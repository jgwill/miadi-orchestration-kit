import { randomUUID, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { dirname } from "node:path";
import {
  DEFAULT_HEARTBEAT_MS,
  DEFAULT_MESSAGE_TTL_MS,
  DEFAULT_PORT,
  MAX_BODY_BYTES,
  MAX_HOPS,
  MAX_PROMPT_BYTES,
  MAX_RESPONSE_BYTES,
  PROTOCOL_VERSION,
  byteLength,
  encodeSse,
  isRecord,
  publicMessage,
  requiredString,
  type AgentCard,
  type NetworkMessage,
} from "./protocol.ts";

interface StoredAgent extends AgentCard {
  desired_name: string;
}

interface Subscriber {
  response: ServerResponse;
  project: string;
  sessionId: string;
  keepalive: ReturnType<typeof setInterval>;
}

interface StoredState {
  version: 1;
  messages: NetworkMessage[];
}

export interface MiadiNetworkHubOptions {
  hostname?: string;
  port?: number;
  token: string;
  storePath?: string | null;
  messageTtlMs?: number;
  heartbeatMs?: number;
  staleAfterMs?: number;
  sweepIntervalMs?: number;
  quiet?: boolean;
}

export interface MiadiNetworkHub {
  readonly url: string;
  readonly server: Server;
  readonly storePath: string | null;
  stop(): Promise<void>;
  snapshot(): { agents: AgentCard[]; messages: Array<Omit<NetworkMessage, "prompt">> };
}

class HttpProblem extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const PROJECT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const NAME_PATTERN = /^[^\s/][^/]{0,62}[^\s/]$|^[^\s/]$/;

function sendJson(response: ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function bearerMatches(request: IncomingMessage, token: string): boolean {
  const header = request.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7), "utf8");
  const expected = Buffer.from(token, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const advertised = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(advertised) && advertised > MAX_BODY_BYTES) {
    throw new HttpProblem(413, "request body too large");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const raw of request) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    total += chunk.byteLength;
    if (total > MAX_BODY_BYTES) throw new HttpProblem(413, "request body too large");
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!isRecord(value)) throw new Error("not an object");
    return value;
  } catch {
    throw new HttpProblem(400, "request body must be a JSON object");
  }
}

function numberInRange(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new HttpProblem(400, `${field} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    return requiredString(value, field, { max });
  } catch (error) {
    throw new HttpProblem(400, (error as Error).message);
  }
}

function validatedString(
  value: unknown,
  field: string,
  options: { max: number; pattern?: RegExp },
): string {
  try {
    return requiredString(value, field, options);
  } catch (error) {
    throw new HttpProblem(400, (error as Error).message);
  }
}

function decodePathPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpProblem(400, "malformed path encoding");
  }
}

function isStoredMessage(value: unknown): value is NetworkMessage {
  if (!isRecord(value)) return false;
  return [
    "msg_id",
    "project",
    "sender_session",
    "target_session",
    "prompt",
    "status",
    "created_at",
    "expires_at",
  ].every((key) => typeof value[key] === "string") && typeof value.hops === "number";
}

export async function createMiadiNetworkHub(options: MiadiNetworkHubOptions): Promise<MiadiNetworkHub> {
  const token = requiredString(options.token, "token", { max: 4096 });
  const hostname = options.hostname ?? "127.0.0.1";
  const port = options.port ?? DEFAULT_PORT;
  const storePath = options.storePath ?? null;
  const messageTtlMs = options.messageTtlMs ?? DEFAULT_MESSAGE_TTL_MS;
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const staleAfterMs = options.staleAfterMs ?? heartbeatMs * 4;
  const sweepIntervalMs = options.sweepIntervalMs ?? Math.min(heartbeatMs, 5_000);
  const agents = new Map<string, StoredAgent>();
  const messages = new Map<string, NetworkMessage>();
  const subscribers = new Map<string, Set<Subscriber>>();

  function loadState(): void {
    if (!storePath || !existsSync(storePath)) return;
    const parsed = JSON.parse(readFileSync(storePath, "utf8")) as StoredState;
    if (parsed?.version !== 1 || !Array.isArray(parsed.messages)) {
      throw new Error(`unsupported or malformed hub state: ${storePath}`);
    }
    for (const message of parsed.messages) {
      if (isStoredMessage(message)) messages.set(message.msg_id, message);
    }
  }

  function persistState(): void {
    if (!storePath) return;
    mkdirSync(dirname(storePath), { recursive: true, mode: 0o700 });
    const tempPath = `${storePath}.${process.pid}.tmp`;
    const state: StoredState = { version: 1, messages: [...messages.values()] };
    writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    chmodSync(tempPath, 0o600);
    renameSync(tempPath, storePath);
    chmodSync(storePath, 0o600);
  }

  loadState();

  function activeAgentCards(project?: string): AgentCard[] {
    const now = Date.now();
    return [...agents.values()]
      .filter((agent) => !project || agent.project === project)
      .map(({ desired_name: _desired, ...agent }) => ({
        ...agent,
        status: now - Date.parse(agent.heartbeat_at) > staleAfterMs ? ("stale" as const) : ("online" as const),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function removeSubscriber(subscriber: Subscriber): void {
    clearInterval(subscriber.keepalive);
    const group = subscribers.get(subscriber.sessionId);
    group?.delete(subscriber);
    if (group?.size === 0) subscribers.delete(subscriber.sessionId);
  }

  function emit(sessionId: string, event: string, data: unknown, id?: string): boolean {
    const group = subscribers.get(sessionId);
    if (!group || group.size === 0) return false;
    const payload = encodeSse(event, data, id);
    let delivered = false;
    for (const subscriber of [...group]) {
      if (subscriber.response.destroyed || subscriber.response.writableEnded) {
        removeSubscriber(subscriber);
        continue;
      }
      try {
        subscriber.response.write(payload);
        delivered = true;
      } catch {
        removeSubscriber(subscriber);
      }
    }
    return delivered;
  }

  function broadcastProject(project: string, event: string, data: unknown): void {
    for (const agent of agents.values()) {
      if (agent.project === project) emit(agent.session_id, event, data);
    }
  }

  function senderSummary(sessionId: string): Pick<AgentCard, "session_id" | "name" | "purpose" | "model" | "provider" | "cwd"> {
    const sender = agents.get(sessionId);
    if (!sender) throw new HttpProblem(404, "sender is not registered");
    return {
      session_id: sender.session_id,
      name: sender.name,
      purpose: sender.purpose,
      model: sender.model,
      provider: sender.provider,
      cwd: sender.cwd,
    };
  }

  function promptEvent(message: NetworkMessage): Record<string, unknown> {
    return {
      msg_id: message.msg_id,
      project: message.project,
      sender: message.sender ?? (agents.has(message.sender_session)
        ? senderSummary(message.sender_session)
        : {
          session_id: message.sender_session,
          name: "reconnecting-peer",
          purpose: "",
          model: "unknown",
        }),
      prompt: message.prompt,
      conversation_id: message.conversation_id,
      response_schema: message.response_schema,
      hops: message.hops,
      created_at: message.created_at,
      expires_at: message.expires_at,
    };
  }

  function resolveTarget(project: string, target: string): StoredAgent | undefined {
    const direct = agents.get(target);
    if (direct?.project === project) return direct;
    return [...agents.values()].find((agent) => agent.project === project && agent.name === target);
  }

  function assignName(project: string, desired: string, sessionId: string): string {
    const occupied = new Set(
      [...agents.values()]
        .filter((agent) => agent.project === project && agent.session_id !== sessionId)
        .map((agent) => agent.name),
    );
    if (!occupied.has(desired)) return desired;
    let suffix = 2;
    while (occupied.has(`${desired}-${suffix}`)) suffix += 1;
    return `${desired}-${suffix}`;
  }

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const method = (request.method ?? "GET").toUpperCase();

    if (method === "GET" && url.pathname === "/health") {
      sendJson(response, {
        ok: true,
        service: "miadi-pi-network-hub",
        protocol_version: PROTOCOL_VERSION,
        durable_queue: Boolean(storePath),
        agents: agents.size,
        messages: messages.size,
      });
      return;
    }

    if (!url.pathname.startsWith("/v1/")) {
      sendJson(response, { error: "not found" }, 404);
      return;
    }
    if (!bearerMatches(request, token)) {
      sendJson(response, { error: "unauthorized" }, 401);
      return;
    }

    if (method === "POST" && url.pathname === "/v1/agents/register") {
      const body = await readJson(request);
      const project = validatedString(body.project, "project", { max: 64, pattern: PROJECT_PATTERN });
      const sessionId = validatedString(body.session_id, "session_id", { max: 128 });
      const desiredName = validatedString(body.name, "name", { max: 64, pattern: NAME_PATTERN });
      const purpose = typeof body.purpose === "string" ? body.purpose.trim().slice(0, 500) : "";
      const model = validatedString(body.model, "model", { max: 256 });
      const provider = optionalString(body.provider, "provider", 128);
      const cwd = optionalString(body.cwd, "cwd", 2048);
      const capabilities = Array.isArray(body.capabilities)
        ? body.capabilities
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 32)
        : [];
      const now = new Date().toISOString();
      const existing = agents.get(sessionId);
      const name = existing?.project === project
        ? existing.name
        : assignName(project, desiredName, sessionId);
      const agent: StoredAgent = {
        project,
        session_id: sessionId,
        name,
        desired_name: desiredName,
        purpose,
        model,
        provider,
        cwd,
        capabilities,
        status: "online",
        registered_at: existing?.registered_at ?? now,
        heartbeat_at: now,
        context_used_pct: existing?.context_used_pct ?? 0,
      };
      agents.set(sessionId, agent);
      const { desired_name: _desired, ...card } = agent;
      broadcastProject(project, existing ? "agent_updated" : "agent_joined", { agent: card });
      sendJson(response, { ok: true, agent: card, heartbeat_interval_ms: heartbeatMs });
      return;
    }

    const heartbeatMatch = url.pathname.match(/^\/v1\/agents\/([^/]+)\/heartbeat$/);
    if (method === "POST" && heartbeatMatch) {
      const sessionId = decodePathPart(heartbeatMatch[1]);
      const agent = agents.get(sessionId);
      if (!agent) throw new HttpProblem(404, "agent not found");
      const body = await readJson(request);
      if (body.project !== agent.project) throw new HttpProblem(403, "project mismatch");
      agent.heartbeat_at = new Date().toISOString();
      if (typeof body.context_used_pct === "number") {
        agent.context_used_pct = Math.max(0, Math.min(100, Math.round(body.context_used_pct)));
      }
      if (typeof body.model === "string" && body.model.trim()) agent.model = body.model.trim().slice(0, 256);
      const { desired_name: _desired, ...card } = agent;
      broadcastProject(agent.project, "agent_updated", { agent: card });
      sendJson(response, { ok: true });
      return;
    }

    const agentMatch = url.pathname.match(/^\/v1\/agents\/([^/]+)$/);
    if (method === "DELETE" && agentMatch) {
      const sessionId = decodePathPart(agentMatch[1]);
      const agent = agents.get(sessionId);
      if (!agent) {
        sendJson(response, { ok: true, removed: false });
        return;
      }
      agents.delete(sessionId);
      const group = subscribers.get(sessionId);
      for (const subscriber of [...(group ?? [])]) {
        removeSubscriber(subscriber);
        subscriber.response.end();
      }
      broadcastProject(agent.project, "agent_left", { session_id: sessionId, name: agent.name });
      sendJson(response, { ok: true, removed: true });
      return;
    }

    if (method === "GET" && url.pathname === "/v1/agents") {
      const project = validatedString(url.searchParams.get("project"), "project", { max: 64, pattern: PROJECT_PATTERN });
      sendJson(response, { agents: activeAgentCards(project) });
      return;
    }

    if (method === "GET" && url.pathname === "/v1/events") {
      const project = validatedString(url.searchParams.get("project"), "project", { max: 64, pattern: PROJECT_PATTERN });
      const sessionId = validatedString(url.searchParams.get("session_id"), "session_id", { max: 128 });
      const agent = agents.get(sessionId);
      if (!agent) throw new HttpProblem(404, "agent not found");
      if (agent.project !== project) throw new HttpProblem(403, "project mismatch");

      response.writeHead(200, {
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-accel-buffering": "no",
      });
      response.flushHeaders();
      let subscriber!: Subscriber;
      const keepalive = setInterval(() => {
        if (response.destroyed || response.writableEnded) removeSubscriber(subscriber);
        else response.write(": keepalive\n\n");
      }, Math.max(heartbeatMs, 5_000));
      keepalive.unref?.();
      subscriber = { response, project, sessionId, keepalive };
      const group = subscribers.get(sessionId) ?? new Set<Subscriber>();
      group.add(subscriber);
      subscribers.set(sessionId, group);
      request.once("close", () => removeSubscriber(subscriber));

      response.write(encodeSse("hello", {
        protocol_version: PROTOCOL_VERSION,
        heartbeat_interval_ms: heartbeatMs,
      }));
      response.write(encodeSse("pool_snapshot", { agents: activeAgentCards(project) }));
      let changed = false;
      for (const message of messages.values()) {
        if (message.target_session === sessionId && (message.status === "queued" || message.status === "delivered")) {
          response.write(encodeSse("prompt", promptEvent(message), message.msg_id));
          if (message.status !== "delivered") {
            message.status = "delivered";
            changed = true;
          }
        }
        if (message.sender_session === sessionId && ["complete", "error", "timeout"].includes(message.status)) {
          response.write(encodeSse("response", publicMessage(message), message.msg_id));
        }
      }
      if (changed) persistState();
      return;
    }

    if (method === "POST" && url.pathname === "/v1/messages") {
      const body = await readJson(request);
      const project = validatedString(body.project, "project", { max: 64, pattern: PROJECT_PATTERN });
      const senderSession = validatedString(body.sender_session, "sender_session", { max: 128 });
      const targetValue = validatedString(body.target, "target", { max: 128 });
      const prompt = validatedString(body.prompt, "prompt", { max: MAX_PROMPT_BYTES });
      if (byteLength(prompt) > MAX_PROMPT_BYTES) throw new HttpProblem(413, "prompt too large");
      const hops = numberInRange(body.hops, "hops", 0, MAX_HOPS - 1);
      const sender = agents.get(senderSession);
      if (!sender) throw new HttpProblem(404, "sender is not registered");
      if (sender.project !== project) throw new HttpProblem(403, "project mismatch");
      const target = resolveTarget(project, targetValue);
      if (!target) throw new HttpProblem(404, "target agent not found");
      if (target.session_id === senderSession) throw new HttpProblem(400, "cannot send to self");
      const responseSchema = body.response_schema === null || body.response_schema === undefined
        ? null
        : isRecord(body.response_schema)
          ? body.response_schema
          : (() => { throw new HttpProblem(400, "response_schema must be an object or null"); })();
      const idempotencyKey = optionalString(body.idempotency_key, "idempotency_key", 256);
      if (idempotencyKey) {
        const prior = [...messages.values()].find((message) =>
          message.project === project &&
          message.sender_session === senderSession &&
          message.idempotency_key === idempotencyKey
        );
        if (prior) {
          sendJson(response, {
            ok: true,
            duplicate: true,
            msg_id: prior.msg_id,
            status: prior.status,
            target_session: prior.target_session,
            target_name: agents.get(prior.target_session)?.name ?? target.name,
          }, 200);
          return;
        }
      }
      const now = Date.now();
      const message: NetworkMessage = {
        msg_id: randomUUID(),
        idempotency_key: idempotencyKey,
        project,
        sender_session: senderSession,
        sender: senderSummary(senderSession),
        target_session: target.session_id,
        target_name: target.name,
        prompt,
        conversation_id: typeof body.conversation_id === "string" ? body.conversation_id.slice(0, 256) : null,
        response_schema: responseSchema,
        hops,
        status: "queued",
        created_at: new Date(now).toISOString(),
        expires_at: new Date(now + messageTtlMs).toISOString(),
      };
      messages.set(message.msg_id, message);
      if (emit(target.session_id, "prompt", promptEvent(message), message.msg_id)) message.status = "delivered";
      persistState();
      sendJson(response, {
        ok: true,
        msg_id: message.msg_id,
        status: message.status,
        target_session: target.session_id,
        target_name: target.name,
      }, 202);
      return;
    }

    const responseMatch = url.pathname.match(/^\/v1\/messages\/([^/]+)\/response$/);
    if (method === "POST" && responseMatch) {
      const msgId = decodePathPart(responseMatch[1]);
      const message = messages.get(msgId);
      if (!message) throw new HttpProblem(404, "message not found");
      const body = await readJson(request);
      const responderSession = validatedString(body.responder_session, "responder_session", { max: 128 });
      if (responderSession !== message.target_session) throw new HttpProblem(403, "only the target may respond");
      if (["complete", "error", "timeout"].includes(message.status)) {
        sendJson(response, { ok: true, duplicate: true, status: message.status });
        return;
      }
      const serializedResponse = JSON.stringify(body.response ?? null);
      if (byteLength(serializedResponse) > MAX_RESPONSE_BYTES) throw new HttpProblem(413, "response too large");
      message.response = body.response ?? null;
      message.error = typeof body.error === "string" ? body.error.slice(0, 1000) : null;
      message.status = message.error ? "error" : "complete";
      message.completed_at = new Date().toISOString();
      persistState();
      emit(message.sender_session, "response", publicMessage(message), message.msg_id);
      sendJson(response, { ok: true, status: message.status });
      return;
    }

    const messageMatch = url.pathname.match(/^\/v1\/messages\/([^/]+)$/);
    if (method === "GET" && messageMatch) {
      const msgId = decodePathPart(messageMatch[1]);
      const caller = validatedString(url.searchParams.get("caller_session"), "caller_session", { max: 128 });
      const message = messages.get(msgId);
      if (!message) throw new HttpProblem(404, "message not found");
      if (caller !== message.sender_session && caller !== message.target_session) {
        throw new HttpProblem(403, "message does not belong to caller");
      }
      sendJson(response, publicMessage(message));
      return;
    }

    sendJson(response, { error: "not found" }, 404);
  }

  const server = createServer((request, response) => {
    void handle(request, response).catch((error) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      if (error instanceof HttpProblem) {
        sendJson(response, { error: error.message }, error.status);
        return;
      }
      if (!options.quiet) console.error("miadi-pi-network hub error", error);
      sendJson(response, { error: "internal server error" }, 500);
    });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, hostname, () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("hub did not bind a TCP address");
  const url = `http://${hostname}:${address.port}`;

  const sweepTimer = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const message of [...messages.values()]) {
      if ((message.status === "queued" || message.status === "delivered") && Date.parse(message.expires_at) <= now) {
        message.status = "timeout";
        message.error = "message expired before a response arrived";
        message.completed_at = new Date(now).toISOString();
        emit(message.sender_session, "response", publicMessage(message), message.msg_id);
        changed = true;
      }
      if (Date.parse(message.expires_at) + messageTtlMs <= now) {
        messages.delete(message.msg_id);
        changed = true;
      }
    }
    for (const agent of [...agents.values()]) {
      if (now - Date.parse(agent.heartbeat_at) > staleAfterMs * 6 && !subscribers.has(agent.session_id)) {
        agents.delete(agent.session_id);
        broadcastProject(agent.project, "agent_left", { session_id: agent.session_id, name: agent.name });
      }
    }
    if (changed) persistState();
  }, sweepIntervalMs);
  sweepTimer.unref?.();

  if (!options.quiet) {
    console.log(`Miadi Pi network hub listening on ${url}`);
    console.log(`Protocol v${PROTOCOL_VERSION}; authenticated durable queue: ${storePath ?? "disabled"}`);
  }

  return {
    url,
    server,
    storePath,
    async stop() {
      clearInterval(sweepTimer);
      persistState();
      for (const group of subscribers.values()) {
        for (const subscriber of group) {
          clearInterval(subscriber.keepalive);
          subscriber.response.end();
        }
      }
      subscribers.clear();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      });
    },
    snapshot() {
      return {
        agents: activeAgentCards(),
        messages: [...messages.values()].map(publicMessage),
      };
    },
  };
}
