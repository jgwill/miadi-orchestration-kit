#!/usr/bin/env node
// choose-worker — ask Jev which worker should take a piece of work, before a subagent or a
// tmux seat is started. William, 2026-10-26: be "Economic in your usage of subagents or
// spawning of other tmux workers by using JEV decision engine for choosing which best model
// should handle the work".
//
// usage: choose-worker.mjs --task "<what the work is>" [--task-file F] [--facts "<what is known>"]
//                          [--model jev-1.14.0] [--dry] [--json]
//
// What leaves the host: the task text and the facts, nothing else. The key is read by
// lane-check's decider (JEV_AI_API_KEY from the environment or one literal line of ~/.env)
// and never printed. Every answer is appended to ~/.miadi/decisions/worker-choice.jsonl.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const LANE_CHECK = process.env.LANE_CHECK_DIR || "/workspace/repos/jgwill/smcraft/examples/decision-gate/lane-check";
const { buildRequest, decideDry, decideJev, readAnswer } = await import(pathToFileURL(join(LANE_CHECK, "lib", "decider.mjs")).href);

export const WORKERS = {
  self: "The coordinating seat does it in the turn it was asked: a handful of tool calls, a lookup whose target is known, a check it can run inline, or work that needs the context the seat already holds. Starting another agent would cost more than doing it.",
  haiku: "Claude Haiku 5.5 as a subagent: repetitive or high-volume work with a clear method and little judgment, such as summarising, classifying, routing, reading many transcripts or files to extract fields, or checking a list.",
  sonnet: "Claude Sonnet 5.5 as a subagent: bounded research or drafting by a known method, such as web research with citations, writing one section of a review, or a single-repository change with tests where the design is already decided.",
  opus: "Claude Opus 5.5 as a subagent: a multi-file change or a verification-heavy task inside one repository, where judgment is needed within a known method and mistakes are costly.",
  fable: "Claude Fable 5.1 as a subagent: wide-context synthesis across many sources, adjudicating between defensible readings of the person's intent, or deciding what a body of work should become.",
  seat: "A tmux seat of its own (mct new <team> <name> --mission): the work must persist across turns or days, hold its own repository context, rebuild or release a service, or be steered by the person directly.",
};

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const k = argv[i].slice(2); const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) out[k] = true; else { out[k] = v; i += 1; }
  }
  return out;
}

const a = args(process.argv.slice(2));
const task = a["task-file"] ? readFileSync(a["task-file"], "utf8") : a.task;
if (!task) { console.error("usage: choose-worker.mjs --task \"<work>\" [--task-file F] [--facts \"<known>\"] [--model jev-1.14.0] [--dry] [--json]"); process.exit(2); }

const questions = {
  worker: {
    type: "choice",
    instructions: "Which worker should take `task`, given `facts`? Choose the least costly worker that can do it well. Prefer `self` when the coordinating seat can finish it in a few tool calls.",
    criteria: WORKERS,
  },
  needs_person: {
    type: "noul",
    instructions: "Does `task` require the person's own act or decision: a deletion, a credential, a name, money, someone else's repository, or an outside audience?",
    criteria: { true: "Some part of it needs the person.", false: "Agents can carry all of it." },
  },
};
const req = buildRequest({ task, facts: a.facts || "" }, questions, a.model || "jev-1.14.0");
const res = a.dry ? await decideDry(req) : await decideJev(req);
const worker = readAnswer(res.answers?.worker);
const person = readAnswer(res.answers?.needs_person);
const record = { at: new Date().toISOString(), model: res.model, task: task.slice(0, 500), worker: worker.value, confidence: worker.p, probabilities: worker.probabilities, needs_person: person.value, p_person: person.p, sent: res.sent !== false };
if (!a.dry) {
  const dir = join(homedir(), ".miadi", "decisions"); mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, "worker-choice.jsonl"), JSON.stringify(record) + "\n");
}
if (a.json) console.log(JSON.stringify(record, null, 2));
else console.log(a.dry ? `dry: ${res.estimated_input_tokens} tokens estimated, nothing sent` : `worker=${worker.value} confidence=${worker.p?.toFixed(2)} needs_person=${person.value} (${person.p?.toFixed(2)})`);
