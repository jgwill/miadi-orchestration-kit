import { test } from "node:test";
import assert from "node:assert/strict";
import { ageDays, episodeNumber, hasIssue, labelPath, toMarkdown } from "./drafts-witness.mjs";

test("an issue reference is found in a subject or a Ref line", () => {
  assert.equal(hasIssue("tide drafts: withdraw #691"), true);
  assert.equal(hasIssue("x\n\nRef: jgwill/Miadi#887"), true);
  assert.equal(hasIssue("fix (jgwill/gaia#97)"), true);
  assert.equal(hasIssue("A capability has an address, Episode 568"), false);
  assert.equal(hasIssue("colour #ffd700 ring"), false);
});

test("a miadi-chronicle address gives its episode number", () => {
  assert.equal(episodeNumber("miadi-chronicle://548"), 548);
  assert.equal(episodeNumber("miadi-chronicle:019"), 19);
  assert.equal(episodeNumber("miadi-review://abc"), null);
});

test("age is counted in whole days", () => {
  assert.equal(ageDays("2026-11-01T00:00:00Z", Date.parse("2026-11-04T12:00:00Z")), 3);
});

test("a label path drops its @ and reads a relative path from the pane's folder", () => {
  assert.equal(labelPath("@app/tide/", "/a/src/Miadi-18"), "/a/src/Miadi-18/app/tide");
  assert.equal(labelPath("/srv/miadi", "/x"), "/srv/miadi");
});

test("the markdown keeps the words out unless they were read", () => {
  const d = { id: "abc", pane: "mctgo-1:0.0", team: "T8", target: "t8-x", state: "parked", opened_at: "2026-11-01T00:00:00Z", age_days: 3, chars: 10,
    session: { running: false, record: null }, repos: [], episodes: [{ n: 548, folder: "f", commits: 2, threads: ["PT1"] }], missing: [] };
  const md = toMarkdown([d], { olderThan: 3, at: "now" });
  assert.match(md, /miadi-chronicle:\/\/548: 2 chronicle commit\(s\) since, plot threads PT1/);
  assert.doesNotMatch(md, /Words/);
  assert.match(toMarkdown([{ ...d, text: "secret words" }], { olderThan: 3, at: "now" }), /secret words/);
});
