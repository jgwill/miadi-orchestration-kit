import { afterEach, describe, expect, test } from "bun:test";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import miadiPiNetwork from "../extensions/miadi-pi-network.ts";
import { createMiadiNetworkHub, type MiadiNetworkHub } from "../src/hub.ts";

const token = "integration-token-kept-inside-the-test";
let hub: MiadiNetworkHub | null = null;
const previousToken = process.env.MIADI_PI_NETWORK_TOKEN;

afterEach(async () => {
  if (previousToken === undefined) delete process.env.MIADI_PI_NETWORK_TOKEN;
  else process.env.MIADI_PI_NETWORK_TOKEN = previousToken;
  await hub?.stop();
  hub = null;
});

type Handler = (event: any, ctx: any) => any;

class MockPi {
  readonly tools = new Map<string, any>();
  readonly handlers = new Map<string, Handler[]>();
  readonly messages: any[] = [];
  readonly audit: any[] = [];

  constructor(
    private readonly flags: Record<string, unknown>,
    readonly sessionId: string,
  ) {}

  registerFlag(): void {}
  registerTool(tool: any): void { this.tools.set(tool.name, tool); }
  registerCommand(): void {}
  getFlag(name: string): unknown { return this.flags[name]; }
  getSessionName(): undefined { return undefined; }
  appendEntry(type: string, data: unknown): void { this.audit.push({ type, data }); }
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

function makeContext(sessionId: string): any {
  return {
    cwd: "/tmp/miadi-network-test",
    hasUI: false,
    mode: "json",
    model: { id: "test-model", provider: "test-provider" },
    sessionManager: { getSessionId: () => sessionId },
    getContextUsage: () => ({ percent: 7 }),
    ui: {
      notify() {},
      setStatus() {},
    },
  };
}

async function waitFor<T>(read: () => T | undefined, timeoutMs = 3_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = read();
    if (value !== undefined) return value;
    await Bun.sleep(20);
  }
  throw new Error("condition was not met before timeout");
}

describe("Pi extension integration", () => {
  test("joins two extension instances and returns the receiver's normal answer", async () => {
    process.env.MIADI_PI_NETWORK_TOKEN = token;
    hub = createMiadiNetworkHub({ port: 0, token, heartbeatMs: 100, quiet: true });

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
    const plannerCtx = makeContext(planner.sessionId);
    const builderCtx = makeContext(builder.sessionId);
    await planner.emit("session_start", { reason: "startup" }, plannerCtx);
    await builder.emit("session_start", { reason: "startup" }, builderCtx);

    const peersResult = await planner.tools.get("miadi_network_peers").execute("peers", {}, undefined, undefined, plannerCtx);
    expect(peersResult.details.agents).toHaveLength(1);
    expect(peersResult.details.agents[0].name).toBe("builder");

    const sendResult = await planner.tools.get("miadi_network_send").execute(
      "send",
      { target: "builder", prompt: "Can this network carry a reply?" },
      undefined,
      undefined,
      plannerCtx,
    );
    const msgId = sendResult.details.msg_id as string;

    const inboundMessage = await waitFor(() => builder.messages[0]);
    expect(inboundMessage.content).toContain(msgId);
    expect(inboundMessage.content).toContain("Can this network carry a reply?");

    await builder.emit("before_agent_start", { prompt: inboundMessage.content }, builderCtx);
    await builder.emit("agent_end", {
      messages: [{
        role: "assistant",
        content: [{ type: "text", text: "Yes—peer reply received." }],
      }],
    }, builderCtx);

    const awaitResult = await planner.tools.get("miadi_network_await").execute(
      "await",
      { msg_id: msgId, timeout_ms: 2_000 },
      undefined,
      undefined,
      plannerCtx,
    );
    expect(awaitResult.content[0].text).toBe("Yes—peer reply received.");

    await planner.emit("session_shutdown", { reason: "quit" }, plannerCtx);
    await builder.emit("session_shutdown", { reason: "quit" }, builderCtx);
    expect(hub.snapshot().agents).toHaveLength(0);
  });
});
