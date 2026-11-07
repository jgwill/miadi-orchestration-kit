import assert from "node:assert/strict";
import { test } from "node:test";

import { updateAsk } from "./asks-lib.mjs";

function ledger() {
  return {
    seat: "test",
    asks: [
      { id: "ask-1", title: "Teach the witness what a draft is", status: "open", words: [], evidence: [], history: [] },
      { id: "ask-2", title: "Finished work", status: "done", words: [], evidence: [], history: [] },
    ],
  };
}

test("--expect refuses an id that now names another ask, and changes nothing", () => {
  const l = ledger();
  assert.throws(() => updateAsk(l, "ask-1", { expect: "capabilities", evidence: ["x"] }), /does not contain/);
  assert.deepEqual(l.asks[0].evidence, []);
  assert.equal(l.asks[0].history.length, 0);
});

test("--expect passes on the title's words, whatever their case", () => {
  const ask = updateAsk(ledger(), "ask-1", { expect: "WHAT A DRAFT", evidence: ["x"] });
  assert.deepEqual(ask.evidence, ["x"]);
});

test("a done ask keeps its status unless reopened", () => {
  const l = ledger();
  assert.throws(() => updateAsk(l, "ask-2", { status: "partial" }), /--reopen/);
  assert.equal(l.asks[1].status, "done");
  assert.equal(updateAsk(l, "ask-2", { status: "partial", reopen: true }).status, "partial");
});

test("a done ask can take evidence without changing its status", () => {
  const ask = updateAsk(ledger(), "ask-2", { evidence: ["y"] });
  assert.equal(ask.status, "done");
  assert.deepEqual(ask.evidence, ["y"]);
});
