#!/usr/bin/env node
// read-gate — ask Jev whether a file is worth reading for the mission at hand, before the agent
// reads it. William, 2026-10-30: "you don't look at the file, but you send into that decision
// engine ... the mission or what we're trying to do, and it gives you a score like, should you
// read it or should you not read it ... If it's not, you don't read it."
//
// usage: read-gate.mjs --mission "<what we are trying to do now>" [--mission-file F]
//                      [--known "<what the seat already holds>"] [--known-file F]
//                      [--cwd DIR] [--recursive] [--model jev-1.14.0] [--parallel 8]
//                      [--review <uuid>,…] [--reviews-since YYYY-MM-DD] [--pde <pde-dir>]
//                      [--dry] [--json] [<file|dir|glob>...]
//        read-gate.mjs --ruling <read|skip> --by <who> --path <file> [--words "<verbatim>"]
//        read-gate.mjs rulings [--json] [--mission <words>]          # decisions with no ruling, newest first, by mission
//        read-gate.mjs calibrate --class <relevant|action> [--target 0.95] [--min 20] [--write]
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
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
// `calibrate --write` replaces them in read-gate-policy.json beside this script, from twenty
// rulings per class, with the person's name in set_by. The constants stay the defaults.
export const READ_AT = 0.7;
export const SKIP_AT = 0.3;
// A choice's confidence is a shape statistic: on four options, 0.6 is a top probability of 0.7.
export const ACTION_BAR = 0.6;
export const POLICY_FILE = fileURLToPath(new URL("./read-gate-policy.json", import.meta.url));

export function defaultPolicy() {
  return { read_at: READ_AT, skip_at: SKIP_AT, action_bar: ACTION_BAR, set_by: null, rulings: 0, date: null };
}

// The bars in force: the policy file when it exists and parses, else the defaults.
export function loadPolicy(file = POLICY_FILE) {
  if (!existsSync(file)) return defaultPolicy();
  try {
    const p = JSON.parse(readFileSync(file, "utf8"));
    return { ...defaultPolicy(), ...p };
  } catch {
    return defaultPolicy();
  }
}
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
    // Rewritten 2026-11-03 (fork 01 of Episode 567): the first form read 0.73 to 0.93 on every
    // file in two runs. This one names what `known_items` holds and asks for one uncovered thing.
    questions.new_to_us = {
      type: "noul",
      instructions: "`known_items` lists, one per entry, what the seat has already read for `mission`. Is there at least one thing the file says about `mission` that no entry of `known_items` covers? A file that restates, summarises or cites what an entry already covers adds nothing.",
      criteria: { true: "At least one thing it says about the mission is covered by no entry of known_items.", false: "Each thing it says about the mission is covered by some entry of known_items, or it says nothing about the mission." },
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

// `known` is split into items on line breaks and semicolons, so a question can point at one entry.
export function knownItems(known) {
  return String(known ?? "").split(/\n+|;\s*/).map((s) => s.trim()).filter(Boolean);
}

export function buildState({ mission, known = "", file }) {
  const state = { mission, path: file.path, bytes: file.bytes, lines: file.lines, basis: file.basis };
  if (known) { state.known = known; state.known_items = knownItems(known); }
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

// The reviews published or revised since a date, from the service's public feed, so "which of
// the new reviews should I read for what I am doing" is one run. The feed is read, never
// interpreted: only each item's link and pubDate are used.
export async function reviewsSince(date, { fetchImpl = globalThis.fetch } = {}) {
  const since = new Date(date);
  if (Number.isNaN(since.getTime())) throw new Error(`--reviews-since needs a date, got ${date}`);
  const url = `${REVIEW_BASE}/review/feed.xml`;
  const response = await fetchImpl(url, { headers: { Accept: "application/rss+xml, application/xml, text/xml" } });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  const xml = await response.text();
  const out = [];
  for (const item of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const link = /<link>\s*([^<\s]+)\s*<\/link>/.exec(item)?.[1] ?? "";
    const pub = /<pubDate>\s*([^<]+?)\s*<\/pubDate>/.exec(item)?.[1] ?? "";
    const uuid = REVIEW_RE.exec(link.replace(/^.*\/review\//, "").replace(/[/?#].*$/, ""))?.[1];
    if (uuid && !Number.isNaN(new Date(pub).getTime()) && new Date(pub) >= since) out.push(uuid.toLowerCase());
  }
  return [...new Set(out)];
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
export function verdictOf(relevantP, actionValue, policy = defaultPolicy()) {
  if (typeof relevantP !== "number") return "ask";
  if (relevantP >= policy.read_at) return actionValue === "skip" ? "skim" : "read";
  if (relevantP <= policy.skip_at) return "skip";
  return "skim";
}

export function makeRecord({ result, requestedModel, mission, known, file, request, readAnswer, estimateTokens, now = new Date().toISOString(), seq = 0, policy = defaultPolicy() }) {
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
    bar: { read_at: policy.read_at, skip_at: policy.skip_at, action_confidence: policy.action_bar, action_top_probability: topProbabilityFor(policy.action_bar, n), options: n, set_by: policy.set_by ?? null },
    action_above_bar: typeof action.p === "number" ? action.p >= policy.action_bar : false,
    section: heading ? { key: heading.key, line: heading.line, text: heading.text } : null,
    section_confidence: section ? section.p : null,
    verdict: verdictOf(relevant.p, action.value, policy),
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

// ---------- rulings and calibration (Episode 567, fork 01, 2026-11-03) ----------

// The ruling in force for each decision: the latest one written.
export function latestRulings(records) {
  const map = new Map();
  for (const r of records) if (r.kind === "ruling" && r.decision_id) map.set(r.decision_id, r);
  return map;
}

// Decisions no ruling answers yet, newest first.
export function pendingDecisions(records) {
  const ruled = latestRulings(records);
  return records.filter((r) => r.kind === "decision" && !ruled.has(r.id)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function groupByMission(decisions) {
  const groups = new Map();
  for (const d of decisions) { const k = d.mission ?? ""; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); }
  return [...groups.entries()].map(([mission, items]) => ({ mission, count: items.length, items }));
}

// How a ruling reads against the action Jev chose.
export const ACTION_AS_RULING = { read_whole: "read", read_part: "read", skip: "skip", later: "skip" };

// Where a cut would have agreed with the rulings, in lane-check's shape (calibrate in
// lane-check.mjs). Class relevant: p is the noul; a `read` ruling agrees at or above the cut, a
// `skip` ruling at or below 1 - cut. Class action: p is the choice's confidence; the ruling
// agrees when it matches the action's reading. Nothing is suggested under `min` rulings per cut.
export function calibrate(records, { cls = "relevant", target = 0.95, min = 20 } = {}) {
  if (!["relevant", "action"].includes(cls)) throw new Error("class is relevant or action");
  const ruled = latestRulings(records);
  const points = [];
  for (const d of records) {
    if (d.kind !== "decision" || !ruled.has(d.id)) continue;
    const verdict = ruled.get(d.id).verdict;
    if (cls === "relevant" && typeof d.relevant === "number") points.push({ p: d.relevant, read: verdict === "read" });
    if (cls === "action" && typeof d.action_confidence === "number") points.push({ p: d.action_confidence, agrees: ACTION_AS_RULING[d.action] === verdict });
  }
  const cuts = [];
  for (let t = 0.5; t <= 0.991; t += 0.05) {
    const cut = Number(t.toFixed(2));
    if (cls === "relevant") {
      const above = points.filter((x) => x.p >= cut);
      const below = points.filter((x) => x.p <= Number((1 - cut).toFixed(2)));
      cuts.push({ cut, read_n: above.length, read_agrees: above.length ? above.filter((x) => x.read).length / above.length : null, skip_n: below.length, skip_agrees: below.length ? below.filter((x) => !x.read).length / below.length : null });
    } else {
      const above = points.filter((x) => x.p >= cut);
      cuts.push({ cut, n: above.length, agrees: above.length ? above.filter((x) => x.agrees).length / above.length : null });
    }
  }
  const report = { class: cls, rulings: points.length, min, target, cuts, suggested: null };
  if (cls === "relevant") {
    const read = cuts.find((c) => c.read_n >= min && c.read_agrees >= target);
    const skip = [...cuts].reverse().find((c) => c.skip_n >= min && c.skip_agrees >= target);
    if (read || skip) report.suggested = { read_at: read?.cut ?? null, skip_at: skip ? Number((1 - skip.cut).toFixed(2)) : null };
  } else {
    const bar = cuts.find((c) => c.n >= min && c.agrees >= target);
    if (bar) report.suggested = { action_bar: bar.cut };
  }
  return report;
}

// The policy is written from a suggestion only, with the name of whose rulings set it.
export function writePolicy(report, { by, file = POLICY_FILE, now = new Date().toISOString() } = {}) {
  if (!report.suggested) throw new Error(`nothing to write: ${report.rulings} ruled decisions in class ${report.class}, ${report.min} needed at a cut`);
  if (!by) throw new Error("--by names whose rulings these are");
  const next = { ...loadPolicy(file), set_by: by, rulings: report.rulings, date: now };
  if (report.class === "relevant") {
    if (report.suggested.read_at != null) next.read_at = report.suggested.read_at;
    if (report.suggested.skip_at != null) next.skip_at = report.suggested.skip_at;
  } else {
    next.action_bar = report.suggested.action_bar;
  }
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

// The PDE room's files_needed (the decomposition's context): entries that name a path which
// exists on this host become candidates; prose and foreign paths are reported, never guessed.
export function filesNeededFromPde(dir, env = process.env) {
  const jsons = existsSync(dir) ? readdirSync(dir).filter((f) => /^pde-.*\.json$/.test(f)) : [];
  if (!jsons.length) throw new Error(`no pde-*.json in ${dir}`);
  const pde = JSON.parse(readFileSync(join(dir, jsons[0]), "utf8"));
  const needed = pde?.result?.context?.files_needed ?? pde?.context?.files_needed ?? [];
  const found = [];
  const skipped = [];
  for (const entry of needed) {
    const tokens = String(entry).match(/(?:\$[A-Z_]+|~|\/)[^\s,;()'"`]*/g) ?? [];
    let hit = null;
    for (const token of tokens) {
      const path = token.replace(/^~/, env.HOME ?? "").replace(/\$([A-Z_]+)/g, (_, k) => env[k] ?? "").replace(/\*.*$/, "").replace(/\/+$/, "");
      if (path && existsSync(path)) { hit = path; break; }
    }
    if (hit) found.push(hit); else skipped.push({ path: String(entry).slice(0, 120), reason: "no path in the entry exists on this host" });
  }
  return { pde: jsons[0], found: [...new Set(found)], skipped };
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

const VALUE_FLAGS = new Set(["mission", "mission-file", "known", "known-file", "cwd", "model", "parallel", "ruling", "by", "path", "words", "review", "reviews-since", "pde", "class", "target", "min"]);

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

const USAGE = `usage: read-gate.mjs --mission "<what we are trying to do now>" [--mission-file F] [--known "<what the seat already holds>"] [--known-file F] [--cwd DIR] [--recursive] [--model ${MODEL}] [--parallel 8] [--review <uuid>[,<uuid>…]] [--reviews-since YYYY-MM-DD] [--dry] [--json] [<file|dir|glob>...]
       read-gate.mjs --ruling <read|skip> --by <who> --path <file|miadi-review:uuid> [--words "<verbatim>"]`;

const fmt = (x) => (typeof x === "number" ? x.toFixed(2) : "  ? ");
// A path is shown relative to the working directory when it sits under it, else whole.
const shown = (path, cwd) => {
  if (isAddress(path)) return path;
  const rel = relative(cwd, path);
  return !rel || rel.startsWith("..") ? path : rel;
};

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
  const argv = process.argv.slice(2);
  const command = ["rulings", "calibrate"].includes(argv[0]) ? argv.shift() : null;
  const a = parseArgs(argv);
  const ledger = ledgerPath();
  const cwd = a.cwd ? resolve(a.cwd) : process.cwd();
  const policy = loadPolicy();

  if (command === "rulings") {
    let pending = pendingDecisions(readRecords(ledger));
    if (typeof a.mission === "string") pending = pending.filter((d) => String(d.mission ?? "").toLowerCase().includes(a.mission.toLowerCase()));
    const groups = groupByMission(pending);
    if (a.json) { console.log(JSON.stringify({ pending: pending.length, groups }, null, 2)); return; }
    if (!pending.length) { console.log("nothing waits for a ruling"); return; }
    for (const g of groups) {
      console.log(`\n${g.count} waiting · ${g.mission.slice(0, 110)}${g.mission.length > 110 ? "…" : ""}`);
      for (const d of g.items) console.log(`  ${d.id}  ${String(d.verdict).padEnd(5)} ${fmt(d.relevant)}  ${(d.section ? `L${d.section.line} ${d.section.text}` : "").slice(0, 24).padEnd(24)}  ${shown(d.path, cwd)}`);
    }
    console.log(`\n${pending.length} decisions wait for a ruling · read-gate.mjs --ruling read|skip --by <who> --path <file|miadi-review:uuid>`);
    return;
  }

  if (command === "calibrate") {
    const cls = typeof a.class === "string" ? a.class : "relevant";
    const report = calibrate(readRecords(ledger), { cls, target: Number(a.target ?? 0.95), min: Number(a.min ?? 20) });
    if (a.json) console.log(JSON.stringify(report, null, 2));
    else if (!report.rulings) console.log(`no ruled decisions in class ${cls}: nothing to calibrate yet (policy in force: ${JSON.stringify(policy)})`);
    else console.log(`${report.rulings} ruled decisions in class ${cls} · ${report.suggested ? `suggested ${JSON.stringify(report.suggested)}` : `no cut reaches ${report.min} rulings at ${report.target} agreement`}`);
    if (a.write) {
      const next = writePolicy(report, { by: typeof a.by === "string" ? a.by : "" });
      console.log(`policy written to ${POLICY_FILE}: ${JSON.stringify(next)}`);
    }
    return;
  }

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
  if (typeof a["reviews-since"] === "string") {
    const recent = await reviewsSince(a["reviews-since"]);
    console.error(`reviews since ${a["reviews-since"]}: ${recent.length} in the feed`);
    for (const uuid of recent) if (!reviews.some((r) => r.includes(uuid))) reviews.push(uuid);
  }
  if (typeof a.pde === "string") {
    const need = filesNeededFromPde(resolve(cwd, a.pde));
    console.error(`pde ${need.pde}: ${need.found.length} files_needed entries resolve on this host, ${need.skipped.length} do not`);
    for (const s of need.skipped) console.error(`  not a path here: ${s.path}`);
    a._.push(...need.found);
  }
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
    const record = makeRecord({ result, requestedModel: model, mission, known, file: states[i], request, readAnswer, estimateTokens, now, seq: i, policy });
    append(ledger, record);
    return record;
  });

  if (a.json) { console.log(JSON.stringify(records, null, 2)); return; }
  printTable(records, cwd);
  const counts = VERDICTS.map((v) => `${v} ${records.filter((r) => r.verdict === v).length}`).join(", ");
  const paid = records.reduce((acc, r) => acc + (r.paid_input_tokens ?? 0), 0);
  const bars = policy.set_by ? `set by ${policy.set_by} from ${policy.rulings} rulings on ${String(policy.date).slice(0, 10)}` : "uncalibrated starting lines";
  console.log(`\n${counts} · read at ≥ ${policy.read_at}, skip at ≤ ${policy.skip_at} (${bars}) · action bar ${policy.action_bar} = top ${topProbabilityFor(policy.action_bar, Object.keys(ACTIONS).length)} on ${Object.keys(ACTIONS).length} options`);
  console.log(`model ${records[0]?.model ?? "?"} (requested ${model}) · ${paid} tokens paid · ≈$${(paid * 0.042 / 1e6).toFixed(4)} at $0.042/M · ledger ${ledger}`);
  console.log(`a read you make against a verdict is a ruling: read-gate.mjs --ruling read|skip --by <who> --path <file>`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`read-gate: ${error.message}`); process.exit(1); });
}
