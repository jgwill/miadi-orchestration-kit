import { randomUUID, timingSafeEqual } from "node:crypto";
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
  type AgentStatus,
  type NetworkMessage,
  type SendMessageRequest,
} from "./protocol.ts";

interface StoredAgent extends AgentCard {
  desired_name: string;
}

interface Subscriber {
  controller: ReadableStreamDefaultController<Uint8Array>;
  project: string;
  sessionId: string;
  keepalive: ReturnType<typeof setInterval>;
}

export interface MiadiNetworkHubOptions {
  hostname?: string;
  port?: number;
  token: string;
  messageTtlMs?: number;
  heartbeatMs?: number;
  staleAfterMs?: number;
  sweepIntervalMs?: number;
  quiet?: boolean;
}

export interface MiadiNetworkHub {
  readonly url: string;
  readonly server: ReturnType<typeof Bun.serve>;
  stop(): Promise<void>;
  snapshot(): { agents: AgentCard[]; messages: Array<Omit<NetworkMessage, "prompt">> };
}

class HttpProblem extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const encoder = new TextEncoder();
const PROJECT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const NAME_PATTERN = /^[^\s/][^/]{0,62}[^\s/]$|^[^\s/]$/;

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function bearerMatches(request: Request, token: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7), "utf8");
  const expected = Buffer.from(token, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const advertised = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(advertised) && advertised > MAX_BODY_BYTES) {
    throw new HttpProblem(413, "request body too large");
  }
  const text = await request.text();
  if (byteLength(text) > MAX_BODY_BYTES) throw new HttpProblem(413, "request body too large");
  try {
    const value = JSON.parse(text);
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

export function createMiadiNetworkHub(options: MiadiNetworkHubOptions): MiadiNetworkHub {
  const token = requiredString(options.token, "token", { max: 4096 });
  const hostname = options.hostname ?? "127.0.0.1";
  const port = options.port ?? DEFAULT_PORT;
  const messageTtlMs = options.messageTtlMs ?? DEFAULT_MESSAGE_TTL_MS;
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const staleAfterMs = options.staleAfterMs ?? heartbeatMs * 4;
  const sweepIntervalMs = options.sweepIntervalMs ?? Math.min(heartbeatMs, 5_000);
  const agents = new Map<string, StoredAgent>();
  const messages = new Map<string, NetworkMessage>();
  const subscribers = new Map<string, Set<Subscriber>>();

  function activeAgentCards(project?: string): AgentCard[] {
    const now = Date.now();
    return [...agents.values()]
      .filter((agent) => !project || agent.project === project)
      .map(({ desired_name: _desired, ...agent }) => {
        const status: AgentStatus = now - Date.parse(agent.heartbeat_at) > staleAfterMs ? "stale" : "online";
        return { ...agent, status };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function subscriberCount(sessionId: string): number {
    return subscribers.get(sessionId)?.size ?? 0;
  }

  function emit(sessionId: string, event: string, data: unknown, id?: string): boolean {
    const group = subscribers.get(sessionId);
    if (!group || group.size === 0) return false;
    const payload = encoder.encode(encodeSse(event, data, id));
    let delivered = false;
    for (const subscriber of [...group]) {
      try {
        subscriber.controller.enqueue(payload);
        delivered = true;
      } catch {
        clearInterval(subscriber.keepalive);
        group.delete(subscriber);
      }
    }
    if (group.size === 0) subscribers.delete(sessionId);
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
      sender: senderSummary(message.sender_session),
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

  function removeSubscriber(subscriber: Subscriber): void {
    clearInterval(subscriber.keepalive);
    const group = subscribers.get(subscriber.sessionId);
    group?.delete(subscriber);
    if (group?.size === 0) subscribers.delete(subscriber.sessionId);
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "miadi-pi-network-hub",
        protocol_version: PROTOCOL_VERSION,
        agents: agents.size,
        messages: messages.size,
      });
    }

    if (!url.pathname.startsWith("/v1/")) return json({ error: "not found" }, 404);
    if (!bearerMatches(request, token)) return json({ error: "unauthorized" }, 401);

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
      return json({ ok: true, agent: card, heartbeat_interval_ms: heartbeatMs });
    }

    const heartbeatMatch = url.pathname.match(/^\/v1\/agents\/([^/]+)\/heartbeat$/);
    if (method === "POST" && heartbeatMatch) {
      const sessionId = decodeURIComponent(heartbeatMatch[1]);
      const agent = agents.get(sessionId);
      if (!agent) throw new HttpProblem(404, "agent not found");
      const body = await readJson(request);
      if (body.project !== agent.project) throw new HttpProblem(403, "project mismatch");
      const context = typeof body.context_used_pct === "number"
        ? Math.max(0, Math.min(100, Math.round(body.context_used_pct)))
        : agent.context_used_pct;
      agent.heartbeat_at = new Date().toISOString();
      agent.context_used_pct = context;
      if (typeof body.model === "string" && body.model.trim()) agent.model = body.model.trim().slice(0, 256);
      const { desired_name: _desired, ...card } = agent;
      broadcastProject(agent.project, "agent_updated", { agent: card });
      return json({ ok: true });
    }

    const agentMatch = url.pathname.match(/^\/v1\/agents\/([^/]+)$/);
    if (method === "DELETE" && agentMatch) {
      const sessionId = decodeURIComponent(agentMatch[1]);
      const agent = agents.get(sessionId);
      if (!agent) return json({ ok: true, removed: false });
      agents.delete(sessionId);
      const group = subscribers.get(sessionId);
      for (const subscriber of group ?? []) {
        removeSubscriber(subscriber);
        try { subscriber.controller.close(); } catch { /* already closed */ }
      }
      broadcastProject(agent.project, "agent_left", { session_id: sessionId, name: agent.name });
      return json({ ok: true, removed: true });
    }

    if (method === "GET" && url.pathname === "/v1/agents") {
      const project = validatedString(url.searchParams.get("project"), "project", { max: 64, pattern: PROJECT_PATTERN });
      return json({ agents: activeAgentCards(project) });
    }

    if (method === "GET" && url.pathname === "/v1/events") {
      const project = validatedString(url.searchParams.get("project"), "project", { max: 64, pattern: PROJECT_PATTERN });
      const sessionId = validatedString(url.searchParams.get("session_id"), "session_id", { max: 128 });
      const agent = agents.get(sessionId);
      if (!agent) throw new HttpProblem(404, "agent not found");
      if (agent.project !== project) throw new HttpProblem(403, "project mismatch");

      let subscriber!: Subscriber;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const keepalive = setInterval(() => {
            try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch { removeSubscriber(subscriber); }
          }, Math.max(heartbeatMs, 5_000));
          subscriber = { controller, project, sessionId, keepalive };
          const group = subscribers.get(sessionId) ?? new Set<Subscriber>();
          group.add(subscriber);
          subscribers.set(sessionId, group);
          controller.enqueue(encoder.encode(encodeSse("hello", {
            protocol_version: PROTOCOL_VERSION,
            heartbeat_interval_ms: heartbeatMs,
          })));
          controller.enqueue(encoder.encode(encodeSse("pool_snapshot", {
            agents: activeAgentCards(project),
          })));

          for (const message of messages.values()) {
            if (message.target_session === sessionId && (message.status === "queued" || message.status === "delivered")) {
              controller.enqueue(encoder.encode(encodeSse("prompt", promptEvent(message), message.msg_id)));
              message.status = "delivered";
            }
            if (message.sender_session === sessionId && ["complete", "error", "timeout"].includes(message.status)) {
              controller.enqueue(encoder.encode(encodeSse("response", publicMessage(message), message.msg_id)));
            }
          }
        },
        cancel() {
          if (subscriber) removeSubscriber(subscriber);
        },
      });
      request.signal.addEventListener("abort", () => {
        if (subscriber) removeSubscriber(subscriber);
      }, { once: true });
      return new Response(stream, {
        headers: {
          "cache-control": "no-cache, no-transform",
          "content-type": "text/event-stream; charset=utf-8",
          "x-accel-buffering": "no",
        },
      });
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
      const now = Date.now();
      const message: NetworkMessage = {
        msg_id: randomUUID(),
        project,
        sender_session: senderSession,
        target_session: target.session_id,
        prompt,
        conversation_id: typeof body.conversation_id === "string" ? body.conversation_id.slice(0, 256) : null,
        response_schema: responseSchema,
        hops,
        status: "queued",
        created_at: new Date(now).toISOString(),
        expires_at: new Date(now + messageTtlMs).toISOString(),
      };
      messages.set(message.msg_id, message);
      if (emit(target.session_id, "prompt", promptEvent(message), message.msg_id)) {
        message.status = "delivered";
      }
      return json({
        ok: true,
        msg_id: message.msg_id,
        status: message.status,
        target_session: target.session_id,
        target_name: target.name,
      }, 202);
    }

    const responseMatch = url.pathname.match(/^\/v1\/messages\/([^/]+)\/response$/);
    if (method === "POST" && responseMatch) {
      const msgId = decodeURIComponent(responseMatch[1]);
      const message = messages.get(msgId);
      if (!message) throw new HttpProblem(404, "message not found");
      const body = await readJson(request);
      const responderSession = validatedString(body.responder_session, "responder_session", { max: 128 });
      if (responderSession !== message.target_session) throw new HttpProblem(403, "only the target may respond");
      if (["complete", "error", "timeout"].includes(message.status)) {
        return json({ ok: true, duplicate: true, status: message.status });
      }
      const serializedResponse = JSON.stringify(body.response ?? null);
      if (byteLength(serializedResponse) > MAX_RESPONSE_BYTES) throw new HttpProblem(413, "response too large");
      message.response = body.response ?? null;
      message.error = typeof body.error === "string" ? body.error.slice(0, 1000) : null;
      message.status = message.error ? "error" : "complete";
      message.completed_at = new Date().toISOString();
      emit(message.sender_session, "response", publicMessage(message), message.msg_id);
      return json({ ok: true, status: message.status });
    }

    const messageMatch = url.pathname.match(/^\/v1\/messages\/([^/]+)$/);
    if (method === "GET" && messageMatch) {
      const msgId = decodeURIComponent(messageMatch[1]);
      const caller = validatedString(url.searchParams.get("caller_session"), "caller_session", { max: 128 });
      const message = messages.get(msgId);
      if (!message) throw new HttpProblem(404, "message not found");
      if (caller !== message.sender_session && caller !== message.target_session) {
        throw new HttpProblem(403, "message does not belong to caller");
      }
      return json(publicMessage(message));
    }

    return json({ error: "not found" }, 404);
  }

  const server = Bun.serve({
    hostname,
    port,
    idleTimeout: 255,
    fetch(request) {
      return handle(request).catch((error) => {
        if (error instanceof HttpProblem) return json({ error: error.message }, error.status);
        if (!options.quiet) console.error("miadi-pi-network hub error", error);
        return json({ error: "internal server error" }, 500);
      });
    },
  });

  const sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const message of messages.values()) {
      if ((message.status === "queued" || message.status === "delivered") && Date.parse(message.expires_at) <= now) {
        message.status = "timeout";
        message.error = "message expired before a response arrived";
        message.completed_at = new Date(now).toISOString();
        emit(message.sender_session, "response", publicMessage(message), message.msg_id);
      }
      if (Date.parse(message.expires_at) + messageTtlMs <= now) messages.delete(message.msg_id);
    }
  }, sweepIntervalMs);
  sweepTimer.unref?.();

  const url = `http://${server.hostname}:${server.port}`;
  if (!options.quiet) {
    console.log(`Miadi Pi network hub listening on ${url}`);
    console.log(`Protocol v${PROTOCOL_VERSION}; authentication required for /v1/*`);
  }

  return {
    url,
    server,
    async stop() {
      clearInterval(sweepTimer);
      for (const group of subscribers.values()) {
        for (const subscriber of group) {
          clearInterval(subscriber.keepalive);
          try { subscriber.controller.close(); } catch { /* already closed */ }
        }
      }
      subscribers.clear();
      await server.stop(true);
    },
    snapshot() {
      return {
        agents: activeAgentCards(),
        messages: [...messages.values()].map(publicMessage),
      };
    },
  };
}
