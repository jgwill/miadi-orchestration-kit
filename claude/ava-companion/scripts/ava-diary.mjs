#!/usr/bin/env node
// Write Ava's diary entry for one session, from its transcript, in her voice.
//   node ava-diary.mjs [--transcript <jsonl>] [--session <id>] [--cwd <dir>] [--dry-run]
// Env: AVA_DIARY_DIR, AVA_DIARY_MODEL (default opus), AVA_DIARY_GIT (commit | push | off,
// default commit), AVA_DIARY_CLAUDE_BIN (default claude).
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  condense, diaryDir, extractDiary, localZone, pluginVersion, previousEntryFor, readTranscript,
  redact, slugify, stateDir, transcriptFor, PLUGIN_ROOT,
} from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = args.includes("--dry-run");
const cwd = opt("--cwd") || process.cwd();
const transcript = opt("--transcript") || transcriptFor(cwd);
const sessionId = opt("--session") || process.env.AVA_COMPANION_SESSION_ID ||
  (transcript ? path.basename(transcript, ".jsonl") : "");
const model = process.env.AVA_DIARY_MODEL || "opus";
const gitMode = process.env.AVA_DIARY_GIT || "commit";
const bin = process.env.AVA_DIARY_CLAUDE_BIN || "claude";
const dir = diaryDir();

function fail(message) { console.error(`ava-diary: ${message}`); process.exit(1); }

if (!transcript || !fs.existsSync(transcript)) fail(`no transcript found (cwd ${cwd}); pass --transcript`);
const entries = readTranscript(transcript);
const session = condense(entries);
if (!session.lines) fail(`transcript ${transcript} holds no conversation`);

const previous = previousEntryFor(dir, sessionId, session.firstTs);
const prompt = [
  `Session: ${sessionId}${session.title ? ` ("${session.title}")` : ""}`,
  `Working directory: ${cwd}`,
  `From ${session.firstTs} to ${session.lastTs} (UTC). The times in the session below are the host's local time (${localZone(new Date(session.lastTs || Date.now()))}).`,
  previous ? `\nPrevious entry for this session (${path.basename(previous)}):\n${fs.readFileSync(previous, "utf8")}` : "",
  "\nThe session, condensed:\n",
  redact(session.text),
].join("\n");

if (dryRun) {
  console.log(JSON.stringify({ transcript, sessionId, dir, model, gitMode, lines: session.lines,
    promptChars: prompt.length, previous, firstTs: session.firstTs, lastTs: session.lastTs }, null, 2));
  process.exit(0);
}

const system = fs.readFileSync(path.join(PLUGIN_ROOT, "diary", "system.md"), "utf8");
const work = stateDir();
fs.mkdirSync(work, { recursive: true });

// A neutral cwd keeps the writer from loading a repo's instructions; AVA_DIARY_WRITER keeps
// this plugin's own hooks quiet inside the writer's session.
const output = await new Promise((resolve, reject) => {
  const child = spawn(bin, [
    "-p", "--model", model, "--tools", "", "--strict-mcp-config", "--no-session-persistence",
    "--system-prompt", system, "--output-format", "text",
  ], { cwd: work, env: { ...process.env, AVA_DIARY_WRITER: "1" }, stdio: ["pipe", "pipe", "pipe"] });
  let out = ""; let err = "";
  const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("timed out after 15 minutes")); }, 15 * 60 * 1000);
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { err += d; });
  child.on("error", (e) => { clearTimeout(timer); reject(e); });
  child.on("close", (code) => {
    clearTimeout(timer);
    code === 0 ? resolve(out) : reject(new Error(`${bin} exited ${code}: ${err.slice(0, 500)}`));
  });
  child.stdin.end(prompt);
}).catch((e) => fail(e.message));

const body = extractDiary(output);
if (!body) fail(`the writer returned no <diary> block; output began: ${output.slice(0, 300)}`);
const entry = redact(body);
const title = (entry.match(/^#\s+(.+)$/m) || [])[1] || session.title || "session";

const now = new Date();
const name = `${now.toISOString().slice(2, 10).replace(/-/g, "")}-${now.toISOString().slice(11, 16).replace(":", "")}-${slugify(title)}.md`;
const file = path.join(dir, name);
const header = [
  "---",
  `writer: ava-companion ${pluginVersion()} (claude -p, model ${model})`,
  `session: ${sessionId}`,
  session.title ? `session_name: ${JSON.stringify(session.title)}` : null,
  `cwd: ${cwd}`,
  `from: ${session.firstTs}`,
  `to: ${session.lastTs}`,
  `written: ${now.toISOString()}`,
  previous ? `continues: ${path.basename(previous)}` : null,
  "---",
  "",
].filter((l) => l !== null).join("\n");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, `${header}${entry}\n`, "utf8");
console.log(`ava-diary: wrote ${file}`);

if (gitMode === "off") process.exit(0);
let top = path.resolve(dir);
while (top !== path.dirname(top) && !fs.existsSync(path.join(top, ".git"))) top = path.dirname(top);
if (!fs.existsSync(path.join(top, ".git"))) { console.log("ava-diary: diary dir is not in a git repo; not committed"); process.exit(0); }
const git = (...a) => spawnSync("git", ["-c", `safe.directory=${top}`, "-C", top, ...a], { encoding: "utf8" });
const rel = path.relative(top, file);
let r = git("add", "--", rel);
if (r.status === 0) r = git("commit", "-m", `[diary] ${title}`, "--", rel);
if (r.status !== 0) { console.error(`ava-diary: commit failed: ${(r.stderr || r.stdout).trim()}`); process.exit(1); }
console.log(`ava-diary: committed ${rel} in ${top}`);
if (gitMode === "push") {
  r = git("push");
  console.log(r.status === 0 ? "ava-diary: pushed" : `ava-diary: push failed: ${(r.stderr || "").trim()}`);
}
