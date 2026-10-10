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

import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir, hostname, userInfo } from "node:os";
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
    // Every episode that can receive a take, highest number first. A cap of 80 once hid
    // everything below Episode 120, including the one William wanted. A folder without
    // episode.yaml is not listed, because a take cannot be stored there.
    .sort((a, b) => b.number - a.number || b.path.localeCompare(a.path));
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

// mia-listen writes a heartbeat per episode (listenerOf in mia-listen.mjs holds the same
// rules). The page asks for it, so William can see who is in the room: a seat listening,
// a seat answering a take, a seat that has just answered and is re-arming, or nobody.
const LISTENER_STALE_MS = 120_000;
const ANSWERING_STALE_MS = 15 * 60 * 1000;
const AWAY = Object.freeze({ state: "away" });

export function listenerState(dir, episode) {
  try {
    const beat = JSON.parse(readFileSync(join(dir, `${episode}.listening.json`), "utf8"));
    const age = Date.now() - Date.parse(beat.at);
    const takes = Array.isArray(beat.takes) ? beat.takes.filter((take) => /^\d{12}$/.test(take)) : [];
    if (beat.state === "answering") return age > ANSWERING_STALE_MS ? AWAY : { state: "answering", takes };
    if (age > LISTENER_STALE_MS) return AWAY;
    if (beat.state === "answered") return { state: "answered", takes };
    try { process.kill(beat.pid, 0); } catch { return AWAY; }
    return { state: "listening" };
  } catch {
    return AWAY;
  }
}

// The page says when William is recording, so a reply that lands then waits in silence
// and the seat that posts it is told. On 2026-10-08 (Episode 339) a reply started playing
// in the middle of a take and cut it. Held in memory and kept alive by the page's
// heartbeat: a page that goes quiet stops counting as recording.
const RECORDING_STALE_MS = 45_000;

// The conversation, one thread: William's takes and Mia's replies in the order they
// happened. A sent take used to hide every earlier reply (William, 2026-10-08).
const THREAD_LIMIT = 40;
const TAKE_ID = /^\d{12}$/;

function listTakes(dir) {
  const captures = join(dir, "captures");
  if (!existsSync(captures)) return [];
  return readdirSync(captures, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && TAKE_ID.test(entry.name))
    .map((entry) => {
      const take = entry.name;
      const folder = join(captures, take);
      let at = "";
      try { at = JSON.parse(readFileSync(join(folder, "capture.json"), "utf8")).storedAt || ""; } catch {}
      let text = "";
      try { text = readFileSync(join(folder, `transcription_${take}_EN.txt`), "utf8").trim(); } catch {}
      return { kind: "take", take, at: at || statSync(folder).mtime.toISOString(), text };
    });
}

// The trading chart records spoken notes for labelled examples through /api/takes
// (jgwill/jgtsrc#190, 2026-10-09). It runs on another origin, so these may post.
const CORS_ORIGINS = (process.env.MIADI_PHONE_CAPTURE_CORS_ORIGINS || "https://trading.tail3b11eb.ts.net")
  .split(",").map((origin) => origin.trim()).filter(Boolean);
// A take may say what it is for. A labelling note belongs to its example on the chart,
// not to the conversation, so the listening seat is told not to answer it.
const PURPOSES = new Set(["labelling"]);

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

// The voice layer refuses a voice whose origin cannot be answered. Checking the same
// rules here moves that refusal to the moment the reply is posted, where the seat can
// fix it. On 2026-09-29 a seat posted by hand with a composed { host, tmux } origin,
// the text reached the page, and every tap on Hear Mia ended in a player error.
export function originProblem(origin) {
  if (!origin || typeof origin !== "object") return "the reply carries no origin";
  const missing = ["user", "host", "cwd", "multiplexer"].filter((key) => typeof origin[key] !== "string" || !origin[key]);
  if (missing.length) return `origin is missing ${missing.join(", ")}`;
  if (origin.multiplexer === "tmux") return origin.session ? null : "a tmux origin needs its session";
  if (origin.multiplexer === "herdr") {
    const absent = ["session", "workspace", "pane"].filter((key) => !origin[key]);
    return absent.length ? `a herdr origin needs ${absent.join(", ")}` : null;
  }
  return `origin.multiplexer is "${origin.multiplexer}": the voice layer answers a tmux or herdr seat only`;
}

// tmux numbers its panes again when it restarts. The session-continuity restore resumes
// each Claude session in a new pane of the same named tmux session and writes where on
// the binding line (<root>/data/terminal_bindings.jsonl). A reply keeps the pane it was
// written from, so after a reboot it names a pane that is gone and the voice layer
// refuses it. On 2026-10-07 gaia rebooted: the seat that wrote ten replies from
// episode-339-mia-companion %85 on 2026-10-03 had been resumed in %19 of that session.
//
// The seat is followed only when the binding line shows the same Claude session: the
// named tmux session and pane find who wrote the reply, the session id finds where that
// writer is now, and the live panes confirm it. Without all three this returns null,
// the origin goes unchanged, and the voice layer gives its own reason.
export function followSeat(origin, { panes, bindings, self, at }) {
  if (origin?.multiplexer !== "tmux" || !origin.session || !origin.pane || !Array.isArray(panes)) return null;
  if (origin.host !== self.host || origin.user !== self.user) return null; // another host's panes are not these
  const live = (session, pane) => panes.some((p) => p.session === session && p.pane === pane);
  if (live(origin.session, origin.pane)) return null;
  const written = Date.parse(at);
  const writer = origin.occupantId || bindings.findLast((b) =>
    b.tmux?.session === origin.session && b.tmux?.pane_id === origin.pane && b.event !== "session.end"
    && !(Date.parse(b.at) > written))?.session_id;
  if (!writer) return null;
  const latest = bindings.findLast((b) => b.session_id === writer);
  if (!latest || latest.event === "session.end" || !live(latest.tmux?.session, latest.tmux?.pane_id)) return null;
  return { ...origin, session: latest.tmux.session, pane: latest.tmux.pane_id, occupantId: writer, observedAt: new Date().toISOString() };
}

// This host's live tmux panes, or null when no tmux server answers.
function tmuxPanes() {
  try {
    return execFileSync("tmux", ["list-panes", "-a", "-F", "#{session_name}\t#{pane_id}"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 })
      .split("\n").filter(Boolean).map((line) => {
        const [session, pane] = line.split("\t");
        return { session, pane };
      });
  } catch {
    return null;
  }
}

// The binding line, rooted the way miadi-session-observability's hooks root it.
function bindingLine() {
  const root = process.env.CLAUDE_SESSIONDATA_ROOT || process.env.MIADI_SESSION_DIR || process.env.MIADI_SESSIONDATA_ROOT
    || process.env.SESSION_DATA_ROOT || "/src/_sessiondata";
  const file = join(root, "data", "terminal_bindings.jsonl");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

const POST_WITH_MIA_LISTEN = "Post replies with `mia-listen.mjs reply`, which reads the seat's origin in the same invocation.";

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
  const problem = voiced ? null : originProblem(reply.origin);
  return {
    id: reply.id, episode: reply.episode, take: reply.take, text: reply.text, seat: reply.seat, at: reply.at,
    audio: voiced ? `api/replies/${reply.id}/audio` : null,
    ...(problem ? { unvoiced: `This reply cannot be voiced: ${problem}.` } : {}),
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

// Edge-TTS renders at about the speed of speech, and the voice layer gives one render
// 120 s: on 2026-10-07 a 2181-character reply took 133 s and was refused. A long reply is
// voiced in parts cut at paragraphs, then sentences, then spaces. The engine writes bare
// MPEG frames with no ID3 header, so the parts join by concatenation.
const VOICE_PART_CHARS = 900;
const VOICE_PARTS_AT_ONCE = 4;

export function voiceParts(text, limit = VOICE_PART_CHARS) {
  const pieces = []; // [text, paragraph index]
  text.split(/\n{2,}/).map((para) => para.trim()).filter(Boolean).forEach((para, index) => {
    if (para.length <= limit) { pieces.push([para, index]); return; }
    for (const sentence of (para.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [para]).map((s) => s.trim()).filter(Boolean)) {
      let rest = sentence;
      while (rest.length > limit) {
        const space = rest.lastIndexOf(" ", limit);
        const cut = space > 0 ? space : limit;
        pieces.push([rest.slice(0, cut).trim(), index]);
        rest = rest.slice(cut).trim();
      }
      if (rest) pieces.push([rest, index]);
    }
  });
  const parts = [];
  let previous = -1;
  for (const [piece, index] of pieces) {
    const joint = index === previous ? " " : "\n\n";
    if (parts.length && parts.at(-1).length + joint.length + piece.length <= limit) parts[parts.length - 1] += joint + piece;
    else parts.push(piece);
    previous = index;
  }
  return parts;
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

// How long a posted reply waits for its voice, so the seat hears a refusal while it can
// still fix it. A longer render finishes after the answer, and the page plays it then.
const VOICE_AT_POST_MS = 20_000;

export function createApp({
  service, chronicleRoot, uploadsDir, repliesDir, listenerDir, voice = null, defaultEpisode = "",
  locate = () => null, log = () => {},
}) {
  const serial = serializer();
  const voicing = new Map(); // reply id → in-flight synthesis, so two taps make one voice
  const recorders = new Map(); // episode → { recording, since, seen }

  function recorderState(episode) {
    const seen = recorders.get(episode);
    if (!seen || !seen.recording || Date.now() - seen.seen > RECORDING_STALE_MS) return { recording: false };
    return { recording: true, since: seen.since };
  }

  async function postRecorder(req) {
    const body = await readJson(req);
    episodeDir(chronicleRoot, body.episode);
    const recording = body.recording === true;
    const before = recorders.get(body.episode);
    const now = Date.now();
    recorders.set(body.episode, {
      recording,
      since: recording && before?.recording ? before.since : new Date(now).toISOString(),
      seen: now,
    });
    return { success: true, episode: body.episode, ...recorderState(body.episode) };
  }

  function listThread(url) {
    const episode = url.searchParams.get("episode") || defaultEpisode;
    const dir = episodeDir(chronicleRoot, episode);
    const replies = readReplies(repliesDir, episode).map((reply) => ({ kind: "reply", ...publicReply(reply, repliesDir) }));
    const items = [...listTakes(dir), ...replies]
      .sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0))
      .slice(-THREAD_LIMIT);
    return { success: true, episode, presence: listenerState(listenerDir, episode), recorder: recorderState(episode), items };
  }

  // One voice per reply, rendered once and cached as a file on this host.
  function render(reply) {
    if (!voicing.has(reply.id)) {
      voicing.set(reply.id, (async () => {
        const moved = locate(reply.origin, reply.at);
        if (moved) log(`reply ${reply.id}: its seat moved from ${reply.origin.session} ${reply.origin.pane} to ${moved.session} ${moved.pane} (Claude session ${moved.occupantId})`);
        const parts = voiceParts(speakable(reply.text));
        const voiced = [];
        for (let at = 0; at < parts.length; at += VOICE_PARTS_AT_ONCE) {
          voiced.push(...await Promise.all(parts.slice(at, at + VOICE_PARTS_AT_ONCE).map((text) => voice.render({
            text,
            episode: reply.episode,
            persona: "mia",
            lang: "en",
            source: "phone-capture",
            origin: moved ?? reply.origin,
          }))));
        }
        mkdirSync(join(repliesDir, "audio"), { recursive: true });
        writeFileSync(join(repliesDir, "audio", `${reply.id}.mp3`), Buffer.concat(voiced), { mode: 0o600 });
      })().finally(() => voicing.delete(reply.id)));
    }
    return voicing.get(reply.id);
  }

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
    // Told to the seat that posts: while William records, the reply shows on his page and
    // waits in silence until he has sent his take.
    const recording = recorderState(reply.episode).recording ? { recording: true } : {};
    // The text is kept either way: William can still read and copy it.
    const problem = originProblem(reply.origin);
    if (problem) return { success: true, id: reply.id, ...recording, unvoiced: `${problem}. ${POST_WITH_MIA_LISTEN}` };
    if (!voice) return { success: true, id: reply.id, ...recording };
    // Voiced now, while the pane that wrote it is the pane its origin names. The mp3 is a
    // file on this host, so a later reboot that renumbers the panes cannot take it away.
    let timer;
    const refused = await Promise.race([
      render(reply).then(() => "", (error) => {
        const reason = error instanceof Error ? error.message : String(error);
        log(`reply ${reply.id}: not voiced: ${reason}`);
        return reason;
      }),
      new Promise((done) => { timer = setTimeout(done, VOICE_AT_POST_MS, ""); }),
    ]).finally(() => clearTimeout(timer));
    return { success: true, id: reply.id, ...recording, ...(refused ? { unvoiced: `the voice layer refused: ${refused}` } : {}) };
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
    const presence = listenerState(listenerDir, episode);
    return { success: true, episode, listening: presence.state !== "away", presence, recorder: recorderState(episode), replies };
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
    const problem = originProblem(reply.origin);
    if (problem) throw new Refusal(422, `this reply cannot be voiced: ${problem}. ${POST_WITH_MIA_LISTEN}`);
    try {
      await render(reply);
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

    const purpose = url.searchParams.get("purpose") || "";
    if (purpose && !PURPOSES.has(purpose)) throw new Refusal(400, `unknown purpose: ${purpose}`);
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
        if (purpose) {
          const takeDir = join(episodeDir(chronicleRoot, episode), "captures", stopped.tlid);
          mkdirSync(takeDir, { recursive: true });
          writeFileSync(join(takeDir, "purpose.json"), `${JSON.stringify({ purpose, at: new Date().toISOString() })}\n`);
        }
        const presence = listenerState(listenerDir, episode);
        return {
          success: true,
          episode,
          take: stopped.tlid,
          filename: stopped.filename,
          bytes: upload.bytes,
          bundle: assigned.bundle,
          listening: presence.state !== "away",
          presence,
          registered: assigned.registered,
          english,
          ...(purpose ? { purpose } : {}),
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
      if (url.pathname === "/api/takes" && req.headers.origin) {
        const allowed = CORS_ORIGINS.includes(req.headers.origin);
        if (allowed) {
          res.setHeader("access-control-allow-origin", req.headers.origin);
          res.setHeader("vary", "origin");
        }
        if (req.method === "OPTIONS") {
          if (!allowed) throw new Refusal(403, `origin not allowed: ${req.headers.origin}`);
          res.writeHead(204, {
            "access-control-allow-methods": "POST",
            "access-control-allow-headers": "content-type",
            "access-control-max-age": "600",
          }).end();
          return;
        }
      }
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
      if (url.pathname === "/api/recorder") {
        if (req.method === "POST") { sendJson(res, 200, await postRecorder(req)); return; }
        if (req.method === "GET") {
          const episode = url.searchParams.get("episode") || defaultEpisode;
          episodeDir(chronicleRoot, episode);
          sendJson(res, 200, { success: true, episode, ...recorderState(episode) });
          return;
        }
      }
      if (req.method === "GET" && url.pathname === "/api/thread") {
        sendJson(res, 200, listThread(url));
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
          // Render on demand, so a play started inside the tap does not need a second one.
          if (!existsSync(file)) await voiceReply(id);
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
    listenerDir: process.env.MIADI_MIA_COMPANION_STATE_DIR
      || join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "miadi-mia-companion"),
    voice: await voiceLayer(),
    defaultEpisode: process.env.MIADI_PHONE_CAPTURE_EPISODE || "",
    locate: (origin, at) => followSeat(origin, {
      panes: tmuxPanes(), bindings: bindingLine(), self: { host: hostname(), user: userInfo().username }, at,
    }),
    log: (line) => console.log(`[phone-capture] ${line}`),
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
