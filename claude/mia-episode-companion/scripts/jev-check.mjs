#!/usr/bin/env node
// jev-check — before a return reaches William, ask Jev the questions in jev/questions.json
// about it, and print each answer with its flag. Step 5 of the mia-episode-companion turn.
//
//   node jev-check.mjs check --episode <dir> --take <id> [--take <id>] --draft <file|->
//        [--fact "<what this turn did>"]... [--evidence <file>] [--model <m>] [--dry] [--out <file>]
//   node jev-check.mjs models          # the key's service and models; no inference, no charge
//
// What leaves the host: William's take (its validated English text), the draft, the facts,
// and the typed questions. Nothing else. The key is read by lane-check's decider from the
// environment or one literal line of ~/.env, and it is never printed. `--dry` sends nothing.
//
// A flag never blocks delivery, and neither does a check that could not run: the exit code is
// 0 whenever answers came back, flags or not, and 1 only when the check did not run.
//
// Each run appends one record to ${MIADI_DECISIONS_DIR:-~/.miadi/decisions}/mia-return.jsonl,
// outside every repository, beside lane-check.jsonl and proposal-score.jsonl. William's
// rulings on those records are what the thresholds will be set from.
//
// The decider is lane-check's (jgwill/smcraft examples/decision-gate/lane-check), imported by
// path as the kit's proposal scorer does, until it moves into this kit. Set LANE_CHECK_DIR to
// another checkout.

import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LANE_CHECK = process.env.LANE_CHECK_DIR || "/workspace/repos/jgwill/smcraft/examples/decision-gate/lane-check";

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command, take: [], fact: [], questions: join(HERE, "jev", "questions.json"), dry: false };
  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    const value = () => {
      const next = rest[i + 1];
      if (next === undefined) throw new Error(`${flag} needs a value`);
      i += 1;
      return next;
    };
    if (flag === "--episode") args.episode = value();
    else if (flag === "--take") args.take.push(value());
    else if (flag === "--draft") args.draft = value();
    else if (flag === "--fact") args.fact.push(value());
    else if (flag === "--evidence") args.evidence = value();
    else if (flag === "--questions") args.questions = value();
    else if (flag === "--model") args.model = value();
    else if (flag === "--out") args.out = value();
    else if (flag === "--ledger") args.ledger = value();
    else if (flag === "--dry") args.dry = true;
    else throw new Error(`unknown argument ${flag}`);
  }
  return args;
}

// The validated English text of a take, where the capture contract puts it.
export function readTake(episode, takeId) {
  const file = join(resolve(episode), "captures", takeId, `transcription_${takeId}_EN.txt`);
  if (!existsSync(file)) throw new Error(`no English transcription for take ${takeId} at ${file}`);
  return readFileSync(file, "utf8").trim();
}

export function buildState({ takes, draft, evidence }) {
  const take = takes.length === 1 ? takes[0].text : takes.map((t) => `[take ${t.id}]\n${t.text}`).join("\n\n");
  return { take, draft: draft.trim(), evidence };
}

export function wireQuestions(questions) {
  return Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, { type: q.type, instructions: q.instructions, criteria: q.criteria }]));
}

export function isFlagged(question, value) {
  if (value == null) return null;
  const when = question.flag_when;
  return Array.isArray(when) ? when.includes(value) : value === when;
}

function readDraft(source) {
  if (!source) throw new Error("check needs --draft <file>, or --draft - with the draft on stdin");
  return source === "-" ? readFileSync(0, "utf8") : readFileSync(source, "utf8");
}

async function loadDecider() {
  const path = join(LANE_CHECK, "lib", "decider.mjs");
  if (!existsSync(path)) throw new Error(`lane-check's decider is not at ${path}; set LANE_CHECK_DIR`);
  return import(pathToFileURL(path).href);
}

async function check(args) {
  if (!args.episode) throw new Error("check needs --episode <dir>");
  if (!args.take.length) throw new Error("check needs --take <id>");
  const set = JSON.parse(readFileSync(args.questions, "utf8"));
  const takes = args.take.map((id) => ({ id, text: readTake(args.episode, id) }));
  const draft = readDraft(args.draft);
  const evidence = [
    ...(args.evidence ? readFileSync(args.evidence, "utf8").split("\n") : []),
    ...args.fact,
  ].map((line) => line.trim()).filter(Boolean);
  const state = buildState({ takes, draft, evidence });
  const model = args.model || set.model;
  const decider = await loadDecider();
  const request = decider.buildRequest(state, wireQuestions(set.questions), model);
  const result = args.dry ? await decider.decideDry(request) : await decider.decideJev(request);

  const answers = Object.entries(set.questions).map(([id, q]) => {
    const reading = decider.readAnswer(result.answers?.[id]);
    return { id, class: q.class, type: q.type, value: reading.value, p: reading.p, p_measures: reading.p_measures, probabilities: reading.probabilities ?? null, flag: isFlagged(q, reading.value) };
  });
  const record = {
    id: randomUUID(),
    at: new Date().toISOString(),
    kind: "mia-return",
    questions_version: set.version,
    decider: result.model ?? model,
    requested_model: model,
    run_id: result.billing?.run_id ?? null,
    sent: Boolean(result.sent),
    episode: resolve(args.episode),
    takes: args.take,
    draft: state.draft,
    draft_sha256: createHash("sha256").update(state.draft).digest("hex"),
    evidence,
    usage: result.usage ?? null,
    estimated_input_tokens: decider.estimateTokens(request),
    answers,
    ruling_id: null,
  };
  return record;
}

function print(record) {
  for (const a of record.answers) {
    const mark = a.flag ? "FLAG" : a.flag === false ? " ok " : "  ? ";
    const p = a.p == null ? "  -  " : a.p.toFixed(2);
    console.log(`${mark}  ${a.id.padEnd(22)} ${String(a.value).padEnd(8)} p=${p}`);
  }
  const flags = record.answers.filter((a) => a.flag).map((a) => a.id);
  console.log(`jev-check · ${record.decider} · sent ${record.sent} · ~${record.estimated_input_tokens} input tokens${record.run_id ? ` · run ${record.run_id}` : ""}`);
  console.log(flags.length
    ? `flags: ${flags.join(", ")}. Look again at the draft for each: revise it, or keep it and say why in one line. A flag does not block delivery.`
    : "no flags.");
}

function ledgerPath(args) {
  return args.ledger || join(process.env.MIADI_DECISIONS_DIR || join(homedir(), ".miadi", "decisions"), "mia-return.jsonl");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "models") {
    const decider = await loadDecider();
    const m = await decider.listModels();
    console.log(`${m.service} · ${m.keyName} · ${m.destination}`);
    for (const model of m.models) console.log(`  ${model.id ?? model.name ?? JSON.stringify(model)}`);
    return;
  }
  if (args.command !== "check") {
    console.log("usage: jev-check.mjs check --episode <dir> --take <id> --draft <file|-> [--fact <line>]... | models");
    process.exitCode = args.command ? 2 : 0;
    return;
  }
  const record = await check(args);
  print(record);
  if (args.out) writeFileSync(args.out, `${JSON.stringify(record, null, 2)}\n`);
  if (record.sent) {
    const path = ledgerPath(args);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(record)}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`jev-check: the check did not run: ${error.message}. Deliver the return anyway and say so in one line.`);
    process.exitCode = 1;
  });
}
