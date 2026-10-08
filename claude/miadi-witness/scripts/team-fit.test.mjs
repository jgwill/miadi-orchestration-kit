// node --test claude/miadi-witness/scripts/team-fit.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import { decide, evaluateRules, latestBinding, teamFit } from "./team-fit.mjs";

const TEAMS = {
  teams: [
    { id: "T1", name: "Session continuity", level: "the machine", sessions: ["gaia-tmux"], folders: ["/a/src/gaia", "/opt/gaia"], name_patterns: ["^gaia-"] },
    { id: "T3", name: "Witness", level: "between", sessions: ["stcbot"], folders: ["/a/src/_sessiondata/abd7ba82"], name_patterns: ["^mino-"] },
    { id: "T4", name: "Chart path", level: "the application", folders: ["/a/src/gaia/charts"], glyph: "📊" },
  ],
};

test("every matching rule is reported, and folders decide before name patterns", () => {
  const fit = teamFit({ tmux: "gaia-cpufreq-261008", cwd: "/a/src/gaia/linux_migration" }, TEAMS);
  assert.equal(fit.team.id, "T1");
  assert.equal(fit.decided_by, "folders");
  assert.deepEqual(fit.matches.map((m) => `${m.rule}:${m.team}:${m.evidence}`), ["folders:T1:/a/src/gaia", "name_patterns:T1:^gaia-"]);
  assert.equal(fit.team.glyph, "🔁");
  assert.equal(fit.team.glyph_source, "draft");
});

test("the longest folder wins, and the other team is named as also matched", () => {
  const fit = teamFit({ tmux: "gaia-charts", cwd: "/a/src/gaia/charts/x" }, TEAMS);
  assert.equal(fit.team.id, "T4");
  assert.equal(fit.team.glyph, "📊");
  assert.equal(fit.team.glyph_source, "teams.json");
  assert.deepEqual(fit.also_matched, ["T1"]);
});

test("a declared team decides, and a sessions match beats folders", () => {
  assert.deepEqual(decide(evaluateRules({ tmux: "x", cwd: "/a/src/gaia", declared: { team: "T3", source: "tmux @miadi-team" } }, TEAMS)), { team: "T3", decided_by: "declared" });
  assert.deepEqual(decide(evaluateRules({ tmux: "stcbot", cwd: "/a/src/gaia" }, TEAMS)), { team: "T3", decided_by: "sessions" });
});

test("no rule gives unassigned with no decision rule", () => {
  const fit = teamFit({ tmux: "miadi-app-api-sessions", cwd: "/a/src/Miadi-18" }, TEAMS);
  assert.equal(fit.team.id, "unassigned");
  assert.equal(fit.decided_by, null);
  assert.equal(fit.team.glyph, "❔");
});

test("the latest binding line skips headless children of the same tmux session", () => {
  const lines = [
    { session_id: "a", tmux: { session: "s" }, argv: ["claude"], at: "1" },
    { session_id: "b", tmux: { session: "s" }, argv: ["claude", "-p", "x"], at: "2" },
  ];
  assert.equal(latestBinding(lines, { tmux: "s" }).session_id, "a");
  assert.equal(latestBinding(lines, { sessionId: "a" }).at, "1");
});
