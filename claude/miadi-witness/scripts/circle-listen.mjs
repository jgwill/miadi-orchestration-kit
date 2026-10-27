#!/usr/bin/env node
// circle-listen — wake the witness seat when a talking circle it sits in moves: a new turn, a new
// diary entry, a new Miadi review, or a new version of one. The seat's own turns and entries never wake it.
//
//   circle-listen.mjs await  --seat mino --ceremony <id>... [--reviews] [--review <id>]... [--interval <s>] [--timeout <s>]
//       --reviews wakes on a new review; --review <id> also wakes on a new version of that review,
//       so a person's edits to reviews the seat is not in conversation with do not wake it.
//   circle-listen.mjs peek   --seat mino --ceremony <id>... [--reviews]   what is waiting; marks nothing seen
//   circle-listen.mjs status --seat mino --ceremony <id>... [--reviews]
//   circle-listen.mjs mark   --seat mino --ceremony <id>... [--reviews]   mark everything there now as seen
//
// Run `mark` right after the seat relays William's words with his token: those turns carry his
// name, so nothing else tells the listener the seat wrote them.
//
// `await` blocks until something new arrives, prints a CIRCLE WAKE with the exact words, marks
// them seen, and exits 0. It has no deadline and a door that refuses does not end it, so a quiet
// circle costs the seat no tokens. Exit 4: a --timeout someone gave ran out, nothing new.
// Exit 5: another await already listens for this seat. Exit 2: usage, a missing token, or a door
// that answers 401, 403 or 404. Run it with run_in_background: true.
//
// The first read of a ceremony or of the review list is a baseline: what is already there is
// seen. Tokens are read from the environment, else from ~/.env, and never printed:
// MIADI_API_URL, MIADI_<SEAT>_TOKEN (the seat's own Miadi identity), MIADI_REVIEW_TOKEN.
// State: $WITNESS_STATE_DIR, else $XDG_STATE_HOME/miadi-witness/<seat>-circles.json.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { pendingRetellings } from "./give-back.mjs";
import { inventoryDir, readInventory } from "./inventory.mjs";

const SCRIPT = fileURLToPath(import.meta.url);
const GIVE_BACK = join(fileURLToPath(new URL(".", import.meta.url)), "give-back.mjs");
const REVIEW_BASE = process.env.MIADI_REVIEW_BASE_URL || "https://miadi-review-service.vercel.app";

function usage(msg) {
  if (msg) console.error(`circle-listen: ${msg}`);
  console.error("usage: circle-listen.mjs await|peek|status|mark --seat <seat> --ceremony <id>... [--reviews] [--interval <s>] [--timeout <s>]");
  process.exit(2);
}

function parseArgs(argv) {
  const a = { cmd: argv[0], seat: "mino", ceremonies: [], reviews: false, reviewIds: [], interval: 30, timeout: 0 };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--seat") a.seat = argv[++i];
    else if (k === "--ceremony") a.ceremonies.push(argv[++i]);
    else if (k === "--reviews") a.reviews = true;
    else if (k === "--review") { a.reviews = true; a.reviewIds.push(argv[++i]); }
    else if (k === "--interval") a.interval = Number(argv[++i]);
    else if (k === "--timeout") a.timeout = Number(argv[++i]);
    else usage(`unknown argument ${k}`);
  }
  if (!["await", "peek", "status", "mark"].includes(a.cmd)) usage();
  if (!a.ceremonies.length && !a.reviews) usage("name at least one --ceremony, or --reviews");
  return a;
}

function envValue(name) {
  if (process.env[name]) return process.env[name];
  const file = join(homedir(), ".env");
  if (!existsSync(file)) return "";
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(new RegExp(`^\\s*(?:export\\s+)?${name}=(.*)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

function stateFile(seat) {
  const dir = process.env.WITNESS_STATE_DIR || join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "miadi-witness");
  mkdirSync(dir, { recursive: true });
  return { file: join(dir, `${seat}-circles.json`), pid: join(dir, `${seat}-circles.pid`) };
}

function readState(file) {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return { ceremonies: {}, reviews: null }; }
}

function writeState(file, state) {
  writeFileSync(`${file}.tmp`, JSON.stringify(state, null, 2));
  renameSync(`${file}.tmp`, file);
}

async function getJson(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(`${url.replace(/\?.*/, "")} answered ${res.status} ${body.error || ""}`.trim());
  return body;
}

function parseMaybe(v) {
  if (typeof v !== "string") return v || {};
  try { return JSON.parse(v); } catch { return {}; }
}

// One read of everything watched. Returns the new items and the state they would make seen.
async function read(args, state) {
  const api = envValue("MIADI_API_URL");
  const seatToken = envValue(`MIADI_${args.seat.toUpperCase()}_TOKEN`);
  const events = [];
  const next = { ceremonies: { ...state.ceremonies }, reviews: state.reviews };
  for (const id of args.ceremonies) {
    if (!api || !seatToken) throw new Error(`MIADI_API_URL and MIADI_${args.seat.toUpperCase()}_TOKEN are needed to read a ceremony`);
    const c = await getJson(`${api}/api/ceremony/${encodeURIComponent(id)}`, seatToken);
    const me = c.me?.id;
    const intention = [].concat(c.ceremony?.intention || c.ceremony?.intentions || [])[0] || "";
    const turns = c.turns || [];
    const diary = c.diary || [];
    const seen = state.ceremonies[id];
    next.ceremonies[id] = { turns: turns.map((t) => t.id), diary: diary.map((d) => d.id), closed: !!c.closed };
    if (!seen) continue; // baseline
    for (const t of turns) {
      if (seen.turns.includes(t.id) || t.speaker === me) continue;
      events.push({ kind: "TURN", id: t.id, ceremony: id, intention, who: t.speaker_name || t.speaker, at: t.timestamp, words: t.prose || t.description || "" });
    }
    for (const d of diary) {
      const meta = parseMaybe(d.metadata);
      if (seen.diary.includes(d.id) || d.participant === me) continue;
      events.push({ kind: "DIARY", ceremony: id, intention, who: meta.participant_name || d.participant, at: d.timestamp, words: `[${d.phase || ""} · ${d.entryType || ""}] ${d.content || ""}` });
    }
    if (c.closed && !seen.closed) events.push({ kind: "CLOSED", ceremony: id, intention, who: "", at: "", words: "The ceremony was closed." });
  }
  if (args.reviews) {
    const token = envValue("MIADI_REVIEW_TOKEN");
    if (!token) throw new Error("MIADI_REVIEW_TOKEN is needed to read the review list");
    const list = (await getJson(`${REVIEW_BASE}/api/reviews?limit=25&offset=0`, token)).reviews || [];
    // id -> latest_version. An array is the 0.1 state (ids only): versions start being tracked now.
    const before = Array.isArray(state.reviews) ? Object.fromEntries(state.reviews.map((id) => [id, null])) : state.reviews;
    const after = { ...(before || {}) };
    // Reviews created before this moment are history, whatever list window they enter later.
    const since = state.reviewsSince || new Date().toISOString();
    for (const r of list) after[r.id] = r.latest_version ?? 0;
    if (before) {
      for (const r of list) {
        const url = `${REVIEW_BASE}/review/${r.id}`;
        if (!(r.id in before)) {
          // An old review that moved into the recent list (an edit, a new version) is not new.
          if (r.created_at && r.created_at <= since) continue;
          events.push({ kind: "REVIEW", ceremony: "", intention: "", who: "", at: r.created_at || "", words: `${r.title || "Untitled review"} · ${url}` });
        } else if (args.reviewIds.includes(r.id) && before[r.id] != null && (r.latest_version ?? 0) > before[r.id]) {
          // A person can write a version by hand. Their words are what the seat needs, so the
          // wake carries the lines the new version added.
          const added = await addedLines(r.id, before[r.id], token).catch((err) => `(could not read the versions: ${err.message})`);
          events.push({ kind: "REVIEW VERSION", ceremony: "", intention: "", who: "", at: r.updated_at || "", words: `${r.title} · version ${before[r.id]} → ${r.latest_version} · ${url}\nLines added since version ${before[r.id]}:\n${added}` });
        }
      }
    }
    next.reviews = Object.fromEntries(Object.entries(after).slice(-300));
    next.reviewsSince = since;
  }
  return { events, next };
}

async function addedLines(id, fromVersion, token) {
  const review = await getJson(`${REVIEW_BASE}/api/reviews/${encodeURIComponent(id)}`, token);
  const versions = review.versions || [];
  const latest = versions.reduce((a, v) => (!a || v.version > a.version ? v : a), null);
  const old = versions.find((v) => v.version === fromVersion);
  if (!latest) return "(no version text)";
  const seen = new Set((old?.markdown || "").split("\n").map((l) => l.trim()));
  const lines = latest.markdown.split("\n").filter((l) => l.trim() && !seen.has(l.trim()));
  return lines.length > 150 ? `${lines.slice(0, 150).join("\n")}\n… ${lines.length - 150} more lines` : lines.join("\n") || "(no new lines)";
}

function rearmCommand(args) {
  const parts = [`node "${SCRIPT}" await --seat ${args.seat}`];
  for (const c of args.ceremonies) parts.push(`--ceremony ${c}`);
  if (args.reviews) parts.push("--reviews");
  for (const id of args.reviewIds) parts.push(`--review ${id}`);
  return parts.join(" ");
}

// A turn in a ceremony where a retelling waits for an answer may be that answer (P1, P7).
function answersFor(event) {
  if (event.kind !== "TURN") return [];
  try {
    const inv = readInventory(inventoryDir());
    // Only a turn spoken after the account was given back can answer it.
    // Only the person an account was given to can answer it, and only after it was given.
    const person = (r) => r.for ?? (process.env.WITNESS_PERSON || "Guillaume");
    return pendingRetellings([...inv.byId.values()], event.ceremony)
      .filter((r) => (!event.at || !r.at || event.at > r.at) && event.who === person(r));
  } catch {
    return [];
  }
}

function printWake(args, events) {
  console.log(`CIRCLE WAKE · seat ${args.seat} · ${events.length} event${events.length === 1 ? "" : "s"} · ${new Date().toISOString()}\n`);
  events.forEach((e, i) => {
    const where = e.ceremony ? ` · ceremony ${e.ceremony} (${e.intention.slice(0, 90)})` : "";
    console.log(`${i + 1}. ${e.kind}${where}${e.who ? ` · ${e.who}` : ""}${e.at ? ` · ${e.at}` : ""}`);
    console.log(`Exact words:\n${e.words}\n`);
    for (const r of answersFor(e)) {
      console.log(`May answer: retelling ${r.turn_id} (session ${r.session_id}, ${r.kind}, given back ${r.at}). Record it with:`);
      console.log(`  node "${GIVE_BACK}" answer --session ${r.session_id} --turn ${e.id} --retelling ${r.turn_id} --verdict confirm|correct\n`);
    }
  });
  console.log("Turn budget (circle-listen):");
  console.log("1. Read the words above. They are the feedback the seat asked for.");
  console.log("2. For each event decide: act on the work this circle holds, answer in the circle with the seat's own token, or bring it to William with a recommendation.");
  console.log("3. A new REVIEW of a screenwalk: confirm his voice with transcribe-video.mjs, attach it to its episode, read it for what needs continuity.");
  console.log("4. Move the chart in the same turn as the work.");
  console.log(`5. Re-arm in the background: ${rearmCommand(args)}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { file, pid } = stateFile(args.seat);
  let state = readState(file);

  if (args.cmd === "mark") {
    const { events, next } = await read(args, state);
    writeState(file, next);
    console.log(`circle-listen: marked seen for seat ${args.seat}: ${events.length} waiting event${events.length === 1 ? "" : "s"}${events.length ? ` (${events.map((e) => `${e.kind}${e.who ? ` ${e.who}` : ""}`).join(", ")})` : ""}`);
    return;
  }

  if (args.cmd !== "await") {
    const { events, next } = await read(args, state);
    const listening = existsSync(pid) && alive(Number(readFileSync(pid, "utf8")));
    console.log(`circle-listen · seat ${args.seat} · state ${file}`);
    console.log(`watching: ${args.ceremonies.join(", ") || "no ceremony"}${args.reviews ? " + reviews" : ""}`);
    console.log(`listening now: ${listening ? `yes (pid ${readFileSync(pid, "utf8").trim()})` : "no"}`);
    const baselines = args.ceremonies.filter((c) => !state.ceremonies[c]);
    if (baselines.length || (args.reviews && !state.reviews)) console.log(`not yet baselined: ${[...baselines, ...(args.reviews && !state.reviews ? ["reviews"] : [])].join(", ")}`);
    console.log(events.length ? `waiting: ${events.map((e) => `${e.kind}${e.who ? ` ${e.who}` : ""}`).join(", ")}` : "waiting: nothing");
    if (args.cmd === "peek") events.forEach((e) => console.log(`\n${e.kind} · ${e.who || ""}\n${e.words}`));
    void next;
    return;
  }

  if (existsSync(pid) && alive(Number(readFileSync(pid, "utf8")))) {
    console.error(`circle-listen: pid ${readFileSync(pid, "utf8").trim()} already listens for seat ${args.seat}`);
    process.exit(5);
  }
  writeFileSync(pid, String(process.pid));
  const release = () => { try { if (readFileSync(pid, "utf8").trim() === String(process.pid)) rmSync(pid); } catch {} };
  process.on("exit", release);
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(130));

  console.log(`circle-listen: listening for seat ${args.seat}`);
  // No deadline unless --timeout names seconds: a wake with nothing new makes the seat read its
  // whole context again from an expired cache, only to re-arm (2026-10-27, Episode 560's seat).
  const deadline = args.timeout > 0 ? Date.now() + args.timeout * 1000 : Infinity;
  let failures = 0;
  let lastError = "";
  for (;;) {
    // Re-read the state each poll: `mark`, run by the seat after it relays words, writes the
    // same file, and a listener holding its state in memory would wake on the relay anyway.
    state = readState(file);
    let result;
    try {
      result = await read(args, state);
      if (failures) console.error(`circle-listen: the door answers again after ${failures} failed poll${failures === 1 ? "" : "s"}`);
      failures = 0;
      lastError = "";
    } catch (err) {
      // A door that fails is not the end of the watch: a 502 while the wheel's tunnel is down, or
      // a production rebuild of the app (about ten minutes, measured 2026-10-06). The seat can do
      // nothing about it, so it is not woken. A new message is logged once, not every poll.
      // A missing token, or a door that refuses this seat or does not know the ceremony, will not
      // heal while the seat sleeps: that ends the watch at once, exit 2.
      if (/ needed to read|answered 40[134]\b/.test(err.message)) {
        console.error(`circle-listen: ${err.message}`);
        process.exit(2);
      }
      failures += 1;
      if (err.message !== lastError) console.error(`circle-listen: ${err.message} (poll ${failures} in a row), still listening`);
      lastError = err.message;
      await new Promise((r) => setTimeout(r, args.interval * 1000));
      continue;
    }
    state = result.next;
    if (result.events.length) {
      writeState(file, state);
      printWake(args, result.events);
      process.exit(0);
    }
    writeState(file, state);
    if (Date.now() >= deadline) {
      console.log(`circle-listen: timeout after ${args.timeout}s, nothing new. Re-arm: ${rearmCommand(args)}`);
      process.exit(4);
    }
    await new Promise((r) => setTimeout(r, args.interval * 1000));
  }
}

function alive(p) {
  if (!p) return false;
  try { process.kill(p, 0); return true; } catch { return false; }
}

main().catch((err) => { console.error(`circle-listen: ${err.message}`); process.exit(2); });
