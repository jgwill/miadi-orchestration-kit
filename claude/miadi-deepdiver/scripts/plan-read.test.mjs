import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildQuestions, planText, QUESTIONS_FILE, rotate, route } from "./plan-read.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "plan-read.mjs");
const set = JSON.parse(readFileSync(QUESTIONS_FILE, "utf8"));
const PLAN = "---\nartifact_id: x\nversion: 1\n---\n\n# Deck\n\n1. One item.\n";

function clean(next, confidence, change = {}) {
  const readings = { next: { value: next, p: confidence } };
  for (const id of set.must_be_false) readings[id] = { p: 0.1 };
  for (const id of set.must_be_true) readings[id] = { p: 0.9 };
  for (const [id, p] of Object.entries(change)) readings[id] = { p };
  return readings;
}

function fileWith(text) {
  const path = join(mkdtempSync(join(tmpdir(), "plan-read-")), "outline-01-abc.md");
  writeFileSync(path, text);
  return path;
}

test("a plan's text leaves out the lines saying where it came from", () => {
  assert.equal(planText(PLAN), "# Deck\n\n1. One item.");
});

test("only render_now at the bar, with nothing fired, lets the seat send it on", () => {
  assert.equal(route(clean("render_now", 0.85), set).to, "send");
  assert.equal(route(clean("render_now", 0.7), set).to, "person");
});

test("a check that fired goes to the person, even when Jev says render_now", () => {
  const r = route(clean("render_now", 0.95, { creating_language: 0.7 }), set);
  assert.equal(r.to, "person");
  assert.deepEqual(r.fired, ["creating_language"]);
});

test("an uncertain reading errs toward the person", () => {
  const r = route(clean("render_now", 0.95, { claim_without_a_source: 0.45 }), set);
  assert.equal(r.to, "person");
  assert.deepEqual(r.uncertain, ["claim_without_a_source"]);
});

test("a plan that strays from its brief fires, and an unanswered check is uncertain", () => {
  assert.deepEqual(route(clean("render_now", 0.9, { stays_with_the_brief: 0.2 }), set).fired, ["stays_with_the_brief"]);
  const readings = clean("render_now", 0.9);
  delete readings.creating_language;
  assert.deepEqual(route(readings, set).uncertain, ["creating_language"]);
});

test("the seat may write the change when Jev says revise at the bar", () => {
  assert.equal(route(clean("revise_with_feedback", 0.85, { form_without_content: 0.8 }), set).to, "revise");
});

test("a circle or a person chosen by Jev goes to the person", () => {
  assert.equal(route(clean("hold_for_circle", 0.9), set).to, "person");
  assert.equal(route(clean("ask_a_person", 0.9), set).to, "person");
  assert.equal(route(clean("other", 0.9), set).to, "person");
});

test("the choice's options turn with the plan and keep every option", () => {
  const a = rotate(set.questions.next.criteria, "000000");
  const b = rotate(set.questions.next.criteria, "000001");
  assert.notEqual(Object.keys(a)[0], Object.keys(b)[0]);
  assert.deepEqual(Object.keys(a).sort(), Object.keys(set.questions.next.criteria).sort());
});

test("what is sent carries no provenance, only type, instructions and criteria", () => {
  const q = buildQuestions(set, "000000");
  assert.deepEqual(Object.keys(q.creating_language).sort(), ["criteria", "instructions", "type"]);
  assert.ok(set.questions.creating_language.from);
});

test("every question names the correction it came from", () => {
  for (const [id, q] of Object.entries(set.questions)) assert.ok(q.from, id);
});

test("words: exit 0 on a clean plan", () => {
  const out = execFileSync(process.execPath, [SCRIPT, "words", fileWith(PLAN)], { encoding: "utf8" });
  assert.match(out, /clean/);
});

test("words: exit 1 and the rule on a forbidden word", () => {
  const proc = spawnSync(process.execPath, [SCRIPT, "words", fileWith(`${PLAN}2. This slide will bridge the gap.\n`)], { encoding: "utf8" });
  assert.equal(proc.status, 1);
  assert.match(proc.stdout, /resolve tension/);
});

test("jev: a brief is required", () => {
  const proc = spawnSync(process.execPath, [SCRIPT, "jev", fileWith(PLAN)], { encoding: "utf8" });
  assert.equal(proc.status, 2);
  assert.match(proc.stderr, /--brief/);
});
