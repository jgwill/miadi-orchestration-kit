// node --test claude/miadi-witness/scripts/inventory-at-exit.test.mjs
// Runs the script as a process. A local server answers as Jev (lane-check's decider, through
// JEV_AI_BASE_URL), a stub claude on PATH plays the Haiku reader, and the inventory sits in a git
// repository with a bare remote. Needs lane-check at $LANE_CHECK_DIR (the default path on gaia).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fromDoneLine, keepWritten, lastReplyFacts, settled } from "./inventory-at-exit.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "inventory-at-exit.mjs");
const FACTS_BY = "inventory-keeper (miadi-witness scripts/inventory.mjs)";
let base, server, url, fx;
const jevRequests = [];
let jevAnswer = null;

const sid = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

before(async () => {
  base = mkdtempSync(join(tmpdir(), "inventory-at-exit-"));
  fx = {
    bin: join(base, "bin"),
    logs: join(base, "logs"),
    sessiondata: join(base, "sessiondata"),
    repo: join(base, "workspace-repo"),
    remote: join(base, "remote.git"),
    ledger: join(base, "decisions", "inventory-at-exit.jsonl"),
  };
  fx.inventory = join(fx.repo, "session-inventory");
  for (const d of [fx.bin, fx.logs, join(fx.sessiondata, "data"), fx.inventory]) mkdirSync(d, { recursive: true });
  writeFileSync(join(fx.sessiondata, "data", "terminal_bindings.jsonl"), "");
  execFileSync("git", ["init", "-q", "--bare", fx.remote]);
  const g = (...a) => execFileSync("git", ["-C", fx.repo, ...a], { encoding: "utf8" });
  g("init", "-q", "-b", "main");
  g("remote", "add", "origin", fx.remote);
  writeFileSync(join(fx.inventory, "SCHEMA.md"), "schema\n");
  g("add", "."); g("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "start"); g("push", "-q", "-u", "origin", "main");
  // the reader: fills two empty fields, and also overwrites a field an agent wrote and drops an observation
  writeFileSync(join(fx.bin, "claude"), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${fx.logs}/claude.log"
f=$(printf '%s' "\${@: -1}" | sed -n 's/.*its record is \\([^,]*\\), and.*/\\1/p')
node -e '
const fs = require("fs"); const f = process.argv[1]; const r = JSON.parse(fs.readFileSync(f, "utf8"));
r.mission = "read by the stub reader"; r.work_completed = [{ title: "stub" }]; r.held_decisions = [{ id: "H9", title: "overwritten" }];
r.observations = [...(r.observations || []).slice(1), { at: "x", by: "inventory-keeper (haiku, at exit)", what: "read" }];
fs.writeFileSync(f, JSON.stringify(r, null, 2));' "$f"
`);
  chmodSync(join(fx.bin, "claude"), 0o755);
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      const request = JSON.parse(body || "{}");
      jevRequests.push(request);
      const options = Object.keys(request.questions.reading.criteria);
      const { choice, confidence } = jevAnswer;
      const rest = (1 - confidence) / (options.length - 1);
      const probabilities = Object.fromEntries(options.map((o) => [o, o === choice ? confidence : rest]));
      res.writeHead(200, { "Content-Type": "application/json", "x-jev-run-id": "run-1", "x-jev-paid-input-tokens-used": "700" });
      res.end(JSON.stringify({ model: "typesafe/jev-1.14.0", answers: { reading: { type: "choice", choice, confidence, probabilities } } }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server.close(); rmSync(base, { recursive: true, force: true }); });

function env(extra = {}) {
  const out = {
    ...process.env,
    PATH: `${fx.bin}:${process.env.PATH}`,
    HOME: base,
    WITNESS_INVENTORY_DIR: fx.inventory,
    MIADI_SESSIONDATA_ROOT: fx.sessiondata,
    WITNESS_BINDINGS: join(fx.sessiondata, "data", "terminal_bindings.jsonl"),
    INVENTORY_AT_EXIT_LEDGER: fx.ledger,
    JEV_AI_API_KEY: "jev-fake-key",
    JEV_AI_BASE_URL: url,
    TYPESAFE_ENV_FILE: join(base, "no.env"),
    GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t",
    ...extra,
  };
  delete out.TYPESAFE_API_KEY;
  for (const [k, v] of Object.entries(extra)) if (v === undefined) delete out[k];
  return out;
}

function cli(args, extra) {
  return new Promise((resolve) => execFile(process.execPath, [SCRIPT, ...args], { env: env(extra) }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })));
}

function seed(n, { file = `${sid(n)}.json`, tmux = `t8-session-${n}`, extra = {}, reply = null, argv = ["claude"], userInputs = 4, toolUses = 30 } = {}) {
  const id = sid(n);
  writeFileSync(join(fx.inventory, file), JSON.stringify({
    version: "1.0.0", session_id: id, tmux_session_name: tmux, status: "unreviewed",
    hook_capture: { user_inputs: userInputs, tool_uses: toolUses },
    links: { question: [], trace: [{ ref: "acme/tools@1234567" }], evidence: [], criteria: [], judgment: [] },
    observations: [{ at: "2026-11-10T00:00:00Z", by: FACTS_BY, what: "Record created." }],
    ...extra,
  }, null, 2));
  execFileSync("bash", ["-c", `printf '%s\\n' '${JSON.stringify({ at: "2026-11-10T00:00:00Z", event: "session.start", agent: "claude", session_id: id, argv, tmux: { session: tmux } })}' >> ${join(fx.sessiondata, "data", "terminal_bindings.jsonl")}`]);
  if (reply !== null) {
    mkdirSync(join(fx.sessiondata, id), { recursive: true });
    writeFileSync(join(fx.sessiondata, id, "last_claude_AssistantResponse.json"), JSON.stringify({ last_assistant_message: reply }));
  }
  return { id, path: join(fx.inventory, file) };
}

const record = (path) => JSON.parse(readFileSync(path, "utf8"));
const ledger = () => readFileSync(fx.ledger, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const remoteLog = () => execFileSync("git", ["--git-dir", fx.remote, "log", "--format=%s", "main"], { encoding: "utf8" }).trim().split("\n");

test("the last reply's DONE line, what it fills, and the guard that keeps an agent's fields", () => {
  assert.deepEqual(lastReplyFacts("work\n\nDONE: acme/tools@abc; held: nothing."), { ends_with_done_line: true, chars: 42, done_line: "DONE: acme/tools@abc; held: nothing." });
  assert.equal(lastReplyFacts("DONE: early\nthen more words").ends_with_done_line, false, "a DONE line that is not last does not end the reply");
  assert.deepEqual(fromDoneLine("DONE: acme/tools@abc; held: nothing.").next_steps, []);
  assert.deepEqual(fromDoneLine("DONE: acme/tools@abc, held: the rename is Guillaume's.").next_steps.map((s) => s.title), ["the rename is Guillaume's"]);
  const before = { mission: "", held_decisions: [{ id: "H1" }], observations: [{ what: "a" }, { what: "b" }] };
  const { record: kept, restored } = keepWritten(before, { mission: "new", held_decisions: [], observations: [{ what: "b" }, { what: "c" }] });
  assert.equal(kept.mission, "new", "an empty field may be filled");
  assert.deepEqual(kept.held_decisions, [{ id: "H1" }]);
  assert.deepEqual(kept.observations.map((o) => o.what), ["a", "b", "c"]);
  assert.deepEqual(restored, ["held_decisions", "observations"]);
});

test("counted without a model: already read, headless, a Miette seat, no record, two files for one session", async () => {
  const asked = jevRequests.length;
  const read = seed(1, { extra: { mission: "an agent wrote this", work_completed: [{ title: "kept" }] } });
  const headless = seed(2, { argv: ["claude", "-p", "edit this"] });
  const miette = seed(3, { tmux: "t3-plan-miette-insight" });
  const dupA = seed(4, { file: `${sid(4)}.json` });
  const dupB = seed(4, { file: "ONGOING-t8-session-4.json" });
  const results = {};
  for (const n of [1, 2, 3, 4, 5]) {
    const r = await cli(["decide", "--session", sid(n), "--json"]);
    assert.equal(r.code, 0, r.stderr);
    results[n] = JSON.parse(r.stdout);
  }
  assert.deepEqual(Object.values(results).map((l) => [l.decided_by, l.rule, l.action]), [
    ["count", "already_read", "none"],
    ["count", "headless", "facts_only"],
    ["count", "miette_smoke_probe", "facts_only"],
    ["count", "duplicate", "written_to_neither"],
    ["count", "no_record", "none"],
  ]);
  assert.equal(jevRequests.length, asked, "Jev is not asked when the answer can be counted");
  assert.equal(record(read.path).mission, "an agent wrote this");
  assert.match(record(headless.path).observations.at(-1).what, /^Facts only at exit: a headless claude -p child/);
  assert.match(record(miette.path).observations.at(-1).what, /Miette insight seat/);
  assert.deepEqual(results[4].files, [`${sid(4)}.json`, "ONGOING-t8-session-4.json"]);
  assert.equal(record(dupA.path).observations.length, 1, "neither duplicate is written");
  assert.equal(record(dupB.path).observations.length, 1);
  assert.ok(remoteLog().some((s) => s.startsWith(`inventory at exit: ${sid(2)} · t8-session-2 · facts_only`)), "the record is committed by path and pushed");
});

test("Jev chooses from_last_reply above the bar: work_completed and next_steps come from the DONE line, an agent's field stays", async () => {
  jevAnswer = { choice: "from_last_reply", confidence: 0.82 };
  const s = seed(6, { reply: "I wrote the verb.\n\nDONE: acme/tools@abc1234; held: the rename is Guillaume's.", extra: { next_steps: [{ title: "an agent's next step" }] } });
  const r = await cli(["decide", "--session", s.id, "--json"]);
  assert.equal(r.code, 0, r.stderr);
  const line = JSON.parse(r.stdout);
  assert.deepEqual(jevRequests.at(-1).state, { prompts: 4, tool_uses: 30, commits: 1, last_reply: { ends_with_done_line: true, chars: 77 } }, "only counts leave the host");
  assert.equal(Object.keys(jevRequests.at(-1).questions.reading.criteria).length, 3);
  assert.equal(line.jev.choice, "from_last_reply");
  assert.deepEqual(line.jev.bar, { confidence: 0.6, top_probability: 0.733, options: 3 }, "the bar is written beside the number");
  assert.equal(line.jev.top_probability, 0.82);
  assert.equal(line.action, "from_last_reply");
  assert.deepEqual(line.filled, ["work_completed"]);
  const rec = record(s.path);
  assert.equal(rec.work_completed[0].title, "acme/tools@abc1234");
  assert.deepEqual(rec.next_steps, [{ title: "an agent's next step" }], "next_steps already held an agent's words");
  assert.equal(rec.observations.at(-1).by, "inventory-at-exit (the session's DONE line, no model)");
  assert.equal(line.ruling_id, null, "room for a person's ruling");
});

test("Jev chooses reader above the bar: one detached Haiku reader, its changes to an agent's fields put back, then the commit", async () => {
  jevAnswer = { choice: "reader", confidence: 0.9 };
  const s = seed(7, { reply: "many changes, no DONE line", extra: { held_decisions: [{ id: "H1", title: "an agent's held decision" }] } });
  const r = await cli(["decide", "--session", s.id, "--json"], { MIADI_INVENTORY_EXIT_BUDGET_USD: "0.1" });
  assert.equal(r.code, 0, r.stderr);
  const line = JSON.parse(r.stdout);
  assert.equal(line.action, "reader_started");
  assert.deepEqual(line.caps, { budget_usd: "0.1", reads_today: 1, max_per_day: 10 });
  let reading = null;
  for (let i = 0; i < 100 && !reading; i += 1) {
    reading = existsSync(fx.ledger) ? ledger().find((l) => l.kind === "reading" && l.decision_id === line.id) : null;
    if (!reading) await new Promise((res) => setTimeout(res, 100));
  }
  assert.ok(reading, "the reader reported to the ledger");
  const call = readFileSync(join(fx.logs, "claude.log"), "utf8").trim().split("\n").at(-1);
  assert.match(call, /^-p --model haiku --plugin-dir \S+miadi-witness --agent miadi-witness:inventory-keeper --max-budget-usd 0\.1 --permission-mode bypassPermissions /);
  assert.match(call, new RegExp(`Session ${s.id}: its record is ${s.path.replace(/[.]/g, "\\.")}`));
  const rec = record(s.path);
  assert.equal(rec.mission, "read by the stub reader");
  assert.deepEqual(rec.held_decisions, [{ id: "H1", title: "an agent's held decision" }], "the reader's overwrite is put back");
  assert.equal(rec.observations[0].what, "Record created.", "the observation it dropped is put back");
  assert.deepEqual(reading.restored, ["held_decisions", "observations"]);
  assert.equal(reading.read, true);
  assert.ok(remoteLog().includes(`inventory at exit: ${s.id} · read by Haiku (miadi-witness inventory-at-exit.mjs)`));
});

test("past the daily cap, below the bar, or without Jev, the record stays unread for the nightly pass", async () => {
  jevAnswer = { choice: "reader", confidence: 0.9 };
  const capped = seed(8, { reply: "long work" });
  const c = JSON.parse((await cli(["decide", "--session", capped.id, "--json"], { MIADI_INVENTORY_EXIT_MAX_READ: "1" })).stdout);
  assert.equal(c.action, "unread");
  assert.match(c.reason, /1 readers already ran today \(the cap is 1\)/);
  const unreadObs = record(capped.path).observations.at(-1);
  assert.equal(unreadObs.by, "inventory-keeper (miadi-witness scripts/inventory-at-exit.mjs)", "a by the nightly pass reads as not read yet");

  jevAnswer = { choice: "facts_only", confidence: 0.5 };
  const low = JSON.parse((await cli(["decide", "--session", seed(9).id, "--json"])).stdout);
  assert.equal(low.action, "unread");
  assert.equal(low.jev.above_bar, false);
  assert.match(low.reason, /facts_only at 0\.50, below the bar 0\.6 \(top 0\.733 on 3 options\)/);

  const none = JSON.parse((await cli(["decide", "--session", seed(10).id, "--json"], { JEV_AI_API_KEY: undefined })).stdout);
  assert.equal(none.action, "unread");
  assert.match(none.reason, /Jev did not answer \(no JEV_AI_API_KEY or TYPESAFE_API_KEY/);
});

test("a ruling confirms or overrides the last decision, and settled lists what the nightly pass leaves out", async () => {
  jevAnswer = { choice: "facts_only", confidence: 0.95 };
  const s = seed(11, { reply: "ok" });
  assert.equal(JSON.parse((await cli(["decide", "--session", s.id, "--json"])).stdout).action, "facts_only");
  const listed = (await cli(["settled"])).stdout.trim().split("\n");
  assert.ok(listed.includes(s.id) && listed.includes(sid(2)) && !listed.includes(sid(6)));
  assert.equal((await cli(["ruling", "--session", s.id, "--verdict", "confirm", "--by", "Guillaume", "--choice", "reader"])).code, 1, "confirm keeps the decision's choice");
  const r = await cli(["ruling", "--session", s.id, "--verdict", "override", "--by", "Guillaume", "--choice", "reader", "--words", "read that one"]);
  assert.equal(r.code, 0, r.stderr);
  const ruling = ledger().at(-1);
  assert.deepEqual([ruling.kind, ruling.verdict, ruling.choice, ruling.decision_choice, ruling.words], ["ruling", "override", "reader", "facts_only", "read that one"]);
  assert.ok(!(await cli(["settled"])).stdout.includes(s.id), "an override to reader hands it back to the nightly pass");
  assert.deepEqual(settled([{ kind: "decision", id: "d", session_id: "x", action: "unread" }, { kind: "ruling", decision_id: "d", session_id: "x", choice: "facts_only" }]), ["x"]);
});
