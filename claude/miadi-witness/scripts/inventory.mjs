#!/usr/bin/env node
// inventory — the facts half of the session inventory. For each session it reads the latest
// binding line and the hook capture, and writes or updates the record keyed by session id in
// ~/workspace/.mino/session-inventory/ (SCHEMA.md there). The inventory-keeper agent adds the
// meaning; this script never touches the fields an agent wrote.
//
//   inventory.mjs plan  [--session <id>]...           what it would write (the default; writes nothing)
//   inventory.mjs write --session <id>... | --all      write those records
//   inventory.mjs verify-names <tmux name>...          which session each name held, and on what evidence
//   inventory.mjs link --session <id> --kind <kind> --ref <ref> [--note <n>] [--by <who>]
//                                                      add a reference to one of the five links
//   inventory.mjs links --session <id>... [--check]    the five links, empty ones included;
//                                                      --check verifies commits and writes the result
//
// The five links (links-lib.mjs): question, trace, evidence, criteria, judgment. The script
// fills question from the hook capture, and evidence with the Miadi reviews the session is named
// after (review-<yymmdd>-<id>) or that a person's prompt names; the rest are added with `link`. `--kind derived_from`
// sets the parent session of a fork or a resume.
//
// A name is verified by a binding line whose tmux session is that name, or by a pane reading
// in the seat's own transcripts: a command aimed at exactly that tmux session whose output
// prints `--resume <session id>`. Anything else is unverified, and nothing is written for it.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultPaths, lastWilliamInput, readBindings } from "../service/threads.mjs";
import { transcriptDirForCwd } from "../service/lineage.mjs";
import { LINK_KINDS, addLink, checkRef, emptyLinks, firstInput, linkGaps, personPrompts, reviewPage, reviewsNamed } from "./links-lib.mjs";

const SCRIPT = fileURLToPath(import.meta.url);
const BY = "inventory-keeper (miadi-witness scripts/inventory.mjs)";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FACT_KEYS = ["binding", "hook_capture"];
const FILL_KEYS = ["tmux_session_name", "claude_session_name", "cwd", "repo", "team"];

export function inventoryDir(env = process.env) {
  return env.WITNESS_INVENTORY_DIR || join(homedir(), "workspace", ".mino", "session-inventory");
}

// ---------- the inventory as it is ----------

export function readInventory(dir = inventoryDir()) {
  const byId = new Map();
  const hygiene = [];
  if (!existsSync(dir)) return { byId, hygiene };
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
    let record;
    try {
      record = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch (error) {
      hygiene.push({ file, finding: `not valid JSON: ${error.message.split("\n")[0]}` });
      continue;
    }
    const id = record.session_id;
    if (!id || !UUID.test(id)) {
      hygiene.push({ file, finding: `session_id is ${id ? `"${String(id).slice(0, 60)}"` : "missing"}, not a session id`, tmux: record.tmux_session_name ?? null });
      continue;
    }
    if (file !== `${id}.json` && !file.startsWith("ONGOING-")) hygiene.push({ file, finding: `named by something other than its session id ${id}` });
    if (byId.has(id)) {
      hygiene.push({ file, finding: `second record for session ${id} (first: ${byId.get(id).file})` });
      continue;
    }
    byId.set(id, { file, record });
  }
  return { byId, hygiene };
}

// ---------- facts from the binding line and the hook capture ----------

function countLines(path) {
  try {
    const text = readFileSync(path, "utf8");
    return text ? text.split("\n").filter(Boolean).length : 0;
  } catch {
    return 0;
  }
}

function repoOf(cwd) {
  if (!cwd || !existsSync(cwd)) return null;
  try {
    const url = execFileSync("git", ["-C", cwd, "remote", "get-url", "origin"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const match = url.match(/[:/]([^/:]+\/[^/]+?)(\.git)?$/);
    return match ? match[1] : url;
  } catch {
    return null;
  }
}

export function isHeadless(argv) {
  return Array.isArray(argv) && argv.some((arg) => arg === "-p" || arg === "--print");
}

export function sessionsFromBindings(lines) {
  const sessions = new Map();
  for (const line of lines) {
    if (!line?.session_id || !UUID.test(line.session_id) || (line.agent && line.agent !== "claude")) continue;
    const entry = sessions.get(line.session_id) ?? { first: line, latest: line, names: [], ended: false };
    entry.latest = line;
    for (const name of [...(line.name?.former ?? []).map((f) => (typeof f === "string" ? f : f?.name)), line.name?.name]) {
      if (name && !entry.names.includes(name)) entry.names.push(name);
    }
    entry.ended = line.event === "session.end";
    // A `claude -p` / `--print` run in a pane is a headless child (an editor pass, a PDE
    // call), never the pane's occupant, though its binding line carries the pane's name.
    entry.headless = entry.headless || isHeadless(line.argv);
    sessions.set(line.session_id, entry);
  }
  return sessions;
}

export function factsFor(sessionId, entry, sessiondata) {
  const line = entry.latest;
  const dir = join(sessiondata, sessionId);
  const capture = existsSync(dir)
    ? {
      dir,
      user_inputs: countLines(join(dir, "_claude_user_inputs.jsonl")),
      tool_uses: countLines(join(dir, "_claude_PreToolUse.jsonl")),
      session_end_captured: existsSync(join(dir, "_claude_SessionEnd.jsonl")),
      last_input: lastWilliamInput(sessiondata, sessionId, { maxChars: 300 })?.text ?? null,
    }
    : { dir, missing: true };
  const first = existsSync(dir) ? firstInput(sessiondata, sessionId) : null;
  const reviews = reviewsNamed({
    names: [line.tmux?.session, ...entry.names],
    prompts: existsSync(dir) ? personPrompts(sessiondata, sessionId) : [],
  });
  return {
    session_id: sessionId,
    tmux_session_name: line.tmux?.session ?? null,
    claude_session_name: line.name?.name ?? null,
    cwd: entry.first.cwd ?? line.cwd ?? null,
    repo: repoOf(entry.first.cwd ?? line.cwd),
    team: line.team?.id ?? null,
    date: String(entry.first.at ?? "").slice(0, 10) || null,
    ended: entry.ended,
    binding: {
      at: line.at ?? null,
      event: line.event ?? null,
      source: line.source ?? "",
      launch_alias: line.launch_alias ?? null,
      tmux: line.tmux ? { session: line.tmux.session ?? null, pane_id: line.tmux.pane_id ?? null } : null,
      names: entry.names,
      team: line.team ?? null,
    },
    hook_capture: capture,
    first_input: first,
    reviews,
  };
}

// The question link is a fact of the hook capture, so the script fills it when it is empty.
function fillQuestion(record, facts, now, changes) {
  if (!facts.first_input) return;
  if (record.links?.question?.length) return;
  addLink(record, "question", facts.first_input.ref, { note: facts.first_input.text, by: BY, now });
  changes.push("question link filled");
}

// A review the session was started from, or that a person handed it, is evidence of what it
// worked from. Its page is added once; an entry already there is never changed.
function fillEvidence(record, facts, now, changes) {
  let added = 0;
  for (const review of facts.reviews ?? []) {
    if (addLink(record, "evidence", reviewPage(review.id), { note: `Miadi review, ${review.where}`, by: BY, now })) added += 1;
  }
  if (added) changes.push(`evidence link${added > 1 ? "s" : ""} to ${added} review${added > 1 ? "s" : ""}`);
}

// ---------- the plan ----------

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function planFor(facts, existing, now = new Date().toISOString()) {
  if (!existing) {
    const record = {
      version: "1.0.0",
      session_id: facts.session_id,
      tmux_session_name: facts.tmux_session_name,
      claude_session_name: facts.claude_session_name,
      date: facts.date,
      status: facts.ended ? "unreviewed" : "in_progress",
      cwd: facts.cwd,
      repo: facts.repo,
      team: facts.team,
      binding: facts.binding,
      hook_capture: facts.hook_capture,
      links: emptyLinks(),
      observations: [{ at: now, by: BY, what: "Record created from the binding line and the hook capture. No agent has read the session yet." }],
      metadata: { created_by: BY, closed_by: null, notes: "" },
    };
    fillQuestion(record, facts, now, []);
    fillEvidence(record, facts, now, []);
    return { action: "create", file: `${facts.session_id}.json`, changes: ["new record"], record };
  }
  const record = structuredClone(existing.record);
  const changes = [];
  for (const key of FILL_KEYS) {
    if ((record[key] === undefined || record[key] === null) && facts[key] !== null && facts[key] !== undefined) {
      record[key] = facts[key];
      changes.push(`${key} filled`);
    }
  }
  for (const key of FACT_KEYS) {
    if (!same(record[key], facts[key])) {
      record[key] = facts[key];
      changes.push(`${key} ${existing.record[key] ? "refreshed" : "added"}`);
    }
  }
  fillQuestion(record, facts, now, changes);
  fillEvidence(record, facts, now, changes);
  if (!changes.length) return { action: "unchanged", file: existing.file, changes, record };
  record.observations = [...(record.observations ?? []), { at: now, by: BY, what: `Facts updated from the binding line and the hook capture: ${changes.join(", ")}.` }];
  return { action: "update", file: existing.file, changes, record };
}

// ---------- names ----------

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Every tool call in the seat's transcripts whose command is aimed at exactly this tmux
// session and whose output prints `--resume <uuid>`.
export function paneReadings(name, transcriptsDir) {
  if (!transcriptsDir || !existsSync(transcriptsDir)) return [];
  const aimed = new RegExp(`-t\\s+(['"]?)${escapeRegExp(name)}\\1(?=[\\s:.'"]|$)`);
  const readings = [];
  for (const file of readdirSync(transcriptsDir).filter((f) => f.endsWith(".jsonl"))) {
    const commands = new Map();
    for (const raw of readFileSync(join(transcriptsDir, file), "utf8").split("\n")) {
      if (!raw.includes(name) && !raw.includes("--resume")) continue;
      let record;
      try {
        record = JSON.parse(raw);
      } catch {
        continue;
      }
      const content = record.message?.content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (part?.type === "tool_use" && typeof part.input?.command === "string" && aimed.test(part.input.command)) {
          commands.set(part.id, part.input.command);
        } else if (part?.type === "tool_result" && commands.has(part.tool_use_id)) {
          const output = typeof part.content === "string" ? part.content : JSON.stringify(part.content);
          const ids = [...new Set([...output.matchAll(/--resume\s+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/g)].map((m) => m[1]))];
          if (ids.length) readings.push({ at: record.timestamp ?? null, transcript: file.replace(/\.jsonl$/, ""), ids });
        }
      }
    }
  }
  return readings.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

export function verifyName(name, { sessions, transcriptsDir, inventory }) {
  const bound = [...sessions.entries()].filter(([, entry]) => !entry.headless && (entry.latest.tmux?.session === name || entry.first.tmux?.session === name));
  let verdict;
  if (bound.length === 1) {
    verdict = { verified: true, session_id: bound[0][0], basis: `binding line at ${bound[0][1].latest.at}` };
  } else {
    const readings = paneReadings(name, transcriptsDir);
    const ids = [...new Set(readings.flatMap((reading) => reading.ids))];
    if (ids.length === 1) {
      const first = readings[0];
      verdict = { verified: true, session_id: ids[0], basis: `pane reading at ${first.at} in the seat's transcript ${first.transcript} (${readings.length} reading${readings.length === 1 ? "" : "s"})` };
    } else if (bound.length > 1 || ids.length > 1) {
      verdict = { verified: false, basis: `ambiguous: ${[...new Set([...bound.map(([id]) => id), ...ids])].join(", ")}` };
    } else {
      verdict = { verified: false, basis: "no binding line and no pane reading names a session for it" };
    }
  }
  const records = [...inventory.byId.values()].filter(({ record }) => record.tmux_session_name === name);
  const unkeyed = inventory.hygiene.filter((finding) => finding.tmux === name);
  let record;
  if (!verdict.verified) record = records.length ? `records exist (${records.map((r) => r.file).join(", ")}) but the name is unverified` : "no record";
  else if (inventory.byId.has(verdict.session_id)) {
    const { file, record: held } = inventory.byId.get(verdict.session_id);
    record = held.tmux_session_name === name ? `${file} holds it` : `${file} holds this session under tmux name "${held.tmux_session_name}"`;
  } else record = records.length ? `no record for ${verdict.session_id}; ${records.map((r) => `${r.file} holds ${r.record.session_id}`).join(", ")}` : `no record for ${verdict.session_id}`;
  if (unkeyed.length) record += `; unkeyed: ${unkeyed.map((u) => u.file).join(", ")}`;
  return { name, ...verdict, record };
}

// ---------- commands ----------

function writeRecord(dir, plan) {
  const path = join(dir, plan.file);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(plan.record, null, 2)}\n`);
  renameSync(tmp, path);
  return path;
}

function parseArgs(argv) {
  const args = { _: [], sessions: [], all: false, json: false, seat: "mino", check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--session") args.sessions.push(argv[++i]);
    else if (arg === "--all") args.all = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--seat") args.seat = argv[++i];
    else if (arg === "--kind") args.kind = argv[++i];
    else if (arg === "--ref") args.ref = argv[++i];
    else if (arg === "--note") args.note = argv[++i];
    else if (arg === "--by") args.by = argv[++i];
    else if (arg === "--check") args.check = true;
    else if (arg === "-h" || arg === "--help") args.help = true;
    else args._.push(arg);
  }
  return args;
}

function seatTranscripts(paths, seatId) {
  try {
    const seats = JSON.parse(readFileSync(paths.seats, "utf8"));
    const seat = (seats.seats ?? []).find((candidate) => candidate.id === seatId);
    return seat?.folder ? transcriptDirForCwd(paths.projects, seat.folder) : null;
  } catch {
    return null;
  }
}

const USAGE = `usage: inventory.mjs plan [--session <id>]... | write (--session <id>... | --all) | verify-names <name>... [--seat mino] [--json]
       inventory.mjs link --session <id> --kind <${LINK_KINDS.join("|")}|derived_from> --ref <ref> [--note <n>] [--by <who>]
       inventory.mjs links --session <id>... [--check] [--json]
inventory: ${inventoryDir()} (WITNESS_INVENTORY_DIR overrides)`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] ?? "plan";
  if (args.help || !["plan", "write", "verify-names", "link", "links"].includes(command)) {
    console.log(USAGE);
    return args.help ? 0 : 2;
  }
  if (command === "link" || command === "links") return linksCommand(command, args);
  const paths = defaultPaths();
  const { lines } = readBindings(paths.bindings);
  const sessions = sessionsFromBindings(lines);
  const dir = inventoryDir();
  const inventory = readInventory(dir);

  if (command === "verify-names") {
    const names = args._.slice(1);
    if (!names.length) {
      console.error("inventory: verify-names needs at least one tmux session name");
      return 2;
    }
    const results = names.map((name) => verifyName(name, { sessions, transcriptsDir: seatTranscripts(paths, args.seat), inventory }));
    if (args.json) console.log(JSON.stringify(results, null, 2));
    else for (const r of results) console.log(`${r.verified ? "verified  " : "unverified"} ${r.name} → ${r.session_id ?? "-"} · ${r.basis} · ${r.record}`);
    return results.every((r) => r.verified) ? 0 : 1;
  }

  if (command === "write" && !args.all && !args.sessions.length) {
    console.error("inventory: write needs --session <id> (repeatable) or --all");
    return 2;
  }
  const wanted = args.sessions.length ? args.sessions : [...sessions.keys()];
  const now = new Date().toISOString();
  const plans = [];
  for (const id of wanted) {
    const entry = sessions.get(id);
    if (!entry) {
      plans.push({ action: "skip", session_id: id, reason: "no binding line for this session; use the inventory skill's /status or /exit ritual" });
      continue;
    }
    plans.push({ session_id: id, ...planFor(factsFor(id, entry, paths.sessiondata), inventory.byId.get(id), now) });
  }
  const writing = command === "write";
  for (const plan of plans) {
    if (writing && (plan.action === "create" || plan.action === "update")) plan.written = writeRecord(dir, plan);
  }
  if (args.json) {
    console.log(JSON.stringify({ dir, dry_run: !writing, plans: plans.map(({ record, ...rest }) => rest), hygiene: inventory.hygiene }, null, 2));
    return 0;
  }
  console.log(`inventory ${writing ? "write" : "plan (dry run, nothing written)"} · ${dir} · ${plans.length} session${plans.length === 1 ? "" : "s"}`);
  for (const plan of plans) {
    const head = plan.action === "skip" ? `skip      ${plan.session_id} · ${plan.reason}` : `${plan.action.padEnd(10)}${plan.file}${plan.changes.length ? ` · ${plan.changes.join(", ")}` : ""}`;
    console.log(`${head}${plan.written ? " · written" : ""}`);
  }
  if (inventory.hygiene.length) {
    console.log(`hygiene (${inventory.hygiene.length}, not changed by this script):`);
    for (const finding of inventory.hygiene) console.log(`  ${finding.file}: ${finding.finding}`);
  }
  return 0;
}

// ---------- links ----------

function linksCommand(command, args) {
  const dir = inventoryDir();
  const inventory = readInventory(dir);
  if (!args.sessions.length) {
    console.error(`inventory: ${command} needs --session <id>`);
    return 2;
  }
  const now = new Date().toISOString();
  if (command === "link") {
    const [id] = args.sessions;
    const existing = inventory.byId.get(id);
    if (!existing) {
      console.error(`inventory: no record for ${id}; run write --session ${id} first`);
      return 2;
    }
    if (!args.kind || !args.ref) {
      console.error("inventory: link needs --kind and --ref");
      return 2;
    }
    const record = structuredClone(existing.record);
    const by = args.by ?? BY;
    let what;
    if (args.kind === "derived_from") {
      if (!UUID.test(args.ref)) {
        console.error(`inventory: derived_from must be a session id, not ${args.ref}`);
        return 2;
      }
      if (record.derived_from === args.ref) {
        console.log(`unchanged ${existing.file} · derived_from already ${args.ref}`);
        return 0;
      }
      what = `derived_from set to ${args.ref}${record.derived_from ? ` (was ${record.derived_from})` : ""}`;
      record.derived_from = args.ref;
    } else {
      try {
        if (!addLink(record, args.kind, args.ref, { note: args.note, by, now })) {
          console.log(`unchanged ${existing.file} · ${args.kind} already holds ${args.ref}`);
          return 0;
        }
      } catch (error) {
        console.error(`inventory: ${error.message}`);
        return 2;
      }
      what = `${args.kind} link: ${args.ref}`;
    }
    record.observations = [...(record.observations ?? []), { at: now, by, what: `Link added: ${what}.` }];
    writeRecord(dir, { file: existing.file, record });
    console.log(`linked    ${existing.file} · ${what}`);
    return 0;
  }
  const out = [];
  for (const id of args.sessions) {
    const existing = inventory.byId.get(id);
    if (!existing) {
      out.push({ session_id: id, missing: true });
      continue;
    }
    const record = structuredClone(existing.record);
    const links = { ...emptyLinks(), ...(record.links ?? {}) };
    if (args.check) {
      for (const kind of LINK_KINDS) for (const entry of links[kind]) entry.checked = { at: now, ...checkRef(entry.ref) };
      record.links = links;
      writeRecord(dir, { file: existing.file, record });
    }
    out.push({ session_id: id, file: existing.file, derived_from: record.derived_from ?? null, gaps: linkGaps(record), links });
  }
  const failed = out.some((r) => r.missing || (args.check && LINK_KINDS.some((k) => r.links[k].some((e) => e.checked?.ok === false))));
  if (args.json) {
    console.log(JSON.stringify(out, null, 2));
    return failed ? 1 : 0;
  }
  for (const r of out) {
    if (r.missing) {
      console.log(`${r.session_id}: no record`);
      continue;
    }
    console.log(`${r.session_id}${r.derived_from ? ` · derived from ${r.derived_from}` : ""}`);
    for (const kind of LINK_KINDS) {
      const entries = r.links[kind];
      if (!entries.length) {
        console.log(`  ${kind.padEnd(9)} — empty`);
        continue;
      }
      for (const entry of entries) {
        const mark = entry.checked ? (entry.checked.ok === true ? "checked" : entry.checked.ok === false ? "FAILED" : "unchecked") : "";
        console.log(`  ${kind.padEnd(9)} ${mark ? `${mark} ` : ""}${entry.ref}${entry.checked && entry.checked.ok !== true ? ` (${entry.checked.how})` : ""}`);
      }
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT) process.exitCode = main();

