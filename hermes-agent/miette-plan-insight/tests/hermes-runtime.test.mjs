import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { isSessionId, sessionDataRoot } from "../../../claude/miette-plan-insight/scripts/lib.mjs";

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCRIPT = join(KIT, "claude/miette-plan-insight/scripts/miette-plan-insight.mjs");
const SID = `local-${"a".repeat(64)}`;

test("Hermes capture roots do not inherit an unrelated Claude override", () => {
  const env = { MIADI_MIETTE_AGENT: "hermes", CLAUDE_SESSIONDATA_ROOT: "/claude", MIADI_SESSION_DIR: "/shared" };
  assert.equal(sessionDataRoot(env), "/shared");
  assert.equal(sessionDataRoot({ ...env, HERMES_SESSIONDATA_ROOT: "/hermes" }), "/hermes");
  assert.equal(sessionDataRoot({ ...env, MIADI_MIETTE_AGENT: "claude" }), "/claude");
});

test("native Hermes mint-site identities are recognized without treating missions as sessions", () => {
  for (const id of [SID, "20261108_070000_a1b2c3", "cron_job-1_20261108_070000", "bg_abcdef",
    `room_${"b".repeat(32)}`, "api_1794100000_abcdef12", `api-${"b".repeat(16)}`, `run_${"b".repeat(32)}`]) {
    assert.equal(isSessionId(id), true, id);
  }
  assert.equal(isSessionId("mission-miadiRun-2611080700-test.v1"), false);
  assert.equal(isSessionId("ask-261108070000"), false);
  assert.equal(isSessionId("../20261108_070000_abcdef"), false);
});

async function waitFor(check) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.fail("fixture runtime did not finish opening its stand-in seat");
}

test("Hermes uses a real session key, native launch flags, prompt ledger and capture filing", async () => {
  const root = mkdtempSync(join(tmpdir(), "hermes-miette-runtime-"));
  try {
    const bin = join(root, "bin");
    mkdirSync(bin);
    mkdirSync(join(root, "capture", SID), { recursive: true });
    writeFileSync(join(bin, "tmux"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    writeFileSync(join(bin, "mct"), `#!/bin/sh\nprintf '%s\\n' "$@" > '${root}/mct.args'\n`, { mode: 0o755 });
    writeFileSync(join(root, "plan.md"), "# Fixture plan\nDo the work.\n");
    writeFileSync(join(root, "capture", SID, "_hermes_user_prompt_submit.jsonl"), '{"extra":{"user_message":"fixture prompt"}}\n');
    const env = { PATH: `${bin}:${process.env.PATH}`, HOME: root, TMPDIR: process.env.TMPDIR,
      HERMES_HOME: join(root, "profile"), HERMES_SESSIONDATA_ROOT: join(root, "capture"),
      MIADI_MIETTE_AGENT: "hermes", MIADI_MIETTE_STATE_DIR: join(root, "state"),
      MIADI_MCT_BIN: join(bin, "mct"), MIADI_HOOKS_INTERPRET_BIN: join(root, "absent"),
      MIADI_PLAN_INSIGHT_REGISTER_BIN: join(root, "absent") };
    const cli = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { env, encoding: "utf8", timeout: 15000 });
    const asked = cli(["ask", "--plan", join(root, "plan.md"), "--session", SID]);
    assert.equal(asked.status, 0, asked.stderr);
    const statePath = join(root, "state", SID, "seat.json");
    await waitFor(() => existsSync(statePath) && JSON.parse(readFileSync(statePath)).opened_at);
    const state = JSON.parse(readFileSync(statePath));
    assert.equal(state.source_agent, "hermes");
    const args = readFileSync(join(root, "mct.args"), "utf8").split("\n");
    assert.ok(args.includes("--no-name"));
    assert.ok(!args.includes("--remote"));
    const launch = args[args.indexOf("--launch") + 1];
    assert.match(launch, /\shermes$/);
    assert.match(launch, /HERMES_HOME=/);
    assert.match(launch, /MIADI_MIETTE_STATE_DIR=/);
    assert.doesNotMatch(launch, /--remote-control|(?:^|\s)-n\s/);
    assert.match(readFileSync(state.primer, "utf8"), /miette-plan-insight:miette-plan-insight/);
    assert.match(readFileSync(state.primer, "utf8"), /_hermes_user_prompt_submit\.jsonl/);
    writeFileSync(join(root, "insight.md"), "Recommendation: revise.\nName the audience.\n");
    const filed = cli(["file", join(root, "insight.md"), "--session", SID, "--no-register"]);
    assert.equal(filed.status, 0, filed.stderr);
    const plans = join(root, "capture", SID, "plans");
    assert.equal(readFileSync(join(plans, "miette_perspective.md"), "utf8"), "Recommendation: revise.\nName the audience.\n");
    assert.equal(readdirSync(plans).filter((p) => p.startsWith(`session_${SID}_`)).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
