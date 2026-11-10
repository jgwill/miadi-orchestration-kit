#!/usr/bin/env node
// inventory-at-exit — how a session's record gets its meaning when the session ends (C7 of
// miadiRun-2611101620-t1-mino-capabilities-repos-2611101558-inventory-at-exit.v1).
//
// Guillaume, 2026-11-10: "I'm wondering if JEV could be called to help decide if doing that
// inventory would need a non-interactive session with, for example, a cheap model of yourself
// ... this very economic mission of completing the inventory. And there's also, if the inventory
// for the session already exists, it should handle that."
//
//   inventory-at-exit.mjs decide --session <id> [--json]
//       After inventory.mjs write (the SessionEnd hook's detached half runs both). Decides without
//       a model when the answer can be counted, else asks Jev one choice: reader, from_last_reply or
//       facts_only. Acts on it, appends one line to the ledger, commits the record by path.
//   inventory-at-exit.mjs read --session <id> --file <record> --decision <id>
//       The detached reader: one headless Haiku inventory-keeper for this session, then the guard
//       that puts back any field it changed that an agent had written, then the commit.
//   inventory-at-exit.mjs ruling --session <id> --verdict <confirm|override> --by <who> --choice <c> [--words "<verbatim>"]
//       A person's or a seat's word on the session's last decision, beside it in the ledger.
//   inventory-at-exit.mjs settled
//       The session ids whose reading is settled as facts only, which the nightly pass leaves out.
//
// Counted, no model: a record whose mission and work_completed an agent already wrote (/inventory-
// exit or a keeper) needs nothing; a headless `claude -p` child, a smoke or probe run and a Miette
// insight seat get facts only, as nightly-inventory.sh decides. Two files holding one session are
// reported and neither is written. Jev is asked how the record gets its meaning, never whether the
// work is finished (Episode 564, jev-study-261026.md F7). Below the bar, or without an answer, the
// record stays unread and the nightly pass reads it.
//
// Ledger: ~/.miadi/decisions/inventory-at-exit.jsonl ($INVENTORY_AT_EXIT_LEDGER). What leaves the
// host for Jev: five counts about the session (prompts, tool uses, commits, whether its last reply
// ends with a DONE line, that reply's length). No words of the session.

import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultPaths, readBindings } from "../service/threads.mjs";
import { inventoryDir, sessionsFromBindings } from "./inventory.mjs";
import { loadDecider, readLastMessage, topProbabilityFor } from "./wake-classify.mjs";

const SCRIPT = fileURLToPath(import.meta.url);
const PLUGIN_ROOT = resolve(dirname(SCRIPT), "..");
// Starts with the prefix nightly-inventory.sh reads as "no agent has read it yet".
export const BY = "inventory-keeper (miadi-witness scripts/inventory-at-exit.mjs)";
export const BY_LAST_REPLY = "inventory-at-exit (the session's DONE line, no model)";
export const MODEL = "jev-1.14.0";
export const QUESTIONS_VERSION = "0.1.0";
export const BAR = 0.6;
export const VERDICTS = ["confirm", "override"];
export const FACTS_ONLY_NAMES = /-miette-insight$|smoke|probe/;

export const READINGS = {
  reader: "A cheap model (Haiku) reads this one session and writes its mission, work completed, held decisions and next steps: the session did work that its last reply does not sum up, such as several commits, or many prompts and no DONE line.",
  from_last_reply: "No model: the session's last reply ends with a DONE line, and that line says what was done and what is held, so work completed and next steps are copied from it.",
  facts_only: "No reading: the session did little a reader needs beyond its facts, such as a few prompts, no commits and a short last reply.",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function ledgerPath(env = process.env) {
  return env.INVENTORY_AT_EXIT_LEDGER || join(homedir(), ".miadi", "decisions", "inventory-at-exit.jsonl");
}

function readLedger(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").flatMap((line) => {
    try {
      return line.trim() ? [JSON.parse(line)] : [];
    } catch {
      return [];
    }
  });
}

function append(path, record) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`);
}

export const isEmpty = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

// Every file in the inventory whose session_id is this session, ONGOING-* included.
export function recordFiles(dir, id) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().filter((f) => {
    try {
      return JSON.parse(readFileSync(join(dir, f), "utf8")).session_id === id;
    } catch {
      return false;
    }
  });
}

function writeRecord(path, record) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`);
  renameSync(tmp, path);
}

// ---------- the last reply ----------

const markLine = (line) => line.trim().replace(/^[-*>]\s+/, "").replace(/^`+/, "");

export function lastReplyFacts(message) {
  const lines = String(message ?? "").split("\n").map(markLine).filter(Boolean);
  const last = lines.at(-1) ?? "";
  const ends = /^DONE\b/.test(last);
  return { ends_with_done_line: ends, chars: String(message ?? "").length, done_line: ends ? last : null };
}

// work_completed and next_steps from a DONE line: what was done, then what it says is held.
export function fromDoneLine(line) {
  const text = line.replace(/^DONE\b[:.\s-]*/, "").trim();
  const m = text.match(/^(.*?)[;,.]?\s*\bheld:\s*(.*)$/i);
  const done = (m ? m[1] : text).trim().replace(/[;,.]$/, "") || line;
  const held = m ? m[2].trim().replace(/\.$/, "") : null;
  return {
    work_completed: [{ title: done, description: `The session's DONE line, verbatim: ${line}`, related_files: [] }],
    next_steps: held && !/^(nothing|none)\b/i.test(held) ? [{ title: held, depends_on: "none", owner: "not named by the session" }] : [],
  };
}

// ---------- a reader's guard ----------

// Any field that held a value before the reader is put back as it was; observations keep the
// ones that were there, in order, followed by the new ones.
export function keepWritten(before, after) {
  const record = { ...after };
  const restored = [];
  for (const [key, value] of Object.entries(before)) {
    if (key === "observations" || isEmpty(value)) continue;
    if (JSON.stringify(after[key]) !== JSON.stringify(value)) {
      record[key] = value;
      restored.push(key);
    }
  }
  const prev = before.observations ?? [];
  const next = Array.isArray(after.observations) ? after.observations : [];
  if (!prev.every((o, i) => JSON.stringify(next[i]) === JSON.stringify(o))) {
    const seen = new Set(prev.map((o) => JSON.stringify(o)));
    record.observations = [...prev, ...next.filter((o) => !seen.has(JSON.stringify(o)))];
    restored.push("observations");
  }
  return { record, restored };
}

// ---------- the commit ----------

function git(cwd, args) {
  return spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// The record alone, by path, in the inventory's repository, then a push. A refused push is kept
// for the nightly pass, which pushes HEAD.
export function commitRecord(file, message) {
  const top = git(dirname(file), ["rev-parse", "--show-toplevel"]);
  if (top.status !== 0) return { committed: null, why: "not in a git repository" };
  const repo = top.stdout.trim();
  if (!git(repo, ["status", "--porcelain", "--", file]).stdout.trim()) return { committed: null, why: "nothing changed" };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const done = git(repo, ["add", "--", file]).status === 0 && git(repo, ["commit", "-q", "-m", message, "--", file]).status === 0;
    if (done) {
      const sha = git(repo, ["rev-parse", "--short", "HEAD"]).stdout.trim();
      const pushed = git(repo, ["push", "-q"]).status === 0;
      return { committed: sha, pushed };
    }
    spawnSync("sleep", ["1"]);
  }
  return { committed: null, why: "git add or commit failed twice (another commit held the index)" };
}

// ---------- decide ----------

function sessionFacts(record, message) {
  return {
    prompts: record.hook_capture?.user_inputs ?? 0,
    tool_uses: record.hook_capture?.tool_uses ?? 0,
    commits: (record.links?.trace ?? []).length,
    last_reply: (({ ends_with_done_line, chars }) => ({ ends_with_done_line, chars }))(lastReplyFacts(message)),
  };
}

// The three options in an order that turns with the ledger, so a first-option lean can be read.
export function buildQuestions(shift = 0) {
  const keys = Object.keys(READINGS);
  const k = ((shift % keys.length) + keys.length) % keys.length;
  const order = [...keys.slice(k), ...keys.slice(0, k)];
  return {
    order,
    questions: {
      reading: {
        type: "choice",
        instructions: "A Claude Code session ended and its inventory record holds its facts: `prompts` a person typed, `tool_uses`, `commits` it made, and its `last_reply` (whether it ends with a line that begins with DONE, and its length in characters). How should the record get its meaning, at the least cost that leaves a reader what they need?",
        criteria: Object.fromEntries(order.map((key) => [key, READINGS[key]])),
      },
    },
  };
}

async function askJev(env, facts, shift) {
  const decider = await loadDecider(env);
  const { order, questions } = buildQuestions(shift);
  const request = decider.buildRequest(facts, questions, MODEL);
  const result = await decider.decideJev(request, { report: () => {} });
  const answer = decider.readAnswer(result.answers?.reading);
  const values = Object.values(answer.probabilities ?? {}).filter((v) => typeof v === "number");
  const choice = Object.hasOwn(READINGS, answer.value ?? "") ? answer.value : null;
  const paid = Number(result.billing?.paid_input_tokens_used ?? NaN);
  return {
    requested_model: MODEL,
    model: result.model ?? null,
    choice,
    confidence: typeof answer.p === "number" ? answer.p : null,
    top_probability: values.length ? Math.max(...values) : null,
    probabilities: answer.probabilities ?? null,
    option_order: order,
    bar: { confidence: BAR, top_probability: topProbabilityFor(BAR, order.length), options: order.length },
    above_bar: choice !== null && typeof answer.p === "number" && answer.p >= BAR,
    read_status: answer.read_status ?? null,
    estimated_input_tokens: decider.estimateTokens(request),
    paid_input_tokens: Number.isFinite(paid) ? paid : (result.usage?.input_tokens ?? null),
    run_id: result.billing?.run_id ?? result.id ?? null,
  };
}

function readsToday(ledger, now) {
  const day = now.toISOString().slice(0, 10);
  return ledger.filter((r) => r.kind === "decision" && r.action === "reader_started" && String(r.at).startsWith(day)).length;
}

function observe(record, by, what, now) {
  record.observations = [...(record.observations ?? []), { at: now.toISOString(), by, what }];
}

export async function decide(id, { env = process.env, now = () => new Date() } = {}) {
  if (!UUID.test(id ?? "")) throw new Error(`decide needs --session <session id>, got ${id}`);
  const at = now();
  const ledgerFile = ledgerPath(env);
  const ledger = readLedger(ledgerFile);
  const dir = inventoryDir(env);
  const files = recordFiles(dir, id);
  const base = { kind: "decision", id: `iae-${id.slice(0, 8)}-${at.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`, at: at.toISOString(), questions_version: QUESTIONS_VERSION, session_id: id, files, ruling_id: null };
  const done = (fields) => {
    const line = { ...base, ...fields };
    append(ledgerFile, line);
    return line;
  };

  if (!files.length) return done({ decided_by: "count", rule: "no_record", action: "none", reason: "no record holds this session; inventory.mjs write found no binding line for it" });
  if (files.length > 1) return done({ decided_by: "count", rule: "duplicate", action: "written_to_neither", reason: `${files.length} files hold this session: ${files.join(", ")}; a person or the keeper merges them` });

  const file = join(dir, files[0]);
  const record = JSON.parse(readFileSync(file, "utf8"));
  const tmux = record.tmux_session_name ?? null;
  const commitAs = (action) => commitRecord(file, `inventory at exit: ${id} · ${tmux ?? "no tmux name"} · ${action} (miadi-witness inventory-at-exit.mjs)`);
  const paths = defaultPaths(env);
  const sessions = sessionsFromBindings(readBindings(paths.bindings).lines);

  let count = null;
  if (!isEmpty(record.mission) && !isEmpty(record.work_completed)) count = { rule: "already_read", action: "none", reason: "an agent already wrote its mission and work_completed" };
  else if (sessions.get(id)?.headless) count = { rule: "headless", action: "facts_only", reason: "a headless claude -p child" };
  else if (FACTS_ONLY_NAMES.test(tmux ?? "")) count = { rule: "miette_smoke_probe", action: "facts_only", reason: `${tmux} is a Miette insight seat, a smoke or a probe run, as the nightly pass decides` };
  if (count) {
    if (count.action === "facts_only") {
      observe(record, BY, `Facts only at exit: ${count.reason}.`, at);
      writeRecord(file, record);
    }
    return done({ decided_by: "count", tmux, ...count, commit: commitAs(count.action) });
  }

  const message = readLastMessage(paths.sessiondata, id);
  const facts = sessionFacts(record, message);
  let jev;
  try {
    jev = await askJev(env, facts, ledger.filter((r) => r.kind === "decision" && r.decided_by === "jev").length);
  } catch (error) {
    jev = { error: (error instanceof Error ? error.message : String(error)).slice(0, 300) };
  }
  const unread = (reason) => {
    observe(record, BY, `Left unread for the nightly pass: ${reason}.`, at);
    writeRecord(file, record);
    return { action: "unread", reason };
  };

  let acted;
  if (jev.error) acted = unread(`Jev did not answer (${jev.error})`);
  else if (!jev.above_bar) acted = unread(`Jev chose ${jev.choice ?? "nothing"} at ${jev.confidence?.toFixed?.(2) ?? "?"}, below the bar ${BAR} (top ${jev.bar.top_probability} on ${jev.bar.options} options)`);
  else if (jev.choice === "facts_only") {
    observe(record, BY, `Facts only at exit: Jev chose facts_only at ${jev.confidence.toFixed(2)} (bar ${BAR}).`, at);
    writeRecord(file, record);
    acted = { action: "facts_only", reason: "Jev chose facts_only above the bar" };
  } else if (jev.choice === "from_last_reply") {
    const reply = lastReplyFacts(message);
    if (!reply.done_line) acted = unread("Jev chose from_last_reply, but the last reply does not end with a DONE line");
    else {
      const filled = fromDoneLine(reply.done_line);
      const wrote = Object.keys(filled).filter((key) => isEmpty(record[key]));
      for (const key of wrote) record[key] = filled[key];
      observe(record, BY_LAST_REPLY, wrote.length ? `${wrote.join(" and ")} copied from the session's DONE line: ${reply.done_line}` : `Nothing copied from the DONE line: ${Object.keys(filled).join(" and ")} already held an agent's words.`, at);
      writeRecord(file, record);
      acted = { action: "from_last_reply", filled: wrote, reason: "Jev chose from_last_reply above the bar" };
    }
  } else {
    const max = Number(env.MIADI_INVENTORY_EXIT_MAX_READ ?? 10);
    const budget = String(env.MIADI_INVENTORY_EXIT_BUDGET_USD ?? "0.25");
    const today = readsToday(ledger, at);
    if (today >= max) acted = unread(`Jev chose a reader, and ${today} readers already ran today (the cap is ${max})`);
    else {
      acted = { action: "reader_started", reason: "Jev chose reader above the bar", caps: { budget_usd: budget, reads_today: today + 1, max_per_day: max } };
      const log = env.INVENTORY_AT_EXIT_READER_LOG || join(dirname(ledgerFile), "inventory-at-exit-reader.log");
      mkdirSync(dirname(log), { recursive: true });
      const out = openSync(log, "a");
      const child = spawn(process.execPath, [SCRIPT, "read", "--session", id, "--file", file, "--decision", base.id], { detached: true, stdio: ["ignore", out, out], env });
      child.unref();
      acted.reader_pid = child.pid;
    }
  }
  return done({ decided_by: "jev", tmux, facts, jev, ...acted, commit: commitAs(acted.action) });
}

// ---------- read: the one reader, then the guard and the commit ----------

export function readerPrompt(id, file, today) {
  return `Inventory reading at a session's exit (${today}). Session ${id}: its record is ${file}, and its facts are already written. Read the session with \`miadi-hooks-interpret digest ${id}\` and fill, in that file only, the fields that are empty or missing: mission, work_completed (commits, issues and episodes with their addresses), held_decisions and next_steps, in plain words per SCHEMA.md in that folder, with at most one item that needs William and only if the session says so. Never change a field that already holds a value. Append one observation {at, by: "inventory-keeper (haiku, at exit)", what}. Never read raw _claude_* files, never run find /, never type into a pane, never commit, and change no status, repo, repo_remote, missions or binding. If the digest fails, write the observation 'digest unavailable: <reason>' and stop.`;
}

export function read(id, file, decisionId, { env = process.env, now = () => new Date() } = {}) {
  const before = JSON.parse(readFileSync(file, "utf8"));
  const claude = env.MIADI_INVENTORY_EXIT_CLAUDE || "claude";
  const budget = String(env.MIADI_INVENTORY_EXIT_BUDGET_USD ?? "0.25");
  const cwd = existsSync(join(homedir(), "workspace")) ? join(homedir(), "workspace") : dirname(file);
  const ran = spawnSync(claude, ["-p", "--model", "haiku", "--plugin-dir", PLUGIN_ROOT, "--agent", "miadi-witness:inventory-keeper", "--max-budget-usd", budget, "--permission-mode", "bypassPermissions", readerPrompt(id, file, now().toISOString().slice(0, 10))], { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 1_800_000 });
  let after;
  try {
    after = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    after = null;
  }
  const { record, restored } = after ? keepWritten(before, after) : { record: before, restored: ["the whole record: the reader left invalid JSON"] };
  const wasRead = (record.observations ?? []).length > (before.observations ?? []).length;
  if (restored.length) writeRecord(file, record);
  const commit = commitRecord(file, `inventory at exit: ${id} · read by Haiku (miadi-witness inventory-at-exit.mjs)`);
  const line = { kind: "reading", decision_id: decisionId, session_id: id, at: now().toISOString(), exit: ran.status, signal: ran.signal ?? null, read: wasRead, restored, commit };
  append(ledgerPath(env), line);
  return line;
}

// ---------- ruling and settled ----------

export function makeRuling({ decision, verdict, by, choice, words = null, now = new Date().toISOString() }) {
  if (!decision) throw new Error("no decision for this session in the ledger to rule on");
  if (!VERDICTS.includes(verdict)) throw new Error(`--verdict is one of ${VERDICTS.join(", ")}`);
  if (!by) throw new Error("--by names who ruled");
  if (!Object.hasOwn(READINGS, choice ?? "")) throw new Error(`--choice is one of ${Object.keys(READINGS).join(", ")}`);
  const taken = decision.jev?.choice ?? decision.action;
  if (verdict === "confirm" && choice !== taken) throw new Error(`confirm keeps the decision's choice (${taken}); --choice ${choice} is an override`);
  if (verdict === "override" && choice === taken) throw new Error(`override names another reading than the decision's (${taken})`);
  return {
    kind: "ruling",
    id: `rul-${decision.id}`,
    decision_id: decision.id,
    session_id: decision.session_id,
    verdict,
    decided_by: by,
    choice,
    decision_choice: taken,
    jev_confidence: decision.jev?.confidence ?? null,
    below_bar: decision.jev ? !decision.jev.above_bar : null,
    words,
    at: now,
  };
}

// A session is settled as facts only when its last decision took facts_only and no later ruling
// chose otherwise, or when a ruling chose facts_only.
export function settled(ledger) {
  const last = new Map();
  for (const r of ledger) {
    if (r.kind === "decision") last.set(r.session_id, { decision: r, ruling: null });
    else if (r.kind === "ruling" && last.get(r.session_id)?.decision.id === r.decision_id) last.get(r.session_id).ruling = r;
  }
  return [...last.entries()].filter(([, { decision, ruling }]) => (ruling ? ruling.choice === "facts_only" : decision.action === "facts_only")).map(([id]) => id);
}

// ---------- cli ----------

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) { out._.push(argv[i]); continue; }
    const k = argv[i].slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) out[k] = true;
    else { out[k] = v; i += 1; }
  }
  return out;
}

const USAGE = `usage: inventory-at-exit.mjs decide --session <id> [--json]
       inventory-at-exit.mjs read --session <id> --file <record> --decision <id>
       inventory-at-exit.mjs ruling --session <id> --verdict <confirm|override> --by <who> --choice <${Object.keys(READINGS).join("|")}> [--words "<verbatim>"]
       inventory-at-exit.mjs settled`;

async function main() {
  const a = args(process.argv.slice(2));
  const command = a._[0];
  if (command === "decide") {
    const line = await decide(a.session);
    if (a.json) console.log(JSON.stringify(line, null, 2));
    else {
      const j = line.jev && !line.jev.error ? ` · Jev ${line.jev.choice} ${line.jev.confidence?.toFixed?.(2) ?? "?"} (bar ${line.jev.bar.confidence} = top ${line.jev.bar.top_probability} on ${line.jev.bar.options})` : "";
      console.log(`inventory at exit: ${line.session_id} · ${line.decided_by}${line.rule ? ` ${line.rule}` : ""}${j} → ${line.action} · ${line.reason}${line.commit?.committed ? ` · commit ${line.commit.committed}` : ""} · ${line.id}`);
    }
    return 0;
  }
  if (command === "read") {
    const line = read(a.session, a.file, a.decision);
    console.log(JSON.stringify(line));
    return line.exit === 0 ? 0 : 1;
  }
  if (command === "ruling") {
    const ledgerFile = ledgerPath();
    const decision = [...readLedger(ledgerFile)].reverse().find((r) => r.kind === "decision" && r.session_id === a.session) ?? null;
    const ruling = makeRuling({ decision, verdict: a.verdict, by: typeof a.by === "string" ? a.by : null, choice: a.choice, words: typeof a.words === "string" ? a.words : null });
    append(ledgerFile, ruling);
    console.log(`${ruling.id} · ${ruling.verdict} ${ruling.choice} by ${ruling.decided_by} (decision ${ruling.decision_choice}${ruling.below_bar ? ", below the bar" : ""})`);
    return 0;
  }
  if (command === "settled") {
    for (const id of settled(readLedger(ledgerPath()))) console.log(id);
    return 0;
  }
  console.error(USAGE);
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT) {
  main().then((code) => { process.exitCode = code; }, (error) => { console.error(`inventory-at-exit: ${error.message}`); process.exitCode = 1; });
}
