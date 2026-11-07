#!/usr/bin/env node
// Puts the steering hooks where Codex loads them, for this account (jgwill/Miadi#942): the adapter's
// files under $CODEX_HOME/miadi-steering, five entries in $CODEX_HOME/hooks.json beside whatever is
// there, and Codex's own trust for exactly those five, written through Codex's own app-server. Codex
// runs no hook it does not trust, and --dangerously-bypass-hook-trust would trust every other hook too.
//   node install.mjs            install or update, then print what Codex says about each hook
//   node install.mjs --check    change nothing, print the same
//   node install.mjs --remove   take the five entries out; the files and trust lines stay harmless
//   node install.mjs --also-trust-kit-plugin
//                               also trust the hooks of this kit's own Codex plugins: while any hook on
//                               the account is new or modified, the TUI stops at "Hooks need review"
//                               at start, and a brief typed into it would answer that prompt
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const home = process.env.CODEX_HOME || join(homedir(), ".codex");
const dest = join(home, "miadi-steering");
const hooksFile = join(home, "hooks.json");
const EVENTS = { SessionStart: "session-start", SessionEnd: "session-end", UserPromptSubmit: "user-prompt-submit", PostToolUse: "post-tool-use", Stop: "stop" };
const command = (arg) => `bash "${join(dest, "steering_inbox.sh")}" ${arg}`;
const ours = (group) => (group?.hooks ?? []).some((h) => String(h.command ?? "").includes("miadi-steering/steering_inbox.sh"));

function readHooks() {
  if (!existsSync(hooksFile)) return { hooks: {} };
  const parsed = JSON.parse(readFileSync(hooksFile, "utf8"));
  return { ...parsed, hooks: parsed.hooks ?? {} };
}
function writeHooks(value) {
  if (existsSync(hooksFile)) writeFileSync(`${hooksFile}.before-miadi-steering`, readFileSync(hooksFile));
  const tmp = `${hooksFile}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, hooksFile);
}

/** A short conversation with Codex's own app-server on stdio. */
async function withAppServer(fn) {
  const child = spawn("codex", ["app-server"], { stdio: ["pipe", "pipe", "ignore"], env: process.env });
  const waiting = new Map();
  let id = 0;
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    for (let at = buffer.indexOf("\n"); at >= 0; at = buffer.indexOf("\n")) {
      const line = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);
      if (!line.trim()) continue;
      const m = JSON.parse(line);
      if (m.id !== undefined && waiting.has(m.id)) {
        waiting.get(m.id)(m);
        waiting.delete(m.id);
      }
    }
  });
  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const me = ++id;
      const timer = setTimeout(() => reject(new Error(`${method} did not answer`)), 30_000);
      waiting.set(me, (m) => {
        clearTimeout(timer);
        if (m.error) reject(new Error(`${method}: ${JSON.stringify(m.error)}`));
        else resolve(m.result);
      });
      child.stdin.write(`${JSON.stringify({ id: me, method, params })}\n`);
    });
  try {
    await call("initialize", { clientInfo: { name: "miadi-steering-install", title: null, version: "0.1.0" } });
    child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
    return await fn(call);
  } finally {
    child.kill();
  }
}

const listOurs = async (call) => {
  const { data } = await call("hooks/list", { cwds: [home] });
  return data.flatMap((entry) => entry.hooks).filter((h) => String(h.command ?? "").includes("miadi-steering/steering_inbox.sh"));
};

const mode = process.argv[2];
if (mode === "--remove") {
  const hooks = readHooks();
  for (const event of Object.keys(hooks.hooks)) {
    hooks.hooks[event] = hooks.hooks[event].filter((g) => !ours(g));
    if (!hooks.hooks[event].length) delete hooks.hooks[event];
  }
  writeHooks(hooks);
  rmMarker();
  console.log("removed the steering hooks from", hooksFile);
  process.exit(0);
}
function rmMarker() {
  if (existsSync(dest)) writeFileSync(join(dest, "trusted.json"), "{}\n");
}

if (mode !== "--check") {
  mkdirSync(dest, { recursive: true, mode: 0o700 });
  for (const f of ["steering_inbox.sh", "steering_inbox.mjs", "package.json"]) copyFileSync(join(here, f), join(dest, f));
  const hooks = readHooks();
  for (const [event, arg] of Object.entries(EVENTS)) {
    const others = (hooks.hooks[event] ?? []).filter((g) => !ours(g));
    hooks.hooks[event] = [...others, { hooks: [{ type: "command", command: command(arg), timeout: 10 }] }];
  }
  writeHooks(hooks);
}

const report = await withAppServer(async (call) => {
  let found = await listOurs(call);
  const toTrust = found.filter((h) => h.trustStatus !== "trusted" && h.trustStatus !== "managed");
  if (mode === "--also-trust-kit-plugin") {
    const { data } = await call("hooks/list", { cwds: [home] });
    toTrust.push(...data.flatMap((e) => e.hooks).filter((h) => String(h.pluginId ?? "").endsWith("@miadi-orchestration-kit") && h.trustStatus !== "trusted" && h.trustStatus !== "managed"));
  }
  if (mode !== "--check" && toTrust.length) {
    await call("config/batchWrite", { edits: toTrust.map((h) => ({ keyPath: `hooks.state.${JSON.stringify(h.key)}.trusted_hash`, value: h.currentHash, mergeStrategy: "upsert" })), reloadUserConfig: true });
    found = await listOurs(call);
  }
  return found.map((h) => ({ key: h.key, event: h.eventName, trust: h.trustStatus, hash: h.currentHash }));
});
if (mode !== "--check") writeFileSync(join(dest, "trusted.json"), `${JSON.stringify(Object.fromEntries(report.filter((r) => r.trust === "trusted").map((r) => [r.key, r.hash])), null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(report.length === Object.keys(EVENTS).length && report.every((r) => r.trust === "trusted" || r.trust === "managed") ? 0 : 1);
