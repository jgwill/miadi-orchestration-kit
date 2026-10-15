#!/usr/bin/env node
// agent-talk — what a person and a session's subagents and forks said to each other, read from
// the capture. Any agent that can run node can observe it, whatever it runs on.
//
//   list <session> [--all] [--json]         every subagent and fork of the session, with how many
//                                            messages the person sent it and how many replies it gave
//   show <session> <agent> [--full] [--json] the conversation: the directive, each message the person
//                                            sent while it worked, and each reply
//   person <session> [--json]                only what the person said to any subagent or fork
//
// <session> is a session id, an 8+ character prefix, a tmux session name, or a session's name
// (resolved from the binding file, as miadi-fork does). <agent> is an agent id, a prefix, or a
// fork's name. A person can open a subagent in the agent view and talk to it, or fork a /btw side
// question with `f`. Either way the words reach the subagent and not the main session. The
// capture hook archives each one's transcript at every stop as <root>/<session>/agents/<id>.transcript.jsonl
// (subagent_stop_hook.sh), and this reads that copy. A /btw question that is never forked runs
// in a panel, fires no hook and is written nowhere, so nothing can read it afterwards.
// Earned 2026-10-15: three messages from Guillaume to the witness-editor sat in its transcript
// while the main session told him they had not reached it.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { latestBindings, resolveSession, sessionRoot } from "./miadi-fork.mjs";

const MIDRUN = /^The user sent a new message while you were working:\n/;
const MIDRUN_TAIL = /\n+This is how Claude Code surfaces messages the user sends mid-turn[\s\S]*$/;
const IMAGE = /\[Image #\d+\]/g;

// ---------- the session and its agents folder ----------

export function sessionDir(ref, root = sessionRoot()) {
  if (!ref) throw new Error("name a session: its id, an id prefix, its tmux session or its name");
  if (ref.includes("/")) return ref;
  if (existsSync(join(root, ref))) return join(root, ref);
  const bindings = join(root, "data", "terminal_bindings.jsonl");
  if (!existsSync(bindings)) throw new Error(`no session folder ${join(root, ref)} and no binding file`);
  return join(root, resolveSession(latestBindings(readFileSync(bindings, "utf8")), ref).session_id);
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

function frontmatter(path) {
  if (!existsSync(path)) return {};
  const m = readFileSync(path, "utf8").match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return out;
}

/** Every agent the capture holds for a session, with its kind. */
export function listAgents(dir) {
  const agents = join(dir, "agents");
  if (!existsSync(agents)) return [];
  const ids = new Set();
  for (const f of readdirSync(agents)) {
    const m = f.match(/^([^.]+)\.(output\.md|meta\.json|launch\.json|transcript\.jsonl)$/);
    if (m) ids.add(m[1]);
  }
  return [...ids].map((id) => {
    const meta = readJson(join(agents, `${id}.meta.json`)) ?? {};
    const launch = readJson(join(agents, `${id}.launch.json`));
    const out = frontmatter(join(agents, `${id}.output.md`));
    const archived = join(agents, `${id}.transcript.jsonl`);
    const transcript = existsSync(archived) ? archived : out.transcript && existsSync(out.transcript) ? out.transcript : null;
    const type = meta.agentType || out.agent_type || "";
    // A fork no Agent call launched was made by the person: a /btw question forked with `f`.
    const kind = meta.isFork ? (launch ? "fork" : "btw-fork") : type ? "subagent" : transcript ? "subagent" : "label";
    return {
      id,
      kind,
      type: meta.isFork ? "fork" : type || null,
      name: meta.name || null,
      description: meta.description || launch?.description || (out.description !== "unknown" ? out.description : null) || null,
      transcript,
      ...(transcript ? summarize(readTurns(transcript)) : { person_messages: 0, replies: 0, images_not_delivered: 0, last_at: out.completed_at || null }),
    };
  }).sort((a, b) => String(a.last_at).localeCompare(String(b.last_at)));
}

// ---------- one transcript, as turns ----------

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((b) => b?.type === "text").map((b) => b.text).join("\n");
}

/** The turns that matter to a reader: directive, person, reply, with tool calls counted. */
export function readTurns(path) {
  const turns = [];
  let tools = [];
  let first = true;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.type === "user") {
      const content = e.message?.content;
      if (Array.isArray(content) && content.every((b) => b?.type === "tool_result")) continue;
      const text = textOf(content);
      if (!text || text.startsWith("<fork-boilerplate>") || text.startsWith("<task-notification>")) continue;
      if (first) {
        turns.push({ role: "directive", at: e.timestamp, text });
        first = false;
      } else if (e.origin?.kind === "human" || MIDRUN.test(text)) {
        turns.push({ role: "person", at: e.timestamp, text: text.replace(MIDRUN, "").replace(MIDRUN_TAIL, "").trim() });
      }
    } else if (e.type === "assistant") {
      for (const b of e.message?.content ?? []) {
        if (b?.type === "tool_use") tools.push(b.name);
        if (b?.type === "text" && b.text.trim()) {
          turns.push({ role: "reply", at: e.timestamp, text: b.text.trim(), tools_before: tools });
          tools = [];
        }
      }
    }
  }
  return turns;
}

export function summarize(turns) {
  const person = turns.filter((t) => t.role === "person");
  return {
    person_messages: person.length,
    replies: turns.filter((t) => t.role === "reply").length,
    images_not_delivered: person.reduce((n, t) => n + (t.text.match(IMAGE)?.length ?? 0), 0),
    last_at: turns.at(-1)?.at ?? null,
  };
}

export function findAgent(agents, ref) {
  if (!ref) throw new Error("name an agent: its id, an id prefix or a fork's name");
  const hits = agents.filter((a) => a.id === ref || a.name === ref || (ref.length >= 6 && a.id.startsWith(ref)));
  if (hits.length === 1) return hits[0];
  throw new Error(hits.length ? `"${ref}" names ${hits.length} agents: ${hits.map((a) => a.id).join(", ")}` : `no agent "${ref}" in this session`);
}

// ---------- printing ----------

const hhmm = (at) => (at ? new Date(at).toISOString().slice(11, 16) + "Z" : "--:--");
const clip = (s, n) => (s.length > n ? s.slice(0, n) + ` … (${s.length - n} more characters, --full)` : s);
const label = (a) => `${a.kind}${a.type && a.type !== "fork" ? ` ${a.type}` : ""}${a.name ? ` "${a.name}"` : ""}${a.description ? ` · ${a.description}` : ""}`;

function directiveLabel(a) {
  if (a.kind === "btw-fork") return "the person's /btw question, forked";
  if (a.kind === "fork") return "directive from the main session (fork)";
  return "prompt from the main session";
}

export function renderList(agents, all = false) {
  const shown = all ? agents : agents.filter((a) => a.kind !== "label");
  const hidden = agents.length - shown.length;
  const out = shown.map((a) =>
    `${a.id}  ${String(a.person_messages).padStart(2)} from the person  ${String(a.replies).padStart(2)} replies  ${hhmm(a.last_at)}  ${label(a)}`
      + (a.images_not_delivered ? `  (${a.images_not_delivered} image(s) arrived as a placeholder only)` : ""));
  if (!shown.length) out.push("no subagent or fork in this session's capture");
  if (hidden) out.push(`${hidden} label helper(s) hidden: Claude Code's progress labels, no transcript (--all shows them)`);
  return out.join("\n");
}

export function renderShow(a, turns, full = false) {
  const n = full ? Infinity : 1200;
  const out = [`agent ${a.id} · ${label(a)}`, `transcript ${a.transcript}`, ""];
  for (const t of turns) {
    if (t.role === "directive") out.push(`── ${hhmm(t.at)} ${directiveLabel(a)}`, clip(t.text, full ? Infinity : 600));
    if (t.role === "person") {
      out.push(`── ${hhmm(t.at)} the person, while it worked`, clip(t.text, n));
      if (IMAGE.test(t.text)) out.push("   (an image is named here; only the placeholder reached the agent)");
      IMAGE.lastIndex = 0;
    }
    if (t.role === "reply") out.push(`── ${hhmm(t.at)} reply${t.tools_before.length ? ` (after ${t.tools_before.length} tool call(s): ${[...new Set(t.tools_before)].join(", ")})` : ""}`, clip(t.text, n));
    out.push("");
  }
  return out.join("\n").trimEnd();
}

// ---------- cli ----------

function main(argv) {
  const [cmd, sessionRef, ...rest] = argv;
  const json = rest.includes("--json");
  const positional = rest.filter((r) => !r.startsWith("--"));
  if (!["list", "show", "person"].includes(cmd)) {
    console.error("usage: agent-talk.mjs list <session> [--all] [--json] | show <session> <agent> [--full] [--json] | person <session> [--json]");
    process.exit(2);
  }
  const dir = sessionDir(sessionRef);
  const agents = listAgents(dir);
  if (cmd === "list") {
    console.log(json ? JSON.stringify(agents, null, 2) : `session ${dir}\n${renderList(agents, rest.includes("--all"))}`);
    return;
  }
  if (cmd === "show") {
    const a = findAgent(agents, positional[0]);
    if (!a.transcript) throw new Error(`agent ${a.id} has no transcript in the capture (kind: ${a.kind})`);
    const turns = readTurns(a.transcript);
    console.log(json ? JSON.stringify({ ...a, turns }, null, 2) : renderShow(a, turns, rest.includes("--full")));
    return;
  }
  const said = agents.filter((a) => a.transcript).flatMap((a) =>
    readTurns(a.transcript).filter((t) => t.role === "person" || (t.role === "directive" && a.kind === "btw-fork")).map((t) => ({ agent: a.id, kind: a.kind, at: t.at, text: t.text })));
  said.sort((x, y) => String(x.at).localeCompare(String(y.at)));
  if (json) return console.log(JSON.stringify(said, null, 2));
  console.log(said.length ? said.map((s) => `── ${hhmm(s.at)} to ${s.kind} ${s.agent}\n${s.text}`).join("\n\n") : "the person said nothing to a subagent or fork in this session");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`agent-talk: ${err.message}`);
    process.exit(1);
  }
}
