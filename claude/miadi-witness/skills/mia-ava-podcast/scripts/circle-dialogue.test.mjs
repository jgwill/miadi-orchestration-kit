// node --test claude/miadi-witness/skills/mia-ava-podcast/scripts/circle-dialogue.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { answers, awaitPending, parseDialogue, pendingOf, post, reply, resolveToken } from "./circle-dialogue.mjs";

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

test("post opens a ceremony with no episode when none is given (a staged folder)", async () => {
  const s = await stub((call) => (call.url.startsWith("/api/circles/") ? [201, { ceremony: { id: "st1" } }] : call.method === "GET" ? [200, { turns: [], diary: [] }] : [201, {}]));
  await post({ circle: "circle:1:x", intention: "the person's words", file }, ENV(s.url), () => {});
  s.server.close();
  assert.deepEqual(s.calls[0].body, { intention: "the person's words", type: "talking_circle", direction: "east" });
});

const VIEW = {
  turns: [
    { id: "t1", speaker_name: "Mia", prose: "Mino did the inventory, not me.", timestamp: "2026-10-19T10:00:00Z", responses: [
      { stance: "makes-sense", note: "why not you?", speaker_name: "Guillaume", timestamp: "2026-10-20T01:00:00Z" },
    ] },
    { id: "t2", speaker_name: "Ava", prose: "How many?", timestamp: "2026-10-19T10:01:00Z", responses: [
      { stance: "makes-sense", note: "too much", speaker_name: "Guillaume", timestamp: "2026-10-20T01:01:00Z" },
      { stance: "reply", note: "Eighty-six.", speaker_name: "Ava", timestamp: "2026-10-20T02:00:00Z" },
    ] },
    { id: "t3", speaker_name: "Mia", prose: "Thirteen leads.", timestamp: "2026-10-19T10:02:00Z", responses: [
      { stance: "reply", note: "Noted.", speaker_name: "Mia", timestamp: "2026-10-20T02:00:00Z" },
      { stance: "does-not-make-sense", note: "Only twelve.", speaker_name: "Guillaume", timestamp: "2026-10-20T03:00:00Z" },
    ] },
    { id: "t4", speaker_name: "Guillaume", prose: "Can you reply here?", timestamp: "2026-10-20T01:09:00Z", responses: [] },
  ],
};

test("pendingOf lists answers no host replied to, and a person's turn with no host turn after it", () => {
  const items = pendingOf(VIEW);
  assert.deepEqual(items.map((p) => `${p.kind}:${p.turn_id}:${p.voice}`), ["answer:t1:Mia", "answer:t3:Mia", "turn:t4:Mia"]);
  assert.deepEqual(items[1].answers.map((a) => a.note), ["Only twelve."], "only what came after the host's last reply");
});

test("a host turn after a person's turn answers it", () => {
  const view = { turns: [...VIEW.turns, { id: "t5", speaker_name: "Mia", prose: "Yes.", timestamp: "2026-10-20T04:00:00Z", responses: [] }] };
  assert.ok(!pendingOf(view).some((p) => p.turn_id === "t4"));
});

test("reply posts under a turn with the host's own token, or at the end", async () => {
  const s = await stub(() => [201, {}]);
  await reply({ ceremony: "c1", as: "Ava", turn: "t2", say: "Eighty-six." }, ENV(s.url), () => {});
  await reply({ ceremony: "c1", as: "Mia", say: "Yes, here." }, ENV(s.url), () => {});
  s.server.close();
  assert.deepEqual(s.calls.map((c) => `${c.url} ${c.auth} ${JSON.stringify(c.body)}`), [
    '/api/ceremony/c1/turns/t2/respond Bearer ava-secret {"stance":"reply","note":"Eighty-six."}',
    '/api/ceremony/c1/turns Bearer mia-secret {"said":"Yes, here."}',
  ]);
  await assert.rejects(reply({ ceremony: "c1", as: "Mino", say: "x" }, ENV("http://127.0.0.1:9"), () => {}), /--as is one of Mia, Ava/);
});

test("await returns once something waits for a reply, and times out with exit code 4", async () => {
  let reads = 0;
  const s = await stub(() => (++reads < 3 ? [200, { turns: [] }] : [200, VIEW]));
  const lines = [];
  const items = await awaitPending({ ceremony: "c1", interval: 0 }, ENV(s.url), (l) => lines.push(l), async () => {});
  assert.equal(reads, 3);
  assert.equal(items.length, 3);
  assert.match(lines[0], /3 waiting for a reply/);
  const quiet = await stub(() => [200, { turns: [] }]);
  const err = await awaitPending({ ceremony: "c1", interval: 0, timeout: 0.05 }, ENV(quiet.url), () => {}, (ms) => new Promise((r) => setTimeout(r, 10))).catch((e) => e);
  s.server.close();
  quiet.server.close();
  assert.equal(err.exitCode, 4);
});
