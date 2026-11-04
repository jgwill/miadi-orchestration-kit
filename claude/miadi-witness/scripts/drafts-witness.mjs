#!/usr/bin/env node
// drafts-witness — what landed since each mctgo draft that still waits unsent, without a model.
//
// Guillaume, 2026-11-04: "when there are some draft like that, after a few days, there could be a
// cron job that looks ... and there would be an agent responsible for going through these, look at
// what was implemented". This script is the half that looks. The other half, writing the candidate
// actions, scoring them with Jev and deciding, is a seat's work (skill drafts-witness).
//
// usage: drafts-witness.mjs facts [--older-than-days N] [--words] [--summary] [--out <file.md>]
//
//   facts            one section per open mctgo draft opened N days ago or more (default 3): its
//                    session (started, recorded in the inventory), the commits since it was opened
//                    in each repository its labels name, whether each carries an issue, and the
//                    chronicle commits and plot threads of each episode it names.
//   --words          include the draft's words. Only for the seat's own reading: a file written
//                    with them is never committed (Episode 548 Q5: who reads the words is the
//                    person's to decide).
//   --summary        print one JSON line for the nightly inventory instead of the markdown.
//   --out <file>     also write the markdown there.
//
// Reads: `tide drafts list --json [--text]`, tmux, git logs, the session inventory
// ($WITNESS_INVENTORY_DIR or ~/workspace/.mino/session-inventory), the chronicle
// ($MIADI_CHRONICLE_ROOT). Writes nothing else. First used on 2026-11-04 by hand, recorded in
// miadi-chronicle://564 (drafts-witness-261104/). Ref: jgwill/Miadi#691.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";

const DAY = 86_400_000;
const CHRONICLE = process.env.MIADI_CHRONICLE_ROOT || "/srv/miadi/episodes/miadi-chronicle";
const INVENTORY = process.env.WITNESS_INVENTORY_DIR || join(homedir(), "workspace/.mino/session-inventory");

const sh = (cmd, args, opts = {}) => {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "ignore"], ...opts });
  } catch {
    return null;
  }
};

/** An issue reference in a commit message: #123, owner/repo#123 or a Ref: line. */
export const hasIssue = (message) => /(^|[\s(])([\w.-]+\/[\w.-]+)?#\d+\b|^Ref:\s*\S+#\d+/m.test(message);

/** The episode number of a miadi-chronicle address, or null. */
export const episodeNumber = (address) => {
  const m = /^miadi-chronicle:\/{0,2}(\d+)$/.exec(String(address).trim());
  return m ? Number(m[1]) : null;
};

/** Whole days between an ISO time and now. */
export const ageDays = (iso, now = Date.now()) => Math.floor((now - Date.parse(iso)) / DAY);

/** A label path as a filesystem path: `@` dropped, relative ones read from the pane's folder. */
export const labelPath = (label, base) => {
  const p = String(label).replace(/^@/, "").replace(/\/+$/, "");
  return isAbsolute(p) ? p : join(base, p);
};

export function readDrafts({ words = false } = {}) {
  const out = sh(process.env.MIADI_TIDE_BIN || "tide", ["drafts", "list", "--json", ...(words ? ["--text"] : [])], { timeout: 60_000 });
  if (out === null) throw new Error("tide drafts list failed");
  return out.split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

const paneFolder = (pane) => {
  const [session, rest] = String(pane).split(":");
  return sh("tmux", ["display-message", "-p", "-t", `=${session}:${rest ?? "0.0"}`, "#{pane_current_path}"])?.trim() || null;
};

const repoRoot = (path) => {
  const dir = existsSync(path) && statSync(path).isDirectory() ? path : dirname(path);
  return existsSync(dir) ? sh("git", ["-C", dir, "rev-parse", "--show-toplevel"])?.trim() || null : null;
};

const checkoutOf = (slug) => {
  const [owner, repo] = slug.split("/");
  for (const dir of [join("/workspace/repos", owner, repo), join("/a/src", repo), slug === "jgwill/Miadi" ? "/a/src/Miadi-18" : null]) {
    if (!dir) continue;
    const url = sh("git", ["-C", dir, "remote", "get-url", "origin"])?.trim().replace(/\.git$/, "").toLowerCase();
    if (url?.endsWith(slug.toLowerCase())) return dir;
  }
  return null;
};

/** Commits in a repository since a time, limited to pathspecs when given. */
export function commitsSince(root, since, paths = []) {
  const out = sh("git", ["-C", root, "log", "--no-merges", `--since=${since}`, "--format=%h%x1f%cs%x1f%s%x1f%b%x1e", "--", ...paths], { timeout: 30_000 });
  if (!out) return [];
  return out.split("\x1e").map((r) => r.trim()).filter(Boolean).map((r) => {
    const [sha, date, subject, body = ""] = r.split("\x1f");
    return { sha, date, subject, issue: hasIssue(`${subject}\n${body}`) };
  });
}

const episodeFolder = (n) =>
  readdirSync(CHRONICLE).find((d) => {
    const m = /episode-(\d+)-/.exec(d);
    return m && Number(m[1]) === n;
  }) ?? null;

const threadCodes = (folder) => {
  const f = join(CHRONICLE, folder, "threads.yaml");
  return existsSync(f) ? [...readFileSync(f, "utf8").matchAll(/^\s*- code:\s*(PT\d+)/gm)].map((m) => m[1]) : [];
};

const inventoryRecord = (draft) => {
  if (!existsSync(INVENTORY)) return null;
  for (const f of readdirSync(INVENTORY)) {
    if (!f.endsWith(".json")) continue;
    try {
      const r = JSON.parse(readFileSync(join(INVENTORY, f), "utf8"));
      if ((draft.session_id && r.session_id === draft.session_id) || (draft.target_session && r.tmux_session_name === draft.target_session)) {
        return { session_id: r.session_id, status: r.status ?? null, file: f };
      }
    } catch {}
  }
  return null;
};

export function witness(draft) {
  const base = paneFolder(draft.pane) || "/a/src/Miadi-18";
  const labels = draft.labels ?? {};
  const byRepo = new Map();
  const missing = [];
  for (const label of labels.paths ?? []) {
    const given = labelPath(label, base);
    const p = existsSync(given) ? realpathSync(given) : given; // /a/src/Miadi is a link to /a/src/Miadi-18
    const root = existsSync(p) ? repoRoot(p) : null;
    if (!root) {
      missing.push(label);
      continue;
    }
    byRepo.set(root, [...(byRepo.get(root) ?? []), p]);
  }
  const repos = [...byRepo].map(([root, paths]) => ({ root, paths, commits: commitsSince(root, draft.opened_at, paths) }));
  for (const slug of labels.repositories ?? []) {
    const root = checkoutOf(slug);
    if (root && !byRepo.has(root)) repos.push({ root, slug, paths: [], commits: commitsSince(root, draft.opened_at) });
    if (!root) missing.push(slug);
  }
  const episodes = (labels.addresses ?? []).map(episodeNumber).filter((n) => n !== null).map((n) => {
    const folder = episodeFolder(n);
    return { n, folder, commits: folder ? commitsSince(CHRONICLE, draft.opened_at, [folder]).length : 0, threads: folder ? threadCodes(folder) : [] };
  });
  const target = draft.target_session;
  return {
    id: draft.id, pane: draft.pane, team: draft.team ?? null, target: target ?? null, state: draft.state,
    opened_at: draft.opened_at, age_days: ageDays(draft.opened_at), chars: draft.chars,
    session: {
      running: !!(target && sh("tmux", ["has-session", "-t", `=${target}`]) !== null),
      record: inventoryRecord(draft),
    },
    repos, episodes, missing, text: draft.text,
  };
}

export function toMarkdown(seen, { olderThan, at }) {
  const lines = [`# Drafts waiting ${olderThan} days or more (${at})`, "", `${seen.length} open mctgo draft(s). No words unless --words was given.`, ""];
  for (const d of seen) {
    lines.push(`## ${d.id}: ${d.pane}, ${d.team ?? "no team"} ${d.target ?? "(no session named)"}`, "");
    lines.push(`- waiting ${d.age_days} days (opened ${d.opened_at.slice(0, 10)}), ${d.state}, ${d.chars} characters`);
    lines.push(`- session: ${d.session.running ? "running in tmux" : "not started"}${d.session.record ? `, inventory record ${d.session.record.file} (${d.session.record.status})` : ", no inventory record"}`);
    for (const r of d.repos) {
      const withIssue = r.commits.filter((c) => c.issue).length;
      lines.push(`- ${r.slug ?? r.root}${r.paths.length ? ` (${r.paths.map((p) => p.replace(`${r.root}/`, "")).join(", ")})` : " (whole repository)"}: ${r.commits.length} commit(s) since, ${withIssue} with an issue`);
      for (const c of r.commits.slice(0, 6)) lines.push(`  - ${c.sha} ${c.date} ${c.issue ? "" : "[no issue] "}${c.subject.slice(0, 140)}`);
    }
    for (const e of d.episodes) {
      lines.push(`- miadi-chronicle://${e.n}: ${e.folder ? `${e.commits} chronicle commit(s) since, plot threads ${e.threads.length ? e.threads.join(" ") : "none"}` : "no folder on this host"}`);
    }
    if (d.missing.length) lines.push(`- labels with no path or checkout here: ${d.missing.join(", ")}`);
    if (d.text !== undefined) lines.push("", "Words (for the seat only, never committed):", "", "```", d.text, "```");
    lines.push("");
  }
  return lines.join("\n");
}

function main(argv) {
  const [cmd, ...rest] = argv;
  if (cmd !== "facts") {
    console.error("usage: drafts-witness.mjs facts [--older-than-days N] [--words] [--summary] [--out <file.md>]");
    return 2;
  }
  const opt = (name) => {
    const i = rest.indexOf(name);
    return i === -1 ? null : rest[i + 1];
  };
  const olderThan = Number(opt("--older-than-days") ?? 3);
  const words = rest.includes("--words");
  const at = new Date().toISOString();
  const seen = readDrafts({ words })
    .filter((d) => d.kind === "mctgo" && !d.closed_at && ageDays(d.opened_at) >= olderThan)
    .map(witness);
  const md = toMarkdown(seen, { olderThan, at });
  const out = opt("--out");
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, md);
  }
  if (rest.includes("--summary")) {
    console.log(JSON.stringify({
      at, older_than_days: olderThan, waiting: seen.length, file: out,
      drafts: seen.map((d) => ({
        id: d.id, team: d.team, target: d.target, age_days: d.age_days, started: d.session.running || !!d.session.record,
        commits: d.repos.reduce((n, r) => n + r.commits.length, 0),
        without_issue: d.repos.reduce((n, r) => n + r.commits.filter((c) => !c.issue).length, 0),
        episodes: d.episodes.map((e) => e.n),
      })),
    }));
  } else if (!out) {
    console.log(md);
  }
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
