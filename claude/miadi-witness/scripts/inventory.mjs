#!/usr/bin/env node
// inventory — the facts half of the session inventory. For each session it reads the latest
// binding line and the hook capture, and writes or updates the record keyed by session id in
// ~/workspace/.mino/session-inventory/ (SCHEMA.md there). The inventory-keeper agent adds the
// meaning; this script never touches the fields an agent wrote.
//
//   inventory.mjs plan  [--session <id>]...           what it would write (the default; writes nothing)
//   inventory.mjs write --session <id>... | --all      write those records
//   inventory.mjs plan|write --all --since <date>      only sessions active at or after <date>
//   inventory.mjs verify-names <tmux name>...          which session each name held, and on what evidence
//   inventory.mjs link --session <id> --kind <kind> --ref <ref> [--note <n>] [--by <who>]
//                                                      add a reference to one of the five links
//   inventory.mjs links --session <id>... [--check]    the five links, empty ones included;
//                                                      --check verifies commits and writes the result
//   inventory.mjs hold --session <id> --episode <ref> [--how <text>]
//                                                      put a session on an episode, its main circle
//                                                      and its main ceremony, read from the episode door
//   inventory.mjs capabilities --session <id> [--dry-run]
//                                                      hold the record's capabilities in its episode
//
// The five links (links-lib.mjs): question, trace, evidence, criteria, judgment. The script
// fills question from the hook capture, evidence with the Miadi reviews the session is named
// after (review-<yymmdd>-<id>) or that a person's prompt names, and trace with owner/repo@sha for
// each commit in the capture's publications (related.issues gets the owner/repo#n their messages
// name); the rest are added with `link`. `--kind derived_from` sets the parent session of a fork
// or a resume.
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
import { LINK_KINDS, addLink, checkRef, emptyLinks, firstInput, linkGaps, parseRef, personPrompts, reviewPage, reviewsNamed, treesFor } from "./links-lib.mjs";

const SCRIPT = fileURLToPath(import.meta.url);
const BY = "inventory-keeper (miadi-witness scripts/inventory.mjs)";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FACT_KEYS = ["binding", "hook_capture"];
const FILL_KEYS = ["tmux_session_name", "claude_session_name", "cwd", "repo", "repo_remote", "team"];

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

// The origin URL itself, so a reader knows the host: `owner/repo` alone reads jgwill/episodes
// as GitHub when it lives at gaia:/srv/git (mw-rwl-repo, P18, 2026-11-01).
function remoteOf(cwd) {
  if (!cwd || !existsSync(cwd)) return null;
  try {
    return execFileSync("git", ["-C", cwd, "remote", "get-url", "origin"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

export function repoFromRemote(url) {
  if (!url) return null;
  const match = url.match(/[:/]([^/:]+\/[^/]+?)(\.git)?$/);
  return match ? match[1] : url;
}

function repoOf(cwd) {
  return repoFromRemote(remoteOf(cwd));
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
  const published = existsSync(dir)
    ? commitsOf(sessiondata, sessionId, { since: entry.first.at, cwd: entry.first.cwd ?? line.cwd })
    : { commits: [], owed: [] };
  return {
    session_id: sessionId,
    tmux_session_name: line.tmux?.session ?? null,
    claude_session_name: line.name?.name ?? null,
    cwd: entry.first.cwd ?? line.cwd ?? null,
    repo: repoOf(entry.first.cwd ?? line.cwd),
    repo_remote: remoteOf(entry.first.cwd ?? line.cwd),
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
    commits: published.commits,
    trace_owed: published.owed,
  };
}

// ---------- trace and issues ----------
// What the session committed, read from its hook capture (_claude_publications.jsonl, written by
// miadi-session-observability's publications.sh). A `commit` line names its repo and sha. A
// `push` line names only the range it pushed, so its commits are listed with git log <from>..<to>
// in a local tree whose origin names the repository, keeping those committed at or after the
// session's first binding line: a push also carries commits made before the session began
// (Session 7209701b pushed jgwill/Miadi a391144e, committed two minutes before it started).
// A push no local tree can list is reported as owed, never guessed.

// owner/repo#n, or a bare #n read against the commit's own repository. Not inside a word, a
// path or an HTML entity, and never #0… (a colour, not an issue).
const ISSUE_IN_TEXT = /(?<![\w/&#.-])(?:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+))?#([1-9]\d*)\b/g;

export function issuesIn(message, repo) {
  const issues = [];
  for (const m of String(message ?? "").matchAll(ISSUE_IN_TEXT)) {
    const owner = m[1] ?? repo;
    if (owner && !issues.includes(`${owner}#${m[2]}`)) issues.push(`${owner}#${m[2]}`);
  }
  return issues;
}

const sameSha = (a, b) => {
  const [x, y] = [String(a).toLowerCase(), String(b).toLowerCase()];
  return x.startsWith(y) || y.startsWith(x);
};

// [{short, sha, time, message}] for a git log range in one tree, or null when the tree cannot list it.
function logCommits(tree, range, max = 200) {
  try {
    const out = execFileSync("git", ["-C", tree, "log", `--max-count=${max}`, "--format=%h%x1f%H%x1f%ct%x1f%B%x1e", ...range, "--"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\x1e").map((chunk) => chunk.replace(/^\n/, "")).filter(Boolean).map((chunk) => {
      const [short, sha, time, message = ""] = chunk.split("\x1f");
      return { short, sha, time: Number(time), message: message.trim() };
    });
  } catch {
    return null;
  }
}

export function commitsOf(sessiondata, sessionId, { since = null, cwd = null, env = process.env } = {}) {
  const path = join(sessiondata, sessionId, "_claude_publications.jsonl");
  const commits = [];
  const owed = [];
  if (!existsSync(path)) return { commits, owed };
  const lines = readFileSync(path, "utf8").split("\n").flatMap((raw) => {
    try {
      return raw.trim() ? [JSON.parse(raw)] : [];
    } catch {
      return [];
    }
  });
  const dirs = (repo) => [...new Set(lines.filter((l) => l.kind === "commit" && l.repo === repo && l.dir).map((l) => l.dir)), cwd].filter(Boolean);
  const sinceSeconds = since && !Number.isNaN(Date.parse(since)) ? Date.parse(since) / 1000 : null;
  const add = (repo, c) => {
    if (commits.some((k) => k.repo === repo && sameSha(k.sha, c.sha))) return;
    commits.push({ repo, sha: c.sha, short: c.short, subject: c.message.split("\n")[0], issues: issuesIn(c.message, repo) });
  };
  for (const line of lines) {
    if (line.kind === "commit") {
      if (!line.repo || !line.sha) {
        owed.push(`commit ${line.sha ?? "?"}: the capture names no repository`);
        continue;
      }
      const trees = treesFor(line.repo, { first: dirs(line.repo), env });
      const found = trees.map((tree) => logCommits(tree, [line.sha], 1)).find((list) => list?.length);
      add(line.repo, found?.[0] ?? { sha: line.sha, short: line.sha, message: line.subject ?? "" });
    } else if (line.kind === "push") {
      if (!line.repo || !line.to) {
        owed.push(`push ${line.url ?? line.remote ?? "?"}: the capture names no repository or no pushed tip`);
        continue;
      }
      const range = line.from && !/^0+$/.test(line.from) ? [`${line.from}..${line.to}`] : [line.to];
      const max = range[0].includes("..") ? 200 : 1;
      const listed = treesFor(line.repo, { first: dirs(line.repo), env }).map((tree) => logCommits(tree, range, max)).find((list) => list !== null);
      if (!listed) {
        owed.push(`push ${line.repo} ${line.from ?? ""}...${line.to}: no local tree whose origin names ${line.repo} holds the range`);
        continue;
      }
      for (const c of listed) if (sinceSeconds === null || c.time >= sinceSeconds) add(line.repo, c);
    }
  }
  return { commits, owed };
}

// Adds a commit unless the trace already holds it, in any length of sha an agent wrote.
function fillTrace(record, facts, now, changes) {
  const held = (record.links?.trace ?? []).map((entry) => parseRef(entry.ref)).filter((ref) => ref.type === "commit");
  let added = 0;
  for (const c of facts.commits ?? []) {
    if (held.some((ref) => ref.repo.toLowerCase() === c.repo.toLowerCase() && sameSha(ref.sha, c.sha))) continue;
    if (addLink(record, "trace", `${c.repo}@${c.short}`, { note: c.subject || undefined, by: BY, now })) {
      held.push({ repo: c.repo, sha: c.sha });
      added += 1;
    }
  }
  if (added) changes.push(`trace link${added > 1 ? "s" : ""} to ${added} commit${added > 1 ? "s" : ""}`);
}

function fillIssues(record, facts, changes) {
  const issues = record.related?.issues ?? [];
  const known = new Set(issues.filter((i) => typeof i === "string").map((i) => i.toLowerCase()));
  const added = [];
  for (const ref of (facts.commits ?? []).flatMap((c) => c.issues)) {
    if (known.has(ref.toLowerCase())) continue;
    known.add(ref.toLowerCase());
    added.push(ref);
  }
  if (!added.length) return;
  record.related = { ...(record.related ?? {}), issues: [...issues, ...added] };
  changes.push(`related.issues +${added.length} (${added.join(", ")})`);
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

// ---------- missions ----------
// A miadiRun mission names the Claude session it was handed to in `launch.claude_session_id`
// (~/.miadi/missions/<id>/mission.json, written by miadi-run launch and given). That id is the
// only link read here: a tmux name is reused across sessions and cannot tell them apart.
// SCHEMA.md "Missions (added 2026-10-25)"; /missions on :3335 reads the same records.

export function missionsDir(env = process.env) {
  return env.MIADI_MISSIONS_DIR || join(homedir(), ".miadi", "missions");
}

export function missionsBySession(dir = missionsDir()) {
  const bySession = new Map();
  if (!existsSync(dir)) return bySession;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, "mission.json");
    if (!existsSync(file)) continue;
    let mission;
    try {
      mission = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    const sessionId = mission?.launch?.claude_session_id;
    if (!sessionId || !UUID.test(sessionId)) continue;
    const ref = mission.episode?.ref;
    const entry = {
      id: mission.id ?? name,
      how: "received",
      given_at: mission.launch.at ?? null,
      episode: ref ? `miadi-chronicle://${String(ref).replace(/^0+(?=\d)/, "")}` : null,
    };
    bySession.set(sessionId, [...(bySession.get(sessionId) ?? []), entry]);
  }
  return bySession;
}

// ---------- factory ----------
// A session the Miadi factory started: the factory runner (@miadi/factory-runner) delivered a
// connector brief to it and wrote one ledger line naming the session id, the connector record
// (run_request:<uuid>, work_proposal:<uuid>), the brief file and the Remote Control URL. Same
// ledger the runner and the connector read: $MIADI_FACTORY_LEDGER, else <factory>/delivered.jsonl.

export function factoryLedger(env = process.env) {
  return env.MIADI_FACTORY_LEDGER || join(env.MIADI_FACTORY_DIR || "/srv/miadi/factory", "delivered.jsonl");
}

export function factoryBySession(file = factoryLedger()) {
  const bySession = new Map();
  if (!existsSync(file)) return bySession;
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    let line;
    try {
      line = raw.trim() ? JSON.parse(raw) : null;
    } catch {
      continue;
    }
    if (!line?.sent || !line.session_id || !UUID.test(line.session_id) || !line.record) continue;
    const entry = {
      record: line.record,
      type: line.type ?? null,
      brief: line.brief ?? null,
      delivered_at: line.at ?? null,
      to: line.to ?? null,
      remote_control: line.remote_control?.url ?? null,
    };
    bySession.set(line.session_id, [...(bySession.get(line.session_id) ?? []), entry]);
  }
  return bySession;
}

export function fillFactory(record, facts, now, changes) {
  const known = new Set((record.factory ?? []).map((f) => f.record));
  const added = (facts.factory ?? []).filter((f) => !known.has(f.record));
  if (!added.length) return;
  record.factory = [...(record.factory ?? []), ...added.map((f) => ({ ...f, added_at: now }))];
  changes.push(`factory[] +${added.length} (${added.map((f) => f.record).join(", ")})`);
}

export function fillMissions(record, facts, now, changes) {
  const known = new Set((record.missions ?? []).map((m) => m.id));
  const added = (facts.missions ?? []).filter((m) => !known.has(m.id));
  if (!added.length) return;
  record.missions = [...(record.missions ?? []), ...added.map((m) => ({ ...m, added_at: now }))];
  changes.push(`missions[] +${added.length} (${added.map((m) => m.id).join(", ")})`);
}

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
      repo_remote: facts.repo_remote,
      team: facts.team,
      binding: facts.binding,
      hook_capture: facts.hook_capture,
      links: emptyLinks(),
      observations: [{ at: now, by: BY, what: "Record created from the binding line and the hook capture. No agent has read the session yet." }],
      metadata: { created_by: BY, closed_by: null, notes: "" },
    };
    fillQuestion(record, facts, now, []);
    fillEvidence(record, facts, now, []);
    fillTrace(record, facts, now, []);
    fillIssues(record, facts, []);
    fillMissions(record, facts, now, []);
    fillFactory(record, facts, now, []);
    return { action: "create", file: `${facts.session_id}.json`, changes: ["new record"], owed: facts.trace_owed ?? [], record };
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
  fillTrace(record, facts, now, changes);
  fillIssues(record, facts, changes);
  fillMissions(record, facts, now, changes);
  fillFactory(record, facts, now, changes);
  const owed = facts.trace_owed ?? [];
  if (!changes.length) return { action: "unchanged", file: existing.file, changes, owed, record };
  record.observations = [...(record.observations ?? []), { at: now, by: BY, what: `Facts updated from the binding line and the hook capture: ${changes.join(", ")}.` }];
  return { action: "update", file: existing.file, changes, owed, record };
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
    else if (arg === "--since") args.since = argv[++i];
    else if (arg === "--json") args.json = true;
    else if (arg === "--seat") args.seat = argv[++i];
    else if (arg === "--kind") args.kind = argv[++i];
    else if (arg === "--ref") args.ref = argv[++i];
    else if (arg === "--note") args.note = argv[++i];
    else if (arg === "--by") args.by = argv[++i];
    else if (arg === "--check") args.check = true;
    else if (arg === "--episode") args.episode = argv[++i];
    else if (arg === "--how") args.how = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
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

const USAGE = `usage: inventory.mjs plan [--session <id>]... | write (--session <id>... | --all [--since <date>]) | verify-names <name>... [--seat mino] [--json]
       inventory.mjs link --session <id> --kind <${LINK_KINDS.join("|")}|derived_from> --ref <ref> [--note <n>] [--by <who>]
       inventory.mjs links --session <id>... [--check] [--json]
       inventory.mjs hold --session <id> --episode <number|epNNN|dated path> [--how <text>]
       inventory.mjs capabilities --session <id> [--dry-run]
inventory: ${inventoryDir()} (WITNESS_INVENTORY_DIR overrides)`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] ?? "plan";
  if (args.help || !["plan", "write", "verify-names", "link", "links", "hold", "capabilities"].includes(command)) {
    console.log(USAGE);
    return args.help ? 0 : 2;
  }
  if (command === "link" || command === "links") return linksCommand(command, args);
  if (command === "hold") return holdCommand(args);
  if (command === "capabilities") return capabilitiesCommand(args);
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
  // --since keeps the sessions whose latest binding line is at or after a date, so a nightly
  // run records the day's sessions without rereading every session ever bound.
  const since = args.since ? Date.parse(args.since) : null;
  if (args.since && Number.isNaN(since)) {
    console.error(`inventory: --since needs a date, got ${args.since}`);
    return 2;
  }
  // --all leaves out headless children (`claude -p` editor passes, PDE calls): they are not a
  // pane's occupant and a record for each would bury the sessions a person works with.
  const wanted = (args.sessions.length ? args.sessions : [...sessions.keys()].filter((id) => !sessions.get(id).headless)).filter(
    (id) => since === null || Date.parse(sessions.get(id)?.latest?.at ?? "") >= since,
  );
  const now = new Date().toISOString();
  const missions = missionsBySession();
  const factory = factoryBySession();
  const plans = [];
  for (const id of wanted) {
    const entry = sessions.get(id);
    if (!entry) {
      plans.push({ action: "skip", session_id: id, reason: "no binding line for this session; use the inventory skill's /status or /exit ritual" });
      continue;
    }
    plans.push({ session_id: id, ...planFor({ ...factsFor(id, entry, paths.sessiondata), missions: missions.get(id) ?? [], factory: factory.get(id) ?? [] }, inventory.byId.get(id), now) });
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
    for (const owed of plan.owed ?? []) console.log(`  trace owed: ${owed}`);
  }
  if (inventory.hygiene.length) {
    console.log(`hygiene (${inventory.hygiene.length}, not changed by this script):`);
    for (const finding of inventory.hygiene) console.log(`  ${finding.file}: ${finding.finding}`);
  }
  return 0;
}

// ---------- capabilities ----------
// A record's `capabilities` list has the episode door's shape: {capability: "miadi-capability:
// <owner>/<repo>/<kind>/<name>", relation: uses | revises | brings-into-being, version,
// evidence: [...]}. This command holds each entry in the record's episode through
// POST /api/chronicle/episodes/<n>/capabilities, adding `session:<id>` to its evidence. The door
// keeps one entry per capability and version and only adds evidence it lacks, so a repeat is safe.
// The seat's identity may lack the episode_hold_capability permission, so it writes with the
// writer token (WITNESS_MIADI_WRITER_TOKEN, else MIADI_API_TOKEN_WRITER), as the other episode
// doors accept. Earned 2026-11-01 (Episode 568): William, "this is really something you're going
// to feed on, and it's going to be part of your team and your responsibility".
async function capabilitiesCommand(args) {
  const [id] = args.sessions;
  if (!id) {
    console.error("inventory: capabilities needs --session <id>");
    return 2;
  }
  const dir = inventoryDir();
  const existing = readInventory(dir).byId.get(id);
  if (!existing) {
    console.error(`inventory: no record for ${id}; run write --session ${id} first`);
    return 2;
  }
  const record = existing.record;
  const episode = record.episode?.number ?? record.episode?.dated_path;
  if (!episode) {
    console.error(`inventory: ${existing.file} names no episode; run hold --session ${id} --episode <N> first`);
    return 2;
  }
  const entries = (record.capabilities ?? []).filter((c) => /^miadi-capability:(\/\/)?[^/]+\/[^/]+\/[^/]+\/.+/.test(c?.capability ?? ""));
  const skipped = (record.capabilities ?? []).length - entries.length;
  if (!entries.length) {
    console.log(`nothing   ${existing.file} · no capability with a miadi-capability address${skipped ? ` (${skipped} without one)` : ""}`);
    return 0;
  }
  const base = (process.env.WITNESS_MIADI_API_URL ?? process.env.MIADI_API_URL ?? "http://127.0.0.1:3335").replace(/\/$/, "");
  const token = process.env.WITNESS_MIADI_WRITER_TOKEN ?? process.env.MIADI_API_TOKEN_WRITER ?? "";
  if (!token) {
    console.error("inventory: capabilities needs the writer token (WITNESS_MIADI_WRITER_TOKEN or MIADI_API_TOKEN_WRITER)");
    return 2;
  }
  let failed = 0;
  for (const entry of entries) {
    const evidence = [...new Set([...(entry.evidence ?? []), `session:${id}`])];
    const body = { capability: entry.capability, relation: entry.relation ?? "uses", ...(entry.version ? { version: entry.version } : {}), evidence, ...(args.dryRun ? { dryRun: true } : {}) };
    const response = await fetch(`${base}/api/chronicle/episodes/${encodeURIComponent(episode)}/capabilities`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => ({}));
    const what = `${entry.capability} ${body.relation}${entry.version ? ` ${entry.version}` : ""}`;
    if (!response.ok || json.error) {
      failed += 1;
      console.log(`refused   ${what} · ${response.status} ${json.message ?? json.error ?? ""}`.trim());
    } else console.log(`${args.dryRun ? "would hold" : "held     "} ${what} · episode ${episode}`);
  }
  if (skipped) console.log(`skipped   ${skipped} capabilit${skipped === 1 ? "y" : "ies"} without a miadi-capability address`);
  if (!args.dryRun) {
    const updated = structuredClone(record);
    updated.observations = [...(updated.observations ?? []), { at: new Date().toISOString(), by: args.by ?? BY, what: `Capabilities held in episode ${episode}: ${entries.length - failed} of ${entries.length}.` }];
    writeRecord(dir, { file: existing.file, record: updated });
  }
  return failed ? 1 : 0;
}

// ---------- hold ----------
// The episode door's sessions route (GET /api/chronicle/episodes/<ref>/sessions) lists a session
// whose inventory record names the episode (episode_source: inventory). So writing the schema's
// episode, circle and ceremony into the record is what puts a session on an episode and on its
// main ceremony. Earned 2026-11-01: William asked for two sessions to be added to Episode 568 and
// its ceremony, and the seat first reached for a connector that signs in as him.
// The episode comes from GET …/episodes/<ref>, the main circle and ceremony from
// GET …/episodes/<ref>/circle. Both need a signed-in reader: the door answers 404 to an unsigned
// read of an episode (measured 2026-11-10 at 127.0.0.1:3335 and on the tailnet). Both are signed
// with the seat's own token, never the token of the person it acts for.

// The seat's token: WITNESS_MIADI_TOKEN, else MIADI_MINO_TOKEN, from the environment, else from one
// literal line of WITNESS_ENV_FILE (default ~/.env), which is read and never sourced. A seat's
// process environment often lacks it while ~/.env has it. The token is never printed.
export function seatToken(env = process.env) {
  for (const name of ["WITNESS_MIADI_TOKEN", "MIADI_MINO_TOKEN"]) if (env[name]) return env[name];
  const file = env.WITNESS_ENV_FILE || join(homedir(), ".env");
  if (!existsSync(file)) return "";
  const lines = readFileSync(file, "utf8").split("\n");
  for (const name of ["WITNESS_MIADI_TOKEN", "MIADI_MINO_TOKEN"]) {
    for (const line of lines) {
      const m = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*?)\\s*$`).exec(line);
      const value = m?.[1].replace(/^(['"])(.*)\1$/, "$2");
      if (value) return value;
    }
  }
  return "";
}

async function holdCommand(args) {
  const [id] = args.sessions;
  if (!id || !args.episode) {
    console.error("inventory: hold needs --session <id> and --episode <ref>");
    return 2;
  }
  const dir = inventoryDir();
  const existing = readInventory(dir).byId.get(id);
  if (!existing) {
    console.error(`inventory: no record for ${id}; run write --session ${id} first`);
    return 2;
  }
  const base = (process.env.WITNESS_MIADI_API_URL ?? process.env.MIADI_API_URL ?? "http://127.0.0.1:3335").replace(/\/$/, "");
  const token = seatToken();
  const ref = encodeURIComponent(args.episode);
  let door;
  try {
    door = await getJson(`${base}/api/chronicle/episodes/${ref}`, token);
  } catch (error) {
    console.error(`inventory: the episode door: ${error.message}${token ? "" : "; the read was unsigned: the door reads an episode only for a signed-in reader, so put the seat's MIADI_MINO_TOKEN in the environment or in ~/.env"}`);
    return 1;
  }
  const dated = typeof door.episode === "string" ? door.episode : door.identity?.name;
  const manifest = door.manifest ?? {};
  const number = Number(manifest.episode ?? /-episode-0*(\d+)-/.exec(dated ?? "")?.[1]);
  if (!dated || !Number.isFinite(number)) {
    console.error(`inventory: the episode door does not name an episode for ${args.episode}`);
    return 1;
  }
  let main = null;
  let owed = "";
  if (!token) owed = "no seat token (WITNESS_MIADI_TOKEN or MIADI_MINO_TOKEN, in the environment or ~/.env)";
  else {
    try {
      main = (await getJson(`${base}/api/chronicle/episodes/${ref}/circle`, token)).main ?? null;
    } catch (error) {
      owed = error.message;
    }
  }
  const record = structuredClone(existing.record);
  const now = new Date().toISOString();
  const by = args.by ?? BY;
  record.episode = {
    number,
    title: manifest.title ?? null,
    dated_path: dated,
    chronicle_uri: `miadi-chronicle://${number}`,
    status: manifest.status ?? null,
    ...(args.how ? { how: args.how } : {}),
  };
  if (main?.circle?.id) record.circle = { ...(record.circle ?? {}), id: main.circle.id, title: main.circle.name ?? record.circle?.title ?? null };
  if (main?.ceremony?.id) record.ceremony = { ...(record.ceremony ?? {}), id: main.ceremony.id };
  const held = [`episode miadi-chronicle://${number}`, main?.circle?.id && `circle ${main.circle.id}`, main?.ceremony?.id && `ceremony ${main.ceremony.id}`]
    .filter(Boolean)
    .join(", ");
  record.observations = [...(record.observations ?? []), { at: now, by, what: `Held by ${held}${owed ? `; main circle not read: ${owed}` : ""}.` }];
  writeRecord(dir, { file: existing.file, record });
  console.log(`held      ${existing.file} · ${held}${owed ? ` · circle owed: ${owed}` : ""}`);
  return 0;
}

async function getJson(url, token) {
  const response = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new Error(`${url.replace(/^https?:\/\/[^/]+/, "")} answered ${response.status}`);
  return response.json();
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

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT) {
  Promise.resolve(main()).then((code) => { process.exitCode = code; }, (error) => { console.error(`inventory: ${error.message}`); process.exitCode = 1; });
}

