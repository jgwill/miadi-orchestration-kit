// node --test claude/miadi-witness/scripts/wake-classify.test.mjs
// A stand-in decider; nothing is sent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { bindingTail, buildQuestions, buildState, classifyWake, marksOf, readingOf, STATES, wakeLine } from "./wake-classify.mjs";

const SID = "aaaaaaaa-0000-4000-8000-000000000001";

// lane-check's readAnswer, as the decider reads a choice.
const readAnswer = (a) => (a?.type === "choice" ? { value: a.choice, p: a.confidence, probabilities: a.probabilities, read_status: "satisfied" } : { value: null, p: null, read_status: "unknown" });
const choice = (c, probabilities) => {
  const n = Object.keys(probabilities).length;
  return { type: "choice", choice: c, probabilities, confidence: (Math.max(...Object.values(probabilities)) - 1 / n) / (1 - 1 / n) };
};

function fakeDecider(answer) {
  const sent = [];
  return {
    sent,
    buildRequest: (state, questions, model) => ({ state, questions, model }),
    estimateTokens: (v) => Math.ceil(JSON.stringify(v).length / 4),
    decideDry: async () => ({ sent: false, validation: { ok: true } }),
    decideJev: async (request) => { sent.push(request); return { model: "typesafe/jev-1.13", answers: { wake_state: answer }, billing: { run_id: "run-1", paid_input_tokens_used: "900" } }; },
    readAnswer,
  };
}

function fixture(message) {
  const base = mkdtempSync(join(tmpdir(), "wake-classify-"));
  const sessiondata = join(base, "sessiondata");
  mkdirSync(join(sessiondata, SID), { recursive: true });
  writeFileSync(join(sessiondata, SID, "last_claude_AssistantResponse.json"), JSON.stringify({ last_assistant_message: message }));
  const bindings = join(base, "bindings.jsonl");
  writeFileSync(bindings, [
    { at: "2026-10-26T10:00:00Z", event: "session.start", source: "startup", session_id: SID, name: { name: "k6-lane" }, tmux: { session: "k6-lane" } },
    { at: "2026-10-26T10:00:01Z", event: "session.start", session_id: "someone-else" },
    { at: "2026-10-26T11:00:00Z", event: "session.rename", session_id: SID, name: { name: "k6-lane-2" } },
    { at: "2026-10-26T12:00:00Z", event: "session.mission", session_id: SID, mission: "mis-k6" },
  ].map((r) => JSON.stringify(r)).join("\n") + "\n{torn");
  return { sessiondata, bindings, ledger: join(base, "wake.jsonl") };
}
const idle = { kind: "idle", thread: { session_id: SID, name: "k6-lane-2", status: "idle", status_since: "2026-10-26T12:30:00Z", tmux: { session: "k6-lane" } } };

test("the four states are the question's options, rotated and recorded", () => {
  assert.deepEqual(Object.keys(STATES), ["done", "holds_question", "idle_no_marks", "running"]);
  const { order, questions } = buildQuestions(1);
  assert.deepEqual(order, ["holds_question", "idle_no_marks", "running", "done"]);
  assert.deepEqual(Object.keys(questions.wake_state.criteria), order);
  assert.equal(questions.wake_state.type, "choice");
});

test("the state carries the binding tail, the last message's tail and the marks, with unknown marks as null", () => {
  const lines = readFileSync(fixture("x").bindings, "utf8").split("\n");
  const tail = bindingTail(lines, SID, 2);
  assert.deepEqual(tail.map((t) => t.event), ["session.rename", "session.mission"]);
  assert.equal(tail[1].mission, "mis-k6");
  assert.deepEqual(marksOf({ message: "Report\n- `DONE K6 · 4 commits`" }), { done_line: true, chart_step_complete: null, vessel_file_present: null });
  assert.equal(marksOf({ message: "Not DONE yet" }).done_line, false);
  const state = buildState({ thread: idle.thread, tail, message: "y".repeat(2000), marks: marksOf({}) });
  assert.ok(state.last_message_tail.startsWith("… "));
  assert.equal(state.last_message_tail.length, 1502);
});

test("a reading at or above the bar names the move; only holds_question is for William", () => {
  const q = readingOf(choice("holds_question", { done: 0.05, holds_question: 0.85, idle_no_marks: 0.05, running: 0.05 }), readAnswer);
  assert.equal(q.above_bar, true);
  assert.equal(q.for_william, true);
  const d = readingOf(choice("done", { done: 0.9, holds_question: 0.04, idle_no_marks: 0.03, running: 0.03 }), readAnswer);
  assert.equal(d.for_william, false);
  assert.match(d.move, /relay its DONE line/);
  const low = readingOf(choice("holds_question", { done: 0.3, holds_question: 0.4, idle_no_marks: 0.2, running: 0.1 }), readAnswer);
  assert.equal(low.above_bar, false);
  assert.equal(low.for_william, false, "below the bar nothing goes to him");
  assert.match(low.move, /below the bar/);
  assert.equal(readingOf(undefined, readAnswer).state, null);
});

test("a classified wake is one call, one ledger record, and one line under the event", async () => {
  const fx = fixture("I need William's word on the package name before I publish. Which one?");
  const decider = fakeDecider(choice("holds_question", { done: 0.05, holds_question: 0.85, idle_no_marks: 0.05, running: 0.05 }));
  const c = await classifyWake(idle, { decider, sessiondata: fx.sessiondata, bindingsPath: fx.bindings, env: { WAKE_CLASSIFY_LEDGER: fx.ledger }, now: () => new Date("2026-10-27T05:00:00Z") });
  assert.equal(decider.sent.length, 1);
  assert.equal(decider.sent[0].model, "jev-1.14.0");
  assert.equal(decider.sent[0].state.marks.done_line, false);
  assert.equal(c.state, "holds_question");
  const record = JSON.parse(readFileSync(fx.ledger, "utf8").trim());
  assert.equal(record.session_id, SID);
  assert.equal(record.paid_input_tokens, 900);
  assert.equal(record.bar.top_probability, 0.7);
  assert.match(wakeLine(c), /^ {3}Jev \(J7\): holds_question 0\.80 \(top 0\.85; bar 0\.6 = top 0\.7\) → read the question.* · for William · wake-aaaaaaaa-/);
});

test("--classify-dry sends nothing and says so; a failure is printed, never thrown", async () => {
  const fx = fixture("DONE K6 · tests pass");
  const decider = fakeDecider(null);
  const c = await classifyWake(idle, { decider, dry: true, sessiondata: fx.sessiondata, bindingsPath: fx.bindings, env: { WAKE_CLASSIFY_LEDGER: fx.ledger } });
  assert.equal(decider.sent.length, 0);
  assert.match(wakeLine(c), /Jev \(J7, dry\): nothing sent · ~\d+ tokens estimated, ~\d+ paid expected · DONE line present/);
  const broken = await classifyWake(idle, { decider: { ...decider, decideJev: async () => { throw new Error("402 balance"); } }, sessiondata: fx.sessiondata, bindingsPath: fx.bindings, env: { WAKE_CLASSIFY_LEDGER: fx.ledger } });
  assert.equal(wakeLine(broken), "   Jev (J7): not read (402 balance)");
});
