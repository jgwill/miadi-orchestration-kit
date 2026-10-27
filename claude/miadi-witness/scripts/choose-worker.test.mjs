// node --test claude/miadi-witness/scripts/choose-worker.test.mjs
// Needs lane-check's decider at $LANE_CHECK_DIR (default /workspace/repos/jgwill/smcraft/...). No call is made.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ALIASES, buildQuestions, buildState, lastDecision, makeRecord, makeRuling, MODEL, needsPerson, OWNER_AT, topProbabilityFor, TRIGGERS, WORKERS } from "./choose-worker.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "choose-worker.mjs");

const answer = (worker, probabilities, triggers) => ({
  model: "typesafe/jev-1.13-20260917",
  answers: {
    worker: { type: "choice", choice: worker, probabilities, confidence: (Math.max(...Object.values(probabilities)) - 1 / 6) / (5 / 6) },
    ...Object.fromEntries(Object.entries(triggers).map(([id, p]) => [id, { type: "noul", noul: p }])),
  },
  billing: { run_id: "run-1", paid_input_tokens_used: "1700" },
  sent: true,
});
const quiet = Object.fromEntries(Object.keys(TRIGGERS).map((id) => [id, 0.1]));
const probs = { self: 0.05, haiku: 0.02, sonnet: 0.07, opus: 0.65, fable: 0.02, seat: 0.19 };

test("six literal trigger nouls replace needs_person, and the state names the repository and the shared service", () => {
  const q = buildQuestions();
  assert.equal(q.needs_person, undefined);
  assert.deepEqual(Object.keys(q), ["worker", "deletes", "credential", "names_new", "money", "foreign_repo", "outside_audience"]);
  for (const id of Object.keys(TRIGGERS)) assert.equal(q[id].type, "noul");
  assert.deepEqual(Object.keys(q.worker.criteria), Object.keys(WORKERS));
  assert.deepEqual(buildState({ task: "t", facts: "survey line", repository: "jgwill/smcraft", sharedService: "none" }), { task: "t", facts: "survey line", repository: "jgwill/smcraft", shared_service: "none" });
});

test("needs_person is computed in code: any trigger at or above owner_at, or unanswered", () => {
  assert.deepEqual(needsPerson(quiet), { needs_person: false, needs_person_for: [] });
  assert.deepEqual(needsPerson({ ...quiet, foreign_repo: OWNER_AT }), { needs_person: true, needs_person_for: ["foreign_repo"] });
  assert.deepEqual(needsPerson({ ...quiet, money: null }), { needs_person: true, needs_person_for: ["money"] });
});

test("the model is pinned, never an alias", () => {
  assert.equal(MODEL, "jev-1.13.0");
  assert.ok(!ALIASES.includes(MODEL));
});

test("the record carries the bar beside the number, the top probability and both model names", () => {
  const request = { model: MODEL, state: buildState({ task: "t" }), questions: buildQuestions() };
  const r = makeRecord({ result: answer("opus", probs, { ...quiet, foreign_repo: 0.71 }), requestedModel: MODEL, task: "t", facts: "f", repository: "jgwill/smcraft", sharedService: "none", request, now: "2026-10-26T12:00:00.000Z" });
  assert.equal(r.kind, "decision");
  assert.equal(r.id, "wc-20261026120000000");
  assert.equal(r.requested_model, "jev-1.13.0");
  assert.equal(r.model, "typesafe/jev-1.13-20260917");
  assert.equal(r.top_probability, 0.65);
  assert.deepEqual(r.bar, { confidence: 0.6, top_probability: 0.667, options: 6 });
  assert.equal(r.above_bar, false);
  assert.equal(r.needs_person, true);
  assert.deepEqual(r.needs_person_for, ["foreign_repo"]);
  assert.equal(r.paid_input_tokens, 1700);
  assert.equal(topProbabilityFor(0.6, 6), 0.667);
});

test("a ruling confirms or overrides Jev's worker on the last decision, and refuses a contradiction", () => {
  const legacy = { at: "2026-10-27T02:21:46.222Z", model: "jev-1.14.0", worker: "opus", confidence: 0.58 };
  const d = lastDecision([{ at: "x", worker: "fable", confidence: 0.51 }, legacy, { kind: "ruling", id: "rul-x" }]);
  assert.equal(d, legacy);
  const r = makeRuling({ decision: d, verdict: "confirm", by: "mino-261019-inventory", choice: "opus", now: "2026-10-26T12:00:00.000Z" });
  assert.equal(r.decision_id, legacy.at);
  assert.equal(r.below_bar, true);
  assert.equal(r.jev_worker, "opus");
  assert.throws(() => makeRuling({ decision: d, verdict: "confirm", by: "x", choice: "fable" }), /override/);
  assert.throws(() => makeRuling({ decision: d, verdict: "override", by: "x", choice: "opus" }), /another worker/);
  assert.throws(() => makeRuling({ decision: d, verdict: "override", by: "x", choice: "gpt" }), /--choice/);
  assert.throws(() => makeRuling({ decision: d, verdict: "maybe", by: "x", choice: "opus" }), /--ruling/);
});

test("--ruling writes beside the last decision in the ledger and sends nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "choose-worker-"));
  const ledger = join(dir, "worker-choice.jsonl");
  writeFileSync(ledger, JSON.stringify({ kind: "decision", id: "wc-1", at: "a", worker: "sonnet", confidence: 0.66 }) + "\n");
  const out = execFileSync(process.execPath, [SCRIPT, "--ruling", "override", "--by", "William", "--choice", "opus", "--words", "opus for this one"], { env: { ...process.env, WORKER_CHOICE_LEDGER: ledger }, encoding: "utf8" });
  assert.match(out, /rul-wc-1 · override opus by William/);
  const lines = readFileSync(ledger, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  assert.equal(lines[1].kind, "ruling");
  assert.equal(lines[1].words, "opus for this one");
});

test("--dry sends nothing and writes nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "choose-worker-"));
  const ledger = join(dir, "worker-choice.jsonl");
  const out = execFileSync(process.execPath, [SCRIPT, "--task", "check a commit", "--facts", "one line", "--repository", "none", "--dry"], { env: { ...process.env, WORKER_CHOICE_LEDGER: ledger }, encoding: "utf8" });
  assert.match(out, /^dry: \d+ tokens estimated, ~\d+ paid expected/);
  assert.throws(() => readFileSync(ledger));
});
