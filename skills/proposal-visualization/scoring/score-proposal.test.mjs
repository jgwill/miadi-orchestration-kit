// node --test skills/proposal-visualization/scoring/score-proposal.test.mjs
// Needs lane-check's decider at $LANE_CHECK_DIR (default /workspace/repos/jgwill/smcraft/...). No call is made.
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { ALIASES, bandOf, ledgerRecords, loadJson, PAID_RATIO, questionsFor, rotateCriteria, topProbability, topProbabilityFor, wire } from "./score-proposal.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const set = loadJson(join(HERE, "questions.json"));
const policy = loadJson(join(HERE, "policy.json"));

const quiet = () => Object.fromEntries(set.trigger_questions.map((id) => [id, { class: "trigger", type: "noul", value: false, p: 0.1 }]));
const choice = (value, p) => ({ class: "obvious_now", type: "choice", value, p });

test("the D1 rule is not sent as state, and every set carries the six trigger nouls and an exit", () => {
  assert.equal(set.rule, undefined);
  assert.equal(set.version, "0.2.0");
  assert.ok(!ALIASES.includes(set.model));
  assert.deepEqual(set.trigger_questions, ["deletes", "credential", "names_new", "money", "foreign_repo", "outside_audience"]);
  for (const name of Object.keys(set.sets)) {
    const q = questionsFor(set, name);
    assert.equal(q.needs_owner, undefined, `${name} still asks needs_owner`);
    for (const id of set.trigger_questions) assert.equal(q[id].type, "noul");
    assert.ok(Object.hasOwn(q.obvious_now.criteria, set.exit_options.obvious_now));
    assert.match(q.obvious_now.instructions, /D1 rule/);
    for (const id of Object.keys(q)) assert.doesNotMatch(q[id].instructions, /`rule`/);
  }
});

test("a trigger at or above owner_at sends the card to the person whatever obvious_now says", () => {
  const r = { ...quiet(), obvious_now: choice("do_now", 0.95), money: { class: "trigger", type: "noul", value: true, p: 0.72 } };
  const b = bandOf(r, policy, set);
  assert.equal(b.band, "owner");
  assert.deepEqual(b.triggers, ["money"]);
});

test("a trigger in the uncertain band errs toward the person, and an unanswered one does too", () => {
  assert.equal(bandOf({ ...quiet(), obvious_now: choice("do_now", 0.95), deletes: { p: 0.42 } }, policy, set).band, "owner");
  const missing = quiet(); delete missing.credential;
  assert.equal(bandOf({ ...missing, obvious_now: choice("do_now", 0.95) }, policy, set).band, "owner");
});

test("with quiet triggers, obvious_now decides: needs_decision and the exit go to the person", () => {
  assert.equal(bandOf({ ...quiet(), obvious_now: choice("needs_decision", 0.3) }, policy, set).band, "owner");
  assert.equal(bandOf({ ...quiet(), obvious_now: choice("other", 0.05) }, policy, set).band, "owner");
  assert.equal(bandOf({ ...quiet(), obvious_now: choice("do_now", 0.8) }, policy, set).band, "act");
  assert.equal(bandOf({ ...quiet(), obvious_now: choice("do_now", 0.79) }, policy, set).band, "ask");
  assert.equal(bandOf({ ...quiet(), obvious_now: choice("do_after_go", 0.99) }, policy, set).band, "ask");
});

test("a confidence bar on a choice is a top-probability bar that depends on the option count", () => {
  assert.equal(topProbabilityFor(0.8, 4), 0.85);
  assert.equal(topProbabilityFor(0.8, 3), 0.867);
  assert.equal(topProbabilityFor(0.6, 6), 0.667);
  assert.equal(topProbability({ a: 0.2, b: 0.65, c: 0.15 }), 0.65);
});

test("obvious_now's options rotate card by card, and the order sent is returned", () => {
  const criteria = set.sets.step.obvious_now.criteria;
  assert.deepEqual(rotateCriteria(criteria, 1).order, ["do_after_go", "needs_decision", "other", "do_now"]);
  assert.deepEqual(rotateCriteria(criteria, 4).order, Object.keys(criteria));
  const { questions, orders } = wire(questionsFor(set, "step"), 2, set.rotate);
  assert.deepEqual(Object.keys(questions.obvious_now.criteria), orders.obvious_now);
  assert.equal(orders.obvious_now[0], "needs_decision");
  assert.equal(questions.obvious_now.class, undefined, "class is stripped before sending");
});

test("the ledger keeps one call record with cost and facts hash, and decisions with both model names", () => {
  const scored = [{
    code: "A1", kind: "A", requested_model: "jev-1.13.0", model: "typesafe/jev-1.13-20260917", run_id: "run-1",
    billing: { paid_input_tokens_used: "2170" }, usage: { input_tokens: 2170 }, estimated_input_tokens: 1350,
    expected_paid_tokens: Math.round(1350 * PAID_RATIO), paid_input_tokens: 2170, validation: { ok: true, failures: [] },
    readings: { obvious_now: { class: "obvious_now", type: "choice", value: "do_now", p: 0.7, probabilities: { do_now: 0.775 }, top_probability: 0.775, option_order: ["do_now", "do_after_go", "needs_decision", "other"] } },
    band: "ask", why: "below",
  }];
  const records = ledgerRecords(scored, { page: "/p.html", policy, set, now: "2026-10-26T12:00:00.000Z", facts: { source: "file:/f.md", sha256: "abc" } });
  const call = records.find((r) => r.kind === "call");
  assert.equal(call.paid_input_tokens, 2170);
  assert.equal(call.estimated_input_tokens, 1350);
  assert.equal(call.facts_sha256, "abc");
  assert.deepEqual(call.option_orders.obvious_now[0], "do_now");
  const d = records.find((r) => r.kind === "decision");
  assert.equal(d.requested_model, "jev-1.13.0");
  assert.equal(d.decider, "typesafe/jev-1.13-20260917");
  assert.equal(d.top_probability, 0.775);
  assert.equal(d.id, "prop-A1-obvious_now-20261026120000");
});
