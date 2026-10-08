#!/usr/bin/env node
// miadi-fork — branch a Claude Code session without touching it.
//
//   ask  <session> "<question>"   a headless branch with every tool disabled answers one question
//   open <session> [--topic …] [--add-plugin …] [--same] [--dry-run]
//                                 a branch you can talk to, in its own tmux session
//   list [<session>]              the branches recorded so far
//
// <session> is a session id, an 8+ character id prefix, a tmux session name, or a session's name.
// Everything a branch needs comes from the binding line the capture hook writes for the parent:
// its working folder (same project instructions, same relative paths, same episode), its command line
// (plugins, MCP configs, permission mode), its episode and its team. Every branch is appended to
// <root>/data/session_forks.jsonl, and the binding hook records it again as a session.start with
// source "fork", which is how the witness service draws lineage.
// jgwill/miadi-orchestration-kit#61, jgwill/Miadi#724.

import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function sessionRoot(env = process.env) {
  return env.CLAUDE_SESSIONDATA_ROOT || env.MIADI_SESSION_DIR || env.MIADI_SESSIONDATA_ROOT || env.SESSION_DATA_ROOT || "/src/_sessiondata";
}

// ---------- the parent, from the binding file ----------

export function latestBindings(text) {
  const byId = new Map();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (!row.session_id) continue;
    const seen = byId.get(row.session_id);
    const names = new Set([...(seen?.names ?? []), row.name?.name, row.tmux?.session].filter(Boolean));
    byId.set(row.session_id, { ...seen, ...row, names: [...names] });
  }
  return byId;
}

export function resolveSession(byId, ref) {
  if (!ref) throw new Error("name a session: its id, an id prefix, its tmux session or its name");
  if (byId.has(ref)) return byId.get(ref);
  const rows = [...byId.values()];
  const hits = ref.length >= 8 ? rows.filter((r) => r.session_id.startsWith(ref)) : [];
  const named = hits.length ? hits : rows.filter((r) => r.names.includes(ref));
  if (named.length === 1) return named[0];
  if (named.length > 1) {
    const newest = named.sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
    return { ...newest, ambiguous: named.map((r) => r.session_id) };
  }
  throw new Error(`no session "${ref}" in the binding file`);
}

// ---------- the branch's command line ----------

// what makes a branch, and what made an `ask` branch, never travels into the next one
const DROP_WITH_VALUE = new Set(["--resume", "-r", "--session-id", "-n", "--name", "--tools", "--output-format"]);
const DROP_ALONE = new Set(["--fork-session", "-c", "--continue", "-p", "--print", "--strict-mcp-config"]);

export function parentFlags(argv = []) {
  const out = [];
  // a headless run ends with its prompt, which is not a flag of the session
  const end = (argv.includes("-p") || argv.includes("--print")) && !String(argv.at(-1)).startsWith("-") ? argv.length - 1 : argv.length;
  for (let i = 1; i < end; i += 1) {
    const arg = argv[i];
    if (DROP_ALONE.has(arg)) continue;
    if (DROP_WITH_VALUE.has(arg)) { i += 1; continue; }
    if (/^--(resume|session-id|name)=/.test(arg)) continue;
    out.push(arg);
  }
  return out;
}

export function pluginDir(name, kitRoot = process.env.MIADI_ORCHESTRATION_KIT_ROOT) {
  if (name.includes("/")) return name;
  if (!kitRoot) throw new Error(`--add-plugin ${name} needs MIADI_ORCHESTRATION_KIT_ROOT, or give a path`);
  return join(kitRoot, "claude", name);
}

export function withPlugins(flags, names, kitRoot) {
  const have = new Set(flags.filter((_, i) => flags[i - 1] === "--plugin-dir").map((d) => d.replace(/\/+$/, "")));
  const extra = [];
  for (const name of names) {
    const dir = pluginDir(name, kitRoot).replace(/\/+$/, "");
    if (!have.has(dir)) { extra.push("--plugin-dir", dir); have.add(dir); }
  }
  return [...flags, ...extra];
}

// ---------- names ----------

export function slug(text, max = 40) {
  return String(text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/, "");
}

export function yymmdd(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${String(date.getFullYear()).slice(2)}${p(date.getMonth() + 1)}${p(date.getDate())}`;
}

export function episodeNumber(episodeId) {
  return String(episodeId ?? "").match(/-episode-0*(\d+)-/)?.[1] ?? null;
}

// The binding hook falls back to MIADI_CHRONICLE_PROD_EPISODE, which every shell exports and which
// names the episode in production, not the one the session works in. Only a folder counts.
export function workedEpisode(binding) {
  const e = binding?.episode;
  return e?.id && e.source !== "declared" ? e.id : null;
}

// ep<N>-<yymmdd>-fork-<NN>-<topic>: no ":" (sessions named with one did not come back after
// gaia rebooted, William 2026-10-08), the episode first
// so the name opens miadi-chronicle://<N>, NN one past the highest fork number of the day.
export function forkName({ episode, topic, existing = [], date = new Date() }) {
  const day = yymmdd(date);
  const numbers = existing.map((n) => String(n).match(new RegExp(`${day}-fork-(\\d+)`))?.[1]).filter(Boolean).map(Number);
  const nn = String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(2, "0");
  const head = episode ? `ep${episode}-` : "";
  const tail = slug(topic) || "branch";
  return `${head}${day}-fork-${nn}-${tail}`;
}

function tmuxSessions() {
  try {
    return execFileSync("tmux", ["list-sessions", "-F", "#{session_name}"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean);
  } catch { return []; }
}

export function shellQuote(text) {
  return `'${String(text).replace(/'/g, `'\\''`)}'`;
}

// ---------- the ledger ----------

function record(root, row) {
  mkdirSync(join(root, "data"), { recursive: true });
  appendFileSync(join(root, "data", "session_forks.jsonl"), `${JSON.stringify(row)}\n`);
}

// ---------- ask ----------

export function planAsk(parent, question, { id = randomUUID() } = {}) {
  if (!String(question ?? "").trim()) throw new Error("ask needs a question");
  if (!parent.cwd) throw new Error(`the binding line of ${parent.session_id} has no cwd`);
  const args = ["-p", "--resume", parent.session_id, "--fork-session", "--session-id", id, "--tools", "", "--strict-mcp-config", question];
  return { mode: "ask", parent: parent.session_id, fork: id, cwd: parent.cwd, args };
}

function runAsk(plan, root) {
  const started = new Date().toISOString();
  const result = spawnSync("claude", plan.args, { cwd: plan.cwd, encoding: "utf8", timeout: 15 * 60_000, maxBuffer: 32 * 1024 * 1024 });
  const answer = (result.stdout ?? "").trim();
  const dir = join(root, plan.fork);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "fork-ask.md");
  const question = plan.args[plan.args.length - 1];
  writeFileSync(file, `# Asked a branch of ${plan.parent}\n\n- fork: ${plan.fork}\n- folder: ${plan.cwd}\n- asked: ${started}\n\n## Question\n\n${question}\n\n## Answer\n\n${answer}\n`);
  record(root, { at: started, mode: "ask", parent: plan.parent, fork: plan.fork, cwd: plan.cwd, question, answer_file: file, exit: result.status });
  if (result.status !== 0) throw new Error(`claude exited ${result.status}: ${(result.stderr || result.error?.message || "").trim().slice(0, 400)}`);
  return { ...plan, answer, answer_file: file };
}

// ---------- open ----------

export function planOpen(parent, { topic, addPlugins = [], same = false, id = randomUUID(), existing = [], kitRoot, date, flagsFrom = parent, episode: given } = {}) {
  if (!parent.cwd) throw new Error(`the binding line of ${parent.session_id} has no cwd`);
  const episodeId = workedEpisode(parent);
  const episode = given ? String(given).replace(/^ep/, "") : episodeNumber(episodeId);
  const name = forkName({ episode, topic: topic ?? parent.name?.name ?? parent.session_id.slice(0, 8), existing, date });
  const flags = withPlugins(parentFlags(flagsFrom.argv), addPlugins, kitRoot);
  const branch = same ? ["--resume", parent.session_id] : ["--resume", parent.session_id, "--fork-session", "--session-id", id];
  const launch = ["claude", ...flags, ...branch, "-n", name].map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : shellQuote(a))).join(" ");
  const team = parent.team?.id && parent.team.id !== "unassigned" ? parent.team.id : null;
  const commands = [
    ["tmux", "new-session", "-d", "-s", name, "-c", parent.cwd],
    ["tmux", "set-option", "-t", name, "@miadi-parent", parent.session_id],
    ...(episodeId ? [["tmux", "set-option", "-t", name, "@miadi-episode", episodeId]] : []),
    ...(team ? [["tmux", "set-option", "-t", name, "@miadi-team", team]] : []),
    // the pane keeps a shell after claude exits, so its last screen and resume line stay readable
    ["tmux", "respawn-pane", "-k", "-t", `${name}:0.0`, "-c", parent.cwd, `bash -ic ${shellQuote(`${launch}; exec bash -i`)}`],
  ];
  return { mode: same ? "continue" : "open", parent: parent.session_id, fork: same ? parent.session_id : id, name, cwd: parent.cwd, episode: episodeId ?? (episode ? `ep${episode}` : null), team, launch, commands };
}

function runOpen(plan, root) {
  if (tmuxSessions().includes(plan.name)) throw new Error(`tmux session ${plan.name} already exists`);
  for (const c of plan.commands) execFileSync(c[0], c.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
  record(root, { at: new Date().toISOString(), mode: plan.mode, parent: plan.parent, fork: plan.fork, cwd: plan.cwd, tmux: plan.name, episode: plan.episode });
  return { ...plan, opened: true, attach: `tmux attach -t ${plan.name}` };
}

// ---------- list ----------

function ledger(root) {
  const file = join(root, "data", "session_forks.jsonl");
  return existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
}

// An `ask` branch ran headless with no tools and no plugins. Opening it again takes the flags of
// the session it was asked from, so the conversation continues with the plugins it had.
export function flagSource(byId, rows, parent) {
  const asked = rows.find((r) => r.mode === "ask" && r.fork === parent.session_id);
  return asked && byId.has(asked.parent) ? byId.get(asked.parent) : parent;
}

function listForks(root, byId, ref) {
  const rows = ledger(root);
  const parent = ref ? resolveSession(byId, ref).session_id : null;
  const recorded = rows.filter((r) => !parent || r.parent === parent);
  const seen = [...byId.values()].filter((r) => r.source === "fork" || r.event === "session.start" && (r.argv ?? []).includes("--fork-session"));
  return { parent, recorded, bound: seen.filter((r) => !parent || (r.argv ?? []).includes(parent)).map((r) => ({ fork: r.session_id, at: r.at, tmux: r.tmux?.session ?? null, name: r.name?.name ?? null })) };
}

// ---------- cli ----------

function parseArgs(argv) {
  const opts = { addPlugins: [], positional: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--topic") opts.topic = argv[++i];
    else if (a === "--episode") opts.episode = argv[++i];
    else if (a === "--add-plugin") opts.addPlugins.push(argv[++i]);
    else if (a === "--same") opts.same = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--json") opts.json = true;
    else opts.positional.push(a);
  }
  return opts;
}

const USAGE = `miadi-fork ask  <session> "<question>"
miadi-fork open <session> [--topic <words>] [--episode <N>] [--add-plugin <kit-plugin|dir>]... [--same] [--dry-run]
miadi-fork list [<session>]`;

function main(argv) {
  const [verb, ...rest] = argv;
  const opts = parseArgs(rest);
  const root = sessionRoot();
  const bindings = join(root, "data", "terminal_bindings.jsonl");
  if (!verb || verb === "-h" || verb === "--help") { console.log(USAGE); return 0; }
  if (!existsSync(bindings)) throw new Error(`no binding file at ${bindings}`);
  const byId = latestBindings(readFileSync(bindings, "utf8"));
  if (verb === "list") { console.log(JSON.stringify(listForks(root, byId, opts.positional[0]), null, 2)); return 0; }
  const parent = resolveSession(byId, opts.positional[0]);
  if (parent.ambiguous) console.error(`note: "${opts.positional[0]}" names ${parent.ambiguous.length} sessions; using the newest, ${parent.session_id}`);
  if (verb === "ask") {
    const plan = planAsk(parent, opts.positional.slice(1).join(" "));
    if (opts.dryRun) { console.log(JSON.stringify(plan, null, 2)); return 0; }
    const done = runAsk(plan, root);
    console.log(opts.json ? JSON.stringify(done, null, 2) : `${done.answer}\n\n— branch ${done.fork} of ${done.parent}\n— kept in ${done.answer_file}\n— talk to it: miadi-fork open ${done.fork} --same`);
    return 0;
  }
  if (verb === "open") {
    const plan = planOpen(parent, { ...opts, existing: tmuxSessions(), flagsFrom: flagSource(byId, ledger(root), parent) });
    if (opts.dryRun) { console.log(JSON.stringify(plan, null, 2)); return 0; }
    console.log(JSON.stringify(runOpen(plan, root), null, 2));
    return 0;
  }
  throw new Error(`unknown verb "${verb}"\n${USAGE}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(`miadi-fork: ${e.message}`); process.exitCode = 1; }
}
