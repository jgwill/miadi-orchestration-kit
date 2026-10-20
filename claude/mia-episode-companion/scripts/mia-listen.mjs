#!/usr/bin/env node
// mia-listen — wakes a Claude Code session when William's next voice take lands in
// an episode's captures/. The Claude Code counterpart of the Pi episode-companion
// observer in Episode 339 (.pi/extensions/episode-companion/observer.cjs). That
// observer stays canonical for the capture contract this file re-implements:
// miadi.episode-capture.v1, byte and SHA-256 receipts on every transcription
// output, a validated English translation, raw audio never read.
//
// What differs: Pi holds a poll inside its session and injects a user message.
// Claude Code cannot, so `await` is run as a background Bash command and exits on
// the first new take, which re-invokes the session with this script's output.
// Takes recorded on the phone reach gaia through git, so `origin/<branch>` is read
// from the object store (fetch, never merge) beside the working tree.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  accessSync, constants as fsConstants, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import { basename, delimiter, join, posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const JEV_CHECK = resolve(SCRIPT, "..", "jev-check.mjs");
const CAPTURE_SCHEMA = "miadi.episode-capture.v1";
const STATE_VERSION = 1;
const STABILITY_POLL_MS = 3_000;
// A take this fresh at a first baseline is waiting for the seat starting now.
const CATCH_UP_MS = 15 * 60 * 1000;

const EXIT_NO_EPISODE = 2;
const EXIT_UNDELIVERED = 3;
const EXIT_TIMEOUT = 4;

// ---------- capture validation ----------

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function blocked(takeId, blocker) {
  return { ok: false, takeId, blocker };
}

function message(error) {
  return error instanceof Error ? error.message.split("\n")[0] : String(error);
}

// readOutput(relativePath) returns the bytes of one declared transcription output or throws.
export function validateBundle({ takeId, episodeFolder, captureBytes, readOutput }) {
  let meta;
  try {
    meta = JSON.parse(captureBytes.toString("utf8"));
  } catch (error) {
    return blocked(takeId, `capture.json is not valid JSON: ${message(error)}`);
  }
  if (meta?.schema !== CAPTURE_SCHEMA) return blocked(takeId, `capture schema is not ${CAPTURE_SCHEMA}`);
  if (meta?.episode?.path !== episodeFolder) {
    return blocked(takeId, `capture belongs to ${String(meta?.episode?.path ?? "no episode")}, not ${episodeFolder}`);
  }

  const outputs = meta?.transcription?.outputs;
  if (!Array.isArray(outputs) || outputs.length === 0) return blocked(takeId, "capture declares no transcription outputs");

  const validated = [];
  for (const output of outputs) {
    const language = String(output?.language ?? "");
    const filename = String(output?.filename ?? "");
    const relativePath = String(output?.relativePath ?? "");
    const bytes = Number(output?.bytes);
    const expected = String(output?.sha256 ?? "").toLowerCase();

    const safePath = relativePath.startsWith(`captures/${takeId}/`)
      && posix.normalize(relativePath) === relativePath
      && !relativePath.split("/").includes("..")
      && posix.basename(relativePath) === filename;
    if (!filename || !safePath) return blocked(takeId, `transcription output ${filename || language || "?"} has an unsafe path`);
    if (!Number.isSafeInteger(bytes) || bytes < 0) return blocked(takeId, `${filename} has an invalid byte receipt`);
    if (!/^[0-9a-f]{64}$/.test(expected)) return blocked(takeId, `${filename} has an invalid SHA-256 receipt`);

    let data;
    try {
      data = readOutput(relativePath);
    } catch (error) {
      return blocked(takeId, `${filename} is not finalized: ${message(error)}`);
    }
    if (data.byteLength !== bytes) return blocked(takeId, `${filename} byte receipt does not match`);
    if (sha256(data) !== expected) return blocked(takeId, `${filename} SHA-256 receipt does not match`);
    validated.push({ language, filename, relativePath, bytes, sha256: expected, text: data.toString("utf8") });
  }

  const english = validated.find((output) => output.language === "en");
  if (!english) return blocked(takeId, "capture has no validated English translation");

  const signature = sha256(JSON.stringify({
    capture: sha256(captureBytes),
    outputs: validated
      .map(({ language, relativePath, sha256: hash }) => ({ language, relativePath, sha256: hash }))
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
  }));

  return {
    ok: true,
    takeId,
    key: `${takeId}:${english.sha256}`,
    signature,
    sourceFilename: String(meta?.source?.filename ?? meta?.transcription?.sourceFilename ?? ""),
    capturedAt: String(meta?.transcription?.timestamp ?? meta?.storedAt ?? ""),
    english,
    outputs: validated.map(({ text: _text, ...rest }) => rest),
  };
}

// ---------- sources ----------

export function scanWorktree(episodeRoot, episodeFolder) {
  const capturesRoot = join(episodeRoot, "captures");
  if (!existsSync(capturesRoot)) return [];
  return readdirSync(capturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((takeId) => {
      const takeRoot = join(capturesRoot, takeId);
      const captureJson = join(takeRoot, "capture.json");
      if (!existsSync(captureJson)) return { ...blocked(takeId, "capture.json has not finalized yet"), source: "worktree" };
      const readOutput = (relativePath) => {
        const canonicalTake = realpathSync(takeRoot);
        const canonical = realpathSync(resolve(episodeRoot, relativePath));
        if (!canonical.startsWith(canonicalTake + sep)) throw new Error("resolves outside its take directory");
        if (!statSync(canonical).isFile()) throw new Error("is not a file");
        return readFileSync(canonical);
      };
      let captureBytes;
      try {
        captureBytes = readFileSync(captureJson);
      } catch (error) {
        return { ...blocked(takeId, `capture.json is unreadable: ${message(error)}`), source: "worktree" };
      }
      return { ...validateBundle({ takeId, episodeFolder, captureBytes, readOutput }), source: "worktree" };
    });
}

function git(cwd, args, { encoding = "utf8", timeout = 60_000 } = {}) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding, timeout, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024,
  });
}

function gitContext(episodeRoot) {
  try {
    const prefix = git(episodeRoot, ["rev-parse", "--show-prefix"]).trim();
    let upstream = "origin/main";
    try {
      upstream = git(episodeRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).trim() || upstream;
    } catch { /* detached or no upstream: fall back to origin/main */ }
    const slash = upstream.indexOf("/");
    return { prefix, upstream, remote: upstream.slice(0, slash), branch: upstream.slice(slash + 1) };
  } catch {
    return null;
  }
}

function fetchUpstream(episodeRoot, ctx) {
  try {
    git(episodeRoot, ["fetch", "--quiet", ctx.remote, ctx.branch], { timeout: 90_000 });
    return "";
  } catch (error) {
    return `fetch ${ctx.upstream} failed: ${message(error)}`;
  }
}

const remoteCache = { rev: "", results: [] };

export function scanRemote(episodeRoot, episodeFolder, ctx) {
  let rev;
  try {
    rev = git(episodeRoot, ["rev-parse", ctx.upstream]).trim();
  } catch {
    return [];
  }
  if (rev === remoteCache.rev) return remoteCache.results;

  const catFile = (relativePath) =>
    git(episodeRoot, ["cat-file", "blob", `${rev}:${ctx.prefix}${relativePath}`], { encoding: "buffer" });
  let listing = "";
  try {
    listing = git(episodeRoot, ["ls-tree", "-r", "--name-only", rev, "--", "captures/"]);
  } catch {
    listing = "";
  }
  const takes = listing.split("\n")
    .map((line) => line.match(/^captures\/([^/]+)\/capture\.json$/)?.[1])
    .filter(Boolean)
    .sort();
  const results = takes.map((takeId) => {
    let captureBytes;
    try {
      captureBytes = catFile(`captures/${takeId}/capture.json`);
    } catch (error) {
      return { ...blocked(takeId, `capture.json unreadable on ${ctx.upstream}: ${message(error)}`), source: ctx.upstream };
    }
    return { ...validateBundle({ takeId, episodeFolder, captureBytes, readOutput: catFile }), source: ctx.upstream };
  });
  remoteCache.rev = rev;
  remoteCache.results = results;
  return results;
}

// Union by identity. A take present in both places is reported from the worktree.
function scanAll(episode, { fetch }) {
  const warnings = [];
  const local = scanWorktree(episode.root, episode.folder);
  let remote = [];
  if (episode.git) {
    if (fetch) {
      const warning = fetchUpstream(episode.root, episode.git);
      if (warning) warnings.push(warning);
    }
    remote = scanRemote(episode.root, episode.folder, episode.git);
  }
  const byKey = new Map();
  const blockers = new Map();
  for (const result of [...remote, ...local]) {
    if (result.ok) byKey.set(result.key, result);
    else blockers.set(`${result.takeId}@${result.source}`, result);
  }
  // A blocker is stale once the same take validates somewhere.
  const validTakes = new Set([...byKey.values()].map((result) => result.takeId));
  const liveBlockers = [...blockers.values()].filter((result) => !validTakes.has(result.takeId));
  return {
    takes: [...byKey.values()].sort((a, b) => a.takeId.localeCompare(b.takeId)),
    blockers: liveBlockers,
    warnings,
  };
}

// ---------- episode + state ----------

function findEpisode(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "episode.yaml"))) break;
    const parent = resolve(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
  const manifest = readFileSync(join(dir, "episode.yaml"), "utf8");
  const number = manifest.match(/^episode:\s*(\d+)\s*$/m)?.[1];
  const folder = dir.split(sep).pop();
  return { root: dir, folder, number: number ? Number(number) : undefined, git: gitContext(dir) };
}

export function stateDir() {
  return process.env.MIADI_MIA_COMPANION_STATE_DIR
    || join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "miadi-mia-companion");
}

function statePath(episode) {
  return join(stateDir(), `${episode.folder}.json`);
}

// A heartbeat per episode, so the phone page can say who is in the room. Three states:
//   listening  await is polling. Stale after two minutes, or when its process is gone.
//   answering  await woke on a take and exited; the seat is drafting. Written at the wake
//              and left in place, so the page does not say "nobody is listening" while
//              Mia is answering (William, 2026-09-29). Stale after fifteen minutes.
//   answered   reply posted; the seat re-arms next. Stale after two minutes.
// The re-arm overwrites either of the last two with listening.
export const HEARTBEAT_STALE_MS = 120_000;
export const ANSWERING_STALE_MS = 15 * 60 * 1000;

function heartbeatPath(episode) {
  return join(stateDir(), `${episode.folder}.listening.json`);
}

function writeBeat(episode, fields) {
  try {
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(heartbeatPath(episode), `${JSON.stringify({ ...fields, at: new Date().toISOString() })}\n`, { mode: 0o600 });
  } catch { /* a heartbeat that cannot be written must not stop the seat */ }
}

function beat(episode, since) {
  writeBeat(episode, { state: "listening", pid: process.pid, since });
}

function stopBeating(episode) {
  try { rmSync(heartbeatPath(episode), { force: true }); } catch { /* nothing to remove */ }
}

function loadState(episode) {
  try {
    const state = JSON.parse(readFileSync(statePath(episode), "utf8"));
    if (state?.version === STATE_VERSION && Array.isArray(state.baseline) && Array.isArray(state.delivered)) return state;
  } catch { /* absent or unreadable: a new baseline is taken */ }
  return null;
}

function saveState(episode, state) {
  const path = statePath(episode);
  mkdirSync(stateDir(), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, path);
}

// Takes already present when a seat first listens are its baseline: heard by
// someone before, never a wake for this seat. Except a take from the last few
// minutes: William records, then starts the session in that episode, and that
// take is meant for it. Only a first baseline is affected.
function ensureState(episode, takes) {
  const existing = loadState(episode);
  if (existing) return { state: existing, created: false };
  const fresh = Date.now() - CATCH_UP_MS;
  const state = {
    version: STATE_VERSION,
    episode: episode.folder,
    createdAt: new Date().toISOString(),
    baseline: takes.filter((take) => !(Date.parse(take.capturedAt) > fresh)).map((take) => take.key),
    delivered: [],
    marksHeard: [],
  };
  saveState(episode, state);
  return { state, created: true };
}

export function listenerOf(episode) {
  try {
    const beat = JSON.parse(readFileSync(heartbeatPath(episode), "utf8"));
    const age = Date.now() - Date.parse(beat.at);
    if (beat.state === "answering") return age > ANSWERING_STALE_MS ? null : beat;
    if (age > HEARTBEAT_STALE_MS) return null;
    if (beat.state === "answered") return beat;
    process.kill(beat.pid, 0); // a heartbeat from a process that died is not a listener
    return beat;
  } catch {
    return null;
  }
}

function unheard(state, takes) {
  const heard = new Set([...state.baseline, ...state.delivered]);
  return takes.filter((take) => !heard.has(take.key));
}

// ---------- marks (smcraft Spec 83) ----------
//
// William marks a drawing on his stateloom canvas: elements or an area, a few words, a
// thread of replies. The hub keeps them beside the drawing, `<name>.<smdf|erdf|sqdf>.marks.json`.
// A mark waiting on an agent wakes this seat as a take does. The rules mirror smcraft's
// bridge-protocol/src/stage/marks.ts (readMark, marksWaitingOn, markAnchorText) in plain JS:
// this script has no dependency on stateloom packages. A mark is context, never a reason to
// stop listening: every read here is defensive, and a sidecar that does not read is skipped.
//
// Seen-state sits with the takes' in the episode's state file, as `marksHeard`: one key per
// mark and thread length, `<drawing>#<id>@<replies>`. A reply makes a new key, so a mark
// wakes again when the person adds to it or answers an agent's question. A key is dropped
// once its mark stops waiting (answered, resolved, removed), so a reopened mark wakes again.
// No baseline: a take in the baseline was heard by a seat before, while a mark that waits
// on an agent has, by its own status, been answered by nobody.

const MARK_KINDS = ["comment", "question", "looks_good", "delete"];
const MARK_STATUSES = ["open", "answered", "resolved"];
const MARKS_SIDECAR = /\.(smdf|erdf|sqdf)\.marks\.json$/i;
const SYSTEM_FILE = /\.sysdf\.json$/i;
const DRAWINGS_DEPTH = 3;
const MARK_TEXT_CHARS = 1200;
const THREAD_REPLIES = 10;

const str = (value) => (typeof value === "string" ? value : "");

function markAuthor(value) {
  const o = value && typeof value === "object" ? value : {};
  const role = o.role === "agent" ? "agent" : "person";
  const name = str(o.name) || str(o.id) || (role === "agent" ? "agent" : "someone");
  return { id: str(o.id) || name, name, role };
}

function markRegion(value) {
  if (!value || typeof value !== "object") return null;
  const box = {};
  for (const key of ["x", "y", "width", "height"]) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) return null;
    box[key] = value[key];
  }
  return box.width > 0 && box.height > 0 ? box : null;
}

/** One mark as a reader can trust it, or null when it says nothing (smcraft readMark). */
export function readMark(value) {
  if (!value || typeof value !== "object") return null;
  const id = str(value.id);
  const text = str(value.text).trim();
  if (!id || !text) return null;
  const replies = (Array.isArray(value.replies) ? value.replies : []).flatMap((reply) => {
    const o = reply && typeof reply === "object" ? reply : {};
    const said = str(o.text).trim();
    return said ? [{ author: markAuthor(o.author), text: said, at: str(o.at) }] : [];
  });
  return {
    id,
    kind: MARK_KINDS.includes(value.kind) ? value.kind : "comment",
    elements: (Array.isArray(value.elements) ? value.elements : []).filter((e) => typeof e === "string" && e.length > 0),
    region: markRegion(value.region),
    level: str(value.level),
    text,
    author: markAuthor(value.author),
    at: str(value.at),
    status: MARK_STATUSES.includes(value.status) ? value.status : "open",
    replies,
  };
}

/** smcraft marksWaitingOn(marks, "agent"): a person's open marks, and an agent's marks a person answered. */
export function waitingOnAgent(mark) {
  return (mark.status === "open" && mark.author.role !== "agent") || (mark.status === "answered" && mark.author.role === "agent");
}

/** What a mark points at, in a few words (smcraft markAnchorText). */
export function markAnchor(mark) {
  const parts = [];
  if (mark.elements.length) parts.push(mark.elements.join(", "));
  if (mark.region) {
    const r = mark.region;
    parts.push(`the area ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}${mark.level ? ` inside ${mark.level}` : ""}`);
  }
  return parts.length ? parts.join(" in ") : "the drawing";
}

// Files under the episode's diagrams/ (and a few folders down) whose name matches, relative to
// the episode. `complete` is false when a folder that exists could not be listed.
function drawingFiles(episodeRoot, pattern) {
  const files = [];
  let complete = true;
  const walk = (dir, rel, depth) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if (error?.code !== "ENOENT") complete = false;
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const path = join(dir, entry.name);
      const childRel = `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        if (depth > 0) walk(path, childRel, depth - 1);
      } else if (pattern.test(entry.name)) {
        try {
          if (statSync(path).isFile()) files.push(childRel);
        } catch { /* a dangling link is not a drawing */ }
      }
    }
  };
  walk(join(episodeRoot, "diagrams"), "diagrams", DRAWINGS_DEPTH);
  return { files: files.sort(), complete };
}

/** Every readable mark on the episode's drawings. Never throws. */
export function scanMarks(episodeRoot) {
  const scan = { marks: [], unreadable: [], problems: [], complete: true };
  try {
    const { files, complete } = drawingFiles(episodeRoot, MARKS_SIDECAR);
    scan.complete = complete;
    for (const rel of files) {
      const drawing = rel.replace(/\.marks\.json$/i, ".json");
      try {
        const parsed = JSON.parse(readFileSync(join(episodeRoot, rel), "utf8"));
        for (const raw of Array.isArray(parsed?.marks) ? parsed.marks : []) {
          const mark = readMark(raw);
          if (!mark) continue;
          const ref = `${drawing}#${mark.id}`;
          scan.marks.push({ ...mark, drawing, doc: join(episodeRoot, drawing), ref, key: `${ref}@${mark.replies.length}` });
        }
      } catch (error) {
        scan.unreadable.push(drawing);
        scan.problems.push(`${rel} does not read: ${message(error)}`);
      }
    }
  } catch (error) {
    scan.complete = false;
    scan.problems.push(`marks not scanned: ${message(error)}`);
  }
  return scan;
}

function heardMarks(state) {
  return Array.isArray(state.marksHeard) ? state.marksHeard.filter((key) => typeof key === "string") : [];
}

export function unheardMarks(state, scan) {
  const heard = new Set(heardMarks(state));
  return scan.marks.filter((mark) => waitingOnAgent(mark) && !heard.has(mark.key));
}

// The heard keys still worth keeping: marks still waiting at that thread length, and every key
// on a drawing whose sidecar did not read this time (it may be mid-write). Nothing is dropped
// when a folder could not be listed.
export function keptMarks(state, scan) {
  const heard = heardMarks(state);
  if (!scan.complete) return heard;
  const waiting = new Set(scan.marks.filter(waitingOnAgent).map((mark) => mark.key));
  return heard.filter((key) => waiting.has(key) || scan.unreadable.some((drawing) => key.startsWith(`${drawing}#`)));
}

// The system file in the episode that lists this drawing as a member, so the canvas opens it
// inside its system. Empty when none does.
function systemOf(episodeRoot, drawing) {
  try {
    for (const rel of drawingFiles(episodeRoot, SYSTEM_FILE).files) {
      const file = join(episodeRoot, rel);
      try {
        const members = JSON.parse(readFileSync(file, "utf8"))?.members;
        if (Array.isArray(members) && members.some((m) => typeof m?.path === "string" && resolve(file, "..", m.path) === drawing)) return file;
      } catch { /* a system that does not read lists nothing */ }
    }
  } catch { /* no systems */ }
  return "";
}

function clip(text, max) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)} … (${flat.length - max} more chars)` : flat;
}

function shellWord(value) {
  return /^[\w.:@%+=,/-]+$/.test(value) ? value : `'${value.replace(/'/g, "'\\''")}'`;
}

function whyWaiting(mark) {
  const last = mark.replies.at(-1);
  if (mark.author.role === "agent") return `${last?.author.name ?? "someone"} answered a question ${mark.author.name} asked`;
  if (!last) return "new";
  if (last.author.role === mark.author.role) return `${last.author.name} added to it`;
  return "reopened";
}

export function markLines(mark) {
  const lines = [
    `mark ${mark.id} · ${mark.drawing} · ${mark.kind.replace(/_/g, " ")} by ${mark.author.name}${mark.at ? `, ${mark.at}` : ""} · ${whyWaiting(mark)}`,
    `  on ${markAnchor(mark)}${mark.elements.length && mark.level ? ` (inside ${mark.level})` : ""}`,
    `  "${clip(mark.text, MARK_TEXT_CHARS)}"`,
  ];
  if (mark.replies.length) {
    lines.push("  thread:");
    const shown = mark.replies.slice(-THREAD_REPLIES);
    if (shown.length < mark.replies.length) lines.push(`    (${mark.replies.length - shown.length} earlier replies)`);
    for (const reply of shown) {
      lines.push(`    ${reply.author.name}${reply.author.role === "agent" ? " (agent)" : ""}${reply.at ? `, ${reply.at}` : ""}: ${clip(reply.text, MARK_TEXT_CHARS)}`);
    }
  }
  return lines;
}

// How Mia answers marks: one act per mark, `reply --mark`, which lands the same words in the
// mark's thread, on his phone page and in the companion thread in her voice, and walks his
// canvas to what he marked (review R3, 2026-10-20). The stop comes first: a step left on the
// stage is cleared before her walk starts. Sent after the replies, it would reach the pages
// while they walk her reply, and a stage stop ends that walk (smcraft bridge-react stage.ts,
// `control` → `stop`). `walk` is false when a take's reply already offers steps.
export const STAGE_STOP = `smcx --bridge "$STATELOOM_BRIDGE_URL" stage control stop`;

function markAnswerLines(episode, marks, { walk = true } = {}) {
  const lines = [
    "Answer each mark with one act, as Mia. Your words go into its thread on the drawing, to his phone page and the companion thread in your voice, and play on his canvas while it lights what he marked.",
    "First in that Bash call, clear any step left on the stage, so it neither covers your walk nor stays on every canvas that opens later:",
    `  ${STAGE_STOP}`,
  ];
  for (const mark of marks) {
    lines.push(
      `  node "${SCRIPT}" reply --mark ${shellWord(mark.id)} --doc "${mark.doc}" --episode "${episode.root}" <<'MIA'`,
      `  <your words for mark ${mark.id}>`,
      "  MIA",
    );
  }
  if (walk) {
    const first = marks[0];
    lines.push(
      "Without --steps, one step lights what he marked while your words play. To walk further, write steps, one sentence or two each, with what to light, and add --steps <that file> to that mark's act (the words on stdin stay the thread's):",
      `  [{"say": "…", "doc": "${first.drawing}", "spotlight": ["${first.elements[0] ?? "state:…"}"]}]`,
    );
  }
  return lines;
}

// ---------- answering a mark (reply --mark) ----------

export const MARK_ID = /^m-[0-9a-z]+$/;
const MIA_AUTHOR = Object.freeze({ id: "mia", name: "Mia", role: "agent" });
// phone-capture keeps 2000 characters of a step's words; a longer answer becomes more steps.
const STEP_SAY_CHARS = 1800;

const sidecarOf = (drawing) => drawing.replace(/\.json$/i, ".marks.json");

function readSidecar(drawing) {
  const sidecar = sidecarOf(drawing);
  let raw;
  try {
    raw = readFileSync(sidecar, "utf8");
  } catch (error) {
    throw new Error(`no marks beside ${drawing}: ${message(error)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${sidecar} does not parse, so it is left as it is: ${message(error)}`);
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.marks)) throw new Error(`${sidecar} holds no list of marks, so it is left as it is`);
  return { sidecar, parsed };
}

/** The mark `id` on the episode's drawings, or on `doc` when given (relative to the episode). Throws with what to do. */
export function findMark(episodeRoot, id, doc) {
  if (doc) {
    const drawing = resolve(episodeRoot, doc.replace(/\.marks\.json$/i, ".json"));
    const { parsed } = readSidecar(drawing);
    const mark = parsed.marks.map(readMark).find((m) => m?.id === id);
    if (!mark) throw new Error(`no mark ${id} on ${basename(drawing)}`);
    const rel = drawing.startsWith(episodeRoot + sep) ? drawing.slice(episodeRoot.length + 1) : drawing;
    return { ...mark, drawing: rel, doc: drawing, ref: `${rel}#${id}` };
  }
  const scan = scanMarks(episodeRoot);
  const found = scan.marks.filter((m) => m.id === id);
  if (found.length === 1) return found[0];
  if (found.length > 1) throw new Error(`mark ${id} is on ${found.map((m) => m.drawing).join(" and ")}: pass --doc <drawing>`);
  const unread = scan.unreadable.length ? ` (${scan.unreadable.join(", ")} did not read)` : "";
  throw new Error(`no mark ${id} on the episode's drawings${unread}: pass --doc <drawing>`);
}

function sayChunks(text, limit = STEP_SAY_CHARS) {
  const pieces = [];
  for (const para of text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    let rest = para;
    while (rest.length > limit) {
      const space = rest.lastIndexOf(" ", limit);
      const cut = space > 0 ? space : limit;
      pieces.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) pieces.push(rest);
  }
  const chunks = [];
  for (const piece of pieces) {
    if (chunks.length && chunks.at(-1).length + 2 + piece.length <= limit) chunks[chunks.length - 1] += `\n\n${piece}`;
    else chunks.push(piece);
  }
  return chunks;
}

/** The walk a mark's answer takes when the seat writes no steps: its words, lighting what was marked. */
export function markSteps(mark, text, system = "") {
  const anchor = {
    doc: mark.doc,
    ...(system ? { system } : {}),
    ...(mark.elements.length ? { spotlight: mark.elements.slice(0, 20) } : {}),
    ...(mark.region ? { region: mark.region } : {}),
  };
  return sayChunks(text).map((say) => ({ say, ...anchor }));
}

/**
 * Mia's words in the mark's thread, written in the sidecar itself: smcraft's replyToMark
 * (bridge-protocol/src/stage/marks.ts) in plain JS. An agent answering a person's mark
 * answers it; a resolved mark stays resolved; the rest of the file is kept as it was.
 * Temp file, then rename. `once` skips a reply already last in the thread with these words.
 */
export function replyInSidecar(drawing, id, words, { at = new Date().toISOString(), once = false } = {}) {
  const said = String(words ?? "").trim();
  if (!said) throw new Error("a reply says something: the words are empty");
  const { sidecar, parsed } = readSidecar(drawing);
  const index = parsed.marks.findIndex((m) => m && typeof m === "object" && m.id === id);
  const mark = index < 0 ? null : readMark(parsed.marks[index]);
  if (!mark) throw new Error(`no mark ${id} on ${basename(drawing)}`);
  const last = mark.replies.at(-1);
  if (once && last && last.author.role === "agent" && last.author.id === MIA_AUTHOR.id && last.text === said) return mark.status;
  const status = mark.status === "resolved" ? "resolved" : MIA_AUTHOR.role !== mark.author.role ? "answered" : "open";
  parsed.marks[index] = { ...parsed.marks[index], status, replies: [...mark.replies, { author: { ...MIA_AUTHOR }, text: said, at }] };
  const tmp = `${sidecar}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(parsed, null, 2)}\n`);
  renameSync(tmp, sidecar);
  return status;
}

export function commandOnPath(name, env = process.env) {
  for (const dir of String(env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    const file = join(dir, name);
    try {
      accessSync(file, fsConstants.X_OK);
      if (statSync(file).isFile()) return file;
    } catch { /* not here */ }
  }
  return "";
}

/**
 * The words into the mark's thread. With smcx on PATH, smcx writes the sidecar and tells the
 * hub in one step, so open canvases update. Without it, or when it fails, the sidecar is
 * written here and the hub is not told: an open canvas shows the answer when it reloads.
 */
export function answerInThread(mark, words, env = process.env) {
  const smcx = commandOnPath("smcx", env);
  let failed = "";
  if (smcx) {
    const bridge = env.STATELOOM_BRIDGE_URL || "";
    try {
      const said = execFileSync(smcx, [...(bridge ? ["--bridge", bridge] : []), "--doc", mark.doc, "--name", "Mia", "marks", "reply", mark.id, "--", words], {
        encoding: "utf8", env, timeout: 30_000, stdio: ["ignore", "pipe", "pipe"],
      });
      const line = said.trim().split("\n").at(-1) ?? "";
      return { ok: true, how: "smcx", told: line.includes(" — ") ? line.split(" — ").slice(1).join(" — ") : line || "smcx said nothing" };
    } catch (error) {
      failed = String(error?.stderr ?? "").trim().split("\n")[0] || message(error);
    }
  }
  try {
    replyInSidecar(mark.doc, mark.id, words, { once: Boolean(failed) });
    return {
      ok: true, how: "sidecar",
      told: failed
        ? `smcx failed (${failed}), so the sidecar was written directly and the hub was not told`
        : "smcx is not on PATH, so the sidecar was written directly and the hub was not told: an open canvas shows it when it reloads",
    };
  } catch (error) {
    return { ok: false, error: `${failed ? `smcx failed (${failed}), and ` : ""}${message(error)}` };
  }
}

function voiceWords(answer) {
  if (answer.voiced === true) return "voiced";
  if (answer.unvoiced) return `not voiced: ${answer.unvoiced}`;
  if (answer.voiced === false) return "voice still rendering, his page plays it when ready";
  return "voice not reported by phone-capture";
}

// ---------- output ----------

function episodeLabel(episode) {
  return episode.number ? `episode ${episode.number} (${episode.folder})` : episode.folder;
}

const CONTEXT_CHARS = 700;

// What Mia would otherwise go looking for, bounded: the companion ceremony's latest
// note (the one carrying a thread ledger, else the most recently touched) and the
// threads still open. A wake that carries this spares a turn of exploration.
export function wakeContext(episodeRoot) {
  const ceremoniesRoot = join(episodeRoot, "ceremonies");
  if (!existsSync(ceremoniesRoot)) return [];
  const ceremonies = readdirSync(ceremoniesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ceremoniesRoot, entry.name, "notes.md")))
    .map((entry) => {
      const dir = join(ceremoniesRoot, entry.name);
      return {
        id: entry.name,
        dir,
        ledger: existsSync(join(dir, "thread-ledger.json")),
        mtime: statSync(join(dir, "notes.md")).mtimeMs,
      };
    })
    .sort((a, b) => Number(b.ledger) - Number(a.ledger) || b.mtime - a.mtime);
  const ceremony = ceremonies[0];
  if (!ceremony) return [];

  const lines = [];
  const note = readFileSync(join(ceremony.dir, "notes.md"), "utf8").trim();
  if (note) {
    let excerpt = note.slice(0, CONTEXT_CHARS);
    if (note.length > CONTEXT_CHARS) {
      const cut = Math.max(excerpt.lastIndexOf("\n"), excerpt.lastIndexOf(". "));
      if (cut > CONTEXT_CHARS / 2) excerpt = excerpt.slice(0, cut + 1);
      excerpt += ` … (${note.length - excerpt.length} more chars in ceremonies/${ceremony.id}/notes.md)`;
    }
    lines.push(`Latest ceremony note (ceremonies/${ceremony.id}/notes.md):`, excerpt, "");
  }
  if (ceremony.ledger) {
    try {
      const ledger = JSON.parse(readFileSync(join(ceremony.dir, "thread-ledger.json"), "utf8"));
      const open = (ledger.threads ?? []).filter((thread) => ["active", "emerging", "blocked"].includes(thread.state));
      if (open.length) {
        lines.push(`Open threads: ${open.slice(0, 8).map((thread) => `${thread.id} (${thread.state})`).join(", ")}`, "");
      }
    } catch { /* an unreadable ledger is context lost, not a failure to wake */ }
  }
  return lines;
}

// Whether the take's textual records are committed in this checkout, and if not, the
// one command that commits them by name and pushes (integrating once on a refusal).
export function commitLine(episode, take) {
  if (take.source !== "worktree") return `Committed: yes, on ${take.source}.`;
  const takeDir = join(episode.root, "captures", take.takeId);
  const textual = readdirSync(takeDir)
    .filter((name) => name === "capture.json" || name === "transcription.json" || name === "purpose.json" || /^transcription_.*\.txt$/.test(name))
    .sort()
    .map((name) => `captures/${take.takeId}/${name}`);
  const R = `git -C "${episode.root}"`;
  let tracked = false;
  try {
    git(episode.root, ["ls-files", "--error-unmatch", "--", ...textual]);
    tracked = true;
  } catch { /* at least one textual record is untracked or git is absent */ }
  if (tracked) {
    if (!episode.git) return "Committed: yes.";
    try {
      const commit = git(episode.root, ["log", "-1", "--format=%H", "--", ...textual]).trim();
      git(episode.root, ["merge-base", "--is-ancestor", commit, episode.git.upstream]);
      return `Committed: yes, and pushed (on ${episode.git.upstream}).`;
    } catch {
      return `Committed: yes, not yet on ${episode.git.upstream}. Push: ${R} push -q`;
    }
  }
  if (!episode.git) return "Committed: no, and this episode is not in a git checkout.";
  const label = episode.number ? `Episode ${episode.number}` : episode.folder;
  return [
    "Committed: no. Commit its textual records by name, never the audio:",
    `  ${R} add -- ${textual.join(" ")} && ${R} commit -q -m "Store ${take.takeId} in ${label}" && { ${R} push -q || { ${R} pull -q --no-rebase --no-edit && ${R} push -q; }; }`,
  ].join("\n");
}

// A take recorded from the trading chart for a labelled example (jgwill/jgtsrc#190)
// carries purpose.json. It belongs to that example, so the seat records it and does not
// answer it on the phone page.
function purposeLines(episode, take) {
  if (take.source !== "worktree") return [];
  try {
    const { purpose } = JSON.parse(readFileSync(join(episode.root, "captures", take.takeId, "purpose.json"), "utf8"));
    if (purpose !== "labelling") return [];
    return ["  purpose: labelling. A spoken note for a labelled example on the trading chart. It belongs to that example: commit it, and do not answer it on the phone page.", ""];
  } catch {
    return [];
  }
}

// What William's stateloom canvas shows while he speaks (smcraft Spec 83): the drawing,
// the element in hand, where a tour stands, and the marks on that drawing waiting for an
// agent. Read from the hub's `GET /stage/<name>` and the drawing's `.marks.json` beside it.
// Only when STATELOOM_BRIDGE_URL is set; a hub that does not answer in two seconds is a
// wake without the canvas, never a wake held back.
// `skip` names marks the wake already carries in full, so they are not listed twice.
export async function canvasContext(env = process.env, { skip = [], episode = null, marksOnly = false } = {}) {
  const bridge = env.STATELOOM_BRIDGE_URL || env.SMCRAFT_BRIDGE_URL;
  if (!bridge) return [];
  const stage = env.STATELOOM_STAGE || "default";
  let state;
  try {
    const token = env.STATELOOM_BRIDGE_TOKEN || env.SMCRAFT_BRIDGE_TOKEN;
    const response = await fetch(`${bridge.replace(/\/$/, "")}/stage/${encodeURIComponent(stage)}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return [];
    state = await response.json();
  } catch {
    return [];
  }
  const ctx = state?.context;
  if (!ctx?.doc) return [];
  const where = [`${basename(ctx.doc)}${ctx.kind ? ` (${ctx.kind})` : ""}`];
  if (ctx.focus) where.push(`${ctx.focus} in hand`);
  if (ctx.tour) where.push(`tour '${ctx.tour.title ?? ""}' at step ${ctx.tour.index + 1} of ${ctx.tour.count}`);
  const lines = [`On William's canvas (stage '${stage}', reported ${ctx.at ?? "?"}): ${where.join(", ")}.`];
  try {
    const sidecar = ctx.doc.replace(/\.json$/i, ".marks.json");
    const raw = existsSync(sidecar) ? JSON.parse(readFileSync(sidecar, "utf8"))?.marks : [];
    const waiting = (Array.isArray(raw) ? raw : []).map(readMark).filter((m) => m && waitingOnAgent(m) && !skip.includes(m.id));
    for (const m of waiting.slice(0, 6)) {
      lines.push(`  mark ${m.id} · ${m.author.name} on ${m.elements.join(", ") || "an area"}: "${clip(m.text, 300)}"`);
    }
    if (waiting.length) {
      lines.push(
        "  He may be speaking about these. Answer one with one act (its thread, his phone in your voice, his canvas lit):",
        `  node "${SCRIPT}" reply --mark <id> --doc "${ctx.doc}"${episode ? ` --episode "${episode}"` : ""} <<'MIA' … MIA`,
      );
    }
  } catch { /* an unreadable sidecar is context lost, not a failure to wake */ }
  // A mark's one act lights what was marked; a step put on the stage beside it would stay there.
  if (!marksOnly) lines.push("  To point at what you mean in your return: show_step (stateloom MCP) or smcx stage show --say \"…\" --spotlight kind:name.");
  lines.push("");
  return lines;
}

// What William's canvas showed when he recorded a take there (phone-capture keeps it as
// captures/<take>/canvas.json): the drawing, the element in hand, the marks open on it.
// More exact than the canvas at wake time, which may have moved on.
function spokenAtLines(episode, take) {
  if (take.source !== "worktree") return [];
  try {
    const seen = JSON.parse(readFileSync(join(episode.root, "captures", take.takeId, "canvas.json"), "utf8"));
    if (!seen?.doc) return [];
    const parts = [`${basename(seen.doc)}${seen.kind ? ` (${seen.kind})` : ""}`];
    if (seen.focus) parts.push(`${seen.focus} in hand`);
    if (seen.step && typeof seen.step === "object") {
      const place = Number.isInteger(seen.step.index) && Number.isInteger(seen.step.count) ? ` ${seen.step.index + 1} of ${seen.step.count}` : "";
      const said = typeof seen.step.say === "string" && seen.step.say ? `, which said "${seen.step.say.replace(/\s+/g, " ").slice(0, 160)}"` : "";
      parts.push(`while the step${place}${seen.step.title ? ` '${seen.step.title}'` : ""}${seen.step.by ? ` by ${seen.step.by}` : ""} was on screen${said}`);
    }
    if (Array.isArray(seen.spotlight) && seen.spotlight.length) parts.push(`the step lit ${seen.spotlight.join(", ")}`);
    if (Array.isArray(seen.marks) && seen.marks.length) parts.push(`marks open: ${seen.marks.join(", ")}`);
    return [`  spoken at his stateloom canvas, looking at ${parts.join(", ")} (${seen.doc})`, ""];
  } catch {
    return [];
  }
}

// A wake carries the takes, the marks, or both: one turn answers everything that arrived.
export function formatWake(episode, takes, { rearm = true, canvas = [], marks = [] } = {}) {
  const lines = [];
  if (takes.length) lines.push(`NEW TAKE${takes.length > 1 ? "S" : ""} FROM WILLIAM · ${episodeLabel(episode)}`, "");
  for (const take of takes) {
    const elsewhere = take.source !== "worktree" ? ` · read from ${take.source}, not yet in this checkout` : "";
    lines.push(
      `take ${take.takeId} · transcribed ${take.capturedAt || "unknown"}${elsewhere}`,
      ...take.outputs.map((output) => `  ${output.language || "?"}: ${output.relativePath} sha256=${output.sha256}`),
      `  audio (custody only, never read): ${take.sourceFilename || "unknown"}`,
      "",
      ...purposeLines(episode, take),
      ...spokenAtLines(episode, take),
      "English translation, exact validated contents:",
      take.english.text.trim(),
      "",
      commitLine(episode, take),
      "",
    );
  }
  if (marks.length) lines.push(`NEW MARK${marks.length > 1 ? "S" : ""} FROM WILLIAM · ${episodeLabel(episode)}`, "");
  for (const mark of marks) lines.push(...markLines(mark), "");

  const what = takes.length && marks.length ? "take or a mark" : takes.length ? "take" : "mark";
  const heard = takes.length && marks.length
    ? "the take text, each mark's text and thread,"
    : takes.length ? "the take text" : `the mark's text and thread${marks.length > 1 ? " for each mark" : ""}`;
  const then = rearm ? ", then re-arm." : ".";
  lines.push(
    ...wakeContext(episode.root),
    ...canvas,
    ...(takes.length ? ["This is William speaking in the episode. Answer what he says; do not read it as a task list."] : []),
    ...(marks.length ? [`This is William marking ${marks.length > 1 ? "the episode's drawings" : "a drawing of the episode"}. Answer what he marked, in its thread; do not read it as a task list.`] : []),
    `Turn budget (mia-episode-companion skill): this wake carries what an ordinary ${takes.length ? "take" : "mark"} needs.`,
    `1. Hear from the wake. Read a file only if the ${what} names something the wake does not carry; at most two reads.`,
    `2. Draft backstage. Send only ${heard} and the exact draft to the developmental-editor agent, once.`,
    "3. Revise against each recommendation, short enough to say aloud.",
  );
  if (takes.length) {
    lines.push(
      "4. Jev check: pipe the revised return to jev-check (below), with one --fact per thing this turn did. Revise or keep each flag, saying why, backstage. A flag, or a check that cannot run, never blocks delivery.",
      `  node "${JEV_CHECK}" check --episode "${episode.root}" ${takes.map((take) => `--take ${take.takeId}`).join(" ")} --draft - --fact "<what this turn did>" <<'MIA'`,
      "  <the revised return>",
      "  MIA",
      marks.length
        ? `5. In that same message: one Bash call that clears the stage, delivers the return (below), answers each mark with its one act (below), and runs the commit above if one is shown${then}`
        : `5. In that same message: one Bash call that delivers the return (below) and runs the commit above if one is shown${then}`,
      "Deliver the return to William's phone page, which waits for it and can voice it as Mia:",
      `  node "${SCRIPT}" reply ${takes.at(-1).takeId} --episode "${episode.root}" <<'MIA'`,
      "  <the final return, exactly as given>",
      "  MIA",
    );
  } else {
    lines.push(
      "4. Jev check: jev-check reads takes, and this wake carries marks only, so there is no check to run. Note that backstage.",
      `5. In that same message: one Bash call that clears the stage and answers each mark with its one act (below)${then}`,
    );
  }
  if (marks.length) lines.push(...markAnswerLines(episode, marks, { walk: !takes.length }));
  if (takes.length && (canvas.length || marks.length || takes.some((take) => spokenAtLines(episode, take).length))) {
    lines.push(
      "He is at a diagram: you may answer as a walk through it. Write the return as steps, one sentence or two each, with what to light:",
      `  [{"say": "…", "doc": "diagrams/<name>.smdf.json", "spotlight": ["state:…"]}, {"say": "…", "focus": "message:9"}]`,
      `  and add --steps <that file> to the reply above (stdin may then be empty). Each step's words are voiced on their own and play on his canvas while that step is lit; the phone page plays them as one reply.`,
    );
  }
  if (rearm) {
    lines.push(`After your ${takes.length ? "return" : "answer"}, re-arm in the background: node "${SCRIPT}" await --episode "${episode.root}"`);
  }
  return lines.join("\n");
}

function presenceLine(beat) {
  if (!beat) return "no";
  if (beat.state === "answering") {
    const marks = Array.isArray(beat.marks) ? beat.marks.map((id) => `mark ${id}`) : [];
    return `answering ${[...(beat.takes ?? []), ...marks].join(", ")}`;
  }
  if (beat.state === "answered") return "answered, re-arm pending";
  return "yes";
}

function markStatusLines(state, marks) {
  const waiting = marks.marks.filter(waitingOnAgent);
  const fresh = new Set(unheardMarks(state, marks).map((mark) => mark.key));
  return [
    `marks waiting on an agent: ${waiting.length ? `${waiting.length}, ${fresh.size} unheard` : "none"}`,
    ...waiting.map((mark) => `  ${mark.id} · ${mark.drawing} · ${mark.author.name} on ${markAnchor(mark)}: "${clip(mark.text, 160)}" (${fresh.has(mark.key) ? "unheard" : "heard"})`),
    ...marks.problems.map((problem) => `warning: ${problem}`),
  ];
}

function printStatus(episode, state, scan, created, marks) {
  const pending = unheard(state, scan.takes);
  const lastDelivered = state.delivered.at(-1);
  console.log([
    `mia-listen · ${episodeLabel(episode)}`,
    `sources: worktree${episode.git ? ` + ${episode.git.upstream}` : " (not a git checkout)"}`,
    `state: ${statePath(episode)}${created ? " (new baseline taken now)" : ""}`,
    `takes validated: ${scan.takes.length} · baseline ${state.baseline.length} · heard by this seat ${state.delivered.length}`,
    `last heard: ${lastDelivered ?? "none"}`,
    `listening now: ${presenceLine(listenerOf(episode))}`,
    `unheard: ${pending.length ? pending.map((take) => `${take.takeId} (${take.source})`).join(", ") : "none"}`,
    ...scan.blockers.map((result) => `waiting: ${result.takeId}@${result.source}: ${result.blocker}`),
    ...scan.warnings.map((warning) => `warning: ${warning}`),
    ...markStatusLines(state, marks),
  ].join("\n"));
}

// ---------- commands ----------

function parseArgs(argv) {
  const args = { _: [], interval: 20, timeout: 0, fetch: true, episode: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--episode") args.episode = argv[++i];
    else if (arg === "--interval") args.interval = Number(argv[++i]);
    else if (arg === "--timeout") args.timeout = Number(argv[++i]);
    else if (arg === "--no-fetch") args.fetch = false;
    else if (arg === "--related") (args.related ??= []).push(argv[++i] ?? "");
    else if (arg === "--steps") args.steps = argv[++i];
    else if (arg === "--mark") args.mark = argv[++i] ?? "";
    else if (arg === "--doc") args.doc = argv[++i] ?? "";
    else if (arg === "-h" || arg === "--help") args.help = true;
    else args._.push(arg);
  }
  return args;
}

const USAGE = `usage: mia-listen.mjs <command> [--episode <dir>] [--no-fetch]
  status              what this seat has heard and what is waiting, takes and marks
  await               block until an unheard take validates or a mark on the episode's drawings
                      waits on an agent (smcraft Spec 83), print them as one wake, exit 0
                      [--interval <sec>=20] [--timeout <sec>=0 (none)] → exit 4 on timeout
  show <take-id>      print a take as a wake without marking it heard
  heard <take-id>     mark a take heard without printing it
  reply [<take-id>]   post the return on stdin to the phone page (phone-capture on this host);
                      without a take id it is a message that answers no take
                      [--related "<label>=<target>"]... a card under the reply for something it
                      names: a file in the episode, miadi-review:<id>, owner/repo#n, or a URL
                      [--steps <steps.json>] a walk through diagrams on William's stateloom canvas:
                      [{say, doc?, focus?, spotlight?, region?, title?}], each step's words voiced on
                      their own and played while the canvas lights that step; a doc relative to the
                      episode resolves there. With steps, stdin may be empty: the words are theirs
                      [--mark <id> [--doc <drawing>]] answer a mark on the episode's drawings in one
                      act: the reply carries the mark, the same words go into its thread (through
                      smcx, which tells the hub, else written in the sidecar), and without --steps
                      one step lights what was marked
The episode defaults to the nearest directory above the cwd carrying episode.yaml.
State: $MIADI_MIA_COMPANION_STATE_DIR, else $XDG_STATE_HOME/miadi-mia-companion.`;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// Who wrote this reply, read in the same invocation that posts it: the voice layer
// answers a voiced reply to this seat, and a pane id copied from elsewhere would point
// that answer at somebody else's terminal. The Claude session id is the one part a
// reboot does not change: phone-capture follows it on the binding line to the pane the
// restore resumed this seat in.
function currentOrigin() {
  const pane = process.env.TMUX_PANE;
  const occupantId = process.env.CLAUDE_CODE_SESSION_ID;
  let session = "";
  if (pane) {
    try {
      session = execFileSync("tmux", ["display-message", "-p", "-t", pane, "#S"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { /* no tmux server reachable: the pane alone is still a true statement */ }
  }
  return {
    user: userInfo().username,
    host: hostname(),
    cwd: process.cwd(),
    multiplexer: pane ? "tmux" : "none",
    ...(session ? { session } : {}),
    ...(pane ? { pane } : {}),
    ...(occupantId ? { occupantId } : {}),
    observedAt: new Date().toISOString(),
  };
}

async function readStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

// A card under the reply for something it names that William can open (William, Episode 120,
// 2026-10-12: "when you relate to something very important they would be joined on the
// actual reply"). A file in the episode opens in the chronicle room over the tailnet.
export function relatedCard(spec, episode, env = process.env) {
  const at = spec.indexOf("=");
  if (at <= 0) throw new Error(`--related takes "<label>=<target>": ${spec}`);
  const label = spec.slice(0, at).trim();
  const target = spec.slice(at + 1).trim();
  let match;
  if (/^https?:\/\//.test(target)) return { label, href: target, kind: linkKind(target) };
  if ((match = target.match(/^miadi-review:(?:\/\/)?([0-9a-f-]{36})$/))) {
    return { label, href: `https://miadi-review-service.vercel.app/review/${match[1]}`, kind: "review" };
  }
  if ((match = target.match(/^([\w.-]+\/[\w.-]+)#(\d+)$/))) return { label, href: `https://github.com/${match[1]}/issues/${match[2]}`, kind: "issue" };
  const room = String(env.MIADI_URL_BASE_INTERNAL || env.MIADI_URL_BASE || "").replace(/\/$/, "");
  if (!room) throw new Error("set MIADI_URL_BASE_INTERNAL to link a file of the episode");
  const file = target.replace(/^\.?\//, "");
  if (file.split("/").includes("..") || !existsSync(join(episode.root, file))) throw new Error(`no such file in the episode: ${file}`);
  const kind = /\.(svg|png|webp|smdf\.json|erdf\.json|sqdf\.json)$/.test(file) ? "diagram" : "file";
  return { label, href: `${room}/chronicle/${encodeURIComponent(episode.folder)}?file=${encodeURIComponent(file)}`, kind };
}

function linkKind(url) {
  if (url.includes("miadi-review-service")) return "review";
  if (/github\.com\/[^/]+\/[^/]+\/(issues|pull)\//.test(url)) return "issue";
  if (url.includes("claude.ai/")) return "artifact";
  return "link";
}

// The loop that made a return, kept with it: its Jev run, what the check flagged, whether the
// words changed after the check, and what the turn did (the --fact lines). A thumb on the
// reply then validates the loop, not only the words (William, Episode 120, 2026-10-12:
// "a thumbs up could reinforce the loop").
export function loopOf(takeId, text, env = process.env) {
  if (!takeId) return null;
  const ledger = join(env.MIADI_DECISIONS_DIR || join(homedir(), ".miadi", "decisions"), "mia-return.jsonl");
  if (!existsSync(ledger)) return null;
  const records = readFileSync(ledger, "utf8").split("\n").filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  const run = records.filter((r) => r.kind === "mia-return" && Array.isArray(r.takes) && r.takes.includes(takeId)).at(-1);
  if (!run) return null;
  const finalSha = createHash("sha256").update(text).digest("hex");
  return {
    jev_record: run.id,
    run_id: run.run_id ?? null,
    decider: run.decider ?? null,
    flags: (run.answers ?? []).filter((a) => a.flag).map((a) => a.id),
    revised_after_check: run.draft_sha256 ? run.draft_sha256 !== finalSha : null,
    facts: Array.isArray(run.evidence) ? run.evidence.slice(0, 20) : [],
  };
}

// The steps of a reply that walks William through diagrams (smcraft Spec 84). A drawing
// named relative to the episode (`diagrams/wave.smdf.json`) is made absolute here, where
// the episode is known; phone-capture keeps only steps that say something.
export function readSteps(file, episodeRoot) {
  const parsed = JSON.parse(readFileSync(resolve(file), "utf8"));
  const list = Array.isArray(parsed) ? parsed : parsed?.steps;
  if (!Array.isArray(list) || !list.length) throw new Error(`${file} holds no steps: a JSON list of {say, doc?, focus?, spotlight?}`);
  return list.map((step, index) => {
    if (!step || typeof step.say !== "string" || !step.say.trim()) throw new Error(`step ${index + 1} of ${file} says nothing`);
    const out = { ...step };
    for (const key of ["doc", "system"]) {
      if (typeof out[key] === "string" && out[key] && !out[key].startsWith("/")) out[key] = resolve(episodeRoot, out[key]);
    }
    return out;
  });
}

// The names a drawing holds, by kind, as a step lights them (smcraft Spec 83 focus names).
// Read from the file itself, so a step that names what is not there is caught before
// William hears a reply that lights nothing. A kind this does not know is never refused.
export function drawingNames(def, file) {
  const names = new Map();
  const add = (kind, name) => {
    if (typeof name !== "string" || !name) return;
    if (!names.has(kind)) names.set(kind, new Set());
    names.get(kind).add(name);
  };
  if (/\.smdf\.json$/i.test(file)) {
    const walk = (state) => {
      if (!state || typeof state !== "object") return;
      add("state", state.name);
      for (const child of Array.isArray(state.states) ? state.states : []) walk(child);
    };
    for (const child of Array.isArray(def?.state?.states) ? def.state.states : []) walk(child);
    for (const group of Array.isArray(def?.events) ? def.events : []) {
      for (const event of Array.isArray(group?.events) ? group.events : []) add("event", event?.id ?? event?.name);
    }
  } else if (/\.erdf\.json$/i.test(file)) {
    for (const entity of Array.isArray(def?.entities) ? def.entities : []) {
      add("entity", entity?.name);
      for (const attribute of Array.isArray(entity?.attributes) ? entity.attributes : []) add("attribute", `${entity?.name}.${attribute?.name}`);
    }
  } else if (/\.sqdf\.json$/i.test(file)) {
    for (const participant of Array.isArray(def?.participants) ? def.participants : []) add("participant", participant?.name);
    const messages = Array.isArray(def?.messages) ? def.messages : [];
    messages.forEach((message, index) => {
      add("message", String(index + 1));
      add("event", message?.event);
    });
    (Array.isArray(def?.fragments) ? def.fragments : []).forEach((fragment, f) => {
      (Array.isArray(fragment?.messages) ? fragment.messages : []).forEach((message, index) => {
        add("message", `f${f + 1}.${index + 1}`);
        add("event", message?.event);
      });
    });
  }
  return names;
}

/** What is wrong with a reply's steps against its drawings: missing files, names not there. */
export function stepProblems(steps) {
  const problems = [];
  const cache = new Map();
  let doc;
  steps.forEach((step, index) => {
    if (typeof step.doc === "string" && step.doc) doc = step.doc;
    const named = [...(typeof step.focus === "string" && step.focus ? [step.focus] : []), ...(Array.isArray(step.spotlight) ? step.spotlight : [])];
    if (!doc) return;
    if (!cache.has(doc)) {
      try {
        cache.set(doc, drawingNames(JSON.parse(readFileSync(doc, "utf8")), doc));
      } catch (error) {
        cache.set(doc, error instanceof Error ? error : new Error(String(error)));
      }
    }
    const names = cache.get(doc);
    if (names instanceof Error) {
      if (typeof step.doc === "string") problems.push(`step ${index + 1}: ${existsSync(doc) ? `${basename(doc)} does not read as JSON` : `no drawing at ${doc}`}`);
      return;
    }
    for (const name of named) {
      const at = typeof name === "string" ? name.indexOf(":") : -1;
      if (at < 1) continue;
      const kind = name.slice(0, at);
      const known = names.get(kind);
      if (!known || known.has(name.slice(at + 1))) continue;
      const some = [...known].slice(0, 10).join(", ");
      problems.push(`step ${index + 1}: ${basename(doc)} holds no ${name} (its ${kind}s: ${some}${known.size > 10 ? ", …" : ""})`);
    }
  });
  return problems;
}

async function postReply(episode, takeId, text, related = [], steps = [], mark = null) {
  const port = process.env.MIADI_PHONE_CAPTURE_PORT || "8771";
  const origin = currentOrigin();
  const response = await fetch(`http://127.0.0.1:${port}/api/replies`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      episode: episode.folder, take: takeId, text, seat: `claude-code@${origin.host}`, origin,
      ...(related.length ? { related } : {}),
      ...(steps.length ? { steps } : {}),
      ...(mark ? { mark } : {}),
      ...(loopOf(takeId, text) ? { loop: loopOf(takeId, text) } : {}),
    }),
  });
  const answer = await response.json().catch(() => ({}));
  if (!response.ok || !answer.success) throw new Error(answer.error || `HTTP ${response.status}`);
  return answer;
}

// reply --mark: the voiced reply carrying the mark, then the same words in its thread. The
// thread is written even when phone-capture refuses, since that is where he looks; the
// line printed says which half landed, and the exit is 3 unless both did.
async function answerMark(episode, takeId, mark, text, related, given) {
  const steps = given.length ? given : markSteps(mark, text, systemOf(episode.root, mark.doc));
  const words = text || given.map((step) => step.say).join("\n\n");
  let answer = null;
  let undelivered = "";
  try {
    answer = await postReply(episode, takeId, text, related, steps, { id: mark.id, doc: mark.doc });
  } catch (error) {
    undelivered = message(error);
  }
  const thread = answerInThread(mark, words);
  // While the seat answers several marks, the page keeps saying which ones are left.
  const present = listenerOf(episode);
  if (present?.state === "answering" && (answer || thread.ok)) {
    const left = (Array.isArray(present.marks) ? present.marks : []).filter((id) => id !== mark.id);
    if (left.length) writeBeat(episode, { state: "answering", takes: present.takes ?? [], marks: left, since: present.since });
    else writeBeat(episode, { state: "answered", takes: present.takes ?? [], ...(present.marks ? { marks: present.marks } : {}), ...(answer ? { reply: answer.id } : {}) });
  }
  const count = answer?.steps ?? steps.length;
  console.log([
    answer ? `mia-listen: reply ${answer.id}` : `mia-listen: reply not delivered to phone-capture (${undelivered})`,
    answer ? voiceWords(answer) : "not voiced",
    thread.ok
      ? `answers mark ${mark.id} on ${basename(mark.doc)}, in its thread (${thread.how === "smcx" ? `smcx: ${thread.told}` : thread.told})`
      : `mark ${mark.id} on ${basename(mark.doc)} NOT answered in its thread: ${thread.error}`,
    `${count} step${count === 1 ? "" : "s"} for the canvas`,
    ...(answer?.recording ? ["William is recording: it waits silent on his page until he sends his take"] : []),
  ].join(" · "));
  return answer && thread.ok ? 0 : EXIT_UNDELIVERED;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] ?? "status";
  if (args.help || !["status", "await", "show", "heard", "reply"].includes(command)) {
    console.log(USAGE);
    return args.help ? 0 : EXIT_NO_EPISODE;
  }

  const episode = findEpisode(args.episode);
  if (!episode) {
    console.error(`mia-listen: no episode.yaml at or above ${resolve(args.episode)}; pass --episode <episode dir>`);
    return EXIT_NO_EPISODE;
  }

  if (command === "status") {
    const scan = scanAll(episode, { fetch: args.fetch });
    const { state, created } = ensureState(episode, scan.takes);
    printStatus(episode, state, scan, created, scanMarks(episode.root));
    return 0;
  }

  if (command === "reply") {
    // A take id is optional: a message typed to Mia, not spoken, answers no take. Without
    // this path a seat posted to phone-capture by hand, composed its origin, and the voice
    // layer refused to speak it (2026-09-29).
    const takeId = args._[1];
    if (takeId !== undefined && !/^\d{12}$/.test(takeId)) {
      console.error("mia-listen: reply takes an optional 12-digit take id, and the return on stdin");
      return EXIT_NO_EPISODE;
    }
    // --mark: the one act that answers a mark (review R3). The mark is found before anything
    // is posted, so a wrong id or a sidecar that does not parse changes nothing.
    if (args.mark !== undefined && !MARK_ID.test(args.mark)) {
      console.error(`mia-listen: --mark takes a mark id like m-0mvg4iw5pd4sg (got '${args.mark}')`);
      return EXIT_NO_EPISODE;
    }
    if (args.doc !== undefined && args.mark === undefined) {
      console.error("mia-listen: --doc names the drawing of --mark; pass --mark <id> with it");
      return EXIT_NO_EPISODE;
    }
    let mark = null;
    if (args.mark !== undefined) {
      try {
        mark = findMark(episode.root, args.mark, args.doc);
      } catch (error) {
        console.error(`mia-listen: ${message(error)}`);
        return EXIT_NO_EPISODE;
      }
    }
    let steps = [];
    if (args.steps) {
      try {
        steps = readSteps(args.steps, episode.root);
        // A walk that answers a mark starts on the mark's drawing unless it names another.
        if (mark && !steps[0].doc) steps[0] = { ...steps[0], doc: mark.doc };
        const problems = stepProblems(steps);
        if (problems.length) throw new Error(`the steps light what their drawings do not hold, so his canvas would show nothing there. Fix them and send again:\n  ${problems.join("\n  ")}`);
      } catch (error) {
        console.error(`mia-listen: ${message(error)}`);
        return EXIT_NO_EPISODE;
      }
    }
    const text = (await readStdin()).trim();
    if (!text && !steps.length) {
      console.error("mia-listen: reply read no text on stdin (and no --steps)");
      return EXIT_NO_EPISODE;
    }
    let related = [];
    try {
      related = (args.related ?? []).map((spec) => relatedCard(spec, episode));
    } catch (error) {
      console.error(`mia-listen: ${message(error)}`);
      return EXIT_NO_EPISODE;
    }
    if (mark) return answerMark(episode, takeId, mark, text, related, steps);
    try {
      const answer = await postReply(episode, takeId, text, related, steps);
      const present = listenerOf(episode);
      if (present?.state === "answering") writeBeat(episode, { state: "answered", takes: present.takes, ...(present.marks ? { marks: present.marks } : {}), reply: answer.id });
      console.log(`mia-listen: reply${takeId ? ` to ${takeId}` : ""} delivered to the phone page (${answer.id})${answer.steps ? `, with ${answer.steps} step${answer.steps === 1 ? "" : "s"} for the canvas` : ""}`);
      if (answer.recording) console.log("mia-listen: William is recording right now. The reply is on his page, silent, and waits until he has sent his take.");
      if (answer.unvoiced) console.error(`mia-listen: William can read it but not hear it: ${answer.unvoiced}`);
      return 0;
    } catch (error) {
      console.error(`mia-listen: reply not delivered to phone-capture: ${message(error)}. It stays in this conversation.`);
      return EXIT_UNDELIVERED;
    }
  }

  if (command === "show" || command === "heard") {
    const takeId = args._[1];
    const scan = scanAll(episode, { fetch: args.fetch });
    const matches = scan.takes.filter((take) => take.takeId === takeId);
    if (!matches.length) {
      console.error(`mia-listen: no validated take ${takeId ?? "(missing id)"} in ${episodeLabel(episode)}`);
      return EXIT_NO_EPISODE;
    }
    if (command === "show") {
      console.log(formatWake(episode, matches, { rearm: false, canvas: await canvasContext(process.env, { episode: episode.root }) }));
      return 0;
    }
    const { state } = ensureState(episode, scan.takes);
    state.delivered = [...new Set([...state.delivered, ...matches.map((take) => take.key)])];
    saveState(episode, state);
    console.log(`mia-listen: ${takeId} marked heard`);
    return 0;
  }

  // await
  const intervalMs = Math.max(5, Number.isFinite(args.interval) ? args.interval : 20) * 1000;
  const deadline = args.timeout > 0 ? Date.now() + args.timeout * 1000 : Infinity;
  const settling = new Map(); // key → signature seen on the previous poll (worktree only)
  let heldForTake = false; // marks wait one short poll for a take still settling, to wake once
  let firstPoll = true;
  let lastWarning = "";
  const listeningSince = new Date().toISOString();
  let woke = false; // a wake leaves the answering beat for the seat's turn
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => { stopBeating(episode); process.exit(signal === "SIGINT" ? 130 : 143); });
  }
  process.on("exit", () => { if (!woke) stopBeating(episode); });

  for (;;) {
    beat(episode, listeningSince);
    const scan = scanAll(episode, { fetch: args.fetch });
    const { state, created } = ensureState(episode, scan.takes);
    if (firstPoll) {
      console.error(`mia-listen: listening on ${episodeLabel(episode)}${created ? `, baseline of ${state.baseline.length} takes taken now` : ""}`);
      firstPoll = false;
    }
    // Marks never stop the listener: whatever goes wrong reading them is a poll without marks.
    let marks = [];
    let markProblems = [];
    try {
      const markScan = scanMarks(episode.root);
      markProblems = markScan.problems;
      const kept = keptMarks(state, markScan);
      if (kept.length !== heardMarks(state).length) {
        state.marksHeard = kept;
        saveState(episode, state);
      }
      marks = unheardMarks(state, markScan);
    } catch (error) {
      markProblems = [`marks not read: ${message(error)}`];
    }

    const warning = [...scan.warnings, ...markProblems].join("; ");
    if (warning && warning !== lastWarning) console.error(`mia-listen: ${warning}`);
    lastWarning = warning;

    const ready = [];
    let unsettled = 0;
    for (const take of unheard(state, scan.takes)) {
      // A committed take is stable by construction. A take still being written by a
      // recorder on this host must show the same signature on two polls.
      if (take.source !== "worktree" || settling.get(take.key) === take.signature) ready.push(take);
      else {
        settling.set(take.key, take.signature);
        unsettled += 1;
      }
    }
    // A mark that arrives while a take is settling waits for it one short poll, so a take
    // and a mark arriving together make one wake.
    const holdMarks = marks.length && !ready.length && unsettled && !heldForTake;
    if (holdMarks) heldForTake = true;

    if (ready.length || (marks.length && !holdMarks)) {
      state.delivered = [...new Set([...state.delivered, ...ready.map((take) => take.key)])];
      state.marksHeard = [...new Set([...heardMarks(state), ...marks.map((mark) => mark.key)])];
      saveState(episode, state);
      woke = true;
      writeBeat(episode, {
        state: "answering",
        takes: [...new Set(ready.map((take) => take.takeId))],
        ...(marks.length ? { marks: [...new Set(marks.map((mark) => mark.id))] } : {}),
        since: listeningSince,
      });
      console.log(formatWake(episode, ready, { marks, canvas: await canvasContext(process.env, { skip: marks.map((mark) => mark.id), episode: episode.root, marksOnly: !ready.length }) }));
      return 0;
    }
    if (Date.now() >= deadline) {
      console.log(`mia-listen: no new take in ${args.timeout}s on ${episodeLabel(episode)}`);
      return EXIT_TIMEOUT;
    }
    await sleep(settling.size ? Math.min(intervalMs, STABILITY_POLL_MS) : intervalMs);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(SCRIPT)) {
  main().then((code) => { process.exitCode = code; }, (error) => {
    console.error(`mia-listen: ${error instanceof Error ? error.stack : String(error)}`);
    process.exitCode = 1;
  });
}
