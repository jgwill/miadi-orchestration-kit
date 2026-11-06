#!/usr/bin/env node
// plan-read: the seat's own checks on a saved plan, before `studio proceed` spends a video slot.
//
//   node plan-read.mjs words <outline.md>
//   node plan-read.mjs jev   <outline.md> --brief <text or file> [--videos-today N] [--dry] [--out file.json]
//
// `words` reads the plan against forbidden-words.txt. Exit 0 clean, 1 with each hit and its system rule.
// DeepDiver saves plans itself, so the word gate on Write and Edit never sees them.
//
// `jev` asks plan-questions.json about the plan. What leaves the host is the plan's text, the brief
// and the questions. Exit 0 with a reading, 1 on a failure. The key is read by lane-check's decider
// from the environment or ~/.env and never printed. A record goes to ~/.miadi/decisions/plan-read.jsonl.
//
// The reading is advice until Guillaume's rulings calibrate it. Its "route" says who the plan goes to:
//   person   a person reads it first: any check fired or reads uncertain, or Jev chose
//            ask_a_person, hold_for_circle or other, or its confidence is under act_at;
//   revise   the seat writes the change from the checks that fired, and a person can read both;
//   send     the seat may send it on. Only render_now at act_at or above, with nothing fired, reaches this.
// An uncertain reading errs toward the person, which is how Jev keeps a person near the loop.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { findForbidden, loadWords } from "../hooks/word-gate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const LANE_CHECK = process.env.LANE_CHECK_DIR || "/workspace/repos/jgwill/smcraft/examples/decision-gate/lane-check";
export const QUESTIONS_FILE = join(HERE, "plan-questions.json");
export const POLICY = { act_at: 0.8, fired_at: 0.5, uncertain: [0.4, 0.6] };

// A kept plan's text, without the lines saying where it came from.
export function planText(raw) {
  return raw.replace(/^---\n[\s\S]*?\n---\n+/, "").trim();
}

function ledgerPath() {
  return process.env.PLAN_READ_LEDGER || join(homedir(), ".miadi", "decisions", "plan-read.jsonl");
}

// Jev leans toward the option that comes first, so the order turns with the plan.
export function rotate(criteria, seed) {
  const keys = Object.keys(criteria);
  const by = parseInt(seed.slice(0, 6), 16) % keys.length;
  return Object.fromEntries([...keys.slice(by), ...keys.slice(0, by)].map((k) => [k, criteria[k]]));
}

export function buildQuestions(set, seed) {
  return Object.fromEntries(Object.entries(set.questions).map(([id, q]) => {
    const { type, instructions } = q;
    const criteria = type === "choice" ? rotate(q.criteria, seed) : q.criteria;
    return [id, { type, instructions, criteria }];
  }));
}

// Who the plan goes to, from the readings. `readings` is { id: { value, p } }; a noul's p is its probability.
export function route(readings, set, policy = POLICY) {
  const fired = [];
  const uncertain = [];
  for (const id of set.must_be_false) {
    const p = readings[id]?.p;
    if (typeof p !== "number") { uncertain.push(id); continue; }
    if (p >= policy.fired_at) fired.push(id);
    else if (p >= policy.uncertain[0]) uncertain.push(id);
  }
  for (const id of set.must_be_true) {
    const p = readings[id]?.p;
    if (typeof p !== "number") { uncertain.push(id); continue; }
    if (p < policy.uncertain[0]) fired.push(id);
    else if (p <= policy.uncertain[1]) uncertain.push(id);
  }
  const next = readings.next?.value;
  const confidence = readings.next?.p ?? 0;
  let to = "person";
  if (!uncertain.length && next === "render_now" && confidence >= policy.act_at && !fired.length) to = "send";
  else if (!uncertain.length && next === "revise_with_feedback" && confidence >= policy.act_at) to = "revise";
  return { to, next, confidence, fired, uncertain };
}

function arg(argv, name) {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

function words(path) {
  const hits = findForbidden(planText(readFileSync(path, "utf8")), loadWords());
  if (!hits.length) { console.log(`clean: ${basename(path)} carries no forbidden word`); return 0; }
  for (const h of hits) console.log(`"${h.found}", plan line ${h.line}: ${h.lineText}\n  write "${h.instead}", never "${h.word}"`);
  return 1;
}

async function jev(path, argv) {
  const raw = readFileSync(path, "utf8");
  const plan = planText(raw);
  const given = arg(argv, "--brief");
  if (!given) { console.error("plan-read: --brief is what the plan is checked against"); return 2; }
  const brief = existsSync(given) ? readFileSync(given, "utf8").trim() : given;
  const set = JSON.parse(readFileSync(QUESTIONS_FILE, "utf8"));
  const seed = createHash("sha256").update(plan).digest("hex");
  const { buildRequest, decideDry, decideJev, estimateTokens, readAnswer } = await import(pathToFileURL(join(LANE_CHECK, "lib", "decider.mjs")).href);
  const state = { brief, plan, made_today: { videos: Number(arg(argv, "--videos-today") ?? 0) } };
  const request = buildRequest(state, buildQuestions(set, seed), set.model);
  const dry = argv.includes("--dry");
  if (dry) await decideDry(request);
  const result = dry ? null : await decideJev(request);
  const readings = dry ? {} : Object.fromEntries(Object.keys(request.questions).map((id) => [id, readAnswer(result.answers?.[id])]));
  const record = {
    at: new Date().toISOString(), plan: basename(path), plan_sha256: seed, brief, questions_version: set.version, model: set.model,
    estimated_tokens: estimateTokens(request), paid_input_tokens: result?.usage?.input_tokens ?? null,
    option_order: Object.keys(request.questions.next.criteria), readings,
    route: dry ? null : route(readings, set), ruling: null,
  };
  if (!dry) {
    const ledger = ledgerPath();
    mkdirSync(dirname(ledger), { recursive: true });
    appendFileSync(ledger, `${JSON.stringify(record)}\n`);
  }
  const out = arg(argv, "--out");
  if (out) writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`);
  console.log(JSON.stringify(dry ? { dry: true, estimated_tokens: record.estimated_tokens, option_order: record.option_order } : { plan: record.plan, route: record.route, paid_input_tokens: record.paid_input_tokens }, null, 2));
  return 0;
}

async function main() {
  const [verb, path, ...rest] = process.argv.slice(2);
  if (!["words", "jev"].includes(verb) || !path) {
    console.error("usage: plan-read.mjs words <outline.md> | jev <outline.md> --brief <text or file> [--videos-today N] [--dry] [--out file]");
    return 2;
  }
  if (!existsSync(path)) { console.error(`plan-read: no such file: ${path}`); return 2; }
  return verb === "words" ? words(path) : jev(path, rest);
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  main().then((code) => { process.exitCode = code; }).catch((error) => { console.error(`plan-read: ${error.message}`); process.exitCode = 1; });
}
