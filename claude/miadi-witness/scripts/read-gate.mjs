#!/usr/bin/env node
// read-gate — ask Jev whether a file is worth reading for the mission at hand, before the agent
// reads it. William, 2026-10-30: "you don't look at the file, but you send into that decision
// engine ... the mission or what we're trying to do, and it gives you a score like, should you
// read it or should you not read it ... If it's not, you don't read it."
//
// usage: read-gate.mjs --mission "<what we are trying to do now>" [--mission-file F]
//                      [--known "<what the seat already holds>"] [--known-file F]
//                      [--cwd DIR] [--recursive] [--model jev-1.14.0] [--parallel 8]
//                      [--dry] [--json] <file|dir|glob>...
//        read-gate.mjs --ruling <read|skip> --by <who> --path <file> [--words "<verbatim>"]
//
// What leaves the host: the mission, the known text, and each file's content, or, when the file
// is over the state budget, its first lines and its heading outline. Nothing else. The key is
// read by lane-check's decider (JEV_AI_API_KEY from the environment or one line of ~/.env) and
// never printed. Every answer is appended to ~/.miadi/decisions/read-gate.jsonl
// ($READ_GATE_LEDGER for another file).
//
// The form is Episode 564's levels 8 and 9 (jev-study-261026.md): the file is Jev's state and
// never the agent's context; one call per file, in parallel; the thresholds are written beside
// the numbers and nothing is calibrated yet (study F1). A `--ruling` records what the seat or
// William actually did, so the bars can be calibrated from those words later.
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { glob } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LANE_CHECK = process.env.LANE_CHECK_DIR || "/workspace/repos/jgwill/smcraft/examples/decision-gate/lane-check";

// Pinned with choose-worker and the proposal scorer: jev-1.14.0 at the owner's word, 2026-10-28.
export const MODEL = "jev-1.14.0";
export const QUESTIONS_VERSION = "0.1.0";
export const ALIASES = ["jev-latest", "jev-preview"];
// A noul is a probability of yes. TypeSafe suggests starting at 0.7 for yes and 0.3 for no;
// nothing here is calibrated (study F1), so these are the starting lines, written beside the number.
export const READ_AT = 0.7;
export const SKIP_AT = 0.3;
// A choice's confidence is a shape statistic: on four options, 0.6 is a top probability of 0.7.
export const ACTION_BAR = 0.6;
// Jev's state budget is 32k tokens shared with the longest question; about 25k tokens of file.
export const MAX_STATE_CHARS = 100_000;
export const OUTLINE_HEAD_LINES = 40;
export const OUTLINE_LINE_CHARS = 400;
export const MAX_HEADINGS = 60;
export const MAX_FILES = 255;
export const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", "__pycache__"]);
export const BINARY_RE = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|mp[34]|m4a|mov|mkv|wav|ogg|lock)$/i;
export const VERDICTS = ["read", "skim", "skip", "ask"];
export const RULINGS = ["read", "skip"];

export const ACTIONS = {
  read_whole: "Read the whole file now: most of it bears on `mission`, and it is short enough to read.",
  read_part: "Read one part now, the part `section` names or the beginning; the rest does not bear on `mission`.",
  skip: "Do not read it: it does not bear on `mission`, or `known` already holds what it says.",
  later: "Not now: it bears on `mission`, but only after something else is done first.",
};

export function buildQuestions({ headings = [], hasKnown = false } = {}) {
  const questions = {
    relevant: {
      type: "noul",
      instructions: "Does the file (`content`, or `outline` when `basis` is outline) bear on `mission`: would reading it change or ground what is done next for `mission`?",
      criteria: { true: "Reading it would change or ground what is done next for the mission.", false: "Reading it would not change what is done next for the mission." },
    },
    action: { type: "choice", instructions: "What should the agent do with this file for `mission`?", criteria: ACTIONS },
  };
  if (hasKnown) {
    questions.new_to_us = {
      type: "noul",
      instructions: "Does the file say something about `mission` that `known` does not already say?",
      criteria: { true: "It adds something `known` does not hold.", false: "Everything it says about the mission is already in `known`." },
    };
  }
  if (headings.length >= 2) {
    questions.section = {
      type: "choice",
      instructions: "Which entry of `headings` starts the part of the file that bears most on `mission`?",
      criteria: { ...Object.fromEntries(headings.map((h) => [h.key, h.text])), none: "No single part: the whole file, or nothing in it." },
    };
  }
  return questions;
}

export function buildState({ mission, known = "", file }) {
  const state = { mission, path: file.path, bytes: file.bytes, lines: file.lines, basis: file.basis };
  if (known) state.known = known;
  if (file.basis === "content") state.content = file.content;
  else state.outline = file.outline;
  if (file.headings.length >= 2) state.headings = Object.fromEntries(file.headings.map((h) => [h.key, `line ${h.line}: ${h.text}`]));
  return state;
}

// Markdown headings of level 1 to 3, keyed by line so a choice over them picks a real place.
export function extractHeadings(lines, cap = MAX_HEADINGS) {
  const out = [];
  for (let i = 0; i < lines.length && out.length < cap; i += 1) {
    const m = /^(#{1,3})\s+(.+?)\s*$/.exec(lines[i]);
    if (m) out.push({ key: `h${i + 1}`, line: i + 1, level: m[1].length, text: m[2].slice(0, 120) });
  }
  return out;
}

export class ReadGateError extends Error {
  constructor(message, path) { super(message); this.name = "ReadGateError"; this.path = path; }
}

// The file as state. Over the budget, the state is its first lines and its heading outline,
// and the record says so (`basis: outline`), so a reading of an outline is never mistaken for
// a reading of the file.
export function readFileState(path, options = {}) {
  let info;
  try { info = statSync(path); } catch { throw new ReadGateError(`not found: ${path}`, path); }
  if (!info.isFile()) throw new ReadGateError(`not a file: ${path}`, path);
  if (info.size === 0) throw new ReadGateError(`empty: ${path}`, path);
  const buf = readFileSync(path);
  if (buf.subarray(0, 8192).includes(0)) throw new ReadGateError(`binary: ${path}`, path);
  return textState(path, buf.toString("utf8"), info.size, options);
}

// Any text as state, under a name: a file's path, or an address such as miadi-review:<uuid>.
export function textState(path, text, bytes = Buffer.byteLength(text, "utf8"), { maxChars = MAX_STATE_CHARS, headLines = OUTLINE_HEAD_LINES } = {}) {
  if (!text.trim()) throw new ReadGateError(`empty: ${path}`, path);
  const lines = text.split("\n");
  const headings = extractHeadings(lines);
  const base = { path, bytes, lines: lines.length, headings };
  if (text.length <= maxChars) return { ...base, basis: "content", content: text };
  const head = lines.slice(0, headLines).map((l) => (l.length > OUTLINE_LINE_CHARS ? `${l.slice(0, OUTLINE_LINE_CHARS)} …` : l));
  const outline = [...head, "", `[… ${lines.length} lines in all; the text is over the state budget, so only these first ${headLines} lines and the headings below were sent]`, ...headings.map((h) => `${h.line}: ${"#".repeat(h.level)} ${h.text}`)].join("\n");
  return { ...base, basis: "outline", outline: outline.slice(0, maxChars) };
}

export const REVIEW_BASE = (process.env.MIADI_REVIEW_BASE_URL || "https://miadi-review-service.vercel.app").replace(/\/+$/, "");
const REVIEW_RE = /^(?:miadi-review:(?:\/\/)?)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
export const isAddress = (path) => /^miadi-review:/.test(path);

// A published review as a candidate: its latest Markdown, public, no token. The candidate's
// name is its chronicle reference, miadi-review:<uuid>, so the ledger and a ruling can cite it.
export async function reviewState(ref, { fetchImpl = globalThis.fetch, version = null } = {}) {
  const m = REVIEW_RE.exec(ref.trim());
  if (!m) throw new ReadGateError(`not a review id: ${ref}`, ref);
  const uuid = m[1].toLowerCase();
  const url = `${REVIEW_BASE}/review/${uuid}/raw${version ? `?v=${version}` : ""}`;
  const response = await fetchImpl(url, { headers: { Accept: "text/plain" } });
  if (!response.ok) throw new ReadGateError(`${response.status} from ${url}`, `miadi-review:${uuid}`);
  return textState(`miadi-review:${uuid}`, await response.text());
}

const GLOB_CHARS = /[*?[\]{}]/;

// Patterns are files, directories or globs. A directory means its files, or everything below
// it with --recursive. Nothing here calls Jev.
export async function expandPatterns(patterns, cwd, recursive = false) {
  const out = new Set();
  for (const raw of patterns) {
    const pattern = raw.trim();
    if (!pattern) continue;
    if (GLOB_CHARS.test(pattern)) { for await (const p of glob(pattern, { cwd })) out.add(resolve(cwd, String(p))); continue; }
    const full = isAbsolute(pattern) ? pattern : resolve(cwd, pattern);
    let info;
    try { info = statSync(full); } catch { out.add(full); continue; }
    if (info.isFile()) { out.add(full); continue; }
    for await (const p of glob(recursive ? "**/*" : "*", { cwd: full })) out.add(resolve(full, String(p)));
  }
  return [...out].sort();
}

export function pruneFiles(paths, cwd, cap = MAX_FILES) {
  const files = [];
  const skipped = [];
  for (const path of paths) {
    const rel = relative(cwd, path);
    if (rel.split(sep).some((part) => SKIP_DIRS.has(part))) { skipped.push({ path, reason: "skipped directory" }); continue; }
    if (BINARY_RE.test(path)) { skipped.push({ path, reason: "binary by extension" }); continue; }
    let info;
    try { info = statSync(path); } catch { skipped.push({ path, reason: "not found" }); continue; }
    if (!info.isFile()) continue;
    if (info.size === 0) { skipped.push({ path, reason: "empty" }); continue; }
    if (files.length >= cap) { skipped.push({ path, reason: `over the ${cap} file cap; narrow the pattern` }); continue; }
    files.push(path);
  }
  return { files, skipped };
}

export function topProbabilityFor(confidence, n) {
  return Number((confidence * (1 - 1 / n) + 1 / n).toFixed(3));
}

export function topProbability(probabilities) {
  const values = Object.values(probabilities ?? {}).filter((v) => typeof v === "number");
  return values.length ? Math.max(...values) : null;
}

// The verdict is read from the noul, and the action says how to read. An unanswered noul is
// `ask`: the seat decides with its own eyes, and that choice is a ruling.
export function verdictOf(relevantP, actionValue) {
  if (typeof relevantP !== "number") return "ask";
  if (relevantP >= READ_AT) return actionValue === "skip" ? "skim" : "read";
  if (relevantP <= SKIP_AT) return "skip";
  return "skim";
}

export function makeRecord({ result, requestedModel, mission, known, file, request, readAnswer, estimateTokens, now = new Date().toISOString(), seq = 0 }) {
  const relevant = readAnswer(result.answers?.relevant);
  const action = readAnswer(result.answers?.action);
  const newToUs = request.questions.new_to_us ? readAnswer(result.answers?.new_to_us) : null;
  const section = request.questions.section ? readAnswer(result.answers?.section) : null;
  const heading = section && section.value && section.value !== "none" ? file.headings.find((h) => h.key === section.value) ?? null : null;
  const n = Object.keys(ACTIONS).length;
  const paid = Number(result.billing?.paid_input_tokens_used ?? NaN);
  return {
    kind: "decision",
    id: `rg-${now.replace(/[-:.TZ]/g, "").slice(0, 17)}-${seq}`,
    at: now,
    questions_version: QUESTIONS_VERSION,
    requested_model: requestedModel,
    model: result.model ?? null,
    mission: mission.slice(0, 500),
    known_chars: known.length,
    path: file.path,
    bytes: file.bytes,
    lines: file.lines,
    basis: file.basis,
    relevant: relevant.p,
    relevant_read_status: relevant.read_status ?? null,
    new_to_us: newToUs ? newToUs.p : null,
    action: action.value,
    action_confidence: action.p,
    action_top_probability: topProbability(action.probabilities),
    action_probabilities: action.probabilities ?? null,
    bar: { read_at: READ_AT, skip_at: SKIP_AT, action_confidence: ACTION_BAR, action_top_probability: topProbabilityFor(ACTION_BAR, n), options: n },
    action_above_bar: typeof action.p === "number" ? action.p >= ACTION_BAR : false,
    section: heading ? { key: heading.key, line: heading.line, text: heading.text } : null,
    section_confidence: section ? section.p : null,
    verdict: verdictOf(relevant.p, action.value),
    estimated_input_tokens: estimateTokens(request),
    paid_input_tokens: Number.isFinite(paid) ? paid : (result.usage?.input_tokens ?? null),
    run_id: result.billing?.run_id ?? result.id ?? null,
    billing: result.billing ?? null,
    validation: result.validation ?? null,
    sent: result.sent !== false,
  };
}

// What the seat or William did with the file, written beside the decision it answers.
export function makeRuling({ decision, verdict, by, words = null, now = new Date().toISOString() }) {
  if (!decision) throw new Error("no decision for that path in the ledger");
  if (!RULINGS.includes(verdict)) throw new Error(`--ruling is one of ${RULINGS.join(", ")}`);
  if (!by) throw new Error("--by names who ruled");
  return {
    kind: "ruling",
    id: `rul-${decision.id}`,
    decision_id: decision.id,
    path: decision.path,
    verdict,
    decided_by: by,
    jev_verdict: decision.verdict ?? null,
    jev_relevant: decision.relevant ?? null,
    agrees: decision.verdict === verdict || (decision.verdict === "skim" && verdict === "read"),
    words,
    at: now,
  };
}

export function ledgerPath(env = process.env) {
  return env.READ_GATE_LEDGER || join(homedir(), ".miadi", "decisions", "read-gate.jsonl");
}

export function lastDecisionFor(records, path) {
  return [...records].reverse().find((r) => r.kind === "decision" && r.path === path) ?? null;
}

function readRecords(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function append(path, record) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(record) + "\n");
}

export async function parallel(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next; next += 1; out[i] = await fn(items[i], i); }
  });
  await Promise.all(workers);
  return out;
}

const VALUE_FLAGS = new Set(["mission", "mission-file", "known", "known-file", "cwd", "model", "parallel", "ruling", "by", "path", "words", "review"]);

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) { out._.push(arg); continue; }
    const key = arg.slice(2);
    if (VALUE_FLAGS.has(key)) { out[key] = argv[i + 1]; i += 1; } else out[key] = true;
  }
  return out;
}

const USAGE = `usage: read-gate.mjs --mission "<what we are trying to do now>" [--mission-file F] [--known "<what the seat already holds>"] [--known-file F] [--cwd DIR] [--recursive] [--model ${MODEL}] [--parallel 8] [--review <uuid>[,<uuid>…]] [--dry] [--json] [<file|dir|glob>...]
       read-gate.mjs --ruling <read|skip> --by <who> --path <file|miadi-review:uuid> [--words "<verbatim>"]`;

const fmt = (x) => (typeof x === "number" ? x.toFixed(2) : "  ? ");
const shown = (path, cwd) => (isAddress(path) ? path : relative(cwd, path) || path);

function printTable(records, cwd) {
  const order = { read: 0, skim: 1, ask: 2, skip: 3 };
  const sorted = [...records].sort((a, b) => order[a.verdict] - order[b.verdict] || (b.relevant ?? 0) - (a.relevant ?? 0));
  const hasKnown = sorted.some((r) => typeof r.new_to_us === "number");
  console.log(`verdict  relevant ${hasKnown ? " new " : ""} action      conf  section            lines  basis    path`);
  for (const r of sorted) {
    const section = r.section ? `L${r.section.line} ${r.section.text}`.slice(0, 18).padEnd(18) : "".padEnd(18);
    const fresh = hasKnown ? ` ${fmt(r.new_to_us)}` : "";
    console.log(`${r.verdict.padEnd(8)} ${fmt(r.relevant).padStart(8)}${fresh}  ${String(r.action ?? "?").padEnd(10)} ${fmt(r.action_confidence)}  ${section} ${String(r.lines).padStart(5)}  ${r.basis.padEnd(8)} ${shown(r.path, cwd)}`);
  }
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const ledger = ledgerPath();
  const cwd = a.cwd ? resolve(a.cwd) : process.cwd();

  if (a.ruling) {
    if (!a.path) { console.error("--ruling needs --path <file|miadi-review:uuid> naming the decision to rule on"); process.exit(2); }
    const path = isAddress(a.path) ? a.path : resolve(cwd, a.path);
    const ruling = makeRuling({ decision: lastDecisionFor(readRecords(ledger), path), verdict: a.ruling, by: a.by, words: typeof a.words === "string" ? a.words : null });
    append(ledger, ruling);
    console.log(`${ruling.id} · ${ruling.verdict} by ${ruling.decided_by} (Jev ${ruling.jev_verdict} at ${fmt(ruling.jev_relevant)}; ${ruling.agrees ? "agrees" : "disagrees"})`);
    return;
  }

  const mission = a["mission-file"] ? readFileSync(a["mission-file"], "utf8").trim() : a.mission;
  const reviews = typeof a.review === "string" ? a.review.split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (!mission || mission === true || (a._.length === 0 && reviews.length === 0)) { console.error(USAGE); process.exit(2); }
  const known = a["known-file"] ? readFileSync(a["known-file"], "utf8").trim() : (typeof a.known === "string" ? a.known : "");
  const model = typeof a.model === "string" ? a.model : MODEL;
  if (ALIASES.includes(model)) throw new Error(`${model} is an alias that resolves differently on jev-ai.pro and TypeSafe; pin a version such as ${MODEL}`);
  const limit = Math.max(1, Number(a.parallel) || 8);

  const { buildRequest, decideDry, decideJev, estimateTokens, readAnswer } = await import(pathToFileURL(join(LANE_CHECK, "lib", "decider.mjs")).href);

  const expanded = await expandPatterns(a._, cwd, Boolean(a.recursive));
  const { files, skipped } = pruneFiles(expanded, cwd);
  const states = [];
  for (const path of files) {
    try { states.push(readFileState(path)); } catch (error) { skipped.push({ path, reason: error.message.replace(`: ${path}`, "") }); }
  }
  for (const ref of reviews) {
    try { states.push(await reviewState(ref)); } catch (error) { skipped.push({ path: error.path ?? ref, reason: error.message }); }
  }
  for (const s of skipped) console.error(`skipped ${shown(s.path, cwd)}: ${s.reason}`);
  if (!states.length) { console.error("read-gate: no file to judge"); process.exit(1); }

  const requests = states.map((file) => buildRequest(buildState({ mission, known, file }), buildQuestions({ headings: file.headings, hasKnown: Boolean(known) }), model));

  if (a.dry) {
    let total = 0;
    for (const [i, request] of requests.entries()) {
      const dry = await decideDry(request);
      total += dry.estimated_input_tokens;
      console.log(`dry ${shown(states[i].path, cwd)}: ${dry.estimated_input_tokens} tokens estimated, basis ${states[i].basis}, ${dry.within_budget ? "within" : "OVER"} the state budget${dry.validation.ok ? "" : `, invalid: ${dry.validation.failures.map((f) => f.detail).join("; ")}`}`);
    }
    console.log(`dry: ${states.length} files, ${total} tokens estimated, ~${Math.round(total * 1.61)} paid expected at Episode 562's ratio 1.61, nothing sent`);
    if (a.json) console.log(JSON.stringify(requests[0], null, 2));
    return;
  }

  const now = new Date().toISOString();
  const records = await parallel(requests, limit, async (request, i) => {
    const result = await decideJev(request);
    const record = makeRecord({ result, requestedModel: model, mission, known, file: states[i], request, readAnswer, estimateTokens, now, seq: i });
    append(ledger, record);
    return record;
  });

  if (a.json) { console.log(JSON.stringify(records, null, 2)); return; }
  printTable(records, cwd);
  const counts = VERDICTS.map((v) => `${v} ${records.filter((r) => r.verdict === v).length}`).join(", ");
  const paid = records.reduce((acc, r) => acc + (r.paid_input_tokens ?? 0), 0);
  console.log(`\n${counts} · read at ≥ ${READ_AT}, skip at ≤ ${SKIP_AT} (uncalibrated starting lines) · action bar ${ACTION_BAR} = top ${topProbabilityFor(ACTION_BAR, Object.keys(ACTIONS).length)} on ${Object.keys(ACTIONS).length} options`);
  console.log(`model ${records[0]?.model ?? "?"} (requested ${model}) · ${paid} tokens paid · ≈$${(paid * 0.042 / 1e6).toFixed(4)} at $0.042/M · ledger ${ledger}`);
  console.log(`a read you make against a verdict is a ruling: read-gate.mjs --ruling read|skip --by <who> --path <file>`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`read-gate: ${error.message}`); process.exit(1); });
}
