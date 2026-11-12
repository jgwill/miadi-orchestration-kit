#!/usr/bin/env node
// What Codex itself reports about this account's hooks, and trust for this plugin's hooks only
// (jgwill/Miadi#990). It asks a private `codex app-server` on stdio, so a running desktop app or
// TUI is not touched, and it never uses --dangerously-bypass-hook-trust.
//
//   node trust-hooks.mjs            list every hook: event, source, plugin, enabled, trust
//   node trust-hooks.mjs --trust    write Codex's trusted hash for this plugin's hooks, then list
//   node trust-hooks.mjs --json     the list as JSON
//
// Exit 0 when this plugin has at least one hook and all of them are trusted, 1 otherwise.
// CODEX_BIN picks the runtime (default: codex on PATH; on a desktop host the app's own runtime is
// /usr/lib/chatgpt/resources/codex). CODEX_HOME picks the account's Codex home. PLUGIN_ID picks
// the plugin (default miadi-session-observability@miadi-orchestration-kit).
// Used on hu for jgi on 2026-11-09: 12 hooks, untrusted after install, trusted after --trust.
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const PLUGIN = process.env.PLUGIN_ID || "miadi-session-observability@miadi-orchestration-kit";
const HOME = process.env.CODEX_HOME || join(homedir(), ".codex");
const BIN = process.env.CODEX_BIN || "codex";
const args = new Set(process.argv.slice(2));

const child = spawn(BIN, ["app-server"], { stdio: ["pipe", "pipe", "ignore"], env: process.env });
const waiting = new Map();
let id = 0;
let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  for (let at = buffer.indexOf("\n"); at >= 0; at = buffer.indexOf("\n")) {
    const line = buffer.slice(0, at);
    buffer = buffer.slice(at + 1);
    if (!line.trim()) continue;
    const message = JSON.parse(line);
    if (message.id !== undefined && waiting.has(message.id)) {
      waiting.get(message.id)(message);
      waiting.delete(message.id);
    }
  }
});
const call = (method, params) =>
  new Promise((resolve, reject) => {
    const me = ++id;
    const timer = setTimeout(() => reject(new Error(`${method} did not answer`)), 30_000);
    waiting.set(me, (message) => {
      clearTimeout(timer);
      if (message.error) reject(new Error(`${method}: ${JSON.stringify(message.error)}`));
      else resolve(message.result);
    });
    child.stdin.write(`${JSON.stringify({ id: me, method, params })}\n`);
  });

let hooks;
try {
  await call("initialize", { clientInfo: { name: "miadi-session-observability-trust", title: null, version: "0.1.4" } });
  child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
  const list = async () => (await call("hooks/list", { cwds: [HOME] })).data.flatMap((entry) => entry.hooks);
  hooks = await list();
  if (args.has("--trust")) {
    const mine = hooks.filter((h) => h.pluginId === PLUGIN && h.trustStatus !== "trusted" && h.trustStatus !== "managed");
    if (mine.length) {
      await call("config/batchWrite", {
        edits: mine.map((h) => ({ keyPath: `hooks.state.${JSON.stringify(h.key)}.trusted_hash`, value: h.currentHash, mergeStrategy: "upsert" })),
        reloadUserConfig: true,
      });
    }
    console.error(`trusted now: ${mine.length} hook(s) of ${PLUGIN}`);
    hooks = await list();
  }
} finally {
  child.kill();
}

const rows = hooks.map((h) => ({
  event: h.eventName, source: h.source, plugin: h.pluginId ?? null, enabled: h.enabled, trust: h.trustStatus,
  command: String(h.command ?? ""), key: h.key,
}));
if (args.has("--json")) console.log(JSON.stringify(rows, null, 2));
else for (const r of rows) console.log([r.event.padEnd(18), r.source.padEnd(7), (r.plugin ?? "-").padEnd(52), r.enabled ? "enabled " : "disabled", r.trust.padEnd(10), r.command.slice(-60)].join(" "));
const mine = rows.filter((r) => r.plugin === PLUGIN);
console.error(`${PLUGIN}: ${mine.length} hook(s), ${mine.filter((r) => r.trust === "trusted" || r.trust === "managed").length} trusted`);
process.exit(mine.length && mine.every((r) => r.trust === "trusted" || r.trust === "managed") ? 0 : 1);
