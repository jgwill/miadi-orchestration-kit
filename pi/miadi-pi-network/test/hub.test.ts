import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createMiadiNetworkHub, type MiadiNetworkHub } from "../src/hub.ts";
import { parseSseFrames } from "../src/protocol.ts";

const token = "test-token-that-never-leaves-the-test";

function headers(auth = token): HeadersInit {
  return {
    authorization: `Bearer ${auth}`,
    "content-type": "application/json",
  };
}

async function post(hub: MiadiNetworkHub, path: string, body: unknown, auth = token): Promise<Response> {
  return fetch(`${hub.url}${path}`, {
    method: "POST",
    headers: headers(auth),
    body: JSON.stringify(body),
  });
}

async function register(hub: MiadiNetworkHub, sessionId: string, name: string): Promise<void> {
  const response = await post(hub, "/v1/agents/register", {
    project: "miadi",
    session_id: sessionId,
    name,
    purpose: `${name} purpose`,
    model: "test-model",
  });
  assert.equal(response.status, 200);
}

async function nextSseEvent(response: Response, eventName: string, timeoutMs = 2_000): Promise<any> {
  assert.ok(response.body);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const read = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("SSE timeout")), timeoutMs);
          timeout.unref?.();
        }),
      ]).finally(() => {
        if (timeout) clearTimeout(timeout);
      });
      if (read.done) break;
      buffer += decoder.decode(read.value, { stream: true });
      const parsed = parseSseFrames(buffer);
      buffer = parsed.remainder;
      const found = parsed.events.find((event) => event.event === eventName);
      if (found) return found.data;
    }
    throw new Error(`SSE event ${eventName} not received`);
  } finally {
    await reader.cancel().catch(() => {});
  }
}

test("hub authenticates, routes, protects ownership, and records a response", async (t) => {
  const hub = await createMiadiNetworkHub({ port: 0, token, quiet: true });
  t.after(() => hub.stop());
  await register(hub, "session-a", "planner");
  await register(hub, "session-b", "builder");

  const unauthorized = await fetch(`${hub.url}/v1/agents?project=miadi`, {
    headers: headers("wrong-token"),
  });
  assert.equal(unauthorized.status, 401);

  const sent = await post(hub, "/v1/messages", {
    project: "miadi",
    sender_session: "session-a",
    target: "builder",
    prompt: "Assess the plan",
    response_schema: null,
    idempotency_key: "assessment-1",
    hops: 0,
  });
  assert.equal(sent.status, 202);
  const sentBody = await sent.json() as { msg_id: string; target_session: string };
  assert.equal(sentBody.target_session, "session-b");

  const duplicate = await post(hub, "/v1/messages", {
    project: "miadi",
    sender_session: "session-a",
    target: "builder",
    prompt: "Assess the plan",
    idempotency_key: "assessment-1",
    hops: 0,
  });
  assert.equal((await duplicate.json() as { msg_id: string }).msg_id, sentBody.msg_id);

  const wrongOwner = await fetch(
    `${hub.url}/v1/messages/${sentBody.msg_id}?caller_session=session-c`,
    { headers: headers() },
  );
  assert.equal(wrongOwner.status, 403);

  const impostor = await post(hub, `/v1/messages/${sentBody.msg_id}/response`, {
    responder_session: "session-a",
    response: "not allowed",
  });
  assert.equal(impostor.status, 403);

  const response = await post(hub, `/v1/messages/${sentBody.msg_id}/response`, {
    responder_session: "session-b",
    response: "The plan is sound.",
    error: null,
  });
  assert.equal(response.status, 200);

  const completed = await fetch(
    `${hub.url}/v1/messages/${sentBody.msg_id}?caller_session=session-a`,
    { headers: headers() },
  );
  assert.equal(completed.status, 200);
  assert.deepEqual(
    ((await completed.json()) as { status: string; response: string }).status,
    "complete",
  );
  assert.equal(hub.snapshot().messages[0].response, "The plan is sound.");
  assert.equal("prompt" in hub.snapshot().messages[0], false);
});

test("hub suffixes colliding names and enforces hop limits", async (t) => {
  const hub = await createMiadiNetworkHub({ port: 0, token, quiet: true });
  t.after(() => hub.stop());
  await register(hub, "session-a", "witness");
  const second = await post(hub, "/v1/agents/register", {
    project: "miadi",
    session_id: "session-b",
    name: "witness",
    purpose: "second witness",
    model: "test-model",
  });
  const secondBody = await second.json() as { agent: { name: string } };
  assert.equal(secondBody.agent.name, "witness-2");

  const tooManyHops = await post(hub, "/v1/messages", {
    project: "miadi",
    sender_session: "session-a",
    target: "witness-2",
    prompt: "This should stop",
    hops: 5,
  });
  assert.equal(tooManyHops.status, 400);
});

test("durable queue survives hub restart and replays to a reconnecting target", async () => {
  const dir = mkdtempSync(join(tmpdir(), "miadi-pi-network-hub-"));
  const storePath = join(dir, "hub-state.json");
  let first: MiadiNetworkHub | null = null;
  let second: MiadiNetworkHub | null = null;
  try {
    first = await createMiadiNetworkHub({ port: 0, token, storePath, quiet: true });
    await register(first, "session-a", "planner");
    await register(first, "session-b", "builder");
    const sent = await post(first, "/v1/messages", {
      project: "miadi",
      sender_session: "session-a",
      target: "builder",
      prompt: "Durable intent packet",
      idempotency_key: "durable-1",
      hops: 0,
    });
    const msgId = (await sent.json() as { msg_id: string }).msg_id;
    await first.stop();
    first = null;

    assert.equal(statSync(storePath).mode & 0o777, 0o600);
    second = await createMiadiNetworkHub({ port: 0, token, storePath, quiet: true });
    assert.equal(second.snapshot().messages.length, 1);
    // The target may reconnect before the sender after a hub restart. The
    // durable sender snapshot keeps delivery independent of registration order.
    await register(second, "session-b", "builder");

    const events = await fetch(
      `${second.url}/v1/events?project=miadi&session_id=session-b`,
      { headers: headers() },
    );
    const prompt = await nextSseEvent(events, "prompt");
    assert.equal(prompt.msg_id, msgId);
    assert.equal(prompt.prompt, "Durable intent packet");
  } finally {
    await first?.stop();
    await second?.stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
