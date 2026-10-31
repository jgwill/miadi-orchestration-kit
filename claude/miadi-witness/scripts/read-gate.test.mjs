import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ACTIONS, ACTION_BAR, READ_AT, SKIP_AT, buildQuestions, buildState, extractHeadings, makeRecord, makeRuling,
  parseArgs, pruneFiles, readFileState, topProbabilityFor, verdictOf,
} from "./read-gate.mjs";

const readAnswer = (answer) => {
  if (!answer) return { value: null, p: null, read_status: "unknown" };
  if (answer.type === "noul") return { value: answer.noul >= 0.5, p: answer.noul, read_status: "satisfied" };
  return { value: answer.choice, p: answer.confidence, probabilities: answer.probabilities, read_status: "satisfied" };
};
const estimateTokens = (value) => Math.ceil(JSON.stringify(value).length / 4);

test("headings are keyed by line, levels 1 to 3 only", () => {
  const lines = ["# Title", "text", "## Part", "#### too deep", "### Sub"];
  assert.deepEqual(extractHeadings(lines).map((h) => [h.key, h.line, h.level, h.text]), [["h1", 1, 1, "Title"], ["h3", 3, 2, "Part"], ["h5", 5, 3, "Sub"]]);
});

test("a short file is sent whole; a long one as its first lines and outline", () => {
  const dir = mkdtempSync(join(tmpdir(), "read-gate-"));
  const short = join(dir, "short.md");
  writeFileSync(short, "# A\n\nhello\n\n## B\n\nworld\n");
  const s = readFileState(short);
  assert.equal(s.basis, "content");
  assert.equal(s.content.includes("world"), true);
  const long = join(dir, "long.md");
  writeFileSync(long, ["# Big", ...Array.from({ length: 400 }, (_, i) => (i % 50 === 0 ? `## Section ${i}` : "x".repeat(300)))].join("\n"));
  const l = readFileState(long, { maxChars: 10_000, headLines: 5 });
  assert.equal(l.basis, "outline");
  assert.equal(l.outline.includes("## Section 350"), true);
  assert.equal(l.outline.length <= 10_000, true);
  assert.equal(Object.hasOwn(l, "content"), false);
});

test("questions: section only with two or more headings, new_to_us only with known", () => {
  const none = buildQuestions({ headings: [{ key: "h1", line: 1, text: "A" }] });
  assert.deepEqual(Object.keys(none), ["relevant", "action"]);
  const some = buildQuestions({ headings: [{ key: "h1", line: 1, text: "A" }, { key: "h9", line: 9, text: "B" }], hasKnown: true });
  assert.deepEqual(Object.keys(some), ["relevant", "action", "new_to_us", "section"]);
  assert.deepEqual(Object.keys(some.section.criteria), ["h1", "h9", "none"]);
  assert.equal(Object.keys(ACTIONS).length, 4);
});

test("state carries the mission and either content or outline, never both", () => {
  const file = { path: "/x/a.md", bytes: 3, lines: 1, basis: "content", content: "abc", headings: [] };
  const s = buildState({ mission: "do m", file });
  assert.equal(s.mission, "do m");
  assert.equal(s.content, "abc");
  assert.equal(Object.hasOwn(s, "outline"), false);
  assert.equal(Object.hasOwn(s, "known"), false);
  const o = buildState({ mission: "m", known: "k", file: { ...file, basis: "outline", outline: "o", content: undefined } });
  assert.equal(o.outline, "o");
  assert.equal(o.known, "k");
});

test("verdict bands from the noul, with the action shaping a read", () => {
  assert.equal(verdictOf(0.9, "read_whole"), "read");
  assert.equal(verdictOf(0.9, "skip"), "skim");
  assert.equal(verdictOf(0.5, "read_whole"), "skim");
  assert.equal(verdictOf(0.1, "read_whole"), "skip");
  assert.equal(verdictOf(null, "read_whole"), "ask");
  assert.equal(READ_AT, 0.7);
  assert.equal(SKIP_AT, 0.3);
  assert.equal(topProbabilityFor(ACTION_BAR, 4), 0.7);
});

test("a record writes the bar beside the number and names the section picked", () => {
  const file = { path: "/x/a.md", bytes: 10, lines: 12, basis: "content", content: "…", headings: [{ key: "h3", line: 3, text: "Part" }, { key: "h8", line: 8, text: "Other" }] };
  const request = { state: {}, model: "jev-1.14.0", questions: buildQuestions({ headings: file.headings }) };
  const result = {
    model: "jev-1.14.0",
    answers: {
      relevant: { type: "noul", noul: 0.82 },
      action: { type: "choice", choice: "read_part", confidence: 0.55, probabilities: { read_whole: 0.2, read_part: 0.6, skip: 0.1, later: 0.1 } },
      section: { type: "choice", choice: "h8", confidence: 0.7, probabilities: { h3: 0.1, h8: 0.85, none: 0.05 } },
    },
    billing: { paid_input_tokens_used: "1234", run_id: "run-1" },
    sent: true,
  };
  const r = makeRecord({ result, requestedModel: "jev-1.14.0", mission: "m", known: "", file, request, readAnswer, estimateTokens, now: "2026-10-30T20:00:00.000Z", seq: 2 });
  assert.equal(r.id, "rg-20261030200000000-2");
  assert.equal(r.verdict, "read");
  assert.equal(r.action, "read_part");
  assert.equal(r.action_above_bar, false);
  assert.equal(r.action_top_probability, 0.6);
  assert.deepEqual(r.section, { key: "h8", line: 8, text: "Other" });
  assert.equal(r.paid_input_tokens, 1234);
  assert.equal(r.bar.action_top_probability, 0.7);
});

test("a ruling names the decision and says whether it agrees", () => {
  const decision = { id: "rg-1", path: "/x/a.md", verdict: "skim", relevant: 0.5 };
  const r = makeRuling({ decision, verdict: "read", by: "mia", words: "needed it", now: "2026-10-30T20:01:00.000Z" });
  assert.equal(r.decision_id, "rg-1");
  assert.equal(r.agrees, true);
  assert.equal(makeRuling({ decision: { ...decision, verdict: "skip" }, verdict: "read", by: "mia" }).agrees, false);
  assert.throws(() => makeRuling({ decision, verdict: "maybe", by: "mia" }), /--ruling is one of/);
  assert.throws(() => makeRuling({ decision: null, verdict: "read", by: "mia" }), /no decision/);
});

test("pruning drops binaries, skipped directories and empty files, by name and without Jev", () => {
  const dir = mkdtempSync(join(tmpdir(), "read-gate-prune-"));
  writeFileSync(join(dir, "a.md"), "x");
  writeFileSync(join(dir, "empty.md"), "");
  const { files, skipped } = pruneFiles([join(dir, "a.md"), join(dir, "empty.md"), join(dir, "p.png"), join(dir, "node_modules", "x.js"), join(dir, "missing.md")], dir);
  assert.deepEqual(files, [join(dir, "a.md")]);
  assert.deepEqual(skipped.map((s) => s.reason), ["empty", "binary by extension", "skipped directory", "not found"]);
});

test("args: positionals are the patterns; value flags take one value", () => {
  const a = parseArgs(["--mission", "m", "--dry", "a.md", "docs/", "--parallel", "4"]);
  assert.deepEqual(a._, ["a.md", "docs/"]);
  assert.equal(a.mission, "m");
  assert.equal(a.dry, true);
  assert.equal(a.parallel, "4");
});
