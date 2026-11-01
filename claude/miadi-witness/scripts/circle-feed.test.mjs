// node --test claude/miadi-witness/scripts/circle-feed.test.mjs
// A stand-in for the Miadi API; nothing leaves the host.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { diary, doneLineOf, keyOf, ledgerPath, main, participantEntryOf, post, Refusal, rootCeremonyOf, tokenNameFor, turnOf } from "./circle-feed.mjs";

const EP = "2026-10-26-episode-564-jev-decides-with-the-factory";
const MINO = { id: "node:agent:1", name: "Mino-Bimaadizi-Daa", role: "participant", being: "agent" };
const CIRCLE = "circle:main-564";
const GUILLAUME = { id: "node:human:9", name: "Guillaume", role: "admin", being: "human" };
const MIETTE = { id: "node:agent:7", name: "Miette", role: "participant", being: "agent" };

function viewWith({ circle = CIRCLE, ceremonies = [] } = {}) {
  return {
    episode: { path: EP, number: 564 },
    reader: { id: MINO.id, name: MINO.name, role: MINO.role },
    main: { circle_id: circle, names: [], rename: false, open: false },
    circles: circle ? [{ id: circle, name: "Episode 564 Root Circle", main: true, gone: false }] : [],
    ceremonies,
  };
}
const talking = (id, extra = {}) => ({ id, type: "talking_circle", circle_id: CIRCLE, subject_id: `chronicle:${EP}`, timestamp: "2026-10-26T10:00:00Z", ...extra });

// A fake API: routes answer from `world`, every call is recorded.
function deps({ world, env = {} } = {}) {
  const calls = [];
  const values = { MIADI_MINO_TOKEN: "mino-token", MIADI_PERSON_TOKEN: "person-token", MIADI_API_TOKEN_WRITER: "writer-token", ...env };
  const dir = mkdtempSync(join(tmpdir(), "circle-feed-"));
  const reply = (status, body) => ({ status, ok: status < 400, json: async () => body });
  return {
    calls,
    env: { WITNESS_STATE_DIR: dir },
    api: "http://miadi.test",
    envValue: (name) => values[name] ?? "",
    now: () => new Date("2026-10-27T05:00:00Z"),
    fetch: async (url, init = {}) => {
      const path = url.replace("http://miadi.test", "");
      const method = init.method ?? "GET";
      const body = init.body ? JSON.parse(init.body) : null;
      calls.push({ method, path, auth: init.headers?.Authorization, body });
      if (path === "/api/identity/me") {
        const who = { "Bearer person-token": world.person ?? GUILLAUME, "Bearer miette-token": MIETTE, "Bearer guillaume-token": GUILLAUME }[init.headers?.Authorization];
        return reply(200, { person: who ?? world.me ?? MINO });
      }
      if (path.endsWith("/diary") && method === "POST") return reply(201, { ok: true, entry: { id: `diary-${calls.length}` } });
      if (path.endsWith("/wheel")) return reply(200, world.view());
      if (path.endsWith("/circle") && method === "POST") {
        if (body.dryRun) return reply(200, { dryRun: true, expect: "opens", as: "Miadi Factory, for Guillaume", name: "Episode 564 Root Circle" });
        world.opened = true;
        return reply(201, { mainCircle: { state: "opened", circle: { id: CIRCLE }, ceremony: { id: "cer-new", opened: true } } });
      }
      if (path.endsWith("/turns") && method === "POST") return reply(201, { turn: { id: `turn-${calls.length}` } });
      return reply(404, { error: "no route" });
    },
  };
}

const LINE = "DONE K6 · miadi-witness 0.7.17 · 4 commits on main";

test("only a line that begins with DONE is fed, without list marks or backticks", () => {
  assert.equal(doneLineOf(`Report\n- \`${LINE}\`\nmore`), LINE);
  assert.equal(doneLineOf("DONE except the push, owned by William"), "DONE except the push, owned by William");
  assert.equal(doneLineOf("All done here.\nNot DONE yet"), null);
});

test("the root ceremony is the open talking circle in the main circle, the one about the episode first", () => {
  const view = viewWith({ ceremonies: [
    talking("old-closed", { timestamp: "2026-10-26T08:00:00Z" }),
    { id: "closing-1", type: "talking_circle", circle_id: CIRCLE, closes: "old-closed", timestamp: "2026-10-26T09:00:00Z" },
    talking("other-subject", { subject_id: "review:x", timestamp: "2026-10-26T07:00:00Z" }),
    talking("root-open"),
    talking("elsewhere", { circle_id: "circle:other" }),
  ] });
  const root = rootCeremonyOf(view);
  assert.equal(root.ceremony.id, "root-open");
  assert.equal(root.circle.name, "Episode 564 Root Circle");
  assert.equal(rootCeremonyOf(viewWith({ circle: null })), null);
  assert.equal(rootCeremonyOf(viewWith({ ceremonies: [] })), null);
});

test("a DONE line becomes one turn signed by the seat's own token, and is fed once", async () => {
  const d = deps({ world: { view: () => viewWith({ ceremonies: [talking("root-open")] }) } });
  const out = await post(d, { episode: "564", done: LINE, lane: "K6", seat: "mino" });
  assert.equal(out.state, "fed");
  assert.equal(out.ceremony, "root-open");
  const turn = d.calls.find((c) => c.path.endsWith("/turns"));
  assert.equal(turn.path, "/api/ceremony/root-open/turns");
  assert.equal(turn.auth, "Bearer mino-token");
  assert.equal(turn.body.said, `${LINE}\nRelayed by Mino-Bimaadizi-Daa from lane K6.`);
  assert.equal(turn.body.title, "DONE · K6");
  assert.ok(d.calls.every((c) => c.auth !== "Bearer person-token"), "the person's token is never sent");
  const ledger = readFileSync(ledgerPath("mino", d.env), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(ledger[0].key, keyOf(EP, LINE));
  const again = await post(d, { episode: "564", done: LINE, lane: "K6", seat: "mino" });
  assert.equal(again.state, "already-fed");
  assert.equal(d.calls.filter((c) => c.path.endsWith("/turns")).length, 1);
});

test("the person's token, or an identity that is not an agent, is refused before anything is sent", async () => {
  const same = deps({ world: { view: () => viewWith({ ceremonies: [talking("root-open")] }) }, env: { MIADI_MINO_TOKEN: "person-token" } });
  await assert.rejects(post(same, { episode: "564", done: LINE }), (e) => e instanceof Refusal && e.code === 2 && /never speaks with the person's token/.test(e.message));
  assert.equal(same.calls.length, 0);
  const human = deps({ world: { me: { id: "p1", name: "Guillaume", being: "human" }, view: () => viewWith({ ceremonies: [talking("root-open")] }) } });
  await assert.rejects(post(human, { episode: "564", done: LINE }), /not as an agent/);
  assert.ok(!human.calls.some((c) => c.method === "POST"));
});

test("--dry-run reads the wheel and sends nothing", async () => {
  const d = deps({ world: { view: () => viewWith({ ceremonies: [talking("root-open")] }) } });
  const out = await post(d, { episode: "564", done: LINE, dryRun: true });
  assert.equal(out.state, "dry-run");
  assert.equal(out.ceremony, "root-open");
  assert.ok(!d.calls.some((c) => c.method === "POST"));
});

test("with no root circle: refused without --open; --open has the Factory open it with the writer token, then the seat speaks", async () => {
  const world = { opened: false };
  world.view = () => (world.opened ? viewWith({ ceremonies: [talking("cer-new")] }) : viewWith({ circle: null }));
  const d = deps({ world });
  await assert.rejects(post(d, { episode: "564", done: LINE }), (e) => e.code === 3 && /--open/.test(e.message));
  const dry = await post(d, { episode: "564", done: LINE, open: true, dryRun: true });
  assert.equal(dry.would_open.expect, "opens");
  assert.equal(world.opened, false);
  const out = await post(d, { episode: "564", done: LINE, open: true });
  assert.equal(out.state, "fed");
  assert.equal(out.ceremony, "cer-new");
  const door = d.calls.find((c) => c.path.endsWith("/circle") && !c.body.dryRun);
  assert.equal(door.auth, "Bearer writer-token");
  assert.deepEqual(door.body.spirits, ["Mino-Bimaadizi-Daa"]);
  assert.equal(d.calls.find((c) => c.path.endsWith("/turns")).auth, "Bearer mino-token");
});

test("the command line prints the dry run and refuses a line that is not DONE", async () => {
  const d = deps({ world: { view: () => viewWith({ ceremonies: [talking("root-open")] }) } });
  const text = await main(["post", "--episode", "564", "--done", LINE, "--lane", "K6", "--dry-run"], d);
  assert.match(text, /^dry run · nothing sent · 2026-10-26-episode-564/);
  assert.match(text, /Relayed by Mino-Bimaadizi-Daa from lane K6\./);
  await assert.rejects(main(["post", "--episode", "564", "--done", "finished"], d), /begins with DONE/);
  assert.equal(turnOf({ done: LINE, seatName: "Mino" }).said, `${LINE}\nRelayed by Mino.`);
});

test("diary writes the seat's entry with the seat's token, and a participant's with theirs, saying who wrote it", async () => {
  const world = { view: () => viewWith({ ceremonies: [talking("cer-root")] }) };
  const d = deps({ world, env: { MIADI_PERSON_TOKEN_GUILLAUME: "guillaume-token", MIADI_PERSON_TOKEN_MIETTE: "miette-token" } });
  const own = await diary(d, { episode: "564", entryType: "learning", content: "the seat learned this" });
  assert.equal(own.state, "written");
  assert.equal(own.ceremony, "cer-root");
  const posts = () => d.calls.filter((c) => c.method === "POST" && c.path === "/api/ceremony/cer-root/diary");
  assert.equal(posts()[0].auth, "Bearer mino-token");
  assert.deepEqual(posts()[0].body, { content: "the seat learned this", entryType: "learning" });

  await diary(d, { ceremony: "cer-root", for: "Guillaume", entryType: "reflection", phase: "ningwaab", content: '"I did not know" he said' });
  assert.equal(posts()[1].auth, "Bearer guillaume-token", "the participant's own variable comes first");
  assert.match(posts()[1].body.content, /^Written by Mino-Bimaadizi-Daa for Guillaume, from Guillaume's words in this session; the words in quotation marks are Guillaume's\./);
  assert.equal(posts()[1].body.phase, "ningwaab");

  await diary(d, { ceremony: "cer-root", for: "Miette", how: "in her voice, at Guillaume's request", entryType: "reflection", content: "what this changes" });
  assert.equal(posts()[2].auth, "Bearer miette-token", "an agent participant writes with her own token");
  assert.match(posts()[2].body.content, /^Written by Mino-Bimaadizi-Daa for Miette, in her voice, at Guillaume's request\./);

  assert.equal((await diary(d, { ceremony: "cer-root", for: "Guillaume", entryType: "reflection", phase: "ningwaab", content: '"I did not know" he said' })).state, "already-written");
});

test("diary falls back to MIADI_PERSON_TOKEN only when it answers to the name, and refuses otherwise", async () => {
  const world = { view: () => viewWith({ ceremonies: [talking("cer-root")] }) };
  const d = deps({ world });
  const fallback = await diary(d, { ceremony: "cer-root", for: "Guillaume", content: "x" });
  assert.equal(fallback.by_name, "Guillaume");
  assert.equal(d.calls.filter((c) => c.path.endsWith("/diary")).at(-1).auth, "Bearer person-token");
  await assert.rejects(diary(d, { ceremony: "cer-root", for: "Ava", content: "x" }), (e) => e instanceof Refusal && /no token answers to Ava: set MIADI_PERSON_TOKEN_AVA/.test(e.message));
  await assert.rejects(diary(d, { ceremony: "cer-root", how: "relayed", content: "x" }), (e) => e.code === 2);
  world.me = GUILLAUME;
  await assert.rejects(diary(d, { ceremony: "cer-root", content: "x" }), (e) => e instanceof Refusal && /not as an agent/.test(e.message));
  assert.equal(d.calls.filter((c) => c.path.endsWith("/diary")).length, 1, "nothing is written when a refusal fires");
});

test("a participant's token name is their name in capitals, and an entry already marked as written is kept", () => {
  assert.equal(tokenNameFor("Miette"), "MIADI_PERSON_TOKEN_MIETTE");
  assert.equal(tokenNameFor("Mino-Bimaadizi-Daa"), "MIADI_PERSON_TOKEN_MINO_BIMAADIZI_DAA");
  assert.equal(participantEntryOf({ content: "Written by Mino for Guillaume.\n\nx", seatName: "Mino", name: "Guillaume" }), "Written by Mino for Guillaume.\n\nx");
});
