// What every provider's steering adapter owes the contract (jgwill/Miadi packages/connector/STEERING.md),
// on real files, run as each provider runs it. A new provider joins by passing this and live-probe.mjs.
//   node --test tests/steering/conformance.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CANONICAL = "claude/miadi-session-observability/hooks/steering_inbox.mjs";
const COPIES = ["pi/miadi-session-observability/lib/steering_inbox.mjs", "codex/miadi-steering/steering_inbox.mjs", "copilot/miadi-steering/steering_inbox.mjs"];
const SID = "01a1b2f0-2f23-7023-a1e2-fbda84f259dd";

test("every provider carries the same inbox, byte for byte (scripts/sync-steering-inbox.sh)", () => {
  const canonical = readFileSync(join(KIT, CANONICAL));
  for (const copy of COPIES) assert.ok(canonical.equals(readFileSync(join(KIT, copy))), `${copy} differs: run scripts/sync-steering-inbox.sh`);
});

const rootDir = () => mkdtempSync(join(tmpdir(), "steering-conformance-"));
function drop(root, { sid = SID, steer = "session_steer_request:aaaaaaaa-1", order = "000000000000001", instruction = "Change course.", ...over } = {}) {
  mkdirSync(join(root, sid, "pending"), { recursive: true });
  const envelope = { protocol: 1, steer, grant: "run_request:g1", session_id: sid, instruction, instruction_sha256: createHash("sha256").update(instruction).digest("hex"), from: { name: "Guillaume", via: "ChatGPT" }, queued_at: "2026-11-06T22:00:00.000Z", expires_at: "2099-01-01T00:00:00.000Z", ...over };
  writeFileSync(join(root, sid, "pending", `${order}-${steer.replace(/[^\w-]/g, "-")}.json`), JSON.stringify(envelope));
  return envelope;
}
const receipts = (root, sid = SID) => {
  const f = join(root, sid, "receipts.jsonl");
  return existsSync(f) ? readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
};
const count = (root, state, sid = SID) => (existsSync(join(root, sid, state)) ? readdirSync(join(root, sid, state)).length : 0);

// ── Pi: the extension, through a fake of Pi's own extension API ─────────────────

async function piRig(root, { idle = false } = {}) {
  const prior = { dir: process.env.MIADI_STEERING_DIR, pane: process.env.TMUX_PANE };
  const { registerSteeringInbox } = await import(join(KIT, "pi/miadi-session-observability/lib/steering.mjs"));
  const handlers = {};
  const sent = [];
  // As Pi does: its input event fires once it has taken the words, unless it refused them first.
  const pi = {
    on: (name, fn) => (handlers[name] = fn),
    sendUserMessage: (text, options) => {
      sent.push({ text, options });
      if (!pi.refuses) handlers.input?.({ text, source: "extension" });
    },
  };
  registerSteeringInbox(pi, { env: { MIADI_STEERING_DIR: root, TMUX_PANE: "%144", TMUX: "/tmp/tmux-1/default,123,0" } });
  const ctx = { isIdle: () => idle, sessionManager: { getSessionId: () => SID, getSessionFile: () => "/tmp/session.jsonl" } };
  const stop = () => handlers.session_shutdown?.({}, ctx);
  void prior;
  return { handlers, sent, ctx, stop, pi };
}

test("Pi: it says who it is at session start, with its pid and pane, and retires at shutdown", async () => {
  const root = rootDir();
  const r = await piRig(root);
  r.handlers.session_start({ reason: "startup" }, r.ctx);
  const adapter = JSON.parse(readFileSync(join(root, SID, "adapter.json"), "utf8"));
  assert.equal(adapter.provider, "pi");
  assert.equal(adapter.contract, "miadi.steering/1");
  assert.equal(adapter.pid, process.pid);
  assert.equal(adapter.pane, "%144");
  assert.equal(adapter.tmux_socket, "/tmp/tmux-1/default", "a pane number means nothing without its server");
  assert.equal(adapter.transcript_path, "/tmp/session.jsonl");
  assert.equal(adapter.guarantee.level, "same_turn");
  r.stop();
  assert.equal(existsSync(join(root, SID, "adapter.json")), false);
});

test("Pi: a correction goes through Pi's steering queue, once, in order, as a user message that names its sender", async () => {
  const root = rootDir();
  const r = await piRig(root);
  r.handlers.session_start({ reason: "startup" }, r.ctx);
  drop(root, { steer: "session_steer_request:bbbb", order: "000000000000002", instruction: "Second." });
  drop(root, { steer: "session_steer_request:aaaa", order: "000000000000001", instruction: "First." });
  await new Promise((res) => setTimeout(res, 1300));
  r.stop();
  assert.equal(r.sent.length, 2);
  assert.match(r.sent[0].text, /First\./);
  assert.match(r.sent[1].text, /Second\./);
  assert.deepEqual(r.sent[0].options, { deliverAs: "steer" });
  assert.match(r.sent[0].text, /from Guillaume, through ChatGPT/);
  assert.match(r.sent[0].text, /carries no new permissions/);
  assert.equal(count(root, "claimed"), 2);
  assert.equal(receipts(root).filter((x) => x.state === "emitted").length, 2);
});

test("Pi: an envelope for another session, expired, revoked or altered never reaches the model", async () => {
  const root = rootDir();
  const r = await piRig(root);
  r.handlers.session_start({ reason: "startup" }, r.ctx);
  drop(root, { steer: "session_steer_request:old", order: "000000000000001", expires_at: "2020-01-01T00:00:00.000Z" });
  drop(root, { steer: "session_steer_request:other", order: "000000000000002", session_id: "someone-else" });
  drop(root, { steer: "session_steer_request:altered", order: "000000000000003", instruction_sha256: "0000" });
  mkdirSync(join(root, SID, "revoked"), { recursive: true });
  writeFileSync(join(root, SID, "revoked", "session_steer_request-gone"), "{}");
  drop(root, { steer: "session_steer_request:gone", order: "000000000000004" });
  await new Promise((res) => setTimeout(res, 1300));
  r.stop();
  assert.equal(r.sent.length, 0);
  assert.equal(count(root, "expired"), 1);
  assert.equal(count(root, "rejected"), 2);
  assert.equal(count(root, "withdrawn"), 1);
});

test("Pi: the request that holds the correction leaves its own receipt, once", async () => {
  const root = rootDir();
  const r = await piRig(root);
  r.handlers.session_start({ reason: "startup" }, r.ctx);
  drop(root, { steer: "session_steer_request:cccc" });
  await new Promise((res) => setTimeout(res, 1300));
  const messages = [{ role: "user", content: [{ type: "text", text: r.sent[0].text }] }];
  r.handlers.context({ messages }, r.ctx);
  r.handlers.context({ messages }, r.ctx);
  r.stop();
  assert.equal(receipts(root).filter((x) => x.state === "in_model_request").length, 1);
});

test("Pi: a session reloaded or resumed keeps what waits", async () => {
  const root = rootDir();
  const r = await piRig(root);
  drop(root, { steer: "session_steer_request:early" });
  r.handlers.session_start({ reason: "resume" }, r.ctx);
  assert.equal(r.sent.length, 1, "it was waiting before the session came back");
  r.stop();
});

test("Pi: a hand-off Pi never took, as during compaction, returns to the inbox and is tried again, once taken once", async () => {
  const root = rootDir();
  const r = await piRig(root);
  r.pi.refuses = true;
  r.handlers.session_start({ reason: "startup" }, r.ctx);
  drop(root, { steer: "session_steer_request:later" });
  await new Promise((res) => setTimeout(res, 4600));
  assert.equal(count(root, "pending"), 1, "it went back, because Pi did not take it");
  assert.equal(count(root, "claimed"), 0);
  assert.ok(receipts(root).some((x) => x.state === "emit_failed" && x.returned === true));
  assert.equal(receipts(root).filter((x) => x.state === "emitted").length, 0, "no receipt says Pi had it");
  r.stop();
  // Compaction is over: the same envelope goes, and only then does a receipt say so.
  const again = await piRig(root);
  again.handlers.session_start({ reason: "startup" }, again.ctx);
  again.stop();
  assert.equal(count(root, "claimed"), 1);
  assert.equal(receipts(root).filter((x) => x.state === "emitted").length, 1);
});

test("Pi: words unread when the run settles say so, and are not sent again", async () => {
  const root = rootDir();
  const r = await piRig(root);
  r.handlers.session_start({ reason: "startup" }, r.ctx);
  drop(root, { steer: "session_steer_request:abandoned" });
  await new Promise((res) => setTimeout(res, 1300));
  r.handlers.agent_settled({}, r.ctx);
  r.handlers.agent_settled({}, r.ctx);
  r.stop();
  assert.equal(receipts(root).filter((x) => x.state === "left_provider_queue").length, 1);
  assert.equal(r.sent.length, 1);
});

// ── Codex: the hook script, run as Codex runs it ─────────────────────────────────

const CODEX = join(KIT, "codex/miadi-steering/steering_inbox.sh");
const codexHook = (root, event, input) => {
  const r = spawnSync("bash", [CODEX, event], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, MIADI_STEERING_DIR: root, TMUX_PANE: "%200" } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout ? JSON.parse(r.stdout) : null;
};
const codexInput = (over = {}) => ({ session_id: SID, turn_id: "t1", transcript_path: "/tmp/rollout.jsonl", cwd: "/tmp", hook_event_name: "PostToolUse", tool_name: "Bash", tool_use_id: "call_1", tool_input: {}, tool_response: "ok", ...over });

test("Codex: session start names Codex and the seat's pane, and never takes the hook's own path for the agent", () => {
  const root = rootDir();
  codexHook(root, "session-start", codexInput({ hook_event_name: "SessionStart", source: "startup" }));
  const adapter = JSON.parse(readFileSync(join(root, SID, "adapter.json"), "utf8"));
  assert.equal(adapter.provider, "codex");
  assert.equal(adapter.pane, "%200");
  assert.equal(adapter.adapter, "miadi-steering (Codex hooks)");
  assert.equal(adapter.pid, undefined, "no codex process is an ancestor here, and a script under codex/ is not one");
});

test("Codex: PostToolUse presents it as additionalContext, once", () => {
  const root = rootDir();
  codexHook(root, "session-start", codexInput());
  drop(root);
  const out = codexHook(root, "post-tool-use", codexInput());
  assert.equal(out.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(out.hookSpecificOutput.additionalContext, /Change course\./);
  assert.equal(codexHook(root, "post-tool-use", codexInput()), null);
  assert.equal(count(root, "claimed"), 1);
  assert.equal(receipts(root)[0].state, "emitted");
});

test("Codex: Stop continues the turn with it, and an empty inbox marks the seat idle for the runner", () => {
  const root = rootDir();
  codexHook(root, "session-start", codexInput());
  assert.equal(codexHook(root, "stop", codexInput({ hook_event_name: "Stop" })), null);
  assert.equal(JSON.parse(readFileSync(join(root, SID, "seat.json"), "utf8")).status, "idle");
  assert.equal(codexHook(root, "user-prompt-submit", codexInput({ hook_event_name: "UserPromptSubmit" })), null);
  assert.equal(JSON.parse(readFileSync(join(root, SID, "seat.json"), "utf8")).status, "busy");
  drop(root);
  const out = codexHook(root, "stop", codexInput({ hook_event_name: "Stop" }));
  assert.equal(out.decision, "block");
  assert.match(out.reason, /Change course\./);
});

test("Codex: another session's inbox is not read, and a tool's output naming a session is not taken for this one", () => {
  const root = rootDir();
  drop(root, { sid: "01a1b2f1-6033-73d4-8978-557f9329f334" });
  const nested = JSON.stringify({ session_id: "01a1b2f1-6033-73d4-8978-557f9329f334" });
  assert.equal(codexHook(root, "post-tool-use", codexInput({ tool_response: nested })), null);
  assert.equal(count(root, "pending", "01a1b2f1-6033-73d4-8978-557f9329f334"), 1);
});

test("Codex: UserPromptSubmit presents what waited, for a seat woken by codex queue", () => {
  const root = rootDir();
  codexHook(root, "session-start", codexInput());
  drop(root);
  const out = codexHook(root, "user-prompt-submit", codexInput({ hook_event_name: "UserPromptSubmit" }));
  assert.equal(out.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(out.hookSpecificOutput.additionalContext, /Change course\./);
});

// ── Copilot: what can be checked without its runtime; live-probe holds the rest ──

test("Copilot: the extension parses, names its provider and holds a shell's wait until its tools finish", () => {
  const file = join(KIT, "copilot/miadi-steering/extension.mjs");
  assert.equal(spawnSync("node", ["--check", file]).status, 0);
  const text = readFileSync(file, "utf8");
  assert.match(text, /mode: "immediate"/);
  assert.match(text, /if \(draining \|\| running\.size \|\| Date\.now\(\) < holdUntil\) return/);
  assert.match(text, /IDENTITIES\.copilot/);
});

test("Copilot: the installer sets only the flag it needs, keeps every other setting, and takes both out again", () => {
  const home = rootDir();
  writeFileSync(join(home, "settings.json"), JSON.stringify({ model: "auto", enabledFeatureFlags: { OTHER: true } }));
  const run = (...args) => spawnSync("bash", [join(KIT, "copilot/miadi-steering/install.sh"), ...args], { encoding: "utf8", env: { ...process.env, COPILOT_HOME: home } });
  assert.equal(run().status, 0);
  assert.ok(existsSync(join(home, "extensions/miadi-steering/extension.mjs")));
  assert.deepEqual(JSON.parse(readFileSync(join(home, "settings.json"), "utf8")), { model: "auto", enabledFeatureFlags: { OTHER: true, EXTENSIONS: true } });
  assert.equal(run().status, 0, "a second install changes nothing");
  assert.deepEqual(JSON.parse(readFileSync(join(home, "settings.json"), "utf8")).enabledFeatureFlags, { OTHER: true, EXTENSIONS: true });
  assert.equal(run("--remove").status, 0);
  assert.equal(existsSync(join(home, "extensions/miadi-steering")), false);
  assert.deepEqual(JSON.parse(readFileSync(join(home, "settings.json"), "utf8")), { model: "auto", enabledFeatureFlags: { OTHER: true } });
});

test("the Claude Code adapter still announces itself as it did, and now says its pane", () => {
  const root = rootDir();
  const r = spawnSync("bash", [join(KIT, "claude/miadi-session-observability/hooks/steering_inbox.sh"), "session-start"], { input: JSON.stringify({ session_id: "11111111-2222-4333-8444-555555555555", transcript_path: "/tmp/t.jsonl", source: "startup" }), encoding: "utf8", env: { ...process.env, MIADI_STEERING_DIR: root, TMUX_PANE: "%9" } });
  assert.equal(r.status, 0, r.stderr);
  const adapter = JSON.parse(readFileSync(join(root, "11111111-2222-4333-8444-555555555555", "adapter.json"), "utf8"));
  assert.equal(adapter.provider, "claude");
  assert.equal(adapter.pane, "%9");
  assert.match(adapter.adapter_version, /^\d+\.\d+\.\d+$/, "from the plugin's own manifest");
  chmodSync(root, 0o700);
});
