import { afterEach, describe, expect, test } from "bun:test";
import { createMiadiNetworkHub, type MiadiNetworkHub } from "../src/hub.ts";

const token = "test-token-that-never-leaves-the-test";
let hub: MiadiNetworkHub | null = null;

afterEach(async () => {
  await hub?.stop();
  hub = null;
});

function headers(auth = token): HeadersInit {
  return {
    authorization: `Bearer ${auth}`,
    "content-type": "application/json",
  };
}

async function post(path: string, body: unknown, auth = token): Promise<Response> {
  return fetch(`${hub!.url}${path}`, {
    method: "POST",
    headers: headers(auth),
    body: JSON.stringify(body),
  });
}

async function register(sessionId: string, name: string): Promise<void> {
  const response = await post("/v1/agents/register", {
    project: "miadi",
    session_id: sessionId,
    name,
    purpose: `${name} purpose`,
    model: "test-model",
  });
  expect(response.status).toBe(200);
}

describe("Miadi network hub", () => {
  test("authenticates, routes, protects ownership, and records a response", async () => {
    hub = createMiadiNetworkHub({ port: 0, token, quiet: true });
    await register("session-a", "planner");
    await register("session-b", "builder");

    const unauthorized = await fetch(`${hub.url}/v1/agents?project=miadi`, {
      headers: headers("wrong-token"),
    });
    expect(unauthorized.status).toBe(401);

    const sent = await post("/v1/messages", {
      project: "miadi",
      sender_session: "session-a",
      target: "builder",
      prompt: "Assess the plan",
      response_schema: null,
      hops: 0,
    });
    expect(sent.status).toBe(202);
    const sentBody = await sent.json() as { msg_id: string; target_session: string };
    expect(sentBody.target_session).toBe("session-b");

    const wrongOwner = await fetch(
      `${hub.url}/v1/messages/${sentBody.msg_id}?caller_session=session-c`,
      { headers: headers() },
    );
    expect(wrongOwner.status).toBe(403);

    const impostor = await post(`/v1/messages/${sentBody.msg_id}/response`, {
      responder_session: "session-a",
      response: "not allowed",
    });
    expect(impostor.status).toBe(403);

    const response = await post(`/v1/messages/${sentBody.msg_id}/response`, {
      responder_session: "session-b",
      response: "The plan is sound.",
      error: null,
    });
    expect(response.status).toBe(200);

    const completed = await fetch(
      `${hub.url}/v1/messages/${sentBody.msg_id}?caller_session=session-a`,
      { headers: headers() },
    );
    expect(completed.status).toBe(200);
    expect(await completed.json()).toMatchObject({
      status: "complete",
      response: "The plan is sound.",
      sender_session: "session-a",
      target_session: "session-b",
    });
    expect(hub.snapshot().messages[0]).not.toHaveProperty("prompt");
  });

  test("suffixes colliding peer names and enforces hop limits", async () => {
    hub = createMiadiNetworkHub({ port: 0, token, quiet: true });
    await register("session-a", "witness");
    const second = await post("/v1/agents/register", {
      project: "miadi",
      session_id: "session-b",
      name: "witness",
      purpose: "second witness",
      model: "test-model",
    });
    const secondBody = await second.json() as { agent: { name: string } };
    expect(secondBody.agent.name).toBe("witness-2");

    const tooManyHops = await post("/v1/messages", {
      project: "miadi",
      sender_session: "session-a",
      target: "witness-2",
      prompt: "This should stop",
      hops: 5,
    });
    expect(tooManyHops.status).toBe(400);
  });
});
