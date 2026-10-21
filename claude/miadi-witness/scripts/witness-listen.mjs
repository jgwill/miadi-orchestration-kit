#!/usr/bin/env node
// witness-listen — wakes the witness seat when something it should see happens. Modelled on
// mia-episode-companion's mia-listen.mjs: `await` runs as a background Bash command and exits
// on the first events, which re-invokes the seat with this script's output.
//
// Three events wake the seat:
//   input   a new closed <input ...>…</input> block in ~/workspace/scratchpads/SCRATCHPAD-*.md
//   thread  a thread of this seat seen for the first time (binding lines and the registry)
//   idle    a thread of this seat, or one named with --watch, went from busy to idle
//
// What was present when the seat first listened is its baseline and never wakes it. State is
// one file per seat: $WITNESS_STATE_DIR, else $XDG_STATE_HOME/miadi-witness/<seat>.json.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultPaths, snapshot } from "../service/threads.mjs";
import { asksDir, readLedger } from "./asks-lib.mjs";

const SCRIPT = fileURLToPath(import.meta.url);
const STATE_VERSION = 1;
const EXIT_USAGE = 2;
const EXIT_TIMEOUT = 4;
const EXIT_BUSY = 5;
const HEARTBEAT_STALE_MS = 120_000;
const BLOCK_CHARS = 4000;
const MESSAGE_CHARS = 700;

// A scratchpad that was saved in the last few minutes is still being written: its blocks wait until it has been
// quiet this long, so each save does not wake the seat (2026-10-21, William). WITNESS_SETTLE_MS overrides it.
const TURN_OVER = new Set(["idle", "shell"]);

const settleMs = () => Number(process.env.WITNESS_SETTLE_MS ?? 180_000);

// ---------- sources ----------

export function scratchpadsDir(env = process.env) {
  return env.WITNESS_SCRATCHPADS_DIR || join(homedir(), "workspace", "scratchpads");
}

const sha = (text) => createHash("sha256").update(text).digest("hex");

// A block keeps its identity while William edits its body, so only a block that is new
// wakes the seat: the key is the file, the opening tag and the first non-empty body line.
export function parseInputBlocks(text, file) {
  const blocks = [];
  // A block opens at the start of a line; an <input …> quoted inside a sentence is a mention.
  // It ends at its </input>, and only before the next opening: an unclosed block above
  // must not swallow the closed one below it (SCRATCHPAD-260929.md, 2026-10-01).
  const opening = /^<input(\s[^>\n]*)?>/gm;
  const openings = [...text.matchAll(opening)];
  let unclosed = 0;
  openings.forEach((open, i) => {
    const end = i + 1 < openings.length ? openings[i + 1].index : text.length;
    const region = text.slice(open.index, end);
    const close = region.indexOf("</input>");
    if (close < 0) {
      unclosed += 1;
      return;
    }
    const match = { 0: region.slice(0, close + "</input>".length), 1: open[1], 2: region.slice(open[0].length, close), index: open.index };
    const openTag = `<input${match[1] ?? ""}>`;
    const body = match[2];
    const firstLine = body.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
    const attrs = {};
    for (const attr of (match[1] ?? "").matchAll(/([\w-]+)=(?:"([^"]*)"|“([^”“]*)[”“]|(\S+))/g)) {
      attrs[attr[1]] = attr[2] ?? attr[3] ?? attr[4];
    }
    blocks.push({
      key: sha(`${file}\n${openTag}\n${firstLine}`).slice(0, 20),
      file,
      openTag,
      attrs,
      text: match[0],
      line: text.slice(0, match.index).split("\n").length,
    });
  });
  return { blocks, unclosed };
}

export function scanScratchpads(dir = scratchpadsDir(), now = Date.now()) {
  if (!existsSync(dir)) return { blocks: [], unsettled: [], unclosed: [] };
  const blocks = [];
  const unsettled = [];
  const unclosed = [];
  for (const name of readdirSync(dir).filter((file) => /^SCRATCHPAD-.*\.md$/.test(file)).sort()) {
    const path = join(dir, name);
    const parsed = parseInputBlocks(readFileSync(path, "utf8"), name);
    const settled = now - statSync(path).mtimeMs >= settleMs();
    for (const block of parsed.blocks) (settled ? blocks : unsettled).push({ ...block, path });
    if (parsed.unclosed) unclosed.push({ file: name, count: parsed.unclosed });
  }
  return { blocks, unsettled, unclosed };
}

// The session this script runs under: the registry entry whose pid is one of our ancestors.
export function ownSessionId(threads) {
  const byPid = new Map(Object.values(threads).filter((t) => t.live && t.pid).map((t) => [t.pid, t.session_id]));
  let pid = process.pid;
  for (let depth = 0; depth < 32 && pid > 1; depth += 1) {
    if (byPid.has(pid)) return byPid.get(pid);
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      pid = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
    } catch {
      return null;
    }
  }
  return null;
}

function lastMessage(sessiondata, sessionId) {
  try {
    const record = JSON.parse(readFileSync(join(sessiondata, sessionId, "last_claude_AssistantResponse.json"), "utf8"));
    const text = String(record.last_assistant_message ?? "").trim();
    return text.length > MESSAGE_CHARS ? `${text.slice(0, MESSAGE_CHARS)} … (${text.length} chars)` : text || null;
  } catch {
    return null;
  }
}

// ---------- state ----------

export function stateDir(env = process.env) {
  return env.WITNESS_STATE_DIR || join(env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "miadi-witness");
}

const statePath = (seat) => join(stateDir(), `${seat}.json`);
const heartbeatPath = (seat) => join(stateDir(), `${seat}.listening.json`);

function loadState(seat) {
  try {
    const state = JSON.parse(readFileSync(statePath(seat), "utf8"));
    if (state?.version === STATE_VERSION && Array.isArray(state.inputs) && Array.isArray(state.threads)) return state;
  } catch { /* absent or unreadable: a new baseline is taken */ }
  return null;
}

function saveState(state) {
  mkdirSync(stateDir(), { recursive: true });
  const path = statePath(state.seat);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, path);
}

function statusesOf(threads) {
  return Object.fromEntries(threads.filter((t) => t.live).map((t) => [t.session_id, t.status]));
}

function ensureState(seat, view) {
  const existing = loadState(seat);
  if (existing) return { state: existing, created: false };
  const state = {
    version: STATE_VERSION,
    seat,
    created_at: new Date().toISOString(),
    inputs: view.inputs.blocks.map((block) => block.key),
    threads: [...new Set([...view.seatThreads, ...(view.wakeThreads ?? [])].map((thread) => thread.session_id))],
    statuses: statusesOf(view.watched),
    delivered: [],
  };
  saveState(state);
  return { state, created: true };
}

export function listenerOf(seat) {
  try {
    const beat = JSON.parse(readFileSync(heartbeatPath(seat), "utf8"));
    if (Date.now() - Date.parse(beat.at) > HEARTBEAT_STALE_MS) return null;
    process.kill(beat.pid, 0);
    return beat;
  } catch {
    return null;
  }
}

function beat(seat, since, self) {
  try {
    mkdirSync(stateDir(), { recursive: true });
    writeFileSync(heartbeatPath(seat), `${JSON.stringify({ pid: process.pid, since, session_id: self, at: new Date().toISOString() })}\n`, { mode: 0o600 });
  } catch { /* a heartbeat that cannot be written must not stop the listening */ }
}

function stopBeating(seat) {
  try { rmSync(heartbeatPath(seat), { force: true }); } catch { /* nothing to remove */ }
}

// ---------- the view and its events ----------

// onlyWatched: a seat that witnesses a few sessions (a circle, a peer) wakes for those sessions
// and their forks, and for nothing else of the seat. Every seat thread is still recorded as seen,
// so a listener started later without the flag does not wake on a backlog.
export function view({ seat, watch = [], self = null, onlyWatched = false }) {
  const model = snapshot(defaultPaths());
  const threads = Object.values(model.threads);
  const seatThreads = threads.filter((thread) => thread.seat === seat && thread.session_id !== self);
  const named = new Set();
  for (const wanted of watch) {
    const hit = threads.find((thread) => thread.session_id === wanted || thread.session_id.startsWith(wanted) || thread.names.includes(wanted));
    if (hit && hit.session_id !== self) named.add(hit.session_id);
  }
  // a session named with --watch is already known to whoever named it, so only its forks are news
  const wakeThreads = onlyWatched
    ? threads.filter((thread) => thread.session_id !== self && !named.has(thread.session_id) && named.has(thread.parent?.session_id))
    : seatThreads;
  const watchedIds = new Set([...named, ...wakeThreads.map((thread) => thread.session_id)]);
  const watched = threads.filter((thread) => watchedIds.has(thread.session_id));
  const inputs = scanScratchpads();
  // An input block is addressed by tmux_session_original_name. A scoped listener wakes only for
  // blocks addressed to a watched session or its forks; every block is still recorded as seen.
  const watchedNames = new Set(watched.flatMap((thread) => [...(thread.names ?? []), thread.tmux?.session].filter(Boolean)));
  // A block marked status="drafting" is William's unfinished work: it is recorded as seen but does not wake the seat.
  // Changing its status to anything else changes its opening tag, so the block is new again and wakes once.
  const ready = inputs.blocks.filter((block) => !/draft/i.test(block.attrs?.status ?? ""));
  const wakeInputs = onlyWatched
    ? ready.filter((block) => watchedNames.has(block.attrs?.tmux_session_original_name))
    : ready;
  return { model, seatThreads, wakeThreads, watched, inputs, wakeInputs };
}

export function eventsOf(state, current) {
  const events = [];
  const seenInputs = new Set(state.inputs);
  for (const block of current.wakeInputs ?? current.inputs.blocks) if (!seenInputs.has(block.key)) events.push({ kind: "input", block });
  const seenThreads = new Set(state.threads);
  for (const thread of current.wakeThreads ?? current.seatThreads) if (!seenThreads.has(thread.session_id)) events.push({ kind: "thread", thread });
  for (const thread of current.watched) {
    const before = state.statuses[thread.session_id];
    // "shell" is a turn that ended with a background command still running (a listener, a build):
    // the session is at its prompt, so for the witness its turn is over exactly as for "idle".
    if (before === "busy" && thread.live && TURN_OVER.has(thread.status)) events.push({ kind: "idle", thread, before });
  }
  return events;
}

export function absorb(state, current, events) {
  state.inputs = [...new Set([...state.inputs, ...current.inputs.blocks.map((block) => block.key)])];
  state.threads = [...new Set([...state.threads, ...[...current.seatThreads, ...(current.wakeThreads ?? [])].map((thread) => thread.session_id)])];
  // seat threads too, so a scoped listener leaves no stale "busy" behind for an unscoped one
  state.statuses = { ...state.statuses, ...statusesOf(current.seatThreads), ...statusesOf(current.watched) };
  if (events.length) {
    state.delivered = [...state.delivered, {
      at: new Date().toISOString(),
      events: events.map((event) => ({ kind: event.kind, id: event.block?.key ?? event.thread.session_id })),
    }].slice(-50);
  }
  return state;
}

// ---------- the wake ----------

function describeParent(parent, threads) {
  if (parent?.basis === "fresh") return `fresh (recorded): ${parent.via}`;
  if (!parent?.known) return `parent unknown: ${parent?.reason ?? "no source"}`;
  const name = threads[parent.session_id]?.name ?? parent.session_id;
  return `fork of ${name} (${parent.basis}: ${parent.via})`;
}

function tmuxOf(thread) {
  return thread.tmux ? `tmux ${thread.tmux.session} ${thread.tmux.pane_id ?? ""}`.trim() : "no tmux";
}

export function formatWake({ seat, events, threads, asks, sessiondata, rearm = true, watch = [], onlyWatched = false }) {
  const lines = [`WITNESS WAKE · seat ${seat} · ${events.length} event${events.length === 1 ? "" : "s"} · ${new Date().toISOString()}`, ""];
  events.forEach((event, index) => {
    const n = `${index + 1}.`;
    if (event.kind === "input") {
      const { block } = event;
      const to = block.attrs.tmux_session_original_name ? ` · addressed to ${block.attrs.tmux_session_original_name}` : "";
      const body = block.text.length > BLOCK_CHARS
        ? `${block.text.slice(0, BLOCK_CHARS)}\n… (${block.text.length - BLOCK_CHARS} more chars at ${block.path}:${block.line})`
        : block.text;
      lines.push(`${n} NEW INPUT FROM WILLIAM · ${block.file} line ${block.line}${to}`, "Exact block:", body, "");
    } else if (event.kind === "thread") {
      const t = event.thread;
      lines.push(
        `${n} NEW THREAD · ${t.name ?? "(no name)"} (${t.session_id})`,
        `   ${tmuxOf(t)} · status ${t.status} · team ${t.team?.id ?? "?"}`,
        `   ${describeParent(t.parent, threads)}`,
        `   last input from William: ${t.last_input ? JSON.stringify(t.last_input.text.slice(0, MESSAGE_CHARS)) : "none captured"}`,
        "",
      );
    } else {
      const t = event.thread;
      const said = sessiondata ? lastMessage(sessiondata, t.session_id) : null;
      lines.push(
        `${n} THREAD WENT IDLE · ${t.name ?? "(no name)"} (${t.session_id}) · busy → ${t.status}${t.status_since ? ` at ${t.status_since}` : ""}`,
        `   ${tmuxOf(t)}`,
        `   its last message: ${said ? JSON.stringify(said) : "not captured"}`,
        "",
      );
    }
  });
  const open = asks.filter((ask) => ask.status !== "done");
  lines.push(`Open asks (${open.length}, ledger ${join(asksDir(), `${seat}.json`)}):`);
  for (const ask of open) lines.push(`  ${ask.id} ${ask.status} · ${ask.title}`);
  if (!open.length) lines.push("  none");
  const watchArgs = watch.map((w) => ` --watch "${w}"`).join("") + (onlyWatched ? " --only-watched" : "");
  lines.push(
    "",
    "Turn budget (miadi-witness): this wake carries what an ordinary event needs.",
    "1. Hear from the wake. Read a file only when an event names one the wake does not carry; at most two reads.",
    "2. For each event decide: act yourself, message the thread (only while it is idle), or bring it to William. An input addressed to another thread is to relay or to hold, as the first-impression skill says.",
    "3. Draft the reply to William. Run the witness-editor agent once, with the draft and the open asks above.",
    "4. Revise against every span it returns, then reply. When this turn moved an ask, update it with scripts/asks.mjs.",
  );
  if (rearm) lines.push(`5. Re-arm in the background: node "${SCRIPT}" await --seat ${seat}${watchArgs}`);
  return lines.join("\n");
}

// ---------- commands ----------

function parseArgs(argv) {
  const args = { _: [], seat: "mino", interval: 20, timeout: 0, watch: [], self: undefined, onlyWatched: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--seat") args.seat = argv[++i];
    else if (arg === "--interval") args.interval = Number(argv[++i]);
    else if (arg === "--timeout") args.timeout = Number(argv[++i]);
    else if (arg === "--watch") args.watch.push(argv[++i]);
    else if (arg === "--self") args.self = argv[++i];
    else if (arg === "--only-watched") args.onlyWatched = true;
    else if (arg === "-h" || arg === "--help") args.help = true;
    else args._.push(arg);
  }
  return args;
}

const USAGE = `usage: witness-listen.mjs <command> [--seat mino] [--watch <session id or name>]... [--only-watched] [--self <id>|none]
  --only-watched  wake for the --watch sessions and their forks only, not every thread of the seat,
                  and for input blocks addressed to them only
  status   what this seat has seen, what is waiting, whether a listener runs
  peek     print what is waiting as a wake, without marking it seen
  await    block until an event, print the wake, exit 0
           [--interval <sec>=20] [--timeout <sec>=0 (none)] → exit ${EXIT_TIMEOUT} on timeout,
           exit ${EXIT_BUSY} when another process already listens for the seat
Scratchpads: $WITNESS_SCRATCHPADS_DIR, else ~/workspace/scratchpads.
State: $WITNESS_STATE_DIR, else $XDG_STATE_HOME/miadi-witness/<seat>.json.`;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] ?? "status";
  if (args.help || !["status", "peek", "await"].includes(command) || !/^[a-z0-9][a-z0-9-]*$/.test(args.seat)) {
    console.log(USAGE);
    return args.help ? 0 : EXIT_USAGE;
  }
  const sessiondata = defaultPaths().sessiondata;
  const resolveSelf = (model) => (args.self === "none" ? null : args.self ?? ownSessionId(model.threads));

  let current = view({ seat: args.seat, watch: args.watch, onlyWatched: args.onlyWatched });
  const self = resolveSelf(current.model);
  if (self) current = view({ seat: args.seat, watch: args.watch, self, onlyWatched: args.onlyWatched });
  const { state, created } = ensureState(args.seat, current);
  const asks = () => readLedger(args.seat).asks;

  if (command === "status" || command === "peek") {
    const events = eventsOf(state, current);
    if (command === "peek") {
      console.log(events.length ? formatWake({ seat: args.seat, events, threads: current.model.threads, asks: asks(), sessiondata, rearm: false }) : "witness-listen: nothing waiting");
      return 0;
    }
    const listener = listenerOf(args.seat);
    console.log([
      `witness-listen · seat ${args.seat}${self ? ` · this session ${self}` : ""}`,
      `state: ${statePath(args.seat)}${created ? " (new baseline taken now)" : ""}`,
      `baseline and seen: ${state.inputs.length} input blocks · ${state.threads.length} threads · wakes delivered ${state.delivered.length}`,
      `watching: ${current.watched.map((t) => `${t.name ?? t.session_id} (${t.status})`).join(", ") || "no live thread"}`,
      `listening now: ${listener ? `yes, pid ${listener.pid} since ${listener.since}` : "no"}`,
      `waiting: ${events.length ? events.map((e) => (e.kind === "input" ? `input ${e.block.file}:${e.block.line}` : `${e.kind} ${e.thread.name ?? e.thread.session_id}`)).join(", ") : "nothing"}`,
      ...current.inputs.unclosed.map((u) => `still open: ${u.count} <input> block(s) without </input> in ${u.file}`),
      ...current.inputs.unsettled.map((b) => `settling: ${b.file}:${b.line} (the file changed in the last ${settleMs()} ms)`),
    ].join("\n"));
    return 0;
  }

  // await: one listener per seat, because the seat's state is one file
  const other = listenerOf(args.seat);
  if (other && other.pid !== process.pid) {
    console.log(`witness-listen: seat ${args.seat} already has a listener, pid ${other.pid}${other.session_id ? ` in session ${other.session_id}` : ""}, since ${other.since}`);
    return EXIT_BUSY;
  }
  const intervalMs = Math.max(1, Number.isFinite(args.interval) ? args.interval : 20) * 1000;
  const deadline = args.timeout > 0 ? Date.now() + args.timeout * 1000 : Infinity;
  const since = new Date().toISOString();
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => { stopBeating(args.seat); process.exit(signal === "SIGINT" ? 130 : 143); });
  }
  process.on("exit", () => stopBeating(args.seat));
  console.error(`witness-listen: listening for seat ${args.seat}${created ? ", baseline taken now" : ""}`);

  let working = state;
  for (;;) {
    beat(args.seat, since, self);
    const events = eventsOf(working, current);
    working = absorb(working, current, events);
    saveState(working);
    if (events.length) {
      console.log(formatWake({ seat: args.seat, events, threads: current.model.threads, asks: asks(), sessiondata, watch: args.watch, onlyWatched: args.onlyWatched }));
      return 0;
    }
    if (Date.now() >= deadline) {
      console.log(`witness-listen: no event in ${args.timeout}s for seat ${args.seat}`);
      return EXIT_TIMEOUT;
    }
    await sleep(current.inputs.unsettled.length ? Math.min(intervalMs, 3000) : intervalMs);
    current = view({ seat: args.seat, watch: args.watch, self, onlyWatched: args.onlyWatched });
  }
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(SCRIPT)) {
  main().then((code) => { process.exitCode = code; }, (error) => {
    console.error(`witness-listen: ${error instanceof Error ? error.stack : String(error)}`);
    process.exitCode = 1;
  });
}

