import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findAgent, listAgents, readTurns, renderList, renderShow } from "./agent-talk.mjs";

const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
const midrun = (text) => `The user sent a new message while you were working:\n${text}\n\nThis is how Claude Code surfaces messages the user sends mid-turn — within the running turn.`;

function capture() {
  const dir = mkdtempSync(join(tmpdir(), "agent-talk-"));
  const agents = join(dir, "agents");
  mkdirSync(agents);
  // a subagent the main session launched, that the person then talked to in the agent view
  writeFileSync(join(agents, "a1.launch.json"), JSON.stringify({ description: "Edit reply draft", prompt: "check this draft" }));
  writeFileSync(join(agents, "a1.meta.json"), JSON.stringify({ agentType: "miadi-witness:witness-editor", description: "Edit reply draft" }));
  writeFileSync(join(agents, "a1.transcript.jsonl"), jsonl([
    { type: "user", timestamp: "2026-10-15T09:43:20Z", message: { role: "user", content: "check this draft" } },
    { type: "assistant", timestamp: "2026-10-15T09:44:00Z", message: { content: [{ type: "thinking", thinking: "…" }, { type: "text", text: "R01 · E1" }] } },
    { type: "user", timestamp: "2026-10-15T09:46:00Z", isMeta: true, origin: { kind: "human" }, message: { content: midrun("does main receive this?") } },
    { type: "assistant", timestamp: "2026-10-15T09:46:40Z", message: { content: [{ type: "tool_use", name: "Bash" }] } },
    { type: "user", timestamp: "2026-10-15T09:46:41Z", message: { content: [{ type: "tool_result", content: "ok" }] } },
    { type: "assistant", timestamp: "2026-10-15T09:46:50Z", message: { content: [{ type: "text", text: "I cannot tell." }] } },
    { type: "user", timestamp: "2026-10-15T09:49:00Z", origin: { kind: "human" }, message: { content: midrun("[Image #2]\n\nthere is main") } },
    { type: "assistant", timestamp: "2026-10-15T09:49:40Z", message: { content: [{ type: "text", text: "I see only the placeholder." }] } },
  ]));
  // a /btw side question the person forked with `f`: no Agent call launched it
  writeFileSync(join(agents, "abtw.meta.json"), JSON.stringify({ agentType: "fork", isFork: true, name: "it-takes-forever", description: "it takes forever" }));
  writeFileSync(join(agents, "abtw.transcript.jsonl"), jsonl([
    { type: "user", timestamp: "2026-10-15T08:00:00Z", message: { content: "it takes forever" } },
    { type: "assistant", timestamp: "2026-10-15T08:00:05Z", message: { content: [{ type: "text", text: "The build runs 13 minutes." }] } },
    { type: "user", timestamp: "2026-10-15T08:00:06Z", message: { content: [{ type: "text", text: "<fork-boilerplate>\nYou are a worker fork." }] } },
    { type: "assistant", timestamp: "2026-10-15T08:01:00Z", message: { content: [{ type: "text", text: "Load is 13 on 12 cores." }] } },
  ]));
  // Claude Code's progress-label helper: an output, no transcript, no type
  writeFileSync(join(agents, "alabel.output.md"), "---\nagent_id: alabel\nagent_type: \ndescription: \"unknown\"\ncompleted_at: 2026-10-15T05:46:34-04:00\n---\n\nReviewing draft\n");
  return dir;
}

test("each agent gets its kind, and the person's messages and replies are counted", () => {
  const dir = capture();
  try {
    const byId = Object.fromEntries(listAgents(dir).map((a) => [a.id, a]));
    assert.equal(byId.a1.kind, "subagent");
    assert.equal(byId.a1.type, "miadi-witness:witness-editor");
    assert.equal(byId.a1.person_messages, 2);
    assert.equal(byId.a1.replies, 3);
    assert.equal(byId.a1.images_not_delivered, 1);
    assert.equal(byId.abtw.kind, "btw-fork");
    assert.equal(byId.alabel.kind, "label");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a person's mid-run message loses Claude Code's wrapper and keeps the words", () => {
  const dir = capture();
  try {
    const turns = readTurns(join(dir, "agents", "a1.transcript.jsonl"));
    assert.deepEqual(turns.map((t) => t.role), ["directive", "reply", "person", "reply", "person", "reply"]);
    assert.equal(turns[2].text, "does main receive this?");
    assert.deepEqual(turns[3].tools_before, ["Bash"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a /btw fork shows the person's question and skips the fork boilerplate", () => {
  const dir = capture();
  try {
    const agents = listAgents(dir);
    const fork = findAgent(agents, "it-takes-forever");
    const text = renderShow(fork, readTurns(fork.transcript));
    assert.match(text, /the person's \/btw question, forked\nit takes forever/);
    assert.doesNotMatch(text, /fork-boilerplate/);
    assert.match(renderList(agents), /1 label helper\(s\) hidden/);
    assert.throws(() => findAgent(agents, "nobody"), /no agent/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an image named in a person's message is reported as not delivered", () => {
  const dir = capture();
  try {
    const a1 = findAgent(listAgents(dir), "a1");
    assert.match(renderShow(a1, readTurns(a1.transcript)), /only the placeholder reached the agent/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
