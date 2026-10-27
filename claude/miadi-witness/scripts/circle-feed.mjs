#!/usr/bin/env node
// circle-feed — a DONE line the seat relays becomes a turn in the episode's root circle, spoken
// by the seat with its own token. William, 2026-10-26 (N5): "Automatically creating circles for
// episodes and having something getting there". Since jgwill/Miadi 73e0d7aa an episode's root
// circle opens without a person, so a lane's DONE line has a place to land.
//
//   circle-feed.mjs post  --episode <ref> --done "<DONE line>" [--done-file F|-] [--lane <code>]
//                         [--mission <id>] [--seat mino] [--open] [--again] [--dry-run]
//   circle-feed.mjs where --episode <ref> [--seat mino]
//
// post   finds the root circle's open ceremony through GET /api/chronicle/episodes/<ref>/wheel
//        and speaks the line through POST /api/ceremony/<id>/turns. Only a line that begins
//        with DONE is fed. The same line on the same episode is fed once (--again to repeat).
//        --open: when the episode has no root circle the seat sits in, open it through
//        POST /api/chronicle/episodes/<ref>/circle with the writer token (the Factory opens it
//        for the episode's author and seats the seat as an agent-spirit), then speak.
//        --dry-run reads the wheel and prints the turn and where it would go; it writes nothing.
// where  prints the root circle and ceremony the seat would speak in.
//
// The seat speaks with MIADI_<SEAT>_TOKEN and nothing else. A token that is the person's
// (MIADI_PERSON_TOKEN), or an identity that is not an agent, is refused before anything is sent.
// Tokens and MIADI_API_URL come from the environment, else from ~/.env, and are never printed.
// Ledger of fed lines: $WITNESS_STATE_DIR, else $XDG_STATE_HOME/miadi-witness/<seat>-circle-feed.jsonl.
// Exit 0 fed (or already fed), 2 usage or refusal, 3 no root circle to speak in, 4 a door refused.

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);

export class Refusal extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function envValue(name, env = process.env, file = join(homedir(), ".env")) {
  if (env[name]) return env[name];
  if (!file || !existsSync(file)) return "";
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(new RegExp(`^\\s*(?:export\\s+)?${name}=(.*)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

// The DONE line in what the lane returned: the first line that begins with DONE, without the
// list mark or the backticks a report may put around it.
export function doneLineOf(text) {
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.trim().replace(/^[-*>]\s+/, "").replace(/^`+|`+$/g, "").trim();
    if (/^DONE\b/.test(line)) return line;
  }
  return null;
}

// The root circle's open talking circle, as GET …/wheel shows it to the seat: the earliest
// talking_circle held in the main circle that no closing names, the one about the episode first.
export function rootCeremonyOf(view) {
  const circleId = view?.main?.circle_id ?? (view?.circles ?? []).find((c) => c.main && !c.gone)?.id ?? null;
  if (!circleId) return null;
  const records = view.ceremonies ?? [];
  const closed = new Set(records.map((r) => r.closes).filter(Boolean));
  const subject = view.episode?.path ? `chronicle:${view.episode.path}` : null;
  const open = records
    .filter((r) => r.type === "talking_circle" && r.circle_id === circleId && !r.closes && !closed.has(r.id))
    .sort((a, b) => Number(b.subject_id === subject) - Number(a.subject_id === subject)
      || String(a.timestamp ?? "").localeCompare(String(b.timestamp ?? "")) || a.id.localeCompare(b.id));
  if (!open.length) return null;
  const circle = (view.circles ?? []).find((c) => c.id === circleId);
  return { ceremony: open[0], circle: { id: circleId, name: circle?.name ?? null } };
}

export function turnOf({ done, lane, mission, seatName }) {
  const from = [lane ? `lane ${lane}` : null, mission ? `mission ${mission}` : null].filter(Boolean).join(", ");
  const said = `${done}\nRelayed by ${seatName}${from ? ` from ${from}` : ""}.`;
  return { said, title: `DONE${lane ? ` · ${lane}` : ""}`.slice(0, 120) };
}

export const keyOf = (episodePath, done) => createHash("sha256").update(`${episodePath}\n${done}`).digest("hex").slice(0, 24);

export function ledgerPath(seat, env = process.env) {
  const dir = env.WITNESS_STATE_DIR || join(env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "miadi-witness");
  return join(dir, `${seat}-circle-feed.jsonl`);
}

function readLedger(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

async function call(deps, method, path, token, body) {
  const api = deps.api.replace(/\/$/, "");
  const res = await deps.fetch(`${api}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok && !json.error, body: json };
}

// The seat's identity, checked before anything is sent: its own token, an agent.
export async function seatIdentity(deps, seat) {
  const name = `MIADI_${seat.toUpperCase()}_TOKEN`;
  const token = deps.envValue(name);
  if (!deps.api) throw new Refusal(2, "MIADI_API_URL is needed");
  if (!token) throw new Refusal(2, `${name} is needed: the seat speaks with its own token`);
  const person = deps.envValue("MIADI_PERSON_TOKEN");
  if (person && token === person) throw new Refusal(2, `${name} is the same token as MIADI_PERSON_TOKEN; the seat never speaks with the person's token`);
  const me = await call(deps, "GET", "/api/identity/me", token);
  if (!me.ok) throw new Refusal(4, `/api/identity/me answered ${me.status} ${me.body.error ?? ""}`.trim());
  const p = me.body.person ?? {};
  if (p.being && p.being !== "agent") throw new Refusal(2, `${name} speaks as ${p.name} (${p.being}), not as an agent; refused`);
  return { token, id: p.id, name: p.name ?? seat };
}

export async function where(deps, { episode, seat }) {
  const me = await seatIdentity(deps, seat);
  const wheel = await call(deps, "GET", `/api/chronicle/episodes/${encodeURIComponent(episode)}/wheel`, me.token);
  if (!wheel.ok) throw new Refusal(4, `the episode's wheel answered ${wheel.status} ${wheel.body.error ?? ""}`.trim());
  return { me, view: wheel.body, root: rootCeremonyOf(wheel.body) };
}

export async function post(deps, opts) {
  const seat = opts.seat ?? "mino";
  const done = doneLineOf(opts.done);
  if (!opts.episode) throw new Refusal(2, "post needs --episode <number or folder name>");
  if (!done) throw new Refusal(2, "post feeds a DONE line: a line that begins with DONE");
  let { me, view, root } = await where(deps, { episode: opts.episode, seat });
  const episodePath = view.episode?.path ?? String(opts.episode);
  const turn = turnOf({ done, lane: opts.lane, mission: opts.mission, seatName: me.name });
  const key = keyOf(episodePath, done);
  const ledger = ledgerPath(seat, deps.env);
  const before = readLedger(ledger).find((r) => r.key === key);
  if (before && !opts.again) return { state: "already-fed", episode: episodePath, turn_id: before.turn_id, ceremony: before.ceremony, said: turn.said };

  let opened = null;
  if (!root) {
    if (!opts.open) throw new Refusal(3, `episode ${episodePath} has no root circle ${me.name} sits in; run with --open to have the Factory open it and seat ${me.name}`);
    const writer = deps.envValue("MIADI_API_TOKEN_WRITER");
    if (!writer) throw new Refusal(2, "--open needs MIADI_API_TOKEN_WRITER: the Factory opens the root circle with the writer token");
    const door = await call(deps, "POST", `/api/chronicle/episodes/${encodeURIComponent(episodePath)}/circle`, writer, { spirits: [me.name], ...(opts.dryRun ? { dryRun: true } : {}) });
    if (!door.ok) throw new Refusal(4, `the circle door answered ${door.status} ${door.body.error ?? door.body.message ?? ""}`.trim());
    if (opts.dryRun) return { state: "dry-run", episode: episodePath, would_open: door.body, said: turn.said, title: turn.title };
    opened = door.body.mainCircle ?? null;
    if (opened?.state === "owed") throw new Refusal(3, `the circle door owes the circle: ${opened.reason}`);
    ({ view, root } = await where(deps, { episode: episodePath, seat }));
    if (!root) throw new Refusal(3, `the circle door answered ${opened?.state ?? "?"} but ${me.name} still sees no open root ceremony`);
  }
  if (opts.dryRun) return { state: "dry-run", episode: episodePath, ceremony: root.ceremony.id, circle: root.circle, said: turn.said, title: turn.title };

  const spoken = await call(deps, "POST", `/api/ceremony/${encodeURIComponent(root.ceremony.id)}/turns`, me.token, turn);
  if (!spoken.ok || !spoken.body.turn?.id) throw new Refusal(4, `the circle refused the turn (${spoken.status} ${spoken.body.error ?? ""})`.trim());
  const record = { at: deps.now().toISOString(), key, episode: episodePath, circle: root.circle.id, ceremony: root.ceremony.id, turn_id: spoken.body.turn.id, speaker: me.id, lane: opts.lane ?? null, mission: opts.mission ?? null, done, opened: opened ? opened.state : null };
  mkdirSync(dirname(ledger), { recursive: true });
  appendFileSync(ledger, `${JSON.stringify(record)}\n`);
  return { state: "fed", ...record, circle_name: root.circle.name };
}

function parseArgs(argv) {
  const a = { _: [], seat: "mino" };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === "--episode") a.episode = v();
    else if (k === "--done") a.done = v();
    else if (k === "--done-file") a.doneFile = v();
    else if (k === "--lane") a.lane = v();
    else if (k === "--mission") a.mission = v();
    else if (k === "--seat") a.seat = v();
    else if (k === "--open") a.open = true;
    else if (k === "--again") a.again = true;
    else if (k === "--dry-run") a.dryRun = true;
    else if (k.startsWith("--")) throw new Refusal(2, `unknown flag ${k}`);
    else a._.push(k);
  }
  return a;
}

export const defaultDeps = (env = process.env) => ({
  env,
  api: envValue("MIADI_API_URL", env),
  envValue: (name) => envValue(name, env),
  fetch: globalThis.fetch,
  now: () => new Date(),
});

const USAGE = `usage: circle-feed.mjs post --episode <ref> --done "<DONE line>" [--done-file F|-] [--lane <code>] [--mission <id>] [--seat mino] [--open] [--again] [--dry-run]
       circle-feed.mjs where --episode <ref> [--seat mino]`;

export async function main(argv, deps = defaultDeps()) {
  const a = parseArgs(argv);
  const cmd = a._[0];
  if (cmd === "where") {
    if (!a.episode) throw new Refusal(2, USAGE);
    const { me, view, root } = await where(deps, { episode: a.episode, seat: a.seat });
    return root
      ? `${view.episode?.path ?? a.episode} · root circle ${root.circle.name ?? root.circle.id} (${root.circle.id}) · ceremony ${root.ceremony.id} · ${me.name} speaks there`
      : `${view.episode?.path ?? a.episode} · no root circle ${me.name} sits in (post --open opens it)`;
  }
  if (cmd !== "post") throw new Refusal(2, USAGE);
  const done = a.doneFile ? readFileSync(a.doneFile === "-" ? 0 : a.doneFile, "utf8") : a.done;
  const out = await post(deps, { ...a, done });
  if (out.state === "already-fed") return `already fed · turn ${out.turn_id} · ceremony ${out.ceremony} · ${out.episode} (--again to speak it again)`;
  if (out.state === "dry-run") {
    const to = out.ceremony ? `ceremony ${out.ceremony} in ${out.circle?.name ?? out.circle?.id}` : `the root circle the door would open (${out.would_open?.expect ?? "?"}${out.would_open?.as ? ` as ${out.would_open.as}` : ""}: ${out.would_open?.name ?? ""})`;
    return `dry run · nothing sent · ${out.episode} · ${to}\ntitle: ${out.title}\nsaid:\n${out.said}`;
  }
  return `fed · turn ${out.turn_id} · ceremony ${out.ceremony} · ${out.circle_name ?? out.circle}${out.opened ? ` (root circle ${out.opened})` : ""} · ${out.episode}`;
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT) {
  main(process.argv.slice(2)).then(
    (text) => { console.log(text); },
    (err) => { console.error(`circle-feed: ${err.message}`); process.exitCode = err instanceof Refusal ? err.code : 1; },
  );
}
