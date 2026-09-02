export const PROTOCOL_VERSION = 1;
export const DEFAULT_PORT = 8787;
export const DEFAULT_PROJECT = "miadi";
export const MAX_BODY_BYTES = 128 * 1024;
export const MAX_PROMPT_BYTES = 64 * 1024;
export const MAX_RESPONSE_BYTES = 64 * 1024;
export const MAX_HOPS = 5;
export const DEFAULT_MESSAGE_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_HEARTBEAT_MS = 10_000;

export type AgentStatus = "online" | "stale";
export type MessageStatus = "queued" | "delivered" | "complete" | "error" | "timeout";

export interface AgentRegistration {
  project: string;
  session_id: string;
  name: string;
  purpose: string;
  model: string;
  provider?: string;
  cwd?: string;
  capabilities?: string[];
}

export interface AgentCard extends AgentRegistration {
  status: AgentStatus;
  registered_at: string;
  heartbeat_at: string;
  context_used_pct: number;
}

export interface SendMessageRequest {
  project: string;
  sender_session: string;
  target: string;
  prompt: string;
  conversation_id?: string | null;
  response_schema?: Record<string, unknown> | null;
  hops: number;
}

export interface NetworkMessage {
  msg_id: string;
  project: string;
  sender_session: string;
  target_session: string;
  prompt: string;
  conversation_id: string | null;
  response_schema: Record<string, unknown> | null;
  hops: number;
  status: MessageStatus;
  created_at: string;
  expires_at: string;
  completed_at?: string;
  response?: unknown;
  error?: string | null;
}

export interface NetworkEvent<T = unknown> {
  event: string;
  data: T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function requiredString(
  value: unknown,
  field: string,
  options: { max?: number; pattern?: RegExp } = {},
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  const result = value.trim();
  if (options.max && result.length > options.max) {
    throw new Error(`${field} exceeds ${options.max} characters`);
  }
  if (options.pattern && !options.pattern.test(result)) {
    throw new Error(`${field} has an invalid format`);
  }
  return result;
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("hub URL must use http or https");
  }
  return url.toString().replace(/\/$/, "");
}

export function encodeSse(event: string, data: unknown, id?: string): string {
  const lines = JSON.stringify(data).split("\n").map((line) => `data: ${line}`).join("\n");
  return `${id ? `id: ${id}\n` : ""}event: ${event}\n${lines}\n\n`;
}

export function parseSseFrames(buffer: string): {
  events: NetworkEvent[];
  remainder: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const frames = normalized.split("\n\n");
  const remainder = frames.pop() ?? "";
  const events: NetworkEvent[] = [];

  for (const frame of frames) {
    let event = "message";
    const data: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
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

export function publicMessage(message: NetworkMessage): Omit<NetworkMessage, "prompt"> {
  const { prompt: _prompt, ...rest } = message;
  return rest;
}
