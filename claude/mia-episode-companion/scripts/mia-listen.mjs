#!/usr/bin/env node
// mia-listen — wakes a Claude Code session when William's next voice take lands in
// an episode's captures/. The Claude Code counterpart of the Pi episode-companion
// observer in Episode 339 (.pi/extensions/episode-companion/observer.cjs). That
// observer stays canonical for the capture contract this file re-implements:
// miadi.episode-capture.v1, byte and SHA-256 receipts on every transcription
// output, a validated English translation, raw audio never read.
//
// What differs: Pi holds a poll inside its session and injects a user message.
// Claude Code cannot, so `await` is run as a background Bash command and exits on
// the first new take, which re-invokes the session with this script's output.
// Takes recorded on the phone reach gaia through git, so `origin/<branch>` is read
// from the object store (fetch, never merge) beside the working tree.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync,
} from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import { join, posix, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const CAPTURE_SCHEMA = "miadi.episode-capture.v1";
const STATE_VERSION = 1;
const STABILITY_POLL_MS = 3_000;

const EXIT_NO_EPISODE = 2;
const EXIT_UNDELIVERED = 3;
const EXIT_TIMEOUT = 4;

// ---------- capture validation ----------

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function blocked(takeId, blocker) {
  return { ok: false, takeId, blocker };
}

function message(error) {
  return error instanceof Error ? error.message.split("\n")[0] : String(error);
}

// readOutput(relativePath) returns the bytes of one declared transcription output or throws.
export function validateBundle({ takeId, episodeFolder, captureBytes, readOutput }) {
  let meta;
  try {
    meta = JSON.parse(captureBytes.toString("utf8"));
  } catch (error) {
    return blocked(takeId, `capture.json is not valid JSON: ${message(error)}`);
  }
  if (meta?.schema !== CAPTURE_SCHEMA) return blocked(takeId, `capture schema is not ${CAPTURE_SCHEMA}`);
  if (meta?.episode?.path !== episodeFolder) {
    return blocked(takeId, `capture belongs to ${String(meta?.episode?.path ?? "no episode")}, not ${episodeFolder}`);
  }

  const outputs = meta?.transcription?.outputs;
  if (!Array.isArray(outputs) || outputs.length === 0) return blocked(takeId, "capture declares no transcription outputs");

  const validated = [];
  for (const output of outputs) {
    const language = String(output?.language ?? "");
    const filename = String(output?.filename ?? "");
    const relativePath = String(output?.relativePath ?? "");
    const bytes = Number(output?.bytes);
    const expected = String(output?.sha256 ?? "").toLowerCase();

    const safePath = relativePath.startsWith(`captures/${takeId}/`)
      && posix.normalize(relativePath) === relativePath
      && !relativePath.split("/").includes("..")
      && posix.basename(relativePath) === filename;
    if (!filename || !safePath) return blocked(takeId, `transcription output ${filename || language || "?"} has an unsafe path`);
    if (!Number.isSafeInteger(bytes) || bytes < 0) return blocked(takeId, `${filename} has an invalid byte receipt`);
    if (!/^[0-9a-f]{64}$/.test(expected)) return blocked(takeId, `${filename} has an invalid SHA-256 receipt`);

    let data;
    try {
      data = readOutput(relativePath);
    } catch (error) {
      return blocked(takeId, `${filename} is not finalized: ${message(error)}`);
    }
    if (data.byteLength !== bytes) return blocked(takeId, `${filename} byte receipt does not match`);
    if (sha256(data) !== expected) return blocked(takeId, `${filename} SHA-256 receipt does not match`);
    validated.push({ language, filename, relativePath, bytes, sha256: expected, text: data.toString("utf8") });
  }

  const english = validated.find((output) => output.language === "en");
  if (!english) return blocked(takeId, "capture has no validated English translation");

  const signature = sha256(JSON.stringify({
    capture: sha256(captureBytes),
    outputs: validated
      .map(({ language, relativePath, sha256: hash }) => ({ language, relativePath, sha256: hash }))
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath)),
  }));

  return {
    ok: true,
    takeId,
    key: `${takeId}:${english.sha256}`,
    signature,
    sourceFilename: String(meta?.source?.filename ?? meta?.transcription?.sourceFilename ?? ""),
    capturedAt: String(meta?.transcription?.timestamp ?? meta?.storedAt ?? ""),
    english,
    outputs: validated.map(({ text: _text, ...rest }) => rest),
  };
}

// ---------- sources ----------

export function scanWorktree(episodeRoot, episodeFolder) {
  const capturesRoot = join(episodeRoot, "captures");
  if (!existsSync(capturesRoot)) return [];
  return readdirSync(capturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((takeId) => {
      const takeRoot = join(capturesRoot, takeId);
      const captureJson = join(takeRoot, "capture.json");
      if (!existsSync(captureJson)) return { ...blocked(takeId, "capture.json has not finalized yet"), source: "worktree" };
      const readOutput = (relativePath) => {
        const canonicalTake = realpathSync(takeRoot);
        const canonical = realpathSync(resolve(episodeRoot, relativePath));
        if (!canonical.startsWith(canonicalTake + sep)) throw new Error("resolves outside its take directory");
        if (!statSync(canonical).isFile()) throw new Error("is not a file");
        return readFileSync(canonical);
      };
      let captureBytes;
      try {
        captureBytes = readFileSync(captureJson);
      } catch (error) {
        return { ...blocked(takeId, `capture.json is unreadable: ${message(error)}`), source: "worktree" };
      }
      return { ...validateBundle({ takeId, episodeFolder, captureBytes, readOutput }), source: "worktree" };
    });
}

function git(cwd, args, { encoding = "utf8", timeout = 60_000 } = {}) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding, timeout, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024,
  });
}

function gitContext(episodeRoot) {
  try {
    const prefix = git(episodeRoot, ["rev-parse", "--show-prefix"]).trim();
    let upstream = "origin/main";
    try {
      upstream = git(episodeRoot, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).trim() || upstream;
    } catch { /* detached or no upstream: fall back to origin/main */ }
    const slash = upstream.indexOf("/");
    return { prefix, upstream, remote: upstream.slice(0, slash), branch: upstream.slice(slash + 1) };
  } catch {
    return null;
  }
}

function fetchUpstream(episodeRoot, ctx) {
  try {
    git(episodeRoot, ["fetch", "--quiet", ctx.remote, ctx.branch], { timeout: 90_000 });
    return "";
  } catch (error) {
    return `fetch ${ctx.upstream} failed: ${message(error)}`;
  }
}

const remoteCache = { rev: "", results: [] };

export function scanRemote(episodeRoot, episodeFolder, ctx) {
  let rev;
  try {
    rev = git(episodeRoot, ["rev-parse", ctx.upstream]).trim();
  } catch {
    return [];
  }
  if (rev === remoteCache.rev) return remoteCache.results;

  const catFile = (relativePath) =>
    git(episodeRoot, ["cat-file", "blob", `${rev}:${ctx.prefix}${relativePath}`], { encoding: "buffer" });
  let listing = "";
  try {
    listing = git(episodeRoot, ["ls-tree", "-r", "--name-only", rev, "--", "captures/"]);
  } catch {
    listing = "";
  }
  const takes = listing.split("\n")
    .map((line) => line.match(/^captures\/([^/]+)\/capture\.json$/)?.[1])
    .filter(Boolean)
    .sort();
  const results = takes.map((takeId) => {
    let captureBytes;
    try {
      captureBytes = catFile(`captures/${takeId}/capture.json`);
    } catch (error) {
      return { ...blocked(takeId, `capture.json unreadable on ${ctx.upstream}: ${message(error)}`), source: ctx.upstream };
    }
    return { ...validateBundle({ takeId, episodeFolder, captureBytes, readOutput: catFile }), source: ctx.upstream };
  });
  remoteCache.rev = rev;
  remoteCache.results = results;
  return results;
}

// Union by identity. A take present in both places is reported from the worktree.
function scanAll(episode, { fetch }) {
  const warnings = [];
  const local = scanWorktree(episode.root, episode.folder);
  let remote = [];
  if (episode.git) {
    if (fetch) {
      const warning = fetchUpstream(episode.root, episode.git);
      if (warning) warnings.push(warning);
    }
    remote = scanRemote(episode.root, episode.folder, episode.git);
  }
  const byKey = new Map();
  const blockers = new Map();
  for (const result of [...remote, ...local]) {
    if (result.ok) byKey.set(result.key, result);
    else blockers.set(`${result.takeId}@${result.source}`, result);
  }
  // A blocker is stale once the same take validates somewhere.
  const validTakes = new Set([...byKey.values()].map((result) => result.takeId));
  const liveBlockers = [...blockers.values()].filter((result) => !validTakes.has(result.takeId));
  return {
    takes: [...byKey.values()].sort((a, b) => a.takeId.localeCompare(b.takeId)),
    blockers: liveBlockers,
    warnings,
  };
}

// ---------- episode + state ----------

function findEpisode(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "episode.yaml"))) break;
    const parent = resolve(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
  const manifest = readFileSync(join(dir, "episode.yaml"), "utf8");
  const number = manifest.match(/^episode:\s*(\d+)\s*$/m)?.[1];
  const folder = dir.split(sep).pop();
  return { root: dir, folder, number: number ? Number(number) : undefined, git: gitContext(dir) };
}

export function stateDir() {
  return process.env.MIADI_MIA_COMPANION_STATE_DIR
    || join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "miadi-mia-companion");
}

function statePath(episode) {
  return join(stateDir(), `${episode.folder}.json`);
}

function loadState(episode) {
  try {
    const state = JSON.parse(readFileSync(statePath(episode), "utf8"));
    if (state?.version === STATE_VERSION && Array.isArray(state.baseline) && Array.isArray(state.delivered)) return state;
  } catch { /* absent or unreadable: a new baseline is taken */ }
  return null;
}

function saveState(episode, state) {
  const path = statePath(episode);
  mkdirSync(stateDir(), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, path);
}

// Takes already present when a seat first listens are its baseline: heard by
// someone before, never a wake for this seat.
function ensureState(episode, takes) {
  const existing = loadState(episode);
  if (existing) return { state: existing, created: false };
  const state = {
    version: STATE_VERSION,
    episode: episode.folder,
    createdAt: new Date().toISOString(),
    baseline: takes.map((take) => take.key),
    delivered: [],
  };
  saveState(episode, state);
  return { state, created: true };
}

function unheard(state, takes) {
  const heard = new Set([...state.baseline, ...state.delivered]);
  return takes.filter((take) => !heard.has(take.key));
}

// ---------- output ----------

function episodeLabel(episode) {
  return episode.number ? `episode ${episode.number} (${episode.folder})` : episode.folder;
}

const CONTEXT_CHARS = 700;

// What Mia would otherwise go looking for, bounded: the companion ceremony's latest
// note (the one carrying a thread ledger, else the most recently touched) and the
// threads still open. A wake that carries this spares a turn of exploration.
export function wakeContext(episodeRoot) {
  const ceremoniesRoot = join(episodeRoot, "ceremonies");
  if (!existsSync(ceremoniesRoot)) return [];
  const ceremonies = readdirSync(ceremoniesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ceremoniesRoot, entry.name, "notes.md")))
    .map((entry) => {
      const dir = join(ceremoniesRoot, entry.name);
      return {
        id: entry.name,
        dir,
        ledger: existsSync(join(dir, "thread-ledger.json")),
        mtime: statSync(join(dir, "notes.md")).mtimeMs,
      };
    })
    .sort((a, b) => Number(b.ledger) - Number(a.ledger) || b.mtime - a.mtime);
  const ceremony = ceremonies[0];
  if (!ceremony) return [];

  const lines = [];
  const note = readFileSync(join(ceremony.dir, "notes.md"), "utf8").trim();
  if (note) {
    let excerpt = note.slice(0, CONTEXT_CHARS);
    if (note.length > CONTEXT_CHARS) {
      const cut = Math.max(excerpt.lastIndexOf("\n"), excerpt.lastIndexOf(". "));
      if (cut > CONTEXT_CHARS / 2) excerpt = excerpt.slice(0, cut + 1);
      excerpt += ` … (${note.length - excerpt.length} more chars in ceremonies/${ceremony.id}/notes.md)`;
    }
    lines.push(`Latest ceremony note (ceremonies/${ceremony.id}/notes.md):`, excerpt, "");
  }
  if (ceremony.ledger) {
    try {
      const ledger = JSON.parse(readFileSync(join(ceremony.dir, "thread-ledger.json"), "utf8"));
      const open = (ledger.threads ?? []).filter((thread) => ["active", "emerging", "blocked"].includes(thread.state));
      if (open.length) {
        lines.push(`Open threads: ${open.slice(0, 8).map((thread) => `${thread.id} (${thread.state})`).join(", ")}`, "");
      }
    } catch { /* an unreadable ledger is context lost, not a failure to wake */ }
  }
  return lines;
}

// Whether the take's textual records are committed in this checkout, and if not, the
// one command that commits them by name and pushes (integrating once on a refusal).
export function commitLine(episode, take) {
  if (take.source !== "worktree") return `Committed: yes, on ${take.source}.`;
  const takeDir = join(episode.root, "captures", take.takeId);
  const textual = readdirSync(takeDir)
    .filter((name) => name === "capture.json" || name === "transcription.json" || /^transcription_.*\.txt$/.test(name))
    .sort()
    .map((name) => `captures/${take.takeId}/${name}`);
  const R = `git -C "${episode.root}"`;
  let tracked = false;
  try {
    git(episode.root, ["ls-files", "--error-unmatch", "--", ...textual]);
    tracked = true;
  } catch { /* at least one textual record is untracked or git is absent */ }
  if (tracked) {
    if (!episode.git) return "Committed: yes.";
    try {
      const commit = git(episode.root, ["log", "-1", "--format=%H", "--", ...textual]).trim();
      git(episode.root, ["merge-base", "--is-ancestor", commit, episode.git.upstream]);
      return `Committed: yes, and pushed (on ${episode.git.upstream}).`;
    } catch {
      return `Committed: yes, not yet on ${episode.git.upstream}. Push: ${R} push -q`;
    }
  }
  if (!episode.git) return "Committed: no, and this episode is not in a git checkout.";
  const label = episode.number ? `Episode ${episode.number}` : episode.folder;
  return [
    "Committed: no. Commit its textual records by name, never the audio:",
    `  ${R} add -- ${textual.join(" ")} && ${R} commit -q -m "Store ${take.takeId} in ${label}" && { ${R} push -q || { ${R} pull -q --no-rebase --no-edit && ${R} push -q; }; }`,
  ].join("\n");
}

export function formatWake(episode, takes, { rearm = true } = {}) {
  const lines = [
    `NEW TAKE${takes.length > 1 ? "S" : ""} FROM WILLIAM · ${episodeLabel(episode)}`,
    "",
  ];
  for (const take of takes) {
    const elsewhere = take.source !== "worktree" ? ` · read from ${take.source}, not yet in this checkout` : "";
    lines.push(
      `take ${take.takeId} · transcribed ${take.capturedAt || "unknown"}${elsewhere}`,
      ...take.outputs.map((output) => `  ${output.language || "?"}: ${output.relativePath} sha256=${output.sha256}`),
      `  audio (custody only, never read): ${take.sourceFilename || "unknown"}`,
      "",
      "English translation, exact validated contents:",
      take.english.text.trim(),
      "",
      commitLine(episode, take),
      "",
    );
  }
  lines.push(
    ...wakeContext(episode.root),
    "This is William speaking in the episode. Answer what he says; do not read it as a task list.",
    "Turn budget (mia-episode-companion skill): this wake carries what an ordinary take needs.",
    "1. Hear from the wake. Read a file only if the take names something the wake does not carry; at most two reads.",
    "2. Draft backstage. Send only the take text and the exact draft to the developmental-editor agent, once.",
    "3. Revise against each recommendation and give the return, short enough to say aloud.",
    rearm
      ? "4. In that same message: one Bash call that delivers the return (below) and runs the commit above if one is shown, then re-arm."
      : "4. In that same message: one Bash call that delivers the return (below) and runs the commit above if one is shown.",
    "Deliver the return to William's phone page, which waits for it and can voice it as Mia:",
    `  node "${SCRIPT}" reply ${takes.at(-1).takeId} --episode "${episode.root}" <<'MIA'`,
    "  <the final return, exactly as given>",
    "  MIA",
  );
  if (rearm) {
    lines.push(`After your return, re-arm in the background: node "${SCRIPT}" await --episode "${episode.root}"`);
  }
  return lines.join("\n");
}

function printStatus(episode, state, scan, created) {
  const pending = unheard(state, scan.takes);
  const lastDelivered = state.delivered.at(-1);
  console.log([
    `mia-listen · ${episodeLabel(episode)}`,
    `sources: worktree${episode.git ? ` + ${episode.git.upstream}` : " (not a git checkout)"}`,
    `state: ${statePath(episode)}${created ? " (new baseline taken now)" : ""}`,
    `takes validated: ${scan.takes.length} · baseline ${state.baseline.length} · heard by this seat ${state.delivered.length}`,
    `last heard: ${lastDelivered ?? "none"}`,
    `unheard: ${pending.length ? pending.map((take) => `${take.takeId} (${take.source})`).join(", ") : "none"}`,
    ...scan.blockers.map((result) => `waiting: ${result.takeId}@${result.source}: ${result.blocker}`),
    ...scan.warnings.map((warning) => `warning: ${warning}`),
  ].join("\n"));
}

// ---------- commands ----------

function parseArgs(argv) {
  const args = { _: [], interval: 20, timeout: 0, fetch: true, episode: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--episode") args.episode = argv[++i];
    else if (arg === "--interval") args.interval = Number(argv[++i]);
    else if (arg === "--timeout") args.timeout = Number(argv[++i]);
    else if (arg === "--no-fetch") args.fetch = false;
    else if (arg === "-h" || arg === "--help") args.help = true;
    else args._.push(arg);
  }
  return args;
}

const USAGE = `usage: mia-listen.mjs <command> [--episode <dir>] [--no-fetch]
  status              what this seat has heard and what is waiting
  await               block until an unheard take validates, print it, exit 0
                      [--interval <sec>=20] [--timeout <sec>=0 (none)] → exit 4 on timeout
  show <take-id>      print a take as a wake without marking it heard
  heard <take-id>     mark a take heard without printing it
  reply <take-id>     post the return on stdin to the phone page (phone-capture on this host)
The episode defaults to the nearest directory above the cwd carrying episode.yaml.
State: $MIADI_MIA_COMPANION_STATE_DIR, else $XDG_STATE_HOME/miadi-mia-companion.`;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// Who wrote this reply, read in the same invocation that posts it: the voice layer
// answers a voiced reply to this seat, and a pane id copied from elsewhere would point
// that answer at somebody else's terminal.
function currentOrigin() {
  const pane = process.env.TMUX_PANE;
  let session = "";
  if (pane) {
    try {
      session = execFileSync("tmux", ["display-message", "-p", "-t", pane, "#S"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch { /* no tmux server reachable: the pane alone is still a true statement */ }
  }
  return {
    user: userInfo().username,
    host: hostname(),
    cwd: process.cwd(),
    multiplexer: pane ? "tmux" : "none",
    ...(session ? { session } : {}),
    ...(pane ? { pane } : {}),
  };
}

async function readStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

async function postReply(episode, takeId, text) {
  const port = process.env.MIADI_PHONE_CAPTURE_PORT || "8771";
  const origin = currentOrigin();
  const response = await fetch(`http://127.0.0.1:${port}/api/replies`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ episode: episode.folder, take: takeId, text, seat: `claude-code@${origin.host}`, origin }),
  });
  const answer = await response.json().catch(() => ({}));
  if (!response.ok || !answer.success) throw new Error(answer.error || `HTTP ${response.status}`);
  return answer.id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] ?? "status";
  if (args.help || !["status", "await", "show", "heard", "reply"].includes(command)) {
    console.log(USAGE);
    return args.help ? 0 : EXIT_NO_EPISODE;
  }

  const episode = findEpisode(args.episode);
  if (!episode) {
    console.error(`mia-listen: no episode.yaml at or above ${resolve(args.episode)}; pass --episode <episode dir>`);
    return EXIT_NO_EPISODE;
  }

  if (command === "status") {
    const scan = scanAll(episode, { fetch: args.fetch });
    const { state, created } = ensureState(episode, scan.takes);
    printStatus(episode, state, scan, created);
    return 0;
  }

  if (command === "reply") {
    const takeId = args._[1];
    if (!/^\d{12}$/.test(takeId ?? "")) {
      console.error("mia-listen: reply needs a 12-digit take id, and the return on stdin");
      return EXIT_NO_EPISODE;
    }
    const text = (await readStdin()).trim();
    if (!text) {
      console.error("mia-listen: reply read no text on stdin");
      return EXIT_NO_EPISODE;
    }
    try {
      const id = await postReply(episode, takeId, text);
      console.log(`mia-listen: reply to ${takeId} delivered to the phone page (${id})`);
      return 0;
    } catch (error) {
      console.error(`mia-listen: reply not delivered to phone-capture: ${message(error)}. It stays in this conversation.`);
      return EXIT_UNDELIVERED;
    }
  }

  if (command === "show" || command === "heard") {
    const takeId = args._[1];
    const scan = scanAll(episode, { fetch: args.fetch });
    const matches = scan.takes.filter((take) => take.takeId === takeId);
    if (!matches.length) {
      console.error(`mia-listen: no validated take ${takeId ?? "(missing id)"} in ${episodeLabel(episode)}`);
      return EXIT_NO_EPISODE;
    }
    if (command === "show") {
      console.log(formatWake(episode, matches, { rearm: false }));
      return 0;
    }
    const { state } = ensureState(episode, scan.takes);
    state.delivered = [...new Set([...state.delivered, ...matches.map((take) => take.key)])];
    saveState(episode, state);
    console.log(`mia-listen: ${takeId} marked heard`);
    return 0;
  }

  // await
  const intervalMs = Math.max(5, Number.isFinite(args.interval) ? args.interval : 20) * 1000;
  const deadline = args.timeout > 0 ? Date.now() + args.timeout * 1000 : Infinity;
  const settling = new Map(); // key → signature seen on the previous poll (worktree only)
  let firstPoll = true;
  let lastWarning = "";

  for (;;) {
    const scan = scanAll(episode, { fetch: args.fetch });
    const { state, created } = ensureState(episode, scan.takes);
    if (firstPoll) {
      console.error(`mia-listen: listening on ${episodeLabel(episode)}${created ? `, baseline of ${state.baseline.length} takes taken now` : ""}`);
      firstPoll = false;
    }
    const warning = scan.warnings.join("; ");
    if (warning && warning !== lastWarning) console.error(`mia-listen: ${warning}`);
    lastWarning = warning;

    const ready = [];
    for (const take of unheard(state, scan.takes)) {
      // A committed take is stable by construction. A take still being written by a
      // recorder on this host must show the same signature on two polls.
      if (take.source !== "worktree" || settling.get(take.key) === take.signature) ready.push(take);
      else settling.set(take.key, take.signature);
    }

    if (ready.length) {
      state.delivered = [...new Set([...state.delivered, ...ready.map((take) => take.key)])];
      saveState(episode, state);
      console.log(formatWake(episode, ready));
      return 0;
    }
    if (Date.now() >= deadline) {
      console.log(`mia-listen: no new take in ${args.timeout}s on ${episodeLabel(episode)}`);
      return EXIT_TIMEOUT;
    }
    await sleep(settling.size ? Math.min(intervalMs, STABILITY_POLL_MS) : intervalMs);
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(SCRIPT)) {
  main().then((code) => { process.exitCode = code; }, (error) => {
    console.error(`mia-listen: ${error instanceof Error ? error.stack : String(error)}`);
    process.exitCode = 1;
  });
}
