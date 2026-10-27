// node --test claude/miadi-witness/scripts/circle-feed.test.mjs
// A stand-in for the Miadi API; nothing leaves the host.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { doneLineOf, keyOf, ledgerPath, main, post, Refusal, rootCeremonyOf, turnOf } from "./circle-feed.mjs";

const EP = "2026-10-26-episode-564-jev-decides-with-the-factory";
const MINO = { id: "node:agent:1", name: "Mino-Bimaadizi-Daa", role: "participant", being: "agent" };
const CIRCLE = "circle:main-564";

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
      if (path === "/api/identity/me") return reply(200, { person: world.me ?? MINO });
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
