import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_HEARTBEAT_MS,
  DEFAULT_PROJECT,
  MAX_HOPS,
  normalizeBaseUrl,
  parseSseFrames,
  type AgentCard,
  type NetworkMessage,
} from "../src/protocol.ts";

interface Identity {
  sessionId: string;
  name: string;
  purpose: string;
  project: string;
  model: string;
  provider?: string;
}

interface InboundPrompt {
  msgId: string;
  senderName: string;
  senderSession: string;
  prompt: string;
  hops: number;
  responseSchema: Record<string, unknown> | null;
  fulfilled: boolean;
}

interface HttpFailure extends Error {
  status?: number;
}

const INBOUND_MARKER = "MIADI_PI_NETWORK_INBOUND";
const STATE_ENTRY_TYPE = "miadi-pi-network-state-v1";
const DEFAULT_URL = "http://127.0.0.1:8787";
const MAX_RECONNECT_MS = 10_000;

export default function miadiPiNetwork(pi: ExtensionAPI): void {
  pi.registerFlag("miadi-network-url", {
    description: "Miadi Pi network hub URL",
    type: "string",
    default: undefined,
  });
  pi.registerFlag("miadi-network-name", {
    description: "Peer name advertised to the Miadi Pi network",
    type: "string",
    default: undefined,
  });
  pi.registerFlag("miadi-network-purpose", {
    description: "Short purpose advertised to peer agents",
    type: "string",
    default: undefined,
  });
  pi.registerFlag("miadi-network-project", {
    description: "Network project namespace",
    type: "string",
    default: undefined,
  });

  let baseUrl = DEFAULT_URL;
  let token = "";
  let identity: Identity | null = null;
  let currentCtx: ExtensionContext | null = null;
  let heartbeatMs = DEFAULT_HEARTBEAT_MS;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let sseAbort: AbortController | null = null;
  let shuttingDown = false;
  let connected = false;
  const peers = new Map<string, AgentCard>();
  const inbound = new Map<string, InboundPrompt>();
  const inboundOrder: string[] = [];
  const inboundStates = new Map<string, "queued" | "active" | "replied">();
  const responses = new Map<string, Omit<NetworkMessage, "prompt">>();
  let laneMsgId: string | null = null;
  let activeInbound: InboundPrompt | null = null;

  function safeError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return token ? message.split(token).join("<redacted>") : message;
  }

  function audit(event: string, data: Record<string, unknown> = {}): void {
    try {
      pi.appendEntry("miadi-pi-network-audit", {
        event,
        at: new Date().toISOString(),
        ...data,
      });
    } catch {
      // Audit persistence is best-effort and never carries prompt bodies.
    }
  }

  function restoreState(ctx: ExtensionContext): void {
    inboundStates.clear();
    const entries = ctx.sessionManager.getBranch();
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index] as any;
      if (entry.type !== "custom" || entry.customType !== STATE_ENTRY_TYPE) continue;
      const stored = entry.data?.inbound;
      if (stored && typeof stored === "object") {
        for (const [msgId, state] of Object.entries(stored)) {
          if (state === "replied") inboundStates.set(msgId, "replied");
          else if (state === "queued" || state === "active") inboundStates.set(msgId, "queued");
        }
      }
      break;
    }
  }

  function persistState(): void {
    try {
      pi.appendEntry(STATE_ENTRY_TYPE, {
        version: 1,
        inbound: Object.fromEntries(inboundStates),
        at: new Date().toISOString(),
      });
    } catch (error) {
      audit("state_persist_failed", { reason: safeError(error) });
    }
  }

  function pumpInboundLane(): void {
    if (laneMsgId || shuttingDown) return;
    while (inboundOrder.length > 0) {
      const msgId = inboundOrder.shift()!;
      const item = inbound.get(msgId);
      if (!item || inboundStates.get(msgId) === "replied") continue;
      laneMsgId = msgId;
      inboundStates.set(msgId, "active");
      persistState();
      pi.sendMessage({
        customType: "miadi-pi-network-inbound",
        content:
          `[${INBOUND_MARKER}:${item.msgId}]\n` +
          `Peer ${item.senderName} asks:\n\n${item.prompt}\n\n` +
          "Reply with your normal assistant response. The network extension returns that response automatically. " +
          "Do not call miadi_network_send back to the same peer merely to answer this message.",
        display: true,
        details: { msg_id: item.msgId, sender: item.senderName, hops: item.hops },
      }, { deliverAs: "followUp", triggerTurn: true });
      return;
    }
  }

  function assertReady(): Identity {
    if (!identity || !connected) {
      throw new Error("Miadi Pi network is not connected. Set MIADI_PI_NETWORK_TOKEN and verify the hub URL.");
    }
    return identity;
  }

  async function api<T>(
    method: string,
    route: string,
    body?: unknown,
    signal?: AbortSignal,
    timeoutMs = 10_000,
  ): Promise<T> {
    if (!token) throw new Error("MIADI_PI_NETWORK_TOKEN is not configured");
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("request timed out")), timeoutMs);
    timer.unref?.();
    try {
      const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      let payload: unknown = null;
      try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
      if (!response.ok) {
        const detail = payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error: unknown }).error)
          : `HTTP ${response.status}`;
        const error = new Error(detail) as HttpFailure;
        error.status = response.status;
        throw error;
      }
      return payload as T;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async function registerAgent(): Promise<void> {
    if (!identity) throw new Error("identity is not initialized");
    const shareCwd = process.env.MIADI_PI_NETWORK_SHARE_CWD === "true";
    const result = await api<{ agent: AgentCard; heartbeat_interval_ms?: number }>(
      "POST",
      "/v1/agents/register",
      {
        project: identity.project,
        session_id: identity.sessionId,
        name: identity.name,
        purpose: identity.purpose,
        model: currentCtx?.model?.id ?? identity.model,
        provider: currentCtx?.model?.provider ?? identity.provider,
        cwd: shareCwd ? currentCtx?.cwd : undefined,
        capabilities: [
          "miadi_network_peers",
          "miadi_network_send",
          "miadi_network_get",
          "miadi_network_await",
        ],
      },
    );
    identity.name = result.agent.name;
    heartbeatMs = result.heartbeat_interval_ms ?? DEFAULT_HEARTBEAT_MS;
    connected = true;
    currentCtx?.ui.setStatus("miadi-pi-network", `◎ ${identity.name}@${identity.project}`);
    audit("registered", { session_id: identity.sessionId, name: identity.name, project: identity.project });
  }

  function updatePeers(cards: AgentCard[]): void {
    peers.clear();
    for (const card of cards) {
      if (card.session_id !== identity?.sessionId) peers.set(card.session_id, card);
    }
  }

  function handleResponse(data: unknown): void {
    if (!data || typeof data !== "object") return;
    const message = data as Omit<NetworkMessage, "prompt">;
    if (typeof message.msg_id !== "string") return;
    responses.set(message.msg_id, message);
    audit("response_received", { msg_id: message.msg_id, status: message.status });
  }

  function handlePrompt(data: unknown): void {
    if (!data || typeof data !== "object" || !identity) return;
    const event = data as {
      msg_id?: unknown;
      sender?: { session_id?: unknown; name?: unknown };
      prompt?: unknown;
      hops?: unknown;
      response_schema?: unknown;
    };
    if (typeof event.msg_id !== "string" || typeof event.prompt !== "string") return;
    if (inboundStates.get(event.msg_id) === "replied" || inbound.has(event.msg_id)) return;
    const senderName = typeof event.sender?.name === "string" ? event.sender.name : "unknown-peer";
    const senderSession = typeof event.sender?.session_id === "string" ? event.sender.session_id : "unknown";
    const item: InboundPrompt = {
      msgId: event.msg_id,
      senderName,
      senderSession,
      prompt: event.prompt,
      hops: typeof event.hops === "number" ? event.hops : 0,
      responseSchema: event.response_schema && typeof event.response_schema === "object" && !Array.isArray(event.response_schema)
        ? event.response_schema as Record<string, unknown>
        : null,
      fulfilled: false,
    };
    inbound.set(item.msgId, item);
    inboundStates.set(item.msgId, "queued");
    inboundOrder.push(item.msgId);
    persistState();
    audit("prompt_received", { msg_id: item.msgId, sender: item.senderName, hops: item.hops });
    pumpInboundLane();
  }

  function handleNetworkEvent(event: string, data: unknown): void {
    if (event === "pool_snapshot" && data && typeof data === "object") {
      const cards = (data as { agents?: unknown }).agents;
      if (Array.isArray(cards)) updatePeers(cards as AgentCard[]);
      return;
    }
    if ((event === "agent_joined" || event === "agent_updated") && data && typeof data === "object") {
      const card = (data as { agent?: AgentCard }).agent;
      if (card?.session_id && card.session_id !== identity?.sessionId) peers.set(card.session_id, card);
      return;
    }
    if (event === "agent_left" && data && typeof data === "object") {
      const sessionId = (data as { session_id?: unknown }).session_id;
      if (typeof sessionId === "string") peers.delete(sessionId);
      return;
    }
    if (event === "prompt") handlePrompt(data);
    if (event === "response") handleResponse(data);
  }

  async function consumeEvents(): Promise<void> {
    const ident = identity;
    if (!ident) return;
    const controller = new AbortController();
    sseAbort = controller;
    const url = `${baseUrl}/v1/events?project=${encodeURIComponent(ident.project)}&session_id=${encodeURIComponent(ident.sessionId)}`;
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: "text/event-stream" },
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`event stream failed with HTTP ${response.status}`);
    connected = true;
    let buffer = "";
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    try {
      while (!shuttingDown) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const parsed = parseSseFrames(buffer);
        buffer = parsed.remainder;
        for (const item of parsed.events) handleNetworkEvent(item.event, item.data);
      }
    } finally {
      try { reader.releaseLock(); } catch { /* stream already released */ }
    }
  }

  async function eventLoop(): Promise<void> {
    let attempt = 0;
    while (!shuttingDown && identity) {
      try {
        if (attempt > 0) await registerAgent();
        await consumeEvents();
        if (shuttingDown) return;
        throw new Error("event stream ended");
      } catch (error) {
        if (shuttingDown) return;
        connected = false;
        currentCtx?.ui.setStatus("miadi-pi-network", `◎ reconnecting ${identity.name}`);
        audit("event_stream_lost", { reason: safeError(error), attempt });
        const waitMs = Math.min(500 * (2 ** attempt), MAX_RECONNECT_MS);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        attempt = Math.min(attempt + 1, 8);
      }
    }
  }

  async function sendHeartbeat(): Promise<void> {
    if (!identity || shuttingDown) return;
    const usage = currentCtx?.getContextUsage();
    await api("POST", `/v1/agents/${encodeURIComponent(identity.sessionId)}/heartbeat`, {
      project: identity.project,
      context_used_pct: Math.round(usage?.percent ?? 0),
      model: currentCtx?.model?.id ?? identity.model,
    });
  }

  function startHeartbeat(): void {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      void sendHeartbeat().catch((error) => audit("heartbeat_failed", { reason: safeError(error) }));
    }, heartbeatMs);
    heartbeatTimer.unref?.();
  }

  async function fetchMessage(msgId: string, signal?: AbortSignal): Promise<Omit<NetworkMessage, "prompt">> {
    const ident = assertReady();
    const message = await api<Omit<NetworkMessage, "prompt">>(
      "GET",
      `/v1/messages/${encodeURIComponent(msgId)}?caller_session=${encodeURIComponent(ident.sessionId)}`,
      undefined,
      signal,
    );
    responses.set(msgId, message);
    return message;
  }

  function responseText(message: Omit<NetworkMessage, "prompt">): string {
    if (message.status === "error" || message.status === "timeout") {
      return `${message.status}: ${message.error ?? "peer response failed"}`;
    }
    if (message.status !== "complete") return message.status;
    return typeof message.response === "string"
      ? message.response
      : JSON.stringify(message.response ?? null, null, 2);
  }

  pi.registerTool({
    name: "miadi_network_peers",
    label: "Miadi Network Peers",
    description: "List purpose-specific Pi peers currently registered in this Miadi network project.",
    parameters: Type.Object({}),
    async execute() {
      const ident = assertReady();
      const result = await api<{ agents: AgentCard[] }>(
        "GET",
        `/v1/agents?project=${encodeURIComponent(ident.project)}`,
      );
      updatePeers(result.agents);
      const visible = result.agents.filter((agent) => agent.session_id !== ident.sessionId);
      const text = visible.length === 0
        ? "No peer Pi instances are connected."
        : visible.map((agent) =>
          `${agent.status === "online" ? "●" : "◌"} ${agent.name} — ${agent.purpose || "purpose not declared"} (${agent.model})`
        ).join("\n");
      return { content: [{ type: "text" as const, text }], details: { agents: visible } };
    },
  });

  pi.registerTool({
    name: "miadi_network_send",
    label: "Miadi Network Send",
    description:
      "Start a privacy-bounded intent request to a peer Pi. Returns a msg_id for miadi_network_get or miadi_network_await. " +
      "Send the minimum context needed; never include raw captures or full transcripts unless the human explicitly authorizes that transfer. " +
      "Never use this merely to answer an inbound Miadi network message; normal assistant output is returned automatically.",
    parameters: Type.Object({
      target: Type.String({ description: "Peer name or session ID." }),
      prompt: Type.String({ description: "Focused, privacy-bounded intent packet for the peer." }),
      conversation_id: Type.Optional(Type.String()),
      idempotency_key: Type.Optional(Type.String({ description: "Stable retry key; reuse it only when retrying the same request." })),
      response_schema: Type.Optional(Type.Any()),
    }),
    async execute(_toolCallId, params) {
      const ident = assertReady();
      const hops = activeInbound ? activeInbound.hops + 1 : 0;
      if (hops >= MAX_HOPS) throw new Error(`Miadi network hop limit reached (${MAX_HOPS})`);
      const idempotencyKey = params.idempotency_key ?? randomUUID();
      const result = await api<{
        msg_id: string;
        status: string;
        target_session: string;
        target_name: string;
      }>("POST", "/v1/messages", {
        project: ident.project,
        sender_session: ident.sessionId,
        target: params.target,
        prompt: params.prompt,
        conversation_id: params.conversation_id ?? null,
        idempotency_key: idempotencyKey,
        response_schema: params.response_schema ?? null,
        hops,
      });
      audit("prompt_sent", { msg_id: result.msg_id, target: result.target_name, hops });
      return {
        content: [{ type: "text" as const, text: `Sent to ${result.target_name}. msg_id: ${result.msg_id}` }],
        details: { ...result, idempotency_key: idempotencyKey },
      };
    },
  });

  pi.registerTool({
    name: "miadi_network_get",
    label: "Miadi Network Get",
    description: "Non-blocking status check for a msg_id returned by miadi_network_send.",
    parameters: Type.Object({ msg_id: Type.String() }),
    async execute(_toolCallId, params, signal) {
      const cached = responses.get(params.msg_id);
      const message = cached && ["complete", "error", "timeout"].includes(cached.status)
        ? cached
        : await fetchMessage(params.msg_id, signal);
      return {
        content: [{ type: "text" as const, text: responseText(message) }],
        details: message,
      };
    },
  });

  pi.registerTool({
    name: "miadi_network_await",
    label: "Miadi Network Await",
    description: "Wait for the response to a msg_id returned by miadi_network_send. Never await an inbound message ID.",
    parameters: Type.Object({
      msg_id: Type.String(),
      timeout_ms: Type.Optional(Type.Number({ minimum: 100, maximum: 1_800_000 })),
    }),
    async execute(_toolCallId, params, signal) {
      const timeoutMs = params.timeout_ms ?? 1_800_000;
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (signal?.aborted) throw new Error("Miadi network wait cancelled");
        const cached = responses.get(params.msg_id);
        const message = cached && ["complete", "error", "timeout"].includes(cached.status)
          ? cached
          : await fetchMessage(params.msg_id, signal);
        if (["complete", "error", "timeout"].includes(message.status)) {
          return {
            content: [{ type: "text" as const, text: responseText(message) }],
            details: message,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(250, deadline - Date.now())));
      }
      throw new Error(`Timed out waiting for ${params.msg_id}`);
    },
  });

  pi.registerCommand("miadi-network", {
    description: "Show Miadi Pi network identity and peer count",
    handler: async (_args, ctx) => {
      if (!identity || !connected) {
        ctx.ui.notify("Miadi Pi network is offline", "warning");
        return;
      }
      ctx.ui.notify(
        `${identity.name}@${identity.project} · ${peers.size} peer(s) · ${baseUrl}`,
        "info",
      );
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    shuttingDown = false;
    currentCtx = ctx;
    peers.clear();
    inbound.clear();
    inboundOrder.splice(0, inboundOrder.length);
    responses.clear();
    laneMsgId = null;
    activeInbound = null;
    connected = false;
    restoreState(ctx);
    token = process.env.MIADI_PI_NETWORK_TOKEN ?? "";
    try {
      baseUrl = normalizeBaseUrl(
        (pi.getFlag("miadi-network-url") as string | undefined) ??
        process.env.MIADI_PI_NETWORK_URL ??
        DEFAULT_URL,
      );
    } catch (error) {
      ctx.ui.notify(`Miadi Pi network URL is invalid: ${safeError(error)}`, "error");
      return;
    }
    const sessionId = ctx.sessionManager.getSessionId();
    const requestedName =
      (pi.getFlag("miadi-network-name") as string | undefined) ??
      process.env.MIADI_PI_NETWORK_NAME ??
      pi.getSessionName() ??
      `pi-${sessionId.slice(0, 8)}`;
    identity = {
      sessionId,
      name: requestedName,
      purpose:
        (pi.getFlag("miadi-network-purpose") as string | undefined) ??
        process.env.MIADI_PI_NETWORK_PURPOSE ??
        "",
      project:
        (pi.getFlag("miadi-network-project") as string | undefined) ??
        process.env.MIADI_PI_NETWORK_PROJECT ??
        DEFAULT_PROJECT,
      model: ctx.model?.id ?? "unknown",
      provider: ctx.model?.provider,
    };
    if (!token) {
      ctx.ui.setStatus("miadi-pi-network", "◎ offline: token missing");
      if (ctx.hasUI) ctx.ui.notify("Set MIADI_PI_NETWORK_TOKEN to join the Miadi Pi network", "warning");
      return;
    }
    try {
      await registerAgent();
      startHeartbeat();
      void eventLoop();
    } catch (error) {
      connected = false;
      ctx.ui.setStatus("miadi-pi-network", "◎ offline");
      ctx.ui.notify(`Miadi Pi network connection failed: ${safeError(error)}`, "error");
      audit("registration_failed", { reason: safeError(error) });
    }
  });

  pi.on("before_agent_start", async (event) => {
    const match = event.prompt.match(new RegExp(`\\[${INBOUND_MARKER}:([^\\]]+)\\]`));
    activeInbound = match && match[1] === laneMsgId ? inbound.get(match[1]) ?? null : null;
  });

  pi.on("agent_end", async (event) => {
    const item = activeInbound;
    if (!item || item.fulfilled || !identity) return;
    const assistant = [...event.messages].reverse().find((message) => message.role === "assistant");
    if (!assistant) return;
    const text = Array.isArray(assistant.content)
      ? assistant.content
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim()
      : "";
    let response: unknown = text || null;
    let error: string | null = text ? null : "peer produced no textual response";
    if (item.responseSchema && text) {
      try { response = JSON.parse(text); } catch { response = null; error = "response is not valid JSON"; }
    }

    let submitError: unknown;
    let submitted = false;
    for (let attempt = 0; attempt < 3 && !submitted; attempt += 1) {
      try {
        await api("POST", `/v1/messages/${encodeURIComponent(item.msgId)}/response`, {
          responder_session: identity.sessionId,
          response,
          error,
        });
        submitted = true;
      } catch (caught) {
        submitError = caught;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    if (!submitted) {
      audit("response_failed", { msg_id: item.msgId, reason: safeError(submitError) });
      return;
    }

    item.fulfilled = true;
    inbound.delete(item.msgId);
    inboundStates.set(item.msgId, "replied");
    laneMsgId = null;
    activeInbound = null;
    persistState();
    audit("response_sent", { msg_id: item.msgId, recipient: item.senderName, error });
    pumpInboundLane();
  });

  pi.on("session_shutdown", async () => {
    shuttingDown = true;
    connected = false;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    sseAbort?.abort();
    sseAbort = null;
    if (identity && token) {
      try {
        await api("DELETE", `/v1/agents/${encodeURIComponent(identity.sessionId)}`, undefined, undefined, 2_000);
      } catch (error) {
        audit("unregister_failed", { reason: safeError(error) });
      }
    }
    currentCtx?.ui.setStatus("miadi-pi-network", undefined);
    audit("shutdown", { session_id: identity?.sessionId });
    identity = null;
    currentCtx = null;
  });
}
