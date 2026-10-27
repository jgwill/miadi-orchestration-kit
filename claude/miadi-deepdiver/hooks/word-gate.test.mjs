// node --test claude/miadi-deepdiver/hooks/word-gate.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { decide, findForbidden, inScope, loadWords } from "./word-gate.mjs";

const GATE = fileURLToPath(new URL("./word-gate.mjs", import.meta.url));
const WORDS = loadWords();
const W = "g" + "ap"; // the word itself, kept out of this file's own text

function run(payload) {
  const r = spawnSync(process.execPath, [GATE], { input: JSON.stringify(payload), encoding: "utf8" });
  return { code: r.status, stderr: r.stderr };
}
const write = (file_path, content) => ({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path, content } });
const edit = (file_path, old_string, new_string) => ({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path, old_string, new_string } });

const EP = "/srv/miadi/episodes/miadi-chronicle/2026-07-24-episode-297-x";
const KEPT = `${EP}/captures/notebook-5a00e2d8-5c3a-473b-a830-8fc0336f3457/asked.md`;

test("the list holds the word with what to write instead", () => {
  const entry = WORDS.find((w) => w.word === W);
  assert.ok(entry);
  assert.equal(entry.instead, "resolve tension");
  assert.match(entry.usedFor, /current reality and the desired outcome/);
});

test("prompts and kept text are in scope; other files are not", () => {
  for (const p of [
    `${EP}/deep-diver-perspective-prompts-261025.json`,
    "/a/src/Miadi/packages/review-service/prompts/261020-review-kind-and-workflow-v2.md",
    KEPT,
    `${EP}/captures/notebook-5a00e2d8-5c3a-473b-a830-8fc0336f3457/keep/Strategic-20261026T125550.transcript.md`,
    "/workspace/repos/jgwill/smcraft/docs/handoffs/2026-10-18-stage-and-marks.notebook-1a2b3c/asked.md",
  ]) assert.equal(inScope(p), true, p);
  for (const p of ["/a/src/Miadi/app/globals.css", `${EP}/README.md`, "/workspace/repos/x/src/layout.ts", "", undefined]) {
    assert.equal(inScope(p), false, String(p));
  }
});

test("a prompt or kept text carrying the word is refused, naming the word and the rule", () => {
  const r = run(write(KEPT, `# Asked\n\nThe ${W} between current reality and the desired outcome is wide.\n`));
  assert.equal(r.code, 2);
  assert.match(r.stderr, new RegExp(`"${W}" at line 3`));
  assert.match(r.stderr, new RegExp(`write "resolve tension", never "${W}"`));
  const e = run(edit(`${EP}/deep-diver-perspective-prompts-261025.json`, "x", `{"q": "Name the ${W.toUpperCase()}S"}`));
  assert.equal(e.code, 2, "any case, and the plural");
});

test("a package name or path that carries the word passes, quoted or scoped", () => {
  for (const text of [
    `The analysis lives in \`@medicine-wheel/${W}-analysis\` 0.26.0.`,
    `It imports @medicine-wheel/${W}-analysis directly.`,
    `Rename \`${W}-analysis\` later (W3).`,
    `See foundations/${W}-analysis/README.md.`,
  ]) assert.deepEqual(findForbidden(text, WORDS), [], text);
  assert.equal(run(write(KEPT, `Uses \`@medicine-wheel/${W}-analysis\`.\n`)).code, 0);
});

test("the word in prose stays refused when joined, bare-quoted or at a sentence's end", () => {
  assert.equal(findForbidden(`a ${W}-analysis of the episode`, WORDS).length, 1);
  assert.equal(findForbidden(`never write \`${W}\``, WORDS).length, 1);
  assert.equal(findForbidden(`It shows the ${W}.`, WORDS).length, 1);
  assert.deepEqual(findForbidden(`a mishap, a gapped tooth, agape`, WORDS), [], "only the whole word");
});

test("removing the word is never refused; other files and tools pass", () => {
  assert.equal(run(edit(KEPT, `the ${W}`, "the tension to resolve")).code, 0);
  assert.equal(run(write("/a/src/Miadi/app/globals.css", `.row { ${W}: 1rem; }`)).code, 0);
  assert.equal(run({ tool_name: "Bash", tool_input: { command: `echo ${W}` } }).code, 0);
  assert.equal(decide({ tool_name: "Write", tool_input: { file_path: KEPT, content: "resolve tension" } }, WORDS).refuse, false);
});

test("an unreadable payload passes rather than blocking the session", () => {
  const r = spawnSync(process.execPath, [GATE], { input: "not json", encoding: "utf8" });
  assert.equal(r.status, 0);
});
