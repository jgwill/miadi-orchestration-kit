// node --test claude/miadi-witness/scripts/score-lanes.test.mjs
// The scorer and miadi-run are stand-ins here; no call is made.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { bandsByLane, lanesToPage, main, MIADI_RUN, parseLaneTable, Refusal, SCORER, selectLanes, summaryOf } from "./score-lanes.mjs";

const PLAN = `# Plan

| code | words |
|---|---|
| N1 | not a lane table |

| lane | does (imperative) | repository | done when |
|---|---|---|---|
| K1 | Update \`threads.yaml\` & open PT3 | chronicle | the commit |
| K6 | Build the word gate <a> and circle-feed | jgwill/miadi-orchestration-kit | tests pass |
| K7a | Write the v3 prompt | jgwill/Miadi | committed |
`;

const work = mkdtempSync(join(tmpdir(), "score-lanes-test-"));
const planFile = join(work, "plan.md");
const requestFile = join(work, "request.md");
writeFileSync(planFile, PLAN);
writeFileSync(requestFile, "his words");

const card = (code, band, value, p) => ({
  code, kind: "A", band, why: band === "owner" ? "foreign_repo 0.71: the Decision Gate's D1 rule, never settled by the number" : `obvious_now ${value} ${p}`,
  requested_model: "jev-1.13.0", model: "typesafe/jev-1.13", run_id: `run-${code}`, expected_paid_tokens: 2100, triggers: [],
  readings: { obvious_now: { value, p, top_probability: p + 0.05 } },
});

function fakeDeps(cards, { dry = false } = {}) {
  const calls = [];
  const out = [];
  return {
    calls, out,
    log: (l) => out.push(l),
    err: () => {},
    run: (cmd, args) => {
      calls.push(args);
      if (args[0] === SCORER) {
        const page = readFileSync(args[1], "utf8");
        const scoresPath = args[args.indexOf("--out") + 1];
        const codes = [...page.matchAll(/id="(A\d+)"/g)].map((m) => m[1]);
        writeFileSync(scoresPath, JSON.stringify({ questions_version: "0.2.0", requested_model: "jev-1.13.0", dry, cards: cards.filter((c) => codes.includes(c.code)) }));
        return { status: 0, stdout: "act_at 0.8 on obvious_now's 4 options is a top probability of 0.85\n", stderr: "" };
      }
      if (args[0] === MIADI_RUN) return { status: 0, stdout: "{}", stderr: "" };
      return { status: 1, stdout: "", stderr: "unexpected" };
    },
  };
}

test("the first table with a lane column is read, every cell kept by its column", () => {
  const { columns, rows } = parseLaneTable(PLAN);
  assert.deepEqual(columns, ["lane", "does (imperative)", "repository", "done when"]);
  assert.deepEqual(rows.map((r) => r.lane), ["K1", "K6", "K7a"]);
  assert.equal(rows[2].cells.repository, "jgwill/Miadi");
  assert.throws(() => parseLaneTable("| a | b |\n|---|---|\n| 1 | 2 |\n"), Refusal);
  assert.deepEqual(selectLanes(rows, "K7a,K1").map((r) => r.lane), ["K1", "K7a"]);
  assert.throws(() => selectLanes(rows, "K9"), /no lane K9/);
});

test("each lane becomes an action-step card the scorer reads, its code mapped back", () => {
  const { rows } = parseLaneTable(PLAN);
  const { html, codes } = lanesToPage(rows);
  assert.deepEqual(codes, { A1: "K1", A2: "K6", A3: "K7a" });
  assert.match(html, /<div id="A2">A2 lane: K6 · does \(imperative\): Build the word gate &lt;a&gt; and circle-feed/);
  assert.match(html, /&amp; open PT3/);
  const bands = bandsByLane({ cards: [card("A2", "ask", "do_now", 0.71)] }, codes);
  assert.equal(bands[0].lane, "K6");
  assert.equal(bands[0].band, "after your go");
  assert.equal(summaryOf(bands[0], "0.2.0"), "Jev band for lane K6: after your go (obvious_now do_now 0.71). obvious_now top probability 0.76. Questions 0.2.0 on jev-1.13.0, run run-A2.");
});

test("the plan is scored as A cards with the request and facts, and every lane comes back banded", async () => {
  const d = fakeDeps([card("A1", "act", "do_now", 0.9), card("A2", "ask", "do_after_go", 0.6), card("A3", "owner", "do_now", 0.5)]);
  const bands = await main([planFile, "--request", requestFile, "--facts", requestFile], d);
  assert.deepEqual(bands.map((b) => [b.lane, b.band]), [["K1", "would do now"], ["K6", "after your go"], ["K7a", "needs you"]]);
  const args = d.calls[0];
  assert.equal(args[args.indexOf("--only") + 1], "A");
  assert.equal(args[args.indexOf("--facts") + 1], requestFile);
  assert.ok(!args.includes("--dry"));
  assert.match(d.out.join("\n"), /^\| K7a \| needs you \| do_now \| 0\.50 \| foreign_repo 0\.71/m);
});

test("--mission writes the lane's band as research with miadi-run observe; a dry run only prints the command", async () => {
  const d = fakeDeps([card("A1", "ask", "do_now", 0.71)]);
  await main([planFile, "--request", requestFile, "--lane", "K6", "--mission", "mis-k6"], d);
  const observe = d.calls.find((a) => a[0] === MIADI_RUN);
  assert.deepEqual(observe.slice(1, 5), ["observe", "mis-k6", "--kind", "research"]);
  assert.match(observe[observe.indexOf("--summary") + 1], /^Jev band for lane K6: after your go \(/);

  const dry = fakeDeps([card("A1", null, undefined, undefined)], { dry: true });
  await main([planFile, "--request", requestFile, "--lane", "K6", "--mission", "mis-k6", "--dry"], dry);
  assert.ok(dry.calls[0].includes("--dry"));
  assert.equal(dry.calls.filter((a) => a[0] === MIADI_RUN).length, 0);
  assert.ok(dry.out.some((l) => /^dry: the band is not written\. After a real run: node .*observe mis-k6 --kind research/.test(l)));
});

test("--mission takes one lane, and not with --trace", async () => {
  await assert.rejects(main([planFile, "--request", requestFile, "--mission", "m"], fakeDeps([])), /takes one lane/);
  await assert.rejects(main([planFile, "--request", requestFile, "--lane", "K6", "--mission", "m", "--trace", "t"], fakeDeps([])), /not both/);
  await assert.rejects(main([planFile], fakeDeps([])), /usage/);
});
