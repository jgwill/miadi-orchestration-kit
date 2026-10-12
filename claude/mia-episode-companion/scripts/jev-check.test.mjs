// node --test claude/mia-episode-companion/scripts/jev-check.test.mjs
// Nothing here calls Jev: every run is --dry, and the ledger is a temporary file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildState, isFlagged, parseArgs } from "./jev-check.mjs";

const SCRIPT = fileURLToPath(new URL("./jev-check.mjs", import.meta.url));
const QUESTIONS = JSON.parse(readFileSync(new URL("./jev/questions.json", import.meta.url), "utf8"));
const LANE_CHECK = process.env.LANE_CHECK_DIR || "/workspace/repos/jgwill/smcraft/examples/decision-gate/lane-check";
const deciderMissing = !existsSync(join(LANE_CHECK, "lib", "decider.mjs"));

function episodeWithTake(takeId, english) {
  const root = mkdtempSync(join(tmpdir(), "jev-check-"));
  const dir = join(root, "captures", takeId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `transcription_${takeId}_EN.txt`), english);
  return root;
}

const run = (args, input) => spawnSync(process.execPath, [SCRIPT, ...args], { input, encoding: "utf8", env: { ...process.env, MIADI_DECISIONS_DIR: mkdtempSync(join(tmpdir(), "jev-ledger-")) } });

test("the questions are data with a pinned model, and every one says when it flags", () => {
  assert.match(QUESTIONS.model, /^jev-\d+\.\d+\.\d+$/);
  for (const [id, q] of Object.entries(QUESTIONS.questions)) {
    assert.ok(["choice", "noul"].includes(q.type), id);
    assert.ok("flag_when" in q, id);
    assert.ok(QUESTIONS.policy.classes[q.class], `${id} has a policy class`);
    assert.equal(QUESTIONS.policy.classes[q.class].act_at, null, `${id} threshold stays unset until rulings`);
  }
});

test("flags follow flag_when, and an unanswered question is neither flagged nor clear", () => {
  const q = QUESTIONS.questions;
  assert.equal(isFlagged(q.hands_back, true), true);
  assert.equal(isFlagged(q.hands_back, false), false);
  assert.equal(isFlagged(q.asks_answered, false), true);
  assert.equal(isFlagged(q.return_status, "revise"), true);
  assert.equal(isFlagged(q.return_status, "ready"), false);
  assert.equal(isFlagged(q.hands_back, null), null);
});

test("several takes reach Jev in order, each under its id", () => {
  const state = buildState({ takes: [{ id: "1", text: "first" }, { id: "2", text: "second" }], draft: " d \n", evidence: ["commit abc"] });
  assert.equal(state.take, "[take 1]\nfirst\n\n[take 2]\nsecond");
  assert.equal(state.draft, "d");
  assert.deepEqual(state.evidence, ["commit abc"]);
  assert.deepEqual(parseArgs(["check", "--take", "1", "--fact", "a", "--fact", "b"]).fact, ["a", "b"]);
});

test("a dry check reads the take and the draft from stdin, sends nothing, and exits 0", { skip: deciderMissing && "lane-check's decider is not on this host" }, () => {
  const root = episodeWithTake("261012000000", "Mia, check your reply before I read it.");
  const out = join(root, "record.json");
  const result = run(["check", "--episode", root, "--take", "261012000000", "--draft", "-", "--fact", "commit abc pushed", "--dry", "--out", out], "William, it is checked.");
  assert.equal(result.status, 0, result.stderr);
  const record = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(record.sent, false);
  assert.equal(record.requested_model, QUESTIONS.model);
  assert.equal(record.draft, "William, it is checked.");
  assert.deepEqual(record.evidence, ["commit abc pushed"]);
  assert.deepEqual(record.answers.map((a) => a.id), Object.keys(QUESTIONS.questions));
});

test("a check that cannot run says to deliver anyway, and exits 1", () => {
  const root = episodeWithTake("261012000001", "words");
  const result = run(["check", "--episode", root, "--take", "999999999999", "--draft", "-", "--dry"], "draft");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Deliver the return anyway/);
});
