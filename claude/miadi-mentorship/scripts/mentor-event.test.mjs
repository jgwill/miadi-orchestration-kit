// node --test scripts/mentor-event.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEnvelope, TYPES, TYPE_PREFIX, UsageError } from "./mentor-event.mjs";

const env = { USER: "mentor", CLAUDE_CODE_SESSION_ID: "seat-1" };

test("a message to one of the mentee's identities is an event", () => {
  const data = { channel: "email", perspective: "label", to_identity: "node:human:label", ref: "factory Sent UID 79" };
  const e = buildEnvelope({ type: "mentor.message_sent", subject: "identity:node:human:label", data, env });
  assert.equal(e.type, `${TYPE_PREFIX}mentor.message_sent`);
  assert.equal(e.specversion, "1.0");
  assert.deepEqual(e.data, data);
  assert.equal(e.subject, "identity:node:human:label");
  assert.match(e.source, /\/seat-1$/);
});

test("a step reached on a path is an event", () => {
  const e = buildEnvelope({ type: "mentorship.step_reached", data: { path: "mentorship-path.md", step: "M1", identity: "H" }, env });
  assert.equal(e.type, `${TYPE_PREFIX}mentorship.step_reached`);
});

test("a lesson carries what Jerry named for it", () => {
  const data = { lesson_id: "jev-in-the-line", version: 1, learner: "Miette (gmusic account)", identity: "node:human:label",
    teacher: "Mia", time_slot: { from: "2026-11-14T20:20Z", to: "2026-11-14T21:10Z" }, human_interactions: 4,
    languages: ["fr", "en"], concepts: ["Jev", "mid_thought"], notes_ref: "diary-1", content_refs: [] };
  const e = buildEnvelope({ type: "mentorship.lesson_recorded", subject: "identity:node:human:label", data, env });
  assert.equal(e.type, `${TYPE_PREFIX}mentorship.lesson_recorded`);
  assert.deepEqual(e.data.languages, ["fr", "en"]);
});

test("every earlier type still builds, and an unknown one is refused", () => {
  for (const type of Object.keys(TYPES)) assert.equal(buildEnvelope({ type, env }).type, TYPE_PREFIX + type);
  assert.throws(() => buildEnvelope({ type: "mentor.guessed", env }), UsageError);
  assert.throws(() => buildEnvelope({ type: "mentor.message_sent", data: [], env }), UsageError);
});
