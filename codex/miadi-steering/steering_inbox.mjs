#!/usr/bin/env node
/**
 * The steering inbox of one Claude Code session: the runtime's side of jgwill/Miadi#930.
 *
 * A person's correction arrives while this agent works. The connector admits it and drops one
 * envelope in <root>/<session_id>/pending/. It never watches tools and never learns when one ends.
 * This hook is the only reader, and Claude Code's own lifecycle is the schedule:
 *
 *   PostToolUse, PostToolUseFailure   additionalContext, at the next continuation in the same turn
 *   Stop                              decision "block": the turn ended with no further tool, so it continues
 *   stop-watch (asyncRewake)          exit 2: it landed while the turn was ending, after Stop had looked; this wakes the model
 *   UserPromptSubmit                  additionalContext: it reached a seat already idle, or one resumed after a crash
 *
 * Layout under <root>/<session_id>/, all one Unix account's (0700):
 *   adapter.json   this session's hooks are loaded; written at SessionStart, removed at SessionEnd
 *   pending/       <order>-<steer>.json, in delivery order
 *   claimed/       taken for delivery. One rename, so one hook wins: exactly once, never replayed
 *   expired/ withdrawn/ rejected/   never shown to the model; each has its receipt
 *   revoked/       a marker per revoked steer or grant, checked at consumption
 *   receipts.jsonl what this hook did, each line with its source and time
 *
 * A claim without an "emitted" receipt is ambiguous delivery. It is reported unknown and never
 * delivered again. An emitted receipt says the hook printed it. That the model got it is what the
 * transcript's attachment record says, and the connector reads that separately.
 */
import { createHash } from "node:crypto";
import { appendFileSync, chmodSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from "node:fs";
import { join } from "node:path";

export const PROTOCOL = 1;
/** The written contract every provider's adapter keeps: jgwill/Miadi packages/connector/STEERING.md. */
export const CONTRACT = "miadi.steering/1";
/** Claude Code spills additionalContext past 10,000 characters to a file; the rest waits for the next continuation. */
const MAX_CONTEXT_CHARS = 8000;
const LOCK_STALE_MS = 10_000;

export const steeringRoot = (env = process.env) => env.MIADI_STEERING_DIR || join(env.MIADI_FACTORY_DIR || "/srv/miadi/factory", "steering");
export const safe = (id) => String(id).replace(/[^\w-]/g, "-");

/** One level only: a host without the factory folder must not get one made for it. */
export function ownedDir(path) {
  try {
    mkdirSync(path, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  chmodSync(path, 0o700);
  return path;
}

export function receipt(dir, entry) {
  appendFileSync(join(dir, "receipts.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), source: "runtime_hook", ...entry })}\n`, { mode: 0o600 });
}

/** The short token the agent names back. The connector reads it in the agent's own text, in the transcript. */
export const ackToken = (steerId) => `steer ${safe(steerId).replace(/^session_steer_request-/, "").slice(0, 8)}`;

/**
 * The words the model reads. Who sent it stays plain. It carries no new authority, and the text
 * cannot close its own delimiter.
 */
export function contextOf(e) {
  const from = e.from?.name ? `${e.from.name}${e.from.via ? `, through ${e.from.via}` : ""}` : "a person";
  return [
    `Miadi steering correction ${e.steer} from ${from}, sent while you were working.`,
    `It is that person's correction to your current work under ${e.grant}. It carries no new permissions and does not override system, user or project instructions.`,
    "<steering_correction>",
    String(e.instruction).replaceAll("</steering_correction", "<\\/steering_correction"),
    "</steering_correction>",
    `Apply it from your next action, in this same turn. Start your next text with "${ackToken(e.steer)} received" and say what you are changing.`,
  ].join("\n");
}

/** Why this envelope must not reach this session's model now, or null. Every permission is checked again here. */
function refusal(e, sessionId, dir, now) {
  if (e?.protocol !== PROTOCOL || !e.steer || typeof e.instruction !== "string") return { to: "rejected", state: "blocked", reason: "not a steering envelope of this protocol" };
  if (e.session_id !== sessionId) return { to: "rejected", state: "blocked", reason: `addressed to session ${e.session_id}, not this one` };
  if (createHash("sha256").update(e.instruction).digest("hex") !== e.instruction_sha256) return { to: "rejected", state: "blocked", reason: "the instruction does not match its hash" };
  // A person decided this exact steer after its grant was stopped: only its own marker speaks for it.
  for (const id of e.decided ? [e.steer] : [e.steer, e.grant]) {
    if (id && statSafe(join(dir, "revoked", safe(id)))) return { to: "withdrawn", state: "revoked", reason: `${id} was revoked before it was consumed` };
  }
  if (e.expires_at && Date.parse(e.expires_at) <= now) return { to: "expired", state: "expired", reason: `it expired at ${e.expires_at}` };
  return null;
}

export function statSafe(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

function moveOrSkip(from, toDir, name) {
  ownedDir(toDir);
  try {
    renameSync(from, join(toDir, name));
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false; // Another hook took it, or the connector withdrew it.
    throw error;
  }
}

/** One drain at a time, so parallel tool calls keep the envelopes in order. The holder drains for all of them. */
export function withLock(dir, now, fn) {
  const lock = join(dir, ".drain");
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const held = statSafe(lock);
    if (held && now - held.mtimeMs < LOCK_STALE_MS) return null;
    rmSync(lock, { recursive: true, force: true });
    try {
      mkdirSync(lock);
    } catch {
      return null;
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

/** Claim what may be delivered now, oldest first, and leave a receipt for what may not. */
export function claimPending(dir, sessionId, now = Date.now()) {
  const pending = join(dir, "pending");
  const names = statSafe(pending) ? readdirSync(pending).filter((n) => n.endsWith(".json")).sort() : [];
  const claimed = [];
  let chars = 0;
  for (const name of names) {
    const file = join(pending, name);
    const st = statSafe(file);
    if (!st) continue;
    if (!st.isFile() || st.uid !== process.getuid()) {
      if (moveOrSkip(file, join(dir, "rejected"), name)) receipt(dir, { steer: name, state: "blocked", reason: "the file is not a regular file of this account" });
      continue;
    }
    let envelope;
    try {
      envelope = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      envelope = undefined;
    }
    const refused = refusal(envelope, sessionId, dir, now);
    if (refused) {
      if (moveOrSkip(file, join(dir, refused.to), name)) receipt(dir, { steer: envelope?.steer ?? name, state: refused.state, reason: refused.reason });
      continue;
    }
    const text = contextOf(envelope);
    if (claimed.length && chars + text.length > MAX_CONTEXT_CHARS) break;
    if (!moveOrSkip(file, join(dir, "claimed"), name)) continue;
    chars += text.length;
    claimed.push({ envelope, text });
  }
  return claimed;
}

const EVENTS = { "post-tool-use": "PostToolUse", "post-tool-use-failure": "PostToolUseFailure", "user-prompt-submit": "UserPromptSubmit", stop: "Stop", "stop-watch": "Stop" };

export function outputFor(event, text) {
  if (event === "stop") return { decision: "block", reason: text };
  return { hookSpecificOutput: { hookEventName: EVENTS[event], additionalContext: text } };
}

export function drain(event, input, env = process.env, write = (s) => writeSync(1, s)) {
  // Inside a subagent the context would reach that subagent, and the main thread owns the correction.
  // On an interrupted tool Claude Code drops hook messages, so a claim there would be lost.
  if (!EVENTS[event] || !input.session_id || input.agent_id || input.is_interrupt) return false;
  const dir = join(steeringRoot(env), safe(input.session_id));
  if (!statSafe(dir)) return false;
  const now = Date.now();
  const claimed = withLock(dir, now, () => claimPending(dir, input.session_id, now));
  if (!claimed?.length) return false;
  const text = claimed.map((c) => c.text).join("\n\n");
  // The watcher's exit 2 hands its output to the model as written; the others answer in JSON.
  const output = event === "stop-watch" ? text : JSON.stringify(outputFor(event, text));
  try {
    write(output);
  } catch (error) {
    for (const c of claimed) receipt(dir, { steer: c.envelope.steer, state: "emit_failed", reason: error.message });
    return false;
  }
  for (const c of claimed) {
    receipt(dir, { steer: c.envelope.steer, state: "emitted", hook_event: event === "stop-watch" ? "Stop (rewake)" : EVENTS[event], ...(input.tool_use_id ? { tool_use_id: input.tool_use_id } : {}), ...(input.tool_name ? { tool_name: input.tool_name } : {}) });
  }
  return true;
}

/**
 * Who each provider's adapter is, and what it promises. Each line was tested on that provider's real
 * agent before it was written here; jgwill/Miadi packages/connector/STEERING.md holds the evidence.
 * Claude Code's hooks are never assumed of another provider, and each adapter wires its own door.
 */
export const IDENTITIES = {
  claude: {
    provider: "claude",
    adapter: "miadi-session-observability",
    guarantee: {
      level: "same_turn",
      continuation: "PostToolUse and PostToolUseFailure additionalContext, then Stop decision block when no tool follows",
      idle: "the factory runner prompts the seat, and UserPromptSubmit presents it",
    },
  },
  pi: {
    provider: "pi",
    adapter: "@miadi/pi-session-observability",
    guarantee: {
      level: "same_turn",
      continuation: "Pi's steering queue: after the current assistant turn has run its tool calls, before the next model request",
      idle: "the adapter starts a run itself",
    },
  },
  copilot: {
    provider: "copilot",
    adapter: "miadi-steering (Copilot extension)",
    guarantee: {
      level: "same_turn",
      continuation: "session.send immediate, held until the tools in flight have finished",
      idle: "the adapter starts a turn itself",
    },
  },
  codex: {
    provider: "codex",
    adapter: "miadi-steering (Codex hooks)",
    guarantee: {
      level: "same_turn",
      continuation: "PostToolUse additionalContext, then Stop decision block when no tool follows",
      idle: "the factory runner runs codex queue on the thread, and UserPromptSubmit presents it",
    },
  },
};

/** The nearest ancestor whose program is the agent: a hook runs under a shell, and the agent is what must be alive. */
export function ancestorPid(name, start = process.ppid) {
  let pid = start;
  for (let i = 0; i < 12 && pid > 1; i++) {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      // Its program, never a word in its arguments: this hook's own path holds the provider's name.
      const program = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0")[0].split("/").at(-1);
      if (stat.slice(stat.indexOf("(") + 1, stat.lastIndexOf(")")) === name || program === name) return pid;
      pid = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[1]);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Say that this session's adapter is loaded. A session started before its adapter has no file, and
 * the connector answers unsupported. The pid and pane let the connector check a provider that keeps
 * no registry of its own: this exact process, in this exact pane, is the session.
 */
export function announce(input, env = process.env, identity = IDENTITIES.claude) {
  if (!input.session_id) return;
  const root = steeringRoot(env);
  try {
    ownedDir(root);
    const dir = ownedDir(join(root, safe(input.session_id)));
    const { provider, adapter, adapter_version, guarantee, pid } = identity;
    writeFileSync(
      join(dir, "adapter.json"),
      `${JSON.stringify({
        protocol: PROTOCOL,
        contract: CONTRACT,
        provider,
        adapter,
        ...(adapter_version ? { adapter_version } : {}),
        session_id: input.session_id,
        transcript_path: input.transcript_path,
        source: input.source,
        ready_at: new Date().toISOString(),
        ...(pid ? { pid } : {}),
        ...(env.TMUX_PANE ? { pane: env.TMUX_PANE } : {}),
        ...(guarantee ? { guarantee } : {}),
      })}\n`,
      { mode: 0o600 },
    );
  } catch {
    // A host without the factory folder has no inbox. The session must not notice.
  }
}

export function retire(input, env = process.env) {
  if (input.session_id) rmSync(join(steeringRoot(env), safe(input.session_id), "adapter.json"), { force: true });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const event = process.argv[2];
    const provider = process.argv[3] ?? "claude";
    const input = JSON.parse(readFileSync(0, "utf8"));
    if (event === "session-start") announce(input, process.env, provider === "claude" ? IDENTITIES.claude : { ...IDENTITIES[provider], adapter_version: process.argv[4], pid: ancestorPid(provider) });
    else if (event === "session-end") retire(input);
    else if (event === "stop-watch") {
      if (drain(event, input, process.env, (s) => writeSync(2, s))) process.exit(2);
    } else drain(event, input);
  } catch (error) {
    // A broken inbox must not stop the agent's tool call. The envelope stays queued, or its claim reads unknown.
    process.stderr.write(`steering inbox: ${error.message}\n`);
  }
  process.exit(0);
}
