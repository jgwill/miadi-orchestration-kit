#!/usr/bin/env node
// mentee-watch — turns a mentee's hook capture into mentorship events.
//
//   node mentee-watch.mjs --session <id> [--session <id>]... [--once] [--dry-run] [--with-text]
//                         [--from-start] [--interval <seconds>] [--root <capture root>]
//
// For each session it reads <root>/<id>/_claude_user_inputs.jsonl and _claude_Stop.jsonl, which
// miadi-session-observability writes for every session on the host, readable by every account.
// It never reads the mentee's ~/.claude, which is not readable by the mentor's account anyway.
//
// A new input line is emitted as mentee.said, a new Stop line as mentee.turn_ended, through
// mentor-event.mjs. Their data carries ids, counts and times only. The mentee's words go into an
// event only with --with-text, as an excerpt of at most 280 characters.
//
// The capture has no timestamp field. The event's `time` is when this script saw the line, and
// `capture_file_mtime` is the last write of the capture file, exact only for its last line.
//
// An input line that starts with "Steer from the witness seat" or "Steer from the mentor seat" was
// typed by a mentor seat, not by the mentee. Its data says origin "steer". Every other input is
// origin "pane": typed at the mentee's prompt, usually by the mentee, though the capture cannot
// prove who.
//
// Offsets (lines already emitted, per session) are kept in <state>/offsets.json. A session seen for
// the first time is a baseline: what it already holds is not news and is not emitted.
// --from-start emits it all once instead. --dry-run prints the envelopes and changes nothing:
// no events file, no POST, no offsets.
//
// --once checks once and exits. Without it the script checks every --interval seconds (default 20)
// until it is stopped.
//
// Exit: 0, 2 usage, 3 a session's capture could not be read, 4 an event was kept but not delivered.

import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { EXIT_UNDELIVERED, EXIT_USAGE, UsageError, emitEvent, requireNode, stateDir } from "./mentor-event.mjs";

const INPUTS = "_claude_user_inputs.jsonl";
const STOPS = "_claude_Stop.jsonl";
const EXCERPT_CHARS = 280;
const STEER_LINE = /^\s*Steer from the (witness|mentor) seat\b/;
const EXIT_UNREADABLE = 3;
const OFFSETS_VERSION = 1;

const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const stderr = (m) => process.stderr.write(`${m}\n`);

/** The capture root, in the order session-observability's lib.sh and mct read it. */
export function sessionDataRoot(env = process.env) {
  return (
    text(env.CLAUDE_SESSIONDATA_ROOT) ??
    text(env.MIADI_SESSION_DIR) ??
    text(env.MIADI_SESSIONDATA_ROOT) ??
    text(env.SESSION_DATA_ROOT) ??
    "/src/_sessiondata"
  );
}

/** Complete lines only: a line still being written has no newline yet and waits for the next check. */
export function readJsonl(file) {
  if (!existsSync(file)) return { records: [], mtime: null };
  const raw = readFileSync(file, "utf8");
  const parts = raw.split("\n");
  parts.pop(); // the text after the last newline: empty, or a line not finished yet
  const records = parts.map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return { unparseable: true };
    }
  });
  return { records, mtime: statSync(file).mtime.toISOString() };
}

function ownerName(path) {
  const { uid } = statSync(path);
  try {
    for (const line of readFileSync("/etc/passwd", "utf8").split("\n")) {
      const f = line.split(":");
      if (Number(f[2]) === uid) return f[0];
    }
  } catch {
    // no passwd file: the uid is the answer
  }
  return String(uid);
}

function excerpt(words) {
  return { excerpt: words.slice(0, EXCERPT_CHARS), excerpt_truncated: words.length > EXCERPT_CHARS };
}

/** The events a session's new lines make, in the order its turns happened. */
export function newEvents({ sid, user, inputs, stops, from, withText }) {
  const position = new Map();
  inputs.records.forEach((rec, i) => {
    if (rec.prompt_id && !position.has(rec.prompt_id)) position.set(rec.prompt_id, i);
  });
  const events = [];
  for (let i = from.inputs; i < inputs.records.length; i++) {
    const rec = inputs.records[i];
    const words = typeof rec.prompt === "string" ? rec.prompt : "";
    const data = {
      session_id: sid,
      mentee_user: user,
      prompt_id: rec.prompt_id ?? null,
      index: i + 1,
      count: inputs.records.length,
      origin: STEER_LINE.test(words) ? "steer" : "pane",
      chars: words.length,
      capture_file_mtime: inputs.mtime,
    };
    if (withText) Object.assign(data, excerpt(words));
    events.push({ key: i, rank: 0, type: "mentee.said", data });
  }
  for (let i = from.stops; i < stops.records.length; i++) {
    const rec = stops.records[i];
    const reply = typeof rec.last_assistant_message === "string" ? rec.last_assistant_message : "";
    const data = {
      session_id: sid,
      mentee_user: user,
      prompt_id: rec.prompt_id ?? null,
      index: i + 1,
      count: stops.records.length,
      reply_chars: reply.length,
      capture_file_mtime: stops.mtime,
    };
    if (withText) Object.assign(data, excerpt(reply));
    // A turn's end sorts after the input that opened it; one with no known input sorts last.
    events.push({ key: position.get(rec.prompt_id) ?? Number.MAX_SAFE_INTEGER, rank: 1, type: "mentee.turn_ended", data });
  }
  return events.sort((a, b) => a.key - b.key || a.rank - b.rank || a.data.index - b.data.index);
}

// ---------- offsets ----------

function loadOffsets(file) {
  if (!existsSync(file)) return {};
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  return parsed?.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {};
}

function saveOffsets(file, sessions) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ version: OFFSETS_VERSION, sessions }, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, file);
}

// ---------- one check ----------

export async function check(opts, offsets, state, log = stderr) {
  const result = { emitted: 0, unreadable: 0, undelivered: 0 };
  for (const sid of opts.sessions) {
    const dir = join(opts.root, sid);
    let inputs;
    let stops;
    let user;
    try {
      statSync(dir);
      user = ownerName(dir);
      inputs = readJsonl(join(dir, INPUTS));
      stops = readJsonl(join(dir, STOPS));
    } catch (err) {
      result.unreadable += 1;
      const why = err?.code ?? err?.name ?? "error";
      if (state.lastError.get(sid) !== why) log(`mentee-watch: cannot read the capture of ${sid} in ${opts.root} (${why}). Nothing is reported for it.`);
      state.lastError.set(sid, why);
      continue;
    }
    if (state.lastError.has(sid)) {
      log(`mentee-watch: the capture of ${sid} is readable again`);
      state.lastError.delete(sid);
    }

    const counts = { inputs: inputs.records.length, stops: stops.records.length };
    const prev = offsets[sid];
    if (!prev && !opts.fromStart) {
      offsets[sid] = { ...counts, baseline_at: new Date().toISOString() };
      log(`mentee-watch: ${sid} (${user}) baseline at ${counts.inputs} inputs and ${counts.stops} turn ends; only what comes after is emitted${opts.dryRun ? " (dry run, not saved)" : ""}`);
      continue;
    }
    const from = prev ?? { inputs: 0, stops: 0 };
    if (counts.inputs < from.inputs || counts.stops < from.stops) {
      offsets[sid] = { ...counts, baseline_at: new Date().toISOString() };
      log(`mentee-watch: the capture of ${sid} is shorter than its offsets (rewritten or rotated); baseline reset, nothing emitted`);
      continue;
    }

    for (const ev of newEvents({ sid, user, inputs, stops, from, withText: opts.withText })) {
      const { envelope, delivery } = await emitEvent({
        type: ev.type,
        subject: `session:${sid}`,
        data: ev.data,
        dryRun: opts.dryRun,
      });
      process.stdout.write(`${JSON.stringify(envelope)}\n`);
      result.emitted += 1;
      // An undelivered event is still in events.jsonl, so the offset moves on; there is no retry yet.
      if (!opts.dryRun && delivery.reason !== "no webhook URL" && !delivery.sent) result.undelivered += 1;
    }
    offsets[sid] = { ...counts, updated_at: new Date().toISOString() };
  }
  return result;
}

// ---------- CLI ----------

function parseArgs(argv, env) {
  const opts = { sessions: [], once: false, dryRun: false, withText: false, fromStart: false, interval: 20, root: sessionDataRoot(env) };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const m = /^--(session|interval|root)(?:=(.*))?$/s.exec(arg);
    if (m) {
      const value = m[2] ?? argv[++i];
      if (value === undefined) throw new UsageError(`--${m[1]} needs a value`);
      if (m[1] === "session") {
        if (!/^[\w.-]+$/.test(value) || value === "." || value === "..") throw new UsageError(`not a session id: ${value}`);
        opts.sessions.push(value);
      } else if (m[1] === "interval") {
        opts.interval = Number(value);
        if (!Number.isFinite(opts.interval) || opts.interval < 2) throw new UsageError("--interval is a number of seconds, 2 or more");
      } else {
        opts.root = value;
      }
      continue;
    }
    if (arg === "--once") opts.once = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--with-text") opts.withText = true;
    else if (arg === "--from-start") opts.fromStart = true;
    else throw new UsageError(`unknown argument ${arg}`);
  }
  if (!opts.sessions.length) {
    throw new UsageError(
      "usage: mentee-watch.mjs --session <id> [--session <id>]... [--once] [--dry-run] [--with-text] [--from-start] [--interval <s>] [--root <dir>]",
    );
  }
  opts.sessions = [...new Set(opts.sessions)];
  return opts;
}

async function main(argv, env = process.env) {
  requireNode();
  const opts = parseArgs(argv, env);
  const offsetsFile = join(stateDir(env), "offsets.json");
  const offsets = loadOffsets(offsetsFile);
  const state = { lastError: new Map() };

  const once = async () => {
    const r = await check(opts, offsets, state);
    if (!opts.dryRun) saveOffsets(offsetsFile, offsets);
    return r;
  };

  if (opts.once) {
    const r = await once();
    stderr(`mentee-watch: ${r.emitted} event(s)${opts.dryRun ? " would be emitted" : " emitted"}, ${r.unreadable} unreadable, ${r.undelivered} undelivered`);
    return r.unreadable ? EXIT_UNREADABLE : r.undelivered ? EXIT_UNDELIVERED : 0;
  }

  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  stderr(`mentee-watch: watching ${opts.sessions.length} session(s) in ${opts.root} every ${opts.interval} s`);
  while (!stopping) {
    await once();
    for (let waited = 0; waited < opts.interval * 1000 && !stopping; waited += 250) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  stderr("mentee-watch: stopped");
  return 0;
}

const isMain = (() => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      stderr(err instanceof UsageError ? err.message : `mentee-watch: ${err?.stack ?? err}`);
      process.exitCode = err instanceof UsageError ? EXIT_USAGE : 1;
    },
  );
}
