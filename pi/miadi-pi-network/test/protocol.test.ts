import { describe, expect, test } from "bun:test";
import { encodeSse, normalizeBaseUrl, parseSseFrames } from "../src/protocol.ts";

describe("protocol helpers", () => {
  test("round-trips SSE events while retaining partial frames", () => {
    const input = encodeSse("prompt", { msg_id: "one", prompt: "hello" }, "one") +
      "event: response\ndata: {\"msg_id\":\"two\"}";
    const parsed = parseSseFrames(input);

    expect(parsed.events).toEqual([
      { event: "prompt", data: { msg_id: "one", prompt: "hello" } },
    ]);
    expect(parsed.remainder).toContain("event: response");
  });

  test("accepts HTTP(S) hubs and rejects other schemes", () => {
    expect(normalizeBaseUrl("https://hub.example/" )).toBe("https://hub.example");
    expect(() => normalizeBaseUrl("file:///tmp/hub")).toThrow("http or https");
  });
});
