// node --test claude/ava-companion/scripts/ava.test.mjs
process.env.TZ = "UTC"; // the condensed session is stamped in local time; pin it for the asserts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { avaSpoke, condense, extractDiary, redact, previousEntryFor, readTranscript } from "./lib.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const hook = path.join(here, "ava-hook.mjs");
const diary = path.join(here, "ava-diary.mjs");

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "ava-companion-")); }

function transcript(dir, { withAva }) {
  const rows = [
    { type: "custom-title", customTitle: "thread-talk" },
    { type: "user", timestamp: "2026-10-06T20:54:09Z", message: { role: "user", content: "read asterion#20 <system-reminder>hidden</system-reminder>" } },
    { type: "user", isMeta: true, timestamp: "2026-10-06T20:54:10Z", message: { role: "user", content: "meta, never shown" } },
    { type: "assistant", timestamp: "2026-10-06T20:54:14Z", message: { role: "assistant", content: [{ type: "tool_use", name: "Bash", input: { description: "Read issue 20", command: "gh issue view 20" } }] } },
    { type: "user", timestamp: "2026-10-06T20:54:15Z", message: { role: "user", content: [{ type: "tool_result", content: "issue body" }] } },
    { type: "assistant", timestamp: "2026-10-06T20:54:47Z", message: { role: "assistant", content: [{ type: "text", text: withAva ? "💕 : I'm here." : "🧠: a list of findings, with a 💕: in the middle" }] } },
  ];
  const file = path.join(dir, "s1.jsonl");
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n{torn");
  return file;
}

test("condense keeps words and tool lines, drops meta, reminders and tool results", () => {
  const dir = tmp();
  const s = condense(readTranscript(transcript(dir, { withAva: true })));
  assert.equal(s.title, "thread-talk");
  assert.match(s.text, /\[10-06 20:54\] GUILLAUME: read asterion#20$/m);
  assert.match(s.text, /tool Bash: Read issue 20/);
  assert.match(s.text, /AVA: 💕 : I'm here\./);
  assert.doesNotMatch(s.text, /hidden|meta, never shown|issue body/);
  assert.equal(s.firstTs, "2026-10-06T20:54:09Z");
  assert.equal(s.lastTs, "2026-10-06T20:54:47Z");
});

test("condense hears what he typed mid-turn, and labels a background notification as not him", () => {
  const dir = tmp();
  const file = path.join(dir, "s.jsonl");
  const rows = [
    { type: "user", timestamp: "2026-10-10T01:52:00Z", message: { role: "user", content: "show the screenwalks" } },
    { type: "queue-operation", operation: "enqueue", timestamp: "2026-10-10T01:59:37Z", content: "have a subagent review it" },
    { type: "attachment", timestamp: "2026-10-10T01:59:31Z", attachment: { type: "queued_command", prompt: "have a subagent review it", origin: { kind: "human" } } },
    { type: "attachment", timestamp: "2026-10-10T02:00:00Z", attachment: { type: "queued_command", prompt: "show the screenwalks", origin: { kind: "human" } } },
    { type: "user", timestamp: "2026-10-10T02:07:00Z", message: { role: "user", content: `<task-notification><summary>Agent "Review page" finished</summary><result>VERDICT: cut the From rows${"x".repeat(9000)}</result></task-notification>` } },
  ];
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n"));
  const s = condense(readTranscript(file));
  assert.match(s.text, /\[10-10 01:59\] GUILLAUME \(while the session was working\): have a subagent review it/);
  assert.equal(s.text.match(/show the screenwalks/g).length, 1, "a queued message already delivered as a turn is not repeated");
  assert.match(s.text, /NOTIFICATION \(a background task, not Guillaume\): Agent "Review page" finished\nVERDICT: cut the From rows/);
  assert.doesNotMatch(s.text, /GUILLAUME: <task-notification>/);
  assert.doesNotMatch(s.text, /more characters\]/, "a 9000-character result is kept whole");
});

test("presence is her label in a reply, not her name in a prompt", () => {
  const said = (text) => [{ type: "assistant", message: { content: [{ type: "text", text }] } }];
  assert.equal(avaSpoke(said("💕 : here")), true);
  assert.equal(avaSpoke(said("🧠: Ava answers.\n\n💕 Ava: here")), true, "sessions before 0.1.1");
  assert.equal(avaSpoke(said("a heart 💕: in the middle of a line")), false);
  assert.equal(avaSpoke([{ type: "user", message: { content: "💕 : quoted by him" } }]), false);
});

test("only the diary block survives the writer's output", () => {
  assert.equal(extractDiary("🧠: preface\n<diary>\n# T\n\nbody\n</diary>\n🌸: tail"), "# T\n\nbody");
  assert.equal(extractDiary("no block"), null);
});

test("secrets are redacted", () => {
  const t = redact("token=abcd1234efgh5678 Bearer abcdefghijklmnopqrstuvwxyz ghp_abcdefghijklmnopqrstuvwx");
  assert.doesNotMatch(t, /abcd1234efgh5678|abcdefghijklmnopqrstuvwxyz|ghp_abc/);
  const env = redact('MIADI_PERSON_TOKEN="mwt_Abc123def456ghi789jkl0" and a bare mwt_Zyx987wvu654tsr321qpo0');
  assert.doesNotMatch(env, /mwt_Abc|mwt_Zyx/);
  assert.match(env, /MIADI_PERSON_TOKEN=/);
});

test("session-start is silent for a session she has not spoken in", () => {
  const dir = tmp();
  const env = { ...process.env, AVA_COMPANION: "", CLAUDE_ENV_FILE: path.join(dir, "env") };
  const r = spawnSync("node", [hook, "session-start"], { env, encoding: "utf8",
    input: JSON.stringify({ session_id: "s1", transcript_path: transcript(dir, { withAva: false }), source: "resume" }) });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.match(fs.readFileSync(env.CLAUDE_ENV_FILE, "utf8"), /AVA_COMPANION_SESSION_ID="s1"/);
});

test("session-start brings her back after a resume of a session she spoke in", () => {
  const dir = tmp();
  const r = spawnSync("node", [hook, "session-start"], { env: { ...process.env, AVA_COMPANION: "" }, encoding: "utf8",
    input: JSON.stringify({ session_id: "s1", transcript_path: transcript(dir, { withAva: true }), source: "resume" }) });
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(out.hookSpecificOutput.additionalContext, /she spoke in this session before this resume/);
  assert.match(out.hookSpecificOutput.additionalContext, /## Her label/);
});

test("AVA_COMPANION=1 invites her at startup; AVA_COMPANION=0 keeps her out", () => {
  const dir = tmp();
  const input = JSON.stringify({ session_id: "s1", transcript_path: transcript(dir, { withAva: true }), source: "startup" });
  const on = spawnSync("node", [hook, "session-start"], { env: { ...process.env, AVA_COMPANION: "1" }, encoding: "utf8", input });
  assert.match(JSON.parse(on.stdout).hookSpecificOutput.additionalContext, /AVA_COMPANION=1/);
  const off = spawnSync("node", [hook, "session-start"], { env: { ...process.env, AVA_COMPANION: "0" }, encoding: "utf8", input });
  assert.equal(off.stdout, "");
});

function fakeClaude(dir) {
  const bin = path.join(dir, "fake-claude.mjs");
  fs.writeFileSync(bin, `#!/usr/bin/env node
let input = ""; process.stdin.on("data", (d) => input += d).on("end", () => {
  if (process.env.AVA_DIARY_WRITER !== "1") { console.log("guard missing"); process.exit(3); }
  console.log("🧠: policy preface\\n<diary>\\n# The thread page that opened empty\\n\\n21:10, he asked. token=supersecretvalue1\\n</diary>\\n🌸: tail");
});`);
  fs.chmodSync(bin, 0o755);
  return bin;
}

test("the diary writer writes one entry with provenance and continues an earlier one", () => {
  const dir = tmp();
  const diaries = path.join(dir, "diaries");
  const env = { ...process.env, AVA_DIARY_DIR: diaries, AVA_DIARY_GIT: "off", AVA_DIARY_CLAUDE_BIN: fakeClaude(dir), XDG_STATE_HOME: path.join(dir, "state") };
  const t = transcript(dir, { withAva: true });
  const first = spawnSync("node", [diary, "--transcript", t, "--session", "s1", "--cwd", dir], { env, encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  const files = fs.readdirSync(diaries);
  assert.equal(files.length, 1);
  const text = fs.readFileSync(path.join(diaries, files[0]), "utf8");
  assert.match(files[0], /^\d{6}-\d{4}-the-thread-page-that-opened-empty\.md$/);
  assert.match(text, /^---\nwriter: ava-companion .*\nsession: s1\n/);
  assert.match(text, /from: 2026-10-06T20:54:09Z/);
  assert.doesNotMatch(text, /policy preface|🌸: tail|supersecretvalue1/);
  assert.equal(previousEntryFor(diaries, "s1"), path.join(diaries, files[0]));
  // a fork has its own session id but the same first moment as its parent
  assert.equal(previousEntryFor(diaries, "fork-of-s1", "2026-10-06T20:54:09Z"), path.join(diaries, files[0]));
  assert.equal(previousEntryFor(diaries, "unrelated", "2026-10-07T08:00:00Z"), null);
  const dry = spawnSync("node", [diary, "--transcript", t, "--session", "s1", "--cwd", dir, "--dry-run"], { env, encoding: "utf8" });
  assert.equal(JSON.parse(dry.stdout).previous, path.join(diaries, files[0]));
});

test("session-end writes the diary detached, and never inside the writer's own session", async () => {
  const dir = tmp();
  const diaries = path.join(dir, "diaries");
  const env = { ...process.env, AVA_COMPANION: "", AVA_DIARY_DIR: diaries, AVA_DIARY_GIT: "off", AVA_DIARY_CLAUDE_BIN: fakeClaude(dir), XDG_STATE_HOME: path.join(dir, "state") };
  const input = JSON.stringify({ session_id: "s1", transcript_path: transcript(dir, { withAva: true }), cwd: dir, reason: "prompt_input_exit" });
  const guarded = spawnSync("node", [hook, "session-end"], { env: { ...env, AVA_DIARY_WRITER: "1" }, encoding: "utf8", input });
  assert.equal(guarded.status, 0);
  const r = spawnSync("node", [hook, "session-end"], { env, encoding: "utf8", input });
  assert.equal(r.status, 0);
  for (let i = 0; i < 50 && !(fs.existsSync(diaries) && fs.readdirSync(diaries).length); i++) await new Promise((ok) => setTimeout(ok, 100));
  assert.equal(fs.readdirSync(diaries).length, 1);
});
