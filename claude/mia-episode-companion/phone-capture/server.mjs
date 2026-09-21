#!/usr/bin/env node
// phone-capture — record on the iPhone, land the take in a Chronicle episode on gaia.
//
// The phone records in Safari (MediaRecorder, audio/mp4) and uploads the bytes.
// Everything after the upload is @miadi/capture-service over its file-import
// driver: the take becomes durable in the take library, Groq transcribes it, and
// `assign` binds it to the episode through @miadi/episode-capture as a
// miadi.episode-capture.v1 bundle. The mia-episode-companion listener validates
// exactly that bundle and wakes Mia in the Claude session listening there.
//
// Binds to loopback. `tailscale serve` fronts it with HTTPS, which Safari needs
// before it will open the microphone, and keeps it on the tailnet.

import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CaptureService,
  ConcatSegmentJoiner,
  FileImportDriver,
  GroqTranscriber,
  mimeOf,
  resolveConfig,
  sendJson,
  serveFileRanged,
} from "@miadi/capture-service";

const HERE = fileURLToPath(new URL(".", import.meta.url));
// The code this process is running. ensure.sh hashes the same three files, in the same
// order, and restarts an idle service whose build differs from what is on disk.
const BUILD = createHash("sha256")
  .update(Buffer.concat(["server.mjs", "public/index.html", "package-lock.json"].map((file) => readFileSync(join(HERE, file)))))
  .digest("hex");
const MAX_BYTES = 200 * 1024 * 1024;
const EPISODE_NAME = /^\d{4}-\d{2}-\d{2}-episode-(\d+)-[a-z0-9-]+$/;
// Only containers the Chronicle already gitignores may enter a bundle
// (episodes/CLAUDE.md: raw captures never enter history). iPhone Safari records
// audio/mp4, which lands as .m4a.
const EXTENSIONS = { "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/wav": "wav", "audio/x-wav": "wav" };

class Refusal extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function listEpisodes(chronicleRoot) {
  return readdirSync(chronicleRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && EPISODE_NAME.test(entry.name))
    .filter((entry) => existsSync(join(chronicleRoot, entry.name, "episode.yaml")))
    .map((entry) => ({ path: entry.name, number: Number(entry.name.match(EPISODE_NAME)[1]) }))
    .sort((a, b) => b.path.localeCompare(a.path))
    .slice(0, 80);
}

function episodeDir(chronicleRoot, episode) {
  if (typeof episode !== "string" || !EPISODE_NAME.test(episode)) throw new Refusal(400, "choose an episode");
  const dir = resolve(chronicleRoot, episode);
  if (!dir.startsWith(resolve(chronicleRoot) + sep) || !existsSync(join(dir, "episode.yaml"))) {
    throw new Refusal(404, `no such episode: ${episode}`);
  }
  return dir;
}

async function receive(req, uploadsDir, extension) {
  mkdirSync(uploadsDir, { recursive: true });
  const path = join(uploadsDir, `${randomUUID()}.${extension}`);
  const out = createWriteStream(path, { mode: 0o600 });
  let bytes = 0;
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) throw new Refusal(413, `a take is limited to ${MAX_BYTES / 1024 / 1024} MB`);
      if (!out.write(chunk)) await new Promise((done) => out.once("drain", done));
    }
    await new Promise((done, fail) => out.end((error) => (error ? fail(error) : done())));
  } catch (error) {
    out.destroy();
    await rm(path, { force: true });
    throw error;
  }
  if (bytes === 0) {
    await rm(path, { force: true });
    throw new Refusal(400, "the recording arrived empty");
  }
  return { path, bytes };
}

// William speaks English to Mia (his word, 2026-09-21), so English is assumed.
// capture-service writes one transcript per sidecar field, named by language: spoken
// English would otherwise come out as two outputs both named transcription_<take>_EN.txt,
// the second overwriting the first and breaking its receipt. Spoken English is returned
// as the English text alone. Any other language keeps its original plus the translation.
export class SpokenLanguageTranscriber {
  constructor(inner, language) {
    this.inner = inner;
    this.language = language;
    this.name = `${inner.name}+spoken-${language}`;
  }

  async transcribe(filepath, filename, options = {}) {
    const language = options.language ?? this.language;
    const result = await this.inner.transcribe(filepath, filename, { language });
    if (language !== "en") return result;
    return { ...result, language: "en", transcription: "", translation: result.transcription || result.translation };
  }
}

// ---------- replies ----------
// Mia posts her return here (mia-listen.mjs reply), and the page shows it beside the take.
// One append-only JSONL per episode, with a voice sidecar per reply once it has been heard.

const MAX_REPLY_CHARS = 20_000;

async function readJson(req, limit = 256 * 1024) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) throw new Refusal(413, "request body too large");
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw new Refusal(400, "body is not JSON");
  }
}

// tailscale serve adds these to every request it forwards. A request without them came
// from a process on this host, which is the only place a reply may come from.
function fromThisHost(req) {
  return !req.headers["x-forwarded-for"] && !req.headers["tailscale-user-login"];
}

function readReplies(repliesDir, episode) {
  const file = join(repliesDir, `${episode}.jsonl`);
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function findReply(repliesDir, id) {
  if (!/^[0-9a-f-]{36}$/.test(id) || !existsSync(repliesDir)) return null;
  for (const name of readdirSync(repliesDir).filter((file) => file.endsWith(".jsonl"))) {
    const found = readReplies(repliesDir, name.slice(0, -".jsonl".length)).find((reply) => reply.id === id);
    if (found) return found;
  }
  return null;
}

function publicReply(reply, repliesDir) {
  const voiced = existsSync(join(repliesDir, "audio", `${reply.id}.mp3`));
  return {
    id: reply.id, episode: reply.episode, take: reply.take, text: reply.text, seat: reply.seat, at: reply.at,
    audio: voiced ? `api/replies/${reply.id}/audio` : null,
  };
}

// What a voice reads: the words, without the labels and markup that only a screen needs.
export function speakable(text) {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(🧠|🌸)\s*:?\s*/u, "").replace(/^#+\s*/, "").replace(/^\s*[-*]\s+/, ""))
    .join("\n")
    .replace(/\*\*|__|`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// One take at a time: the capture service holds a single recorder.
function serializer() {
  let tail = Promise.resolve();
  return (work) => {
    const run = tail.then(work, work);
    tail = run.catch(() => {});
    return run;
  };
}

export function createApp({ service, chronicleRoot, uploadsDir, repliesDir, voice = null, defaultEpisode = "" }) {
  const serial = serializer();
  const voicing = new Map(); // reply id → in-flight synthesis, so two taps make one voice

  async function postReply(req) {
    if (!fromThisHost(req)) throw new Refusal(403, "replies are posted from this host only");
    const body = await readJson(req, MAX_REPLY_CHARS * 4 + 8192);
    episodeDir(chronicleRoot, body.episode);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) throw new Refusal(400, "a reply needs text");
    if (text.length > MAX_REPLY_CHARS) throw new Refusal(413, `a reply is limited to ${MAX_REPLY_CHARS} characters`);
    if (body.take !== undefined && !/^\d{12}$/.test(String(body.take))) throw new Refusal(400, "take must be a 12-digit take id");
    const reply = {
      id: randomUUID(),
      episode: body.episode,
      take: body.take === undefined ? null : String(body.take),
      text,
      seat: typeof body.seat === "string" ? body.seat.slice(0, 200) : "",
      origin: body.origin && typeof body.origin === "object" ? body.origin : null,
      at: new Date().toISOString(),
    };
    mkdirSync(repliesDir, { recursive: true });
    appendFileSync(join(repliesDir, `${reply.episode}.jsonl`), `${JSON.stringify(reply)}\n`, { mode: 0o600 });
    return { success: true, id: reply.id };
  }

  function listReplies(url) {
    const episode = url.searchParams.get("episode") || defaultEpisode;
    episodeDir(chronicleRoot, episode);
    const take = url.searchParams.get("take");
    const replies = readReplies(repliesDir, episode)
      .filter((reply) => !take || reply.take === take)
      .reverse()
      .slice(0, 10)
      .map((reply) => publicReply(reply, repliesDir));
    return { success: true, episode, replies };
  }

  // Mia's voice for one reply, through the Miadi voice layer (persona mia, bound to the
  // episode, answering to the seat that wrote the words). Rendered once, then cached so
  // Safari gets byte ranges from a local file.
  async function voiceReply(id) {
    const reply = findReply(repliesDir, id);
    if (!reply) throw new Refusal(404, `no such reply: ${id}`);
    const file = join(repliesDir, "audio", `${id}.mp3`);
    if (existsSync(file)) return { success: true, audio: `api/replies/${id}/audio` };
    if (!voice) throw new Refusal(503, "the voice layer is not configured on this host");
    if (!voicing.has(id)) {
      voicing.set(id, (async () => {
        const bytes = await voice.render({
          text: speakable(reply.text),
          episode: reply.episode,
          persona: "mia",
          lang: "en",
          source: "phone-capture",
          origin: reply.origin,
        });
        mkdirSync(join(repliesDir, "audio"), { recursive: true });
        writeFileSync(file, bytes, { mode: 0o600 });
      })().finally(() => voicing.delete(id)));
    }
    try {
      await voicing.get(id);
    } catch (error) {
      throw new Refusal(502, `the voice layer refused: ${error instanceof Error ? error.message : error}`);
    }
    return { success: true, audio: `api/replies/${id}/audio` };
  }

  async function storeTake(req, url) {
    const episode = url.searchParams.get("episode") || defaultEpisode;
    episodeDir(chronicleRoot, episode);
    const type = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    const extension = EXTENSIONS[type];
    if (!extension) throw new Refusal(415, `record as audio/mp4 (received ${type || "no content type"})`);

    const upload = await receive(req, uploadsDir, extension);
    const recordedBy = String(req.headers["tailscale-user-login"] ?? "") || undefined;
    try {
      return await serial(async () => {
        await service.start({
          import_path: upload.path,
          episode_path: episode,
          source: "phone-capture",
          ...(recordedBy ? { recorded_by: recordedBy } : {}),
        });
        let stopped;
        try {
          stopped = await service.stop({ episode_path: episode });
        } catch (error) {
          throw new Refusal(500, `the take did not finalize: ${error instanceof Error ? error.message : error}`);
        }

        let english = "";
        let transcriptError = "";
        try {
          const transcribed = await service.transcribe({ filename: stopped.filename });
          english = transcribed.transcription.english || transcribed.transcription.translation || "";
        } catch (error) {
          transcriptError = error instanceof Error ? error.message : String(error);
        }
        // Bound either way: the audio is safe in its episode, and a later
        // transcription re-stores the bundle rather than duplicating it.
        const assigned = await service.assign({ filename: stopped.filename, episode_path: episode });
        return {
          success: true,
          episode,
          take: stopped.tlid,
          filename: stopped.filename,
          bytes: upload.bytes,
          bundle: assigned.bundle,
          registered: assigned.registered,
          english,
          ...(transcriptError ? { transcriptError } : {}),
        };
      });
    } finally {
      await rm(upload.path, { force: true });
    }
  }

  return async function handle(req, res) {
    const url = new URL(req.url ?? "/", "http://phone-capture");
    try {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        createReadStream(join(HERE, "public", "index.html")).pipe(res);
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/health") {
        sendJson(res, 200, { success: true, pid: process.pid, build: BUILD, defaultEpisode, capture: service.status() });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/episodes") {
        sendJson(res, 200, { success: true, defaultEpisode, episodes: listEpisodes(chronicleRoot) });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/takes") {
        sendJson(res, 200, await storeTake(req, url));
        return;
      }
      if (url.pathname === "/api/replies") {
        if (req.method === "POST") { sendJson(res, 200, await postReply(req)); return; }
        if (req.method === "GET") { sendJson(res, 200, listReplies(url)); return; }
      }
      const replyRoute = url.pathname.match(/^\/api\/replies\/([0-9a-f-]{36})\/(voice|audio)$/);
      if (replyRoute) {
        const [, id, what] = replyRoute;
        if (what === "voice" && req.method === "POST") { sendJson(res, 200, await voiceReply(id)); return; }
        if (what === "audio" && (req.method === "GET" || req.method === "HEAD")) {
          const file = join(repliesDir, "audio", `${id}.mp3`);
          if (!existsSync(file)) throw new Refusal(404, "this reply has not been voiced yet");
          await serveFileRanged(req, res, file, "audio/mpeg");
          return;
        }
      }
      // The registration uri every take carries answers here.
      const audioPrefix = "/api/captures/audio/";
      if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith(audioPrefix)) {
        const filename = decodeURIComponent(url.pathname.slice(audioPrefix.length));
        const filepath = service.store.takePath(filename);
        if (!existsSync(filepath)) throw new Refusal(404, `no such take: ${filename}`);
        await serveFileRanged(req, res, filepath, mimeOf(filename));
        return;
      }
      throw new Refusal(404, `no such route: ${req.method} ${url.pathname}`);
    } catch (error) {
      const status = error instanceof Refusal ? error.status : Number(error?.status) || 500;
      if (!res.headersSent) sendJson(res, status, { success: false, error: error instanceof Error ? error.message : String(error) });
      else res.destroy();
    }
  };
}

// The Miadi voice layer through its own client: publish, then fetch the rendered mp3.
async function voiceLayer() {
  let createVoiceClient;
  try {
    ({ createVoiceClient } = await import("@miadi/voice-client"));
  } catch {
    return null;
  }
  const base = (process.env.MIADI_API_URL || "http://127.0.0.1:3335").replace(/\/+$/, "");
  const client = createVoiceClient({ baseUrl: base });
  return {
    async render(request) {
      const message = await client.publish(request);
      const url = client.audioUrl(message);
      if (!url) throw new Error("the voice layer produced no audio for this reply");
      // The token goes to the voice layer's own address only, never to a Blob URL.
      const token = process.env.MIADI_API_TOKEN_WRITER;
      const own = url.startsWith(`${base}/`);
      const response = await fetch(url, own && token ? { headers: { authorization: `Bearer ${token}` } } : {});
      if (!response.ok) throw new Error(`audio fetch answered ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    },
  };
}

async function main() {
  const chronicleRoot = process.env.MIADI_CHRONICLE_ROOT;
  if (!chronicleRoot || !existsSync(chronicleRoot)) {
    console.error("phone-capture: MIADI_CHRONICLE_ROOT must name an existing chronicle root");
    process.exit(2);
  }
  const port = Number(process.env.MIADI_PHONE_CAPTURE_PORT || 8771);
  const host = process.env.MIADI_PHONE_CAPTURE_HOST || "127.0.0.1";
  const stateDir = process.env.MIADI_PHONE_CAPTURE_STATE_DIR
    || join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "miadi-phone-capture");
  const publicUrl = process.env.MIADI_PHONE_CAPTURE_PUBLIC_URL || `http://${host}:${port}`;

  const config = resolveConfig(process.env, {
    port,
    host,
    takesDir: process.env.MIADI_CAPTURE_INBOX || join(stateDir, "takes"),
    driver: "file-import",
    publicBaseUrl: publicUrl,
    chronicleRoot,
    device: process.env.MIADI_CAPTURE_DEVICE || "iphone",
    language: process.env.MIADI_CAPTURE_LANGUAGE || "en",
  });
  const service = new CaptureService({
    config,
    driver: new FileImportDriver(),
    joiner: new ConcatSegmentJoiner(),
    transcriber: new SpokenLanguageTranscriber(new GroqTranscriber({ defaultLanguage: config.language }), config.language),
  });
  const flushed = await service.flushPending().catch(() => ({ delivered: 0, remaining: -1 }));

  const handle = createApp({
    service,
    chronicleRoot,
    uploadsDir: join(stateDir, "uploads"),
    repliesDir: join(stateDir, "replies"),
    voice: await voiceLayer(),
    defaultEpisode: process.env.MIADI_PHONE_CAPTURE_EPISODE || "",
  });
  createServer(handle).listen(port, host, () => {
    console.log(`[phone-capture] http://${host}:${port} → ${publicUrl}`);
    console.log(`[phone-capture] chronicle ${chronicleRoot} · takes ${config.takesDir} · wheel ${config.mwApiUrl}`);
    console.log(`[phone-capture] spoken language ${config.language} · groq key ${process.env.GROQ_API_KEY ? "present" : "absent: takes will store without transcript"} · voice token ${process.env.MIADI_API_TOKEN_WRITER ? "present" : "absent"}`);
    if (flushed.delivered || flushed.remaining > 0) {
      console.log(`[phone-capture] pending registrations: ${flushed.delivered} delivered, ${flushed.remaining} queued`);
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
