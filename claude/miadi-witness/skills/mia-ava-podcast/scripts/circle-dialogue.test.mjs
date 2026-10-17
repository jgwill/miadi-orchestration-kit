// node --test claude/miadi-witness/skills/mia-ava-podcast/scripts/circle-dialogue.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { answers, parseDialogue, post, resolveToken } from "./circle-dialogue.mjs";

const DIALOGUE = `## Academics

### Information architecture

Names decide where a seat is found.

#### Controlled vocabularies

One name per thing.

Ava: Mia, what did you do?

Mia: I mounted the reader
at one short path.

Ava: Who asked?
`;

const dir = mkdtempSync(join(tmpdir(), "circle-dialogue-test-"));
const file = join(dir, "d.md");
writeFileSync(file, DIALOGUE);
const envFile = join(dir, ".env");
writeFileSync(envFile, 'MIADI_AVA_SEAT_TOKEN="ava-secret"\nOTHER=1\n');

function stub(handler) {
  const calls = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const call = { method: req.method, url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null };
      calls.push(call);
      const [status, json] = handler(call, calls);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, calls, url: `http://127.0.0.1:${server.address().port}` })));
}

test("parseDialogue reads the survey's fields and joins a turn's lines", () => {
  const { fields, turns, stray } = parseDialogue(DIALOGUE);
  assert.deepEqual(stray, []);
  assert.deepEqual(fields, ["Information architecture", "Controlled vocabularies"]);
  assert.deepEqual(turns, [
    { host: "Ava", said: "Mia, what did you do?" },
    { host: "Mia", said: "I mounted the reader at one short path." },
    { host: "Ava", said: "Who asked?" },
  ]);
});

test("resolveToken prefers the environment, then the env files, unquoted", () => {
  assert.equal(resolveToken(["X"], { X: "from-env" }, [envFile]), "from-env");
  assert.equal(resolveToken(["MIADI_AVA_SEAT_TOKEN", "MIADI_AVA_TOKEN"], {}, [envFile]), "ava-secret");
  assert.equal(resolveToken(["NOPE"], {}, [envFile]), null);
});

test("post writes the diary first, then each turn under its host's token, in order", async () => {
  const s = await stub((call) => {
    if (call.method === "GET") return [200, { turns: [{}, {}, {}], diary: [{}] }];
    return [201, {}];
  });
  const lines = [];
  const env = { MIADI_API_URL: s.url, MIADI_MIA_TOKEN: "mia-secret", MIADI_MINO_TOKEN: "mino-secret", CIRCLE_DIALOGUE_ENV_FILES: envFile };
  const r = await post({ ceremony: "c1", file }, env, (l) => lines.push(l));
  s.server.close();
  assert.equal(r.posted, 3);
  assert.deepEqual(s.calls.map((c) => `${c.method} ${c.url} ${c.auth}`), [
    "POST /api/ceremony/c1/diary Bearer mino-secret",
    "POST /api/ceremony/c1/turns Bearer ava-secret",
    "POST /api/ceremony/c1/turns Bearer mia-secret",
    "POST /api/ceremony/c1/turns Bearer ava-secret",
    "GET /api/ceremony/c1 Bearer mino-secret",
  ]);
  assert.match(s.calls[0].body.content, /Information architecture, Controlled vocabularies/);
  assert.equal(s.calls[2].body.said, "I mounted the reader at one short path.");
  assert.ok(lines.every((l) => !/secret/.test(l)), "no token is printed");
});

test("post stops at the first refused turn and says how many were posted", async () => {
  const s = await stub((call, calls) => (call.url.endsWith("/turns") && calls.filter((c) => c.url.endsWith("/turns")).length === 2 ? [403, { error: "Only those seated in the circle may speak" }] : [201, {}]));
  const env = { MIADI_API_URL: s.url, MIADI_MIA_TOKEN: "mia-secret", MIADI_MINO_TOKEN: "mino-secret", CIRCLE_DIALOGUE_ENV_FILES: envFile };
  await assert.rejects(post({ ceremony: "c1", file }, env, () => {}), /turn 2 \(Mia\) refused: HTTP 403 Only those seated.*1 turns were posted/);
  s.server.close();
  assert.equal(s.calls.filter((c) => c.url.endsWith("/turns")).length, 2);
});

test("post opens the ceremony in the circle when no ceremony is given", async () => {
  const s = await stub((call) => (call.url.startsWith("/api/circles/") ? [201, { ceremony: { id: "new1" } }] : call.method === "GET" ? [200, { turns: [], diary: [] }] : [201, {}]));
  const env = { MIADI_API_URL: s.url, MIADI_MIA_TOKEN: "mia-secret", MIADI_MINO_TOKEN: "mino-secret", CIRCLE_DIALOGUE_ENV_FILES: envFile };
  const r = await post({ circle: "circle:1:x", intention: "the person's words", episodePath: "2026-10-12-episode-553-x", file }, env, () => {});
  s.server.close();
  assert.equal(r.ceremony, "new1");
  assert.deepEqual(s.calls[0].body, { intention: "the person's words", type: "talking_circle", direction: "east", episode_path: "2026-10-12-episode-553-x" });
  assert.equal(s.calls[1].url, "/api/ceremony/new1/diary");
});

test("answers lists only the turns people answered", async () => {
  const s = await stub(() => [200, { turns: [
    { id: "t1", speaker_name: "Mia", prose: "I mounted the reader.", responses: [{ stance: "does-not-make-sense", note: "The rename was mine.", speaker_name: "Guillaume" }] },
    { id: "t2", speaker_name: "Ava", prose: "Who asked?", responses: [] },
  ] }]);
  const lines = [];
  const rows = await answers({ ceremony: "c1" }, { MIADI_API_URL: s.url, MIADI_MINO_TOKEN: "mino-secret", CIRCLE_DIALOGUE_ENV_FILES: envFile }, (l) => lines.push(l));
  s.server.close();
  assert.equal(rows.length, 1);
  assert.deepEqual(lines, ["turn 1, Mia: I mounted the reader.", "  Guillaume: does-not-make-sense. The rename was mine."]);
});

const ENV = (url) => ({ MIADI_API_URL: url, MIADI_MIA_TOKEN: "mia-secret", MIADI_MINO_TOKEN: "mino-secret", CIRCLE_DIALOGUE_ENV_FILES: envFile });

test("post refuses a file with a stray block after the first turn, before any call", async () => {
  const bad = join(dir, "stray.md");
  writeFileSync(bad, "Ava: One.\n\nMia: Two.\n\nA second paragraph of Mia's turn.\n");
  assert.deepEqual(parseDialogue(readFileSync(bad, "utf8")).stray, ["A second paragraph of Mia's turn."]);
  const s = await stub(() => [201, {}]);
  await assert.rejects(post({ ceremony: "c1", file: bad }, ENV(s.url), () => {}), /1 block\(s\) after the first turn/);
  s.server.close();
  assert.equal(s.calls.length, 0);
});

test("--dry-run sends nothing", async () => {
  const s = await stub(() => [201, {}]);
  const lines = [];
  await post({ ceremony: "c1", file, dryRun: true }, ENV(s.url), (l) => lines.push(l));
  s.server.close();
  assert.equal(s.calls.length, 0);
  assert.match(lines[0], /3 turns \(1 Mia, 2 Ava\), 2 fields/);
});

test("--from resumes at turn n and writes no second diary entry", async () => {
  const s = await stub((call) => (call.method === "GET" ? [200, { turns: [], diary: [] }] : [201, {}]));
  const r = await post({ ceremony: "c1", file, from: "2" }, ENV(s.url), () => {});
  s.server.close();
  assert.equal(r.posted, 2);
  assert.deepEqual(s.calls.filter((c) => c.method === "POST").map((c) => `${c.url} ${c.body.said ?? ""}`), [
    "/api/ceremony/c1/turns I mounted the reader at one short path.",
    "/api/ceremony/c1/turns Who asked?",
  ]);
});

test("no token appears in an error", async () => {
  const s = await stub(() => [403, { error: "Only those seated in the circle may speak" }]);
  const err = await post({ ceremony: "c1", file }, ENV(s.url), () => {}).catch((e) => e);
  s.server.close();
  assert.ok(err instanceof Error);
  assert.doesNotMatch(err.message, /secret/);
});

test("answers says so when this Miadi does not return answers", async () => {
  const s = await stub(() => [200, { turns: [{ id: "t1", speaker_name: "Mia", prose: "x" }] }]);
  await assert.rejects(answers({ ceremony: "c1" }, ENV(s.url), () => {}), /does not return answers yet/);
  s.server.close();
});
