#!/usr/bin/env node
// mpn — Miadi Pi Network client for Claude Code sessions.
//
// Speaks the same hub protocol as pi/miadi-pi-network/extensions/miadi-pi-network.ts
// over plain HTTP + SSE, so a Claude session is an ordinary peer on the network.
// No dependencies: Node 20+ built-ins only.

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_URL = "http://127.0.0.1:8787";
const DEFAULT_PROJECT = "miadi";
const DEFAULT_HEARTBEAT_MS = 10_000;
const MAX_PROMPT_BYTES = 64 * 1024;
const MAX_HOPS = 5;
const SETTLE_MS = 900;

const TOKEN = process.env.MIADI_PI_NETWORK_TOKEN ?? "";
const BASE_URL = normalizeBaseUrl(process.env.MIADI_PI_NETWORK_URL ?? DEFAULT_URL);
const PROJECT = process.env.MIADI_PI_NETWORK_PROJECT || DEFAULT_PROJECT;
const STATE_DIR = process.env.MIADI_PI_NETWORK_STATE_DIR
  || join(homedir(), ".miadi", "pi-network", "claude");

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    fail("hub URL must use http or https");
  }
  return url.toString().replace(/\/$/, "");
}

function redact(text) {
  const message = text instanceof Error ? text.message : String(text);
  return TOKEN ? message.split(TOKEN).join("<redacted>") : message;
}

function fail(message, code = 1) {
  process.stderr.write(`mpn: ${redact(message)}\n`);
  process.exit(code);
}

function out(line = "") {
  process.stdout.write(`${line}\n`);
}

// ---------------------------------------------------------------- identity

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "claude";
}

function statePath(name) {
  return join(STATE_DIR, `${slug(name)}.json`);
}

function readState(name) {
  try {
    return JSON.parse(readFileSync(statePath(name), "utf8"));
  } catch {
    return null;
  }
}

function writeState(state) {
  const file = statePath(state.name);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
    // best effort on filesystems without POSIX modes
  }
  return file;
}

function defaultName() {
  return process.env.MIADI_PI_NETWORK_NAME || "claude";
}

// Resolve the peer identity this invocation acts as. `join` creates it; every
// other verb requires it to already exist so the hub keeps one stable session.
function identity(options = {}, { required = true } = {}) {
  const name = options.name || defaultName();
  const stored = readState(name);
  if (!stored && required) {
    fail(`peer "${name}" has not joined. Run: mpn join --name ${name} --purpose '...'`, 4);
  }
  return stored;
}

// -------------------------------------------------------------------- http

async function api(method, route, body, { timeoutMs = 15_000 } = {}) {
  if (!TOKEN) fail("MIADI_PI_NETWORK_TOKEN is not set", 2);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("request timed out")), timeoutMs);
  try {
    const response = await fetch(`${BASE_URL}${route}`, {
      method,
      headers: {
        authorization: `Bearer ${TOKEN}`,
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }
    if (!response.ok) {
      const detail = payload && typeof payload === "object" && payload.error
        ? String(payload.error)
        : `HTTP ${response.status}`;
      const error = new Error(detail);
      error.status = response.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function parseSseFrames(buffer) {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const frames = normalized.split("\n\n");
  const remainder = frames.pop() ?? "";
  const events = [];
  for (const frame of frames) {
    let event = "message";
    const data = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (data.length === 0) continue;
    const raw = data.join("\n");
    try {
      events.push({ event, data: JSON.parse(raw) });
    } catch {
      events.push({ event, data: raw });
    }
  }
  return { events, remainder };
}

// Hold the hub event stream and hand every frame to `onEvent`. Resolves when the
// stream ends or the signal aborts.
async function consumeEvents(state, onEvent, signal) {
  const route = `/v1/events?project=${encodeURIComponent(state.project)}`
    + `&session_id=${encodeURIComponent(state.session_id)}`;
  const response = await fetch(`${BASE_URL}${route}`, {
    headers: { authorization: `Bearer ${TOKEN}`, accept: "text/event-stream" },
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`event stream failed with HTTP ${response.status}`);
  }
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return;
      buffer += decoder.decode(chunk.value, { stream: true });
      const parsed = parseSseFrames(buffer);
      buffer = parsed.remainder;
      for (const item of parsed.events) onEvent(item.event, item.data);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // stream already released
    }
  }
}

// ------------------------------------------------------------------ verbs

async function cmdStatus() {
  let health = null;
  try {
    const response = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(6000) });
    health = await response.json();
  } catch (error) {
    out(`hub       ${BASE_URL} UNREACHABLE (${redact(error)})`);
    out("token     " + (TOKEN ? "set" : "MISSING"));
    process.exit(3);
  }
  out(`hub       ${BASE_URL} ok (protocol v${health.protocol_version}, `
    + `${health.agents} agents, ${health.messages} messages)`);
  out(`token     ${TOKEN ? "set" : "MISSING — export MIADI_PI_NETWORK_TOKEN"}`);
  const state = identity({}, { required: false });
  if (!state) {
    out(`peer      not joined (name would be "${defaultName()}", project "${PROJECT}")`);
    return;
  }
  out(`peer      ${state.name} @ ${state.project} (session ${state.session_id})`);
  if (!TOKEN) return;
  try {
    const { agents } = await api("GET", `/v1/agents?project=${encodeURIComponent(state.project)}`);
    const self = agents.find((agent) => agent.session_id === state.session_id);
    out(`presence  ${self ? self.status : "not registered — run: mpn join"}`);
    const others = agents.filter((agent) => agent.session_id !== state.session_id);
    out(`peers     ${others.length}${others.length ? `: ${others.map((a) => a.name).join(", ")}` : ""}`);
  } catch (error) {
    out(`presence  unknown (${redact(error)})`);
  }
}

async function cmdJoin(options) {
  const name = options.name || defaultName();
  const existing = readState(name);
  const sessionId = process.env.MIADI_PI_NETWORK_SESSION
    || existing?.session_id
    || `claude-${slug(name)}-${randomUUID().slice(0, 8)}`;
  const purpose = options.purpose
    || process.env.MIADI_PI_NETWORK_PURPOSE
    || "Claude Code session";
  const shareCwd = process.env.MIADI_PI_NETWORK_SHARE_CWD === "true";
  const result = await api("POST", "/v1/agents/register", {
    project: PROJECT,
    session_id: sessionId,
    name,
    purpose,
    model: options.model || process.env.MIADI_PI_NETWORK_MODEL || "claude-code",
    provider: "anthropic",
    cwd: shareCwd ? process.cwd() : undefined,
    capabilities: ["mpn_send", "mpn_await", "mpn_inbox", "mpn_respond", "mpn_serve"],
  });
  const state = {
    url: BASE_URL,
    project: PROJECT,
    session_id: sessionId,
    name: result.agent.name,
    purpose,
    heartbeat_interval_ms: result.heartbeat_interval_ms ?? DEFAULT_HEARTBEAT_MS,
    joined_at: new Date().toISOString(),
  };
  const file = writeState(state);
  out(`joined as ${state.name} @ ${state.project} (session ${state.session_id})`);
  out(`state     ${file}`);
  if (result.agent.name !== name) {
    out(`note      hub renamed "${name}" to "${result.agent.name}" — that name was taken`);
  }
}

async function cmdLeave(options) {
  const state = identity(options);
  await api("DELETE", `/v1/agents/${encodeURIComponent(state.session_id)}`);
  out(`left the network (${state.name})`);
}

async function heartbeat(state) {
  try {
    await api("POST", `/v1/agents/${encodeURIComponent(state.session_id)}/heartbeat`, {
      project: state.project,
    });
    return true;
  } catch (error) {
    if (error.status === 404) return false;
    throw error;
  }
}

async function cmdPeers(options) {
  const state = identity(options, { required: false });
  if (state) await heartbeat(state).catch(() => false);
  const { agents } = await api("GET", `/v1/agents?project=${encodeURIComponent(PROJECT)}`);
  const others = agents.filter((agent) => agent.session_id !== state?.session_id);
  if (others.length === 0) {
    out(`no peers online in project "${PROJECT}"`);
    return;
  }
  for (const agent of others) {
    out(`${agent.name}  [${agent.status}]  ${agent.model}`);
    if (agent.purpose) out(`    ${agent.purpose}`);
  }
}

async function cmdSend(options, positional) {
  const state = identity(options);
  const target = positional[0];
  if (!target) fail("usage: mpn send <peer-name> <prompt>");
  const prompt = options.stdin
    ? await readStdin()
    : positional.slice(1).join(" ");
  if (!prompt.trim()) fail("prompt is empty");
  if (Buffer.byteLength(prompt) > MAX_PROMPT_BYTES) fail("prompt exceeds the 64 KiB hub limit");
  await heartbeat(state).catch(() => false);
  const result = await api("POST", "/v1/messages", {
    project: state.project,
    sender_session: state.session_id,
    target,
    prompt,
    hops: Math.min(Number(options.hops ?? 0), MAX_HOPS - 1),
    conversation_id: options.conversation ?? null,
    idempotency_key: options.key ?? undefined,
  });
  out(`sent ${result.msg_id} -> ${result.target_name} [${result.status}]`);
  if (options.await !== undefined) {
    await waitForResponse(state, result.msg_id, Number(options.await) || 180);
  }
}

async function waitForResponse(state, msgId, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const message = await api(
      "GET",
      `/v1/messages/${encodeURIComponent(msgId)}?caller_session=${encodeURIComponent(state.session_id)}`,
    );
    if (["complete", "error", "timeout"].includes(message.status)) {
      out(`--- ${message.status} from ${message.target_name ?? "peer"} ---`);
      if (message.error) out(`error: ${message.error}`);
      if (message.response !== undefined && message.response !== null) {
        out(typeof message.response === "string" ? message.response : JSON.stringify(message.response, null, 2));
      }
      process.exit(message.status === "complete" ? 0 : 5);
    }
    await sleep(2000);
  }
  out(`still ${"pending"} after ${timeoutSeconds}s — poll again with: mpn await ${msgId}`);
  process.exit(3);
}

async function cmdAwait(options, positional) {
  const state = identity(options);
  const msgId = positional[0];
  if (!msgId) fail("usage: mpn await <msg_id> [--timeout 180]");
  await waitForResponse(state, msgId, Number(options.timeout) || 180);
}

// Drain inbound prompts. The hub replays queued and delivered prompts when a
// stream opens, so a short connection is enough to see the backlog. With
// --wait N the process keeps listening and exits as soon as a prompt arrives,
// which is the wake path for a backgrounded shell.
async function cmdInbox(options) {
  const state = identity(options);
  const waitSeconds = Number(options.wait ?? 0);
  const controller = new AbortController();
  const prompts = [];
  let settle = null;

  const finish = () => controller.abort(new Error("done"));
  const stream = consumeEvents(state, (event, data) => {
    if (event !== "prompt") return;
    prompts.push(data);
    if (settle) clearTimeout(settle);
    settle = setTimeout(finish, 250);
  }, controller.signal).catch((error) => {
    if (!controller.signal.aborted) throw error;
  });

  const idle = setTimeout(() => {
    if (prompts.length === 0 && waitSeconds > 0) return;
    finish();
  }, SETTLE_MS);
  const hardStop = waitSeconds > 0 ? setTimeout(finish, waitSeconds * 1000) : null;

  await stream;
  clearTimeout(idle);
  if (hardStop) clearTimeout(hardStop);
  if (settle) clearTimeout(settle);

  if (prompts.length === 0) {
    out("no pending prompts");
    process.exit(waitSeconds > 0 ? 3 : 0);
  }
  for (const prompt of prompts) {
    out(`--- ${prompt.msg_id} from ${prompt.sender?.name ?? "unknown"} (hops ${prompt.hops ?? 0}) ---`);
    out(prompt.prompt);
    out(`--- reply with: mpn respond ${prompt.msg_id} --stdin ---`);
    out();
  }
}

async function cmdRespond(options, positional) {
  const state = identity(options);
  const msgId = positional[0];
  if (!msgId) fail("usage: mpn respond <msg_id> <text>   (or --stdin)");
  const text = options.stdin ? await readStdin() : positional.slice(1).join(" ");
  if (!text.trim() && !options.error) fail("response is empty");
  const result = await api("POST", `/v1/messages/${encodeURIComponent(msgId)}/response`, {
    responder_session: state.session_id,
    response: text,
    error: options.error ?? null,
  });
  out(`responded to ${msgId} [${result.status}]${result.duplicate ? " (already answered)" : ""}`);
}

// Unattended peer: hold the stream and answer every inbound prompt with the
// responder command (default `claude -p`, prompt on stdin, answer on stdout).
async function cmdServe(options) {
  const state = identity(options);
  const responder = options.responder || process.env.MIADI_PI_NETWORK_RESPONDER || "claude -p";
  const timeoutMs = (Number(options.responderTimeout) || 300) * 1000;
  let stopping = false;
  const inFlight = new Set();

  const beat = setInterval(() => {
    heartbeat(state).catch((error) => process.stderr.write(`mpn: heartbeat failed: ${redact(error)}\n`));
  }, state.heartbeat_interval_ms ?? DEFAULT_HEARTBEAT_MS);

  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    clearInterval(beat);
    process.stderr.write(`mpn: stopping serve (${signal})\n`);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  async function answer(prompt) {
    if (inFlight.has(prompt.msg_id)) return;
    inFlight.add(prompt.msg_id);
    const sender = prompt.sender?.name ?? "unknown";
    process.stderr.write(`mpn: answering ${prompt.msg_id} from ${sender}\n`);
    try {
      const reply = await runResponder(responder, prompt.prompt, timeoutMs);
      await api("POST", `/v1/messages/${encodeURIComponent(prompt.msg_id)}/response`, {
        responder_session: state.session_id,
        response: reply.trim(),
        error: null,
      });
      process.stderr.write(`mpn: answered ${prompt.msg_id}\n`);
    } catch (error) {
      await api("POST", `/v1/messages/${encodeURIComponent(prompt.msg_id)}/response`, {
        responder_session: state.session_id,
        response: null,
        error: redact(error).slice(0, 500),
      }).catch(() => {});
      process.stderr.write(`mpn: responder failed for ${prompt.msg_id}: ${redact(error)}\n`);
    } finally {
      inFlight.delete(prompt.msg_id);
    }
  }

  process.stderr.write(`mpn: serving as ${state.name}@${state.project} via "${responder}"\n`);
  let backoff = 1000;
  while (!stopping) {
    try {
      await heartbeat(state).then(async (alive) => {
        if (!alive) await cmdJoinSilently(state);
      });
      await consumeEvents(state, (event, data) => {
        if (event === "prompt") void answer(data);
      });
      backoff = 1000;
    } catch (error) {
      if (stopping) return;
      process.stderr.write(`mpn: stream lost (${redact(error)}), retrying in ${backoff}ms\n`);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 10_000);
    }
  }
}

// Re-register an existing identity after the hub forgot it (restart, sweep).
async function cmdJoinSilently(state) {
  await api("POST", "/v1/agents/register", {
    project: state.project,
    session_id: state.session_id,
    name: state.name,
    purpose: state.purpose ?? "Claude Code session",
    model: process.env.MIADI_PI_NETWORK_MODEL || "claude-code",
    provider: "anthropic",
  });
  process.stderr.write(`mpn: re-registered ${state.name}\n`);
}

function runResponder(command, prompt, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`responder timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`responder exited ${code}: ${stderr.trim().slice(0, 300)}`));
    });
    child.stdin.end(prompt);
  });
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ------------------------------------------------------------------- main

function parseArgs(argv) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return { options, positional };
}

const USAGE = `mpn — Miadi Pi Network client for Claude Code

  mpn status                             hub reachability, this peer, peer count
  mpn join --name NAME --purpose TEXT    register this session as a peer
  mpn peers                              list other peers and their purposes
  mpn send PEER "prompt" [--await 180]   send a prompt; optionally block for the reply
  mpn await MSG_ID [--timeout 180]       poll a sent message until it resolves
  mpn inbox [--wait 300]                 show inbound prompts; --wait blocks until one lands
  mpn respond MSG_ID "text" | --stdin    answer an inbound prompt
  mpn serve [--responder "claude -p"]    unattended peer: answer every inbound prompt
  mpn leave                              unregister this peer

Environment: MIADI_PI_NETWORK_URL, MIADI_PI_NETWORK_TOKEN (required),
MIADI_PI_NETWORK_NAME, MIADI_PI_NETWORK_PURPOSE, MIADI_PI_NETWORK_PROJECT.
The token is read from the environment only and never printed.`;

const [verb, ...rest] = process.argv.slice(2);
const { options, positional } = parseArgs(rest);

const verbs = {
  status: () => cmdStatus(),
  join: () => cmdJoin(options),
  leave: () => cmdLeave(options),
  peers: () => cmdPeers(options),
  send: () => cmdSend(options, positional),
  await: () => cmdAwait(options, positional),
  inbox: () => cmdInbox(options),
  respond: () => cmdRespond(options, positional),
  serve: () => cmdServe(options),
};

if (!verb || verb === "help" || verb === "--help") {
  out(USAGE);
  process.exit(0);
}
if (!verbs[verb]) fail(`unknown command "${verb}"\n\n${USAGE}`);

try {
  await verbs[verb]();
} catch (error) {
  fail(error, error?.status === 401 ? 2 : 1);
}
