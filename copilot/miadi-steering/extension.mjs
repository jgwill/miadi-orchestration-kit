// The steering inbox of one GitHub Copilot CLI session: Copilot's half of the contract in
// jgwill/Miadi packages/connector/STEERING.md (jgwill/Miadi#942). steering_inbox.mjs beside this file
// is the same file every provider's adapter carries.
//
// session.send({ mode: "immediate" }) is the door a person's Enter uses while Copilot works: the
// words enter the running turn as a user message, and an idle session starts a turn. Copilot's
// immediate mode also ends a shell tool's wait, leaving its command running in the background, so
// the adapter holds the correction until the tools in flight have finished. No running tool is touched.
import { readFileSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { joinSession } from "@github/copilot-sdk/extension";
import { announce, claimPending, IDENTITIES, receipt, retire, safe, statSafe, steeringRoot, withLock } from "./steering_inbox.mjs";

const POLL_MS = 1000;
const VERSION = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

const session = await joinSession({ tools: [] });
const id = session.sessionId;
const home = process.env.COPILOT_HOME || join(homedir(), ".copilot");
const dir = join(steeringRoot(), safe(id));
const running = new Set();
let draining = false;
let watcher;

async function deliver() {
  if (draining || running.size) return;
  draining = true;
  try {
    const now = Date.now();
    const claimed = withLock(dir, now, () => claimPending(dir, id, now)) ?? [];
    for (const c of claimed) {
      try {
        await session.send({ prompt: c.text, mode: "immediate" });
        receipt(dir, { steer: c.envelope.steer, state: "emitted", hook_event: "session.send immediate" });
      } catch (error) {
        receipt(dir, { steer: c.envelope.steer, state: "emit_failed", reason: error?.message ?? String(error) });
      }
    }
  } finally {
    draining = false;
  }
}

function watchPending() {
  const pending = join(dir, "pending");
  if (watcher || !statSafe(pending)) return;
  try {
    watcher = watch(pending, () => void deliver());
    watcher.on("error", () => {
      watcher?.close();
      watcher = undefined;
    });
  } catch {
    // The poll below carries it.
  }
}

announce({ session_id: id, transcript_path: join(home, "session-state", id, "events.jsonl"), source: "startup" }, process.env, { ...IDENTITIES.copilot, adapter_version: VERSION, pid: process.ppid });

session.on("tool.execution_start", (event) => running.add(event.data?.toolCallId));
session.on("tool.execution_complete", (event) => {
  running.delete(event.data?.toolCallId);
  void deliver();
});
const timer = setInterval(() => {
  watchPending();
  void deliver();
}, POLL_MS);

const end = () => {
  clearInterval(timer);
  watcher?.close();
  retire({ session_id: id });
  process.exit(0);
};
process.on("SIGTERM", end);
process.on("SIGINT", end);
