// links — the five links of a session record (P2 of the witness proposals, 2026-10-05).
//
// The Miadi Factory names five things that make agent-made work checkable: the originating
// question, the session trace, the interface evidence, the explicit criteria, and a person's
// judgment. A record holds each as a list of references a person can open:
//
//   question   his first words to the session, verbatim (filled from the hook capture)
//   trace      owner/repo@sha for what the session committed
//   evidence   a page, a review, an artifact URL (reviews the session started from are filled)
//   criteria   the elements of performance it was held to, or nothing
//   judgment   turn:<turn id>@<ceremony id>, the person's answer in a circle
//
// An empty link stays in the record as an empty list, so a reader sees the gap.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { MACHINE_PROMPT } from "../service/threads.mjs";

export const LINK_KINDS = ["question", "trace", "evidence", "criteria", "judgment"];

const COMMIT_REF = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)@([0-9a-f]{7,40})$/;
const TURN_REF = /^turn:([0-9a-f-]{8,})@([0-9a-f-]{8,})$/;

// Repositories whose working tree is not at /workspace/repos/<owner>/<repo> on this host.
export const KNOWN_TREES = {
  "jgwill/Miadi": "/a/src/Miadi",
  "jgwill/episodes": "/srv/miadi/episodes/miadi-chronicle",
  "miadisabelle/workspace": "/home/mia/workspace",
};

export function emptyLinks() {
  return Object.fromEntries(LINK_KINDS.map((kind) => [kind, []]));
}

export function parseRef(ref) {
  const commit = COMMIT_REF.exec(ref);
  if (commit) return { type: "commit", repo: `${commit[1]}/${commit[2]}`, sha: commit[3] };
  const turn = TURN_REF.exec(ref);
  if (turn) return { type: "turn", turn: turn[1], ceremony: turn[2] };
  if (/^https?:\/\//.test(ref)) return { type: "url", url: ref };
  if (ref.startsWith("file:")) return { type: "file", path: ref.slice(5) };
  return { type: "text" };
}

// Add one reference to one link. Returns false when the same ref is already there.
export function addLink(record, kind, ref, { note, by, now = new Date().toISOString() } = {}) {
  if (!LINK_KINDS.includes(kind)) throw new Error(`unknown link kind ${kind}; one of ${LINK_KINDS.join(", ")}`);
  record.links = { ...emptyLinks(), ...(record.links ?? {}) };
  if (record.links[kind].some((entry) => entry.ref === ref)) return false;
  record.links[kind].push({ ref, ...(note ? { note } : {}), added_at: now, ...(by ? { added_by: by } : {}) });
  return true;
}

export function linkGaps(record) {
  const links = { ...emptyLinks(), ...(record.links ?? {}) };
  return LINK_KINDS.filter((kind) => !links[kind].length);
}

// Miadi reviews a session started from. A review is named three ways: its page
// (https://miadi-review-service.vercel.app/review/<id>), its address (miadi-review://<id>), and a
// session name made from it (review-<yymmdd>-<id>, as William named review-261019-a425d070-…).
const REVIEW_PAGE = "https://miadi-review-service.vercel.app/review/";
const REVIEW_ID = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
const REVIEW_IN_TEXT = new RegExp(`(?:miadi-review-service\\.vercel\\.app/review/|miadi-review://)${REVIEW_ID}`, "gi");
const REVIEW_IN_NAME = new RegExp(`^review-\\d{6}-${REVIEW_ID}`, "i");

export function reviewPage(id) {
  return `${REVIEW_PAGE}${id.toLowerCase()}`;
}

// [{ id, where }] in first-seen order, one entry per review. `names` are session names,
// `prompts` are { text, ref } of what a person typed.
export function reviewsNamed({ names = [], prompts = [] } = {}) {
  const found = new Map();
  for (const name of names) {
    const m = typeof name === "string" ? REVIEW_IN_NAME.exec(name) : null;
    if (m && !found.has(m[1].toLowerCase())) found.set(m[1].toLowerCase(), { id: m[1].toLowerCase(), where: `session name ${name}` });
  }
  for (const prompt of prompts) {
    for (const m of String(prompt.text ?? "").matchAll(REVIEW_IN_TEXT)) {
      const id = m[1].toLowerCase();
      if (!found.has(id)) found.set(id, { id, where: `named in ${prompt.ref ?? "a prompt"}` });
    }
  }
  return [...found.values()];
}

// Every prompt a person typed into the session, from the hook capture, whole.
export function personPrompts(sessiondata, sessionId) {
  const path = join(sessiondata, sessionId, "_claude_user_inputs.jsonl");
  if (!existsSync(path)) return [];
  const out = [];
  readFileSync(path, "utf8").split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      return;
    }
    const text = typeof record.prompt === "string" ? record.prompt : "";
    if (text.trim() && !MACHINE_PROMPT.test(text)) out.push({ text, ref: `file:${path}#${i + 1}` });
  });
  return out;
}

// The first thing typed into the session, from the hook capture. The hook records no time.
export function firstInput(sessiondata, sessionId, { maxChars = 600 } = {}) {
  const path = join(sessiondata, sessionId, "_claude_user_inputs.jsonl");
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, "utf8").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    let record;
    try {
      record = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const text = typeof record.prompt === "string" ? record.prompt.trim() : "";
    // A message between sessions or a notice is not the person's question.
    if (!text || MACHINE_PROMPT.test(text)) continue;
    return { text: text.length > maxChars ? `${text.slice(0, maxChars)} …` : text, chars: text.length, ref: `file:${path}#${i + 1}` };
  }
  return null;
}

export function originNames(origin, repo) {
  const o = origin.replace(/\.git$/, "").replace(/\/+$/, "").toLowerCase();
  const r = repo.toLowerCase();
  return o === r || o.endsWith(`/${r}`) || o.endsWith(`:${r}`);
}

function treeFor(repo, env = process.env) {
  const candidates = [KNOWN_TREES[repo], join(env.WITNESS_REPOS_ROOT || "/workspace/repos", repo)].filter(Boolean);
  for (const path of candidates) {
    // A subfolder of a repository counts: git finds the repository above it.
    if (!existsSync(path)) continue;
    try {
      const origin = execFileSync("git", ["-C", path, "remote", "get-url", "origin"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      // A folder is not the repository: the origin must name it, after a / or a :.
      if (originNames(origin, repo)) return path;
    } catch {
      // a tree with no origin cannot vouch for a repository
    }
  }
  return null;
}

// Check one reference against what it points at. Commits are checked in a local tree whose
// origin names the repository; other kinds are reported as not checked by this script.
export function checkRef(ref, env = process.env) {
  const parsed = parseRef(ref);
  if (parsed.type === "commit") {
    const tree = treeFor(parsed.repo, env);
    if (!tree) return { ok: null, how: `no local tree of ${parsed.repo} whose origin names it` };
    try {
      execFileSync("git", ["-C", tree, "cat-file", "-e", `${parsed.sha}^{commit}`], { stdio: "ignore" });
      return { ok: true, how: `git cat-file in ${tree}` };
    } catch {
      return { ok: false, how: `no commit ${parsed.sha} in ${tree} (fetch first if it is new)` };
    }
  }
  if (parsed.type === "file") {
    const path = parsed.path.replace(/#\d+$/, "");
    return { ok: existsSync(path), how: "file exists" };
  }
  return { ok: null, how: `${parsed.type} references are not checked by this script` };
}
