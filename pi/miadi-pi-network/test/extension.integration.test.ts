import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import miadiPiNetwork from "../extensions/miadi-pi-network.ts";
import { createMiadiNetworkHub } from "../src/hub.ts";

const token = "integration-token-kept-inside-the-test";
type Handler = (event: any, ctx: any) => any;

class MockPi {
  readonly tools = new Map<string, any>();
  readonly handlers = new Map<string, Handler[]>();
  readonly messages: any[] = [];
  readonly audit: any[] = [];
  readonly branch: any[] = [];
  private readonly flags: Record<string, unknown>;
  readonly sessionId: string;

  constructor(flags: Record<string, unknown>, sessionId: string) {
    this.flags = flags;
    this.sessionId = sessionId;
  }

  registerFlag(): void {}
  registerTool(tool: any): void { this.tools.set(tool.name, tool); }
  registerCommand(): void {}
  getFlag(name: string): unknown { return this.flags[name]; }
  getSessionName(): undefined { return undefined; }
  appendEntry(type: string, data: unknown): void {
    this.audit.push({ type, data });
    this.branch.push({ type: "custom", customType: type, data });
  }
  sendMessage(message: unknown): void { this.messages.push(message); }
  on(event: string, handler: Handler): void {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  async emit(event: string, payload: unknown, ctx: unknown): Promise<void> {
    for (const handler of this.handlers.get(event) ?? []) await handler(payload, ctx);
  }
}

function makeContext(pi: MockPi): any {
  return {
    cwd: "/tmp/miadi-network-test",
    hasUI: false,
    mode: "json",
    model: { id: "test-model", provider: "test-provider" },
    sessionManager: {
      getSessionId: () => pi.sessionId,
      getBranch: () => pi.branch,
    },
    getContextUsage: () => ({ percent: 7 }),
    ui: {
      notify() {},
      setStatus() {},
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(read: () => T | undefined, timeoutMs = 3_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== undefined) return value;
    await sleep(20);
  }
  throw new Error("condition was not met before timeout");
}

async function answer(pi: MockPi, ctx: any, message: any, text: string): Promise<void> {
  await pi.emit("before_agent_start", { prompt: message.content }, ctx);
  await pi.emit("agent_end", {
    messages: [{
      role: "assistant",
      content: [{ type: "text", text }],
    }],
  }, ctx);
}

test("two Pi extensions exchange replies and serialize inbound turns", async () => {
  const previousToken = process.env.MIADI_PI_NETWORK_TOKEN;
  process.env.MIADI_PI_NETWORK_TOKEN = token;
  const hub = await createMiadiNetworkHub({ port: 0, token, heartbeatMs: 100, quiet: true });
  try {
    const planner = new MockPi({
      "miadi-network-url": hub.url,
      "miadi-network-name": "planner",
      "miadi-network-purpose": "frames the work",
      "miadi-network-project": "miadi",
    }, "planner-session");
    const builder = new MockPi({
      "miadi-network-url": hub.url,
      "miadi-network-name": "builder",
      "miadi-network-purpose": "implements the work",
      "miadi-network-project": "miadi",
    }, "builder-session");

    miadiPiNetwork(planner as unknown as ExtensionAPI);
    miadiPiNetwork(builder as unknown as ExtensionAPI);
    const plannerCtx = makeContext(planner);
    const builderCtx = makeContext(builder);
    await planner.emit("session_start", { reason: "startup" }, plannerCtx);
    await builder.emit("session_start", { reason: "startup" }, builderCtx);

    const peersResult = await planner.tools.get("miadi_network_peers").execute("peers", {}, undefined, undefined, plannerCtx);
    assert.equal(peersResult.details.agents.length, 1);
    assert.equal(peersResult.details.agents[0].name, "builder");

    const firstSend = await planner.tools.get("miadi_network_send").execute(
      "send-1",
      { target: "builder", prompt: "Can this network carry a first reply?" },
      undefined,
      undefined,
      plannerCtx,
    );
    const secondSend = await planner.tools.get("miadi_network_send").execute(
      "send-2",
      { target: "builder", prompt: "Can it serialize a second reply?" },
      undefined,
      undefined,
      plannerCtx,
    );

    const firstInbound = await waitFor(() => builder.messages[0]);
    await sleep(80);
    assert.equal(builder.messages.length, 1, "second inbound must wait for the first lane");
    assert.match(firstInbound.content, new RegExp(firstSend.details.msg_id));

    await answer(builder, builderCtx, firstInbound, "Yes—first peer reply received.");
    const secondInbound = await waitFor(() => builder.messages[1]);
    assert.match(secondInbound.content, new RegExp(secondSend.details.msg_id));
    await answer(builder, builderCtx, secondInbound, "Yes—second peer reply received.");

    const firstResult = await planner.tools.get("miadi_network_await").execute(
      "await-1",
      { msg_id: firstSend.details.msg_id, timeout_ms: 2_000 },
      undefined,
      undefined,
      plannerCtx,
    );
    const secondResult = await planner.tools.get("miadi_network_await").execute(
      "await-2",
      { msg_id: secondSend.details.msg_id, timeout_ms: 2_000 },
      undefined,
      undefined,
      plannerCtx,
    );
    assert.equal(firstResult.content[0].text, "Yes—first peer reply received.");
    assert.equal(secondResult.content[0].text, "Yes—second peer reply received.");

    await planner.emit("session_shutdown", { reason: "quit" }, plannerCtx);
    await builder.emit("session_shutdown", { reason: "quit" }, builderCtx);
    assert.equal(hub.snapshot().agents.length, 0);
    assert.ok(builder.branch.some((entry) => entry.customType === "miadi-pi-network-state-v1"));
  } finally {
    await hub.stop();
    if (previousToken === undefined) delete process.env.MIADI_PI_NETWORK_TOKEN;
    else process.env.MIADI_PI_NETWORK_TOKEN = previousToken;
  }
});
