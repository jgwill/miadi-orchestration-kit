import assert from "node:assert/strict";
import test from "node:test";
import { encodeSse, normalizeBaseUrl, parseSseFrames } from "../src/protocol.ts";

test("SSE events round-trip while partial frames remain buffered", () => {
  const input = encodeSse("prompt", { msg_id: "one", prompt: "hello" }, "one") +
    "event: response\ndata: {\"msg_id\":\"two\"}";
  const parsed = parseSseFrames(input);

  assert.deepEqual(parsed.events, [
    { event: "prompt", data: { msg_id: "one", prompt: "hello" } },
  ]);
  assert.match(parsed.remainder, /event: response/);
});

test("hub URL normalization accepts HTTP(S) and rejects other schemes", () => {
  assert.equal(normalizeBaseUrl("https://hub.example/"), "https://hub.example");
  assert.throws(() => normalizeBaseUrl("file:///tmp/hub"), /http or https/);
});
