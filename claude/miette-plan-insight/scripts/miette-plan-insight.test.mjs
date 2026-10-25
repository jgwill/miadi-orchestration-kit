import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { carrierOf, episodeOf, isDisabled, isSeatName, parseHookInput, planStamp, primerText, seatNameOf } from "./lib.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "miette-plan-insight.mjs");
const SID = "4a740ef7-7613-4c69-a608-77456b8bf57f";

test("a plan presented by a session is read from the hook input, inline or by file", () => {
  const inline = parseHookInput(JSON.stringify({ session_id: SID, tool_name: "ExitPlanMode", cwd: "/w", tool_input: { plan: "# Plan\n1. do" } }));
  assert.deepEqual(inline, { sessionId: SID, cwd: "/w", transcriptPath: undefined, plan: "# Plan\n1. do", planFile: undefined });
  assert.equal(parseHookInput({ session_id: SID, tool_name: "ExitPlanMode", tool_input: { planFilePath: "/p.md" } }).planFile, "/p.md");
  assert.equal(parseHookInput({ session_id: SID, tool_name: "Write", tool_input: { plan: "x" } }), null, "only ExitPlanMode");
  assert.equal(parseHookInput({ session_id: "../x", tool_name: "ExitPlanMode", tool_input: { plan: "x" } }), null, "an unsafe id");
  assert.equal(parseHookInput({ session_id: SID, tool_name: "ExitPlanMode", tool_input: {} }), null, "no plan");
  assert.equal(parseHookInput("{torn"), null);
});

test("the seat is named after the planning tmux session, and a seat never opens a seat", () => {
  assert.equal(seatNameOf("ep553-work", SID), "ep553-work-miette-insight");
  assert.equal(seatNameOf("a.b:c", SID), "a-b-c-miette-insight", "tmux refuses . and : in a target");
  assert.equal(seatNameOf(undefined, SID), "plan-4a740ef7-miette-insight");
  assert.equal(isSeatName("ep553-work-miette-insight"), true);
  assert.equal(isSeatName("ep553-work"), false);
});

test("tmux unless herdr is named; the plugin turns off for one session with MIADI_MIETTE_PLAN_INSIGHT=0", () => {
  assert.equal(carrierOf({}), "tmux");
  assert.equal(carrierOf({ MIADI_PLAN_INSIGHT_CARRIER: "HERDR" }), "herdr");
  assert.equal(carrierOf({ MIADI_PLAN_INSIGHT_CARRIER: "zellij" }), "tmux");
  assert.equal(isDisabled({ MIADI_MIETTE_PLAN_INSIGHT: "0" }), true);
  assert.equal(isDisabled({}), false);
});

test("the episode comes from the binding line, then the inventory record, then none", () => {
  assert.deepEqual(episodeOf({ episode: { id: "ep-a", source: "cwd" }, inventory: { episode: { folder: "ep-b" } } }), { folder: "ep-a", source: "binding line (cwd)" });
  assert.deepEqual(episodeOf({ inventory: { episode: { folder: "ep-b" } } }), { folder: "ep-b", source: "inventory record" });
  assert.deepEqual(episodeOf(null), { folder: undefined, source: "none" });
});

test("the primer names the plan, the prompts, the episode, and asks for the episode when none is known", () => {
  const known = primerText({ seat: "s-miette-insight", sessionId: SID, planningTmux: "s", planPath: "/st/plan.md", userInputs: "/sd/u.jsonl", episode: { folder: "ep-a", source: "inventory record" }, stateDir: "/st" });
  assert.match(known, /plan, as presented: \/st\/plan\.md/);
  assert.match(known, /turn by turn: \/sd\/u\.jsonl/);
  assert.match(known, /Its episode: ep-a \(from its inventory record\)/);
  assert.match(known, /Never type into that pane/);
  const byHand = primerText({ seat: "x-miette-insight", sessionId: "mission-m.v1", planPath: "/st/p.md", episode: { source: "none" }, mission: "m.v1", source: "asked by hand: /b.md", stateDir: "/st" });
  assert.match(byHand, /asked for by hand/);
  assert.match(byHand, /belongs to the mission m\.v1/);
  assert.match(byHand, /Ask William in your first turn which episode/);
  assert.equal(/undefined/.test(byHand), false);
});

test("plan versions sort by when they were kept, to the millisecond", () => {
  const a = planStamp(new Date(2026, 9, 25, 11, 0, 0, 5));
  const b = planStamp(new Date(2026, 9, 25, 11, 0, 0, 40));
  assert.equal(a.length, 15);
  assert.ok(a < b);
});

// ---------- the CLI, against a temporary host ----------

function host() {
  const dir = mkdtempSync(join(tmpdir(), "miette-plan-insight-"));
  const bin = join(dir, "bin");
  spawnSync("mkdir", ["-p", bin, join(dir, "sessiondata")]);
  // A stand-in mct that records what it was asked to open, and an interpreter that knows the episode.
  writeFileSync(join(bin, "mct"), `#!/bin/bash\nprintf '%s\\n' "$@" > "${dir}/mct.args"\ncp "\${@: -2:1}" "${dir}/primer.seen" 2>/dev/null\nexit 0\n`, { mode: 0o755 });
  writeFileSync(join(bin, "interp"), `#!/bin/bash\necho '[{"session_id":"${SID}","episode":{"id":"2026-10-12-episode-553-x","source":"cwd"}}]'\n`, { mode: 0o755 });
  const env = {
    PATH: process.env.PATH,
    HOME: dir,
    MIADI_MIETTE_STATE_DIR: join(dir, "state"),
    CLAUDE_SESSIONDATA_ROOT: join(dir, "sessiondata"),
    MIADI_MCT_BIN: join(bin, "mct"),
    MIADI_HOOKS_INTERPRET_BIN: join(bin, "interp"),
    MIADI_PLAN_INSIGHT_REGISTER_BIN: join(bin, "absent")
  };
  return { dir, env, stateOf: (key) => join(dir, "state", key) };
}

const cli = (args, env, input) => spawnSync(process.execPath, [SCRIPT, ...args], { env, input, encoding: "utf8", timeout: 30_000 });

async function until(check, ms = 15_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

test("the hook keeps the plan, answers at once, and the seat opens with mct new on T3 with the primer", async () => {
  const { dir, env, stateOf } = host();
  try {
    const r = cli(["hook"], env, JSON.stringify({ session_id: SID, tool_name: "ExitPlanMode", cwd: dir, tool_input: { plan: "# Plan\nship it" } }));
    assert.equal(r.status, 0, r.stderr);
    assert.match(JSON.parse(r.stdout).systemMessage, /plan-4a740ef7-miette-insight/);
    const plans = readdirSync(stateOf(SID)).filter((n) => n.startsWith("plan-"));
    assert.equal(plans.length, 1);
    assert.ok(await until(() => existsSync(join(dir, "mct.args"))), `the background opener ran mct: ${existsSync(join(stateOf(SID), "open.log")) ? readFileSync(join(stateOf(SID), "open.log"), "utf8") : "no log"}`);
    const args = readFileSync(join(dir, "mct.args"), "utf8").trim().split("\n");
    assert.deepEqual(args.slice(0, 3), ["new", "T3", "plan-4a740ef7-miette-insight"]);
    assert.ok(args.includes("--remote") && args.includes("-d") && args.includes("--prompt-file"));
    assert.ok(await until(() => JSON.parse(readFileSync(join(stateOf(SID), "seat.json"), "utf8")).opened_at));
    const seat = JSON.parse(readFileSync(join(stateOf(SID), "seat.json"), "utf8"));
    assert.equal(seat.episode, "2026-10-12-episode-553-x");
    assert.equal(seat.carrier, "tmux");
    assert.match(readFileSync(seat.primer, "utf8"), /Its episode: 2026-10-12-episode-553-x/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a hook turned off, or given no plan, writes nothing", () => {
  const { dir, env } = host();
  try {
    const off = cli(["hook"], { ...env, MIADI_MIETTE_PLAN_INSIGHT: "0" }, JSON.stringify({ session_id: SID, tool_name: "ExitPlanMode", tool_input: { plan: "x" } }));
    assert.equal(off.status, 0);
    assert.equal(off.stdout, "");
    const empty = cli(["hook"], env, "{not json");
    assert.equal(empty.status, 0);
    assert.equal(existsSync(join(dir, "state")), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a plan asked for by hand files under its mission and the episode given", async () => {
  const { dir, env, stateOf } = host();
  try {
    const brief = join(dir, "brief.md");
    writeFileSync(brief, "# Mission brief\nread the room\n");
    const r = cli(["ask", "--plan", brief, "--for", "ep560-desk", "--mission", "miadiRun-2610251100-x-y.v1", "--episode", "2026-10-20-episode-560-z"], env);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /ep560-desk-miette-insight/);
    const key = "mission-miadiRun-2610251100-x-y.v1";
    assert.ok(await until(() => existsSync(join(stateOf(key), "seat.json")) && JSON.parse(readFileSync(join(stateOf(key), "seat.json"), "utf8")).opened_at));
    const seat = JSON.parse(readFileSync(join(stateOf(key), "seat.json"), "utf8"));
    assert.equal(seat.mission, "miadiRun-2610251100-x-y.v1");
    assert.equal(seat.episode, "2026-10-20-episode-560-z");
    assert.equal(seat.episode_source, "asker");
    const primer = readFileSync(seat.primer, "utf8");
    assert.match(primer, /asked for by hand from tmux ep560-desk/);
    assert.match(primer, /mission miadiRun-2610251100-x-y\.v1/);
    assert.equal(cli(["ask", "--plan", join(dir, "missing.md")], env).status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("open --dry-run prints the plan of opening and opens nothing", () => {
  const { dir, env } = host();
  try {
    cli(["hook"], { ...env, MIADI_MCT_BIN: "/nonexistent" }, JSON.stringify({ session_id: SID, tool_name: "ExitPlanMode", cwd: dir, tool_input: { plan: "p" } }));
    const r = cli(["open", "--session", SID, "--dry-run"], env);
    assert.equal(r.status, 0, r.stderr);
    const plan = JSON.parse(r.stdout);
    assert.equal(plan.seat, "plan-4a740ef7-miette-insight");
    assert.equal(plan.team, "T3");
    assert.equal(plan.carrier, "tmux");
    assert.equal(plan.episode.folder, "2026-10-12-episode-553-x");
    assert.equal(cli(["open"], env).status, 2);
    assert.equal(cli(["open", "--session", "nobody"], env).status, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the listener wakes on a later plan version, and refuses to run twice", () => {
  const { dir, env, stateOf } = host();
  try {
    const hookEnv = { ...env, MIADI_MCT_BIN: "/nonexistent" };
    cli(["hook"], hookEnv, JSON.stringify({ session_id: SID, tool_name: "ExitPlanMode", cwd: dir, tool_input: { plan: "v1" } }));
    const first = readdirSync(stateOf(SID)).find((n) => n.startsWith("plan-"));
    const seatFile = join(stateOf(SID), "seat.json");
    writeFileSync(seatFile, JSON.stringify({ ...JSON.parse(readFileSync(seatFile, "utf8")), heard_plan: join(stateOf(SID), first) }));
    cli(["hook"], hookEnv, JSON.stringify({ session_id: SID, tool_name: "ExitPlanMode", cwd: dir, tool_input: { plan: "v2" } }));
    const woke = cli(["listen", "--session", SID, "--interval", "1"], env);
    assert.equal(woke.status, 0, woke.stderr);
    assert.match(woke.stdout, /MIETTE WAKE/);
    assert.match(woke.stdout, new RegExp(`previous: .*${first}`));
    writeFileSync(join(stateOf(SID), "listener.pid"), JSON.stringify({ pid: process.pid, since: "now" }));
    assert.equal(cli(["listen", "--session", SID], env).status, 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("file puts the insight beside the plan, where plan-insight looks, and records it", () => {
  const { dir, env, stateOf } = host();
  try {
    cli(["hook"], { ...env, MIADI_MCT_BIN: "/nonexistent" }, JSON.stringify({ session_id: SID, tool_name: "ExitPlanMode", cwd: dir, tool_input: { plan: "p" } }));
    const insight = join(dir, "insight.md");
    writeFileSync(insight, "Recommendation: accept.\n");
    const r = cli(["file", insight, "--session", SID], env);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /not carried to the wheel/);
    const plans = join(dir, "sessiondata", SID, "plans");
    assert.equal(readFileSync(join(plans, "miette_perspective.md"), "utf8"), "Recommendation: accept.\n");
    assert.ok(existsSync(join(plans, ".miette_perspective.done")));
    assert.equal(JSON.parse(readFileSync(join(stateOf(SID), "seat.json"), "utf8")).insights.length, 1);
    const s = cli(["status", "--session", SID], env);
    assert.match(s.stdout, /insights filed 1/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
