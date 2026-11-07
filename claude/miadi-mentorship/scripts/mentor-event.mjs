#!/usr/bin/env node
// mentor-event — one mentorship event as a CloudEvents 1.0 JSON envelope.
//
//   node mentor-event.mjs emit <type> [--subject session:<id>] [--data '<json object>'] [--dry-run]
//   node mentor-event.mjs types
//
// emit appends the envelope to <state>/events.jsonl. When MIADI_MENTORSHIP_WEBHOOK_URL is set, it
// also POSTs the envelope there in structured mode (application/cloudevents+json), with
// `Authorization: Bearer $MIADI_MENTORSHIP_WEBHOOK_TOKEN` when that is set. An unset URL means the
// local file only, said once per process on stderr. The token is never printed, and messages name
// only the URL's origin, because a URL can carry a secret too.
//
// --dry-run prints the envelope and writes and sends nothing.
//
// <state> is $MIADI_MENTORSHIP_STATE_DIR, else $XDG_STATE_HOME/miadi-mentorship, else
// ~/.local/state/miadi-mentorship.
//
// Exit: 0 written (and delivered when a URL is set), 2 usage, 4 written but not delivered.

import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, realpathSync } from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const TYPE_PREFIX = "miadi.";

// The vocabulary. The README's table says when each one fires and what its data carries.
// Adding a type is one line here and one row there.
export const TYPES = {
  "mentorship.opened": "the mentor seat starts watching a mentee's sessions",
  "mentee.said": "a new input line in a watched session's capture",
  "mentee.turn_ended": "a new Stop line in a watched session's capture",
  "mentor.supplied": "the seat wrote something useful to the relationship for a person to read",
  "mentor.steer_sent": "the seat typed one steer line into the mentee's pane, after a go and a clear guard",
  "mentee.feedback_written": "a new entry in feedback.md, the mentee's words kept verbatim there",
  "mentor.landed": "the seat committed and pushed what the mentee's session wrote",
};

const NODE_FLOOR = 18; // fetch and AbortSignal.timeout
const POST_TIMEOUT_MS = 10_000;

export const EXIT_USAGE = 2;
export const EXIT_UNDELIVERED = 4;

export class UsageError extends Error {}

const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function stateDir(env = process.env) {
  return (
    text(env.MIADI_MENTORSHIP_STATE_DIR) ??
    join(text(env.XDG_STATE_HOME) ?? join(homedir(), ".local", "state"), "miadi-mentorship")
  );
}

function userName(env) {
  try {
    return userInfo().username;
  } catch {
    return text(env.USER) ?? "unknown";
  }
}

export function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "(unparseable webhook URL)";
  }
}

export function buildEnvelope({ type, subject, data = {}, env = process.env, now = new Date() }) {
  if (!Object.hasOwn(TYPES, type)) {
    throw new UsageError(`unknown type "${type}". Known: ${Object.keys(TYPES).join(", ")}`);
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new UsageError("data must be a JSON object");
  }
  // source = <host>/<user>/<mentor session id>; the session id is left out when it is not known.
  const source = [hostname(), userName(env), text(env.CLAUDE_CODE_SESSION_ID)].filter(Boolean).join("/");
  const envelope = { specversion: "1.0", id: randomUUID(), type: TYPE_PREFIX + type, source };
  if (text(subject)) envelope.subject = text(subject);
  envelope.time = now.toISOString();
  envelope.datacontenttype = "application/json";
  envelope.data = data;
  return envelope;
}

// POST one envelope. Errors are reported by status or error code only: a fetch error message
// can quote the URL.
export async function deliver(envelope, { env = process.env, fetchImpl = globalThis.fetch, timeoutMs = POST_TIMEOUT_MS } = {}) {
  const url = text(env.MIADI_MENTORSHIP_WEBHOOK_URL);
  if (!url) return { sent: false, reason: "no webhook URL" };
  const to = originOf(url);
  const headers = { "content-type": "application/cloudevents+json; charset=utf-8" };
  const token = text(env.MIADI_MENTORSHIP_WEBHOOK_TOKEN);
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? { sent: true, status: res.status, to } : { sent: false, reason: `HTTP ${res.status}`, to };
  } catch (err) {
    const reason =
      err?.name === "TimeoutError" ? `no answer in ${timeoutMs} ms` : (err?.cause?.code ?? err?.name ?? "error");
    return { sent: false, reason, to };
  }
}

const said = new Set();
function once(key, message, log) {
  if (said.has(key)) return;
  said.add(key);
  log(message);
}

const stderr = (m) => process.stderr.write(`${m}\n`);

export async function emitEvent({ type, subject, data, dryRun = false, env = process.env, fetchImpl, log = stderr }) {
  const envelope = buildEnvelope({ type, subject, data, env });
  const file = join(stateDir(env), "events.jsonl");
  const url = text(env.MIADI_MENTORSHIP_WEBHOOK_URL);

  if (dryRun) {
    const where = url ? `would POST to ${originOf(url)}` : "MIADI_MENTORSHIP_WEBHOOK_URL is unset";
    once("dry-run", `mentor-event: dry run, nothing written to ${file} and nothing sent (${where})`, log);
    return { envelope, written: null, delivery: { sent: false, reason: "dry run" } };
  }

  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  appendFileSync(file, `${JSON.stringify(envelope)}\n`, { mode: 0o600 });

  if (!url) {
    once("no-url", `mentor-event: MIADI_MENTORSHIP_WEBHOOK_URL is unset, events are kept only in ${file}`, log);
    return { envelope, written: file, delivery: { sent: false, reason: "no webhook URL" } };
  }
  const delivery = await deliver(envelope, { env, fetchImpl });
  if (!delivery.sent) {
    log(`mentor-event: ${envelope.type} ${envelope.id} not delivered to ${delivery.to} (${delivery.reason}). It is kept in ${file}`);
  }
  return { envelope, written: file, delivery };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = { cmd, positional: [], dryRun: false };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--dry-run") {
      opts.dryRun = true;
      continue;
    }
    const m = /^--(subject|data)(?:=(.*))?$/s.exec(arg);
    if (m) {
      const value = m[2] ?? rest[++i];
      if (value === undefined) throw new UsageError(`--${m[1]} needs a value`);
      opts[m[1]] = value;
      continue;
    }
    if (arg.startsWith("--")) throw new UsageError(`unknown option ${arg}`);
    opts.positional.push(arg);
  }
  return opts;
}

const USAGE = `usage:
  mentor-event.mjs emit <type> [--subject session:<id>] [--data '<json object>'] [--dry-run]
  mentor-event.mjs types`;

/** Refuses loudly below the runtime floor instead of failing later inside fetch. */
export function requireNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < NODE_FLOOR) throw new UsageError(`needs Node ${NODE_FLOOR} or later, found ${process.versions.node}`);
}

async function main(argv) {
  requireNode();
  const opts = parseArgs(argv);
  if (opts.cmd === "types") {
    for (const [type, when] of Object.entries(TYPES)) process.stdout.write(`${TYPE_PREFIX}${type}\t${when}\n`);
    return 0;
  }
  if (opts.cmd !== "emit" || opts.positional.length !== 1) throw new UsageError(USAGE);
  let data = {};
  if (opts.data !== undefined) {
    try {
      data = JSON.parse(opts.data);
    } catch (err) {
      throw new UsageError(`--data is not JSON: ${err.message}`);
    }
  }
  const { envelope, delivery } = await emitEvent({
    type: opts.positional[0],
    subject: opts.subject,
    data,
    dryRun: opts.dryRun,
  });
  process.stdout.write(`${JSON.stringify(envelope)}\n`);
  const undelivered = text(process.env.MIADI_MENTORSHIP_WEBHOOK_URL) && !opts.dryRun && !delivery.sent;
  return undelivered ? EXIT_UNDELIVERED : 0;
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
      stderr(err instanceof UsageError ? err.message : `mentor-event: ${err?.stack ?? err}`);
      process.exitCode = err instanceof UsageError ? EXIT_USAGE : 1;
    },
  );
}
