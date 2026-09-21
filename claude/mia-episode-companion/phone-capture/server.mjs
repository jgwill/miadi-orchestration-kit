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

import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync } from "node:fs";
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

// One take at a time: the capture service holds a single recorder.
function serializer() {
  let tail = Promise.resolve();
  return (work) => {
    const run = tail.then(work, work);
    tail = run.catch(() => {});
    return run;
  };
}

export function createApp({ service, chronicleRoot, uploadsDir, defaultEpisode = "" }) {
  const serial = serializer();

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
        sendJson(res, 200, { success: true, defaultEpisode, capture: service.status() });
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
  });
  const service = new CaptureService({
    config,
    driver: new FileImportDriver(),
    joiner: new ConcatSegmentJoiner(),
    transcriber: new GroqTranscriber({ defaultLanguage: config.language }),
  });
  const flushed = await service.flushPending().catch(() => ({ delivered: 0, remaining: -1 }));

  const handle = createApp({
    service,
    chronicleRoot,
    uploadsDir: join(stateDir, "uploads"),
    defaultEpisode: process.env.MIADI_PHONE_CAPTURE_EPISODE || "",
  });
  createServer(handle).listen(port, host, () => {
    console.log(`[phone-capture] http://${host}:${port} → ${publicUrl}`);
    console.log(`[phone-capture] chronicle ${chronicleRoot} · takes ${config.takesDir} · wheel ${config.mwApiUrl}`);
    console.log(`[phone-capture] groq key ${process.env.GROQ_API_KEY ? "present" : "absent: takes will store without transcript"}`);
    if (flushed.delivered || flushed.remaining > 0) {
      console.log(`[phone-capture] pending registrations: ${flushed.delivered} delivered, ${flushed.remaining} queued`);
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
