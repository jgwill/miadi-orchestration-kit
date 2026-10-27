#!/usr/bin/env node
// choose-worker — ask Jev which worker should take a piece of work, before a subagent or a
// tmux seat is started. William, 2026-10-26: be "Economic in your usage of subagents or
// spawning of other tmux workers by using JEV decision engine for choosing which best model
// should handle the work".
//
// usage: choose-worker.mjs --task "<what the work is>" [--task-file F]
//                          [--facts "<what is known>"] [--facts-file F]
//                          --repository <owner/repo|none> [--shared-service <name|none>]
//                          [--model jev-1.13.0] [--dry] [--json]
//        choose-worker.mjs --ruling <confirm|override> --by <who> --choice <worker> [--words "<verbatim>"]
//
// What leaves the host: the task, the facts (the dispatch survey's lines), the repository the
// lane writes to and the shared service it rebuilds. Nothing else. The key is read by
// lane-check's decider (JEV_AI_API_KEY from the environment or one literal line of ~/.env)
// and never printed. Every answer is appended to ~/.miadi/decisions/worker-choice.jsonl
// ($WORKER_CHOICE_LEDGER for another file).
//
// Revised 2026-10-26 from the Jev study of Episode 564 (jev-study-261026.md, S1 and 4.2):
// - six literal trigger nouls replace the one `needs_person` noul, which read 0.42 to 0.61 on
//   five tasks; needs_person is computed here as any trigger at or above OWNER_AT;
// - the bar is written beside the number: 0.6 on six options is a top probability of 0.667,
//   and both are recorded;
// - `--ruling` writes the seat's or William's confirm or override on the last decision, so the
//   bar can be calibrated from their words;
// - one pinned model, and the resolved name recorded beside the requested one.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LANE_CHECK = process.env.LANE_CHECK_DIR || "/workspace/repos/jgwill/smcraft/examples/decision-gate/lane-check";
const { buildRequest, decideDry, decideJev, estimateTokens, readAnswer } = await import(pathToFileURL(join(LANE_CHECK, "lib", "decider.mjs")).href);

// Pinned with the proposal scorer (study R1): jev-1.13.0 holds 458 of its 519 records and
// JevBench ranks 1.14.0 below it. The questions changed in 0.2.0, so these records start a
// fresh series whatever the model.
export const MODEL = "jev-1.13.0";
export const QUESTIONS_VERSION = "0.2.0";
export const ALIASES = ["jev-latest", "jev-preview"];
export const OWNER_AT = 0.5;
export const WORKER_BAR = 0.6;
export const VERDICTS = ["confirm", "override"];

export const WORKERS = {
  self: "The coordinating seat does it in the turn it was asked: a handful of tool calls, a lookup whose target is known, a check it can run inline, or work that needs the context the seat already holds. Starting another agent would cost more than doing it.",
  haiku: "Claude Haiku 5.5 as a subagent: repetitive or high-volume work with a clear method and little judgment, such as summarising, classifying, routing, reading many transcripts or files to extract fields, or checking a list.",
  sonnet: "Claude Sonnet 5.5 as a subagent: bounded research or drafting by a known method, such as web research with citations, writing one section of a review, or a single-repository change with tests where the design is already decided.",
  opus: "Claude Opus 5.5 as a subagent: a multi-file change or a verification-heavy task inside one repository, where judgment is needed within a known method and mistakes are costly.",
  fable: "Claude Fable 5.1 as a subagent: wide-context synthesis across many sources, adjudicating between defensible readings of the person's intent, or deciding what a body of work should become.",
  seat: "A tmux seat of its own (mct new <team> <name> --mission): the work must persist across turns or days, hold its own repository context, rebuild or release a service, or be steered by the person directly.",
};

// The six things that stay William's whatever the number (study S1). Each names one trigger,
// and its criteria read the same way as its instruction.
export const TRIGGERS = {
  deletes: { type: "noul", instructions: "Does `task` delete a file, a branch, a record or a session that exists today?", criteria: { true: "It deletes something that exists.", false: "It deletes nothing." } },
  credential: { type: "noul", instructions: "Does `task` create, read, move or send a key, a token or a password?", criteria: { true: "It touches a credential.", false: "It touches none." } },
  names_new: { type: "noul", instructions: "Does `task` give a new name to a package, repository, session, episode or public title?", criteria: { true: "It names something new.", false: "It names nothing new." } },
  money: { type: "noul", instructions: "Does `task` spend money or change a plan or a balance?", criteria: { true: "It spends or changes money.", false: "It does not." } },
  foreign_repo: { type: "noul", instructions: "Does `task` write to a repository or account that is not William's own (`repository` names it)?", criteria: { true: "It writes to someone else's repository or account.", false: "It writes only to William's own, or to none." } },
  outside_audience: { type: "noul", instructions: "Does `task` publish, post, release or send something people outside the circle will see?", criteria: { true: "It reaches an outside audience.", false: "It reaches nobody outside the circle." } },
};

export function buildQuestions() {
  return {
    worker: {
      type: "choice",
      instructions: "Which worker should take `task`, given `facts`? Choose the least costly worker that can do it well. Prefer `self` when the coordinating seat can finish it in a few tool calls.",
      criteria: WORKERS,
    },
    ...TRIGGERS,
  };
}

export function buildState({ task, facts = "", repository = "not given", sharedService = "none" }) {
  return { task, facts, repository, shared_service: sharedService };
}

// The top probability a confidence bar requires on a choice of n options:
// confidence = (p_max - 1/n) / (1 - 1/n).
export function topProbabilityFor(confidence, n) {
  return Number((confidence * (1 - 1 / n) + 1 / n).toFixed(3));
}

export function topProbability(probabilities) {
  const values = Object.values(probabilities ?? {}).filter((v) => typeof v === "number");
  return values.length ? Math.max(...values) : null;
}

// needs_person is computed in code: any trigger at or above OWNER_AT. An unanswered trigger
// counts, because a reading that is missing errs toward the person.
export function needsPerson(triggers, ownerAt = OWNER_AT) {
  const over = Object.entries(triggers).filter(([, p]) => typeof p !== "number" || p >= ownerAt).map(([id]) => id);
  return { needs_person: over.length > 0, needs_person_for: over };
}

export function makeRecord({ result, requestedModel, task, facts, repository, sharedService, request, now = new Date().toISOString() }) {
  const worker = readAnswer(result.answers?.worker);
  const triggers = Object.fromEntries(Object.keys(TRIGGERS).map((id) => [id, readAnswer(result.answers?.[id]).p]));
  const n = Object.keys(WORKERS).length;
  const top = topProbability(worker.probabilities);
  const paid = Number(result.billing?.paid_input_tokens_used ?? NaN);
  return {
    kind: "decision",
    id: `wc-${now.replace(/[-:.TZ]/g, "").slice(0, 17)}`,
    at: now,
    questions_version: QUESTIONS_VERSION,
    requested_model: requestedModel,
    model: result.model ?? null,
    task: task.slice(0, 500),
    facts: facts.slice(0, 500),
    facts_chars: facts.length,
    repository,
    shared_service: sharedService,
    worker: worker.value,
    confidence: worker.p,
    top_probability: top,
    bar: { confidence: WORKER_BAR, top_probability: topProbabilityFor(WORKER_BAR, n), options: n },
    above_bar: typeof worker.p === "number" ? worker.p >= WORKER_BAR : false,
    probabilities: worker.probabilities ?? null,
    option_order: Object.keys(request.questions.worker.criteria),
    worker_read_status: worker.read_status ?? null,
    triggers,
    owner_at: OWNER_AT,
    ...needsPerson(triggers),
    estimated_input_tokens: estimateTokens(request),
    paid_input_tokens: Number.isFinite(paid) ? paid : (result.usage?.input_tokens ?? null),
    run_id: result.billing?.run_id ?? result.id ?? null,
    billing: result.billing ?? null,
    validation: result.validation ?? null,
    sent: result.sent !== false,
  };
}

// The seat's or William's word on a decision: confirm Jev's worker, or override it with
// another. Written beside the decision it answers, never in place of it.
export function makeRuling({ decision, verdict, by, choice, words = null, now = new Date().toISOString() }) {
  if (!decision) throw new Error("no decision in the ledger to rule on");
  if (!VERDICTS.includes(verdict)) throw new Error(`--ruling is one of ${VERDICTS.join(", ")}`);
  if (!by) throw new Error("--by names who ruled");
  if (!Object.hasOwn(WORKERS, choice ?? "")) throw new Error(`--choice is one of ${Object.keys(WORKERS).join(", ")}`);
  if (verdict === "confirm" && choice !== decision.worker) throw new Error(`confirm keeps Jev's worker (${decision.worker}); --choice ${choice} is an override`);
  if (verdict === "override" && choice === decision.worker) throw new Error(`override names another worker than Jev's (${decision.worker})`);
  const decisionId = decision.id ?? decision.at;
  return {
    kind: "ruling",
    id: `rul-${decisionId}`,
    decision_id: decisionId,
    verdict,
    decided_by: by,
    choice,
    jev_worker: decision.worker ?? null,
    jev_confidence: decision.confidence ?? null,
    below_bar: typeof decision.confidence === "number" ? decision.confidence < WORKER_BAR : null,
    words,
    at: now,
  };
}

export function ledgerPath(env = process.env) {
  return env.WORKER_CHOICE_LEDGER || join(homedir(), ".miadi", "decisions", "worker-choice.jsonl");
}

// The last decision in the ledger. Records written before 0.2.0 carry no kind and no id; their
// `at` stands for the id.
export function lastDecision(records) {
  return [...records].reverse().find((r) => r.kind === "decision" || (r.kind === undefined && r.worker !== undefined)) ?? null;
}

function readRecords(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function append(path, record) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(record) + "\n");
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2); const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) out[k] = true; else { out[k] = v; i += 1; }
  }
  return out;
}

const USAGE = "usage: choose-worker.mjs --task \"<work>\" [--task-file F] [--facts \"<known>\"] [--facts-file F] --repository <owner/repo|none> [--shared-service <name|none>] [--model jev-1.13.0] [--dry] [--json]\n       choose-worker.mjs --ruling <confirm|override> --by <who> --choice <worker> [--words \"<verbatim>\"]";

async function main() {
  const a = args(process.argv.slice(2));
  const ledger = ledgerPath();

  if (a.ruling) {
    const ruling = makeRuling({ decision: lastDecision(readRecords(ledger)), verdict: a.ruling, by: a.by, choice: a.choice, words: typeof a.words === "string" ? a.words : null });
    append(ledger, ruling);
    console.log(`${ruling.id} · ${ruling.verdict} ${ruling.choice} by ${ruling.decided_by} (Jev ${ruling.jev_worker} ${ruling.jev_confidence?.toFixed?.(2) ?? "?"}${ruling.below_bar ? ", below the bar" : ""})`);
    return;
  }

  const task = a["task-file"] ? readFileSync(a["task-file"], "utf8") : a.task;
  if (!task || task === true) { console.error(USAGE); process.exit(2); }
  const facts = a["facts-file"] ? readFileSync(a["facts-file"], "utf8").trim() : (typeof a.facts === "string" ? a.facts : "");
  const repository = typeof a.repository === "string" ? a.repository : "not given";
  const sharedService = typeof a["shared-service"] === "string" ? a["shared-service"] : "none";
  if (!facts) console.error("choose-worker: no --facts; send the dispatch survey's lines so the choice reads what the seat knows (study 4.2).");
  if (repository === "not given") console.error("choose-worker: no --repository; foreign_repo cannot be read without it. Pass owner/repo, or none.");
  const model = typeof a.model === "string" ? a.model : MODEL;
  if (ALIASES.includes(model)) throw new Error(`${model} is an alias that resolves differently on jev-ai.pro and TypeSafe; pin a version such as ${MODEL}`);

  const request = buildRequest(buildState({ task, facts, repository, sharedService }), buildQuestions(), model);
  const result = a.dry ? await decideDry(request) : await decideJev(request);
  if (a.dry) {
    console.log(`dry: ${result.estimated_input_tokens} tokens estimated, ~${Math.round(result.estimated_input_tokens * 1.61)} paid expected at Episode 562's ratio 1.61, nothing sent`);
    if (a.json) console.log(JSON.stringify(request, null, 2));
    return;
  }
  const record = makeRecord({ result, requestedModel: model, task, facts, repository, sharedService, request });
  append(ledger, record);
  if (a.json) { console.log(JSON.stringify(record, null, 2)); return; }
  const fmt = (x) => (typeof x === "number" ? x.toFixed(2) : "?");
  console.log(`worker=${record.worker} confidence=${fmt(record.confidence)} top=${fmt(record.top_probability)} · bar ${record.bar.confidence} = top ${record.bar.top_probability} on ${record.bar.options} options · ${record.above_bar ? "above the bar: take it and say so" : "below the bar: the seat chooses between the top two and records it with --ruling"}`);
  console.log(record.needs_person ? `needs William for: ${record.needs_person_for.map((id) => `${id} ${fmt(record.triggers[id])}`).join(", ")}` : `needs William for: nothing (every trigger under ${OWNER_AT})`);
  console.log(`model ${record.model} (requested ${record.requested_model}) · ${record.paid_input_tokens ?? "?"} tokens paid · ${record.id}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`choose-worker: ${error.message}`); process.exit(1); });
}
