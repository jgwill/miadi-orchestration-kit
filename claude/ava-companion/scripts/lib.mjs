// Shared by the hook, the diary writer and the tests. No dependencies beyond node.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Her label opens a line: "💕 :" since 0.1.1, "💕 Ava:" in sessions before it.
export const AVA_LABEL = "💕 :";
const AVA_LABEL_LINE = /(^|\n)\s*💕\s*(Ava\s*)?:/;
export const carriesAvaLabel = (text) => AVA_LABEL_LINE.test(text);
export const PLUGIN_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

export function readTranscript(file) {
  if (!file || !fs.existsSync(file)) return [];
  const entries = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try { entries.push(JSON.parse(line)); } catch { /* a torn last line while the session writes */ }
  }
  return entries;
}

function textBlocks(content) {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];
  return content.filter((b) => b && b.type === "text" && typeof b.text === "string").map((b) => b.text);
}

// Ava is present in a session once she has spoken in it under her label.
export function avaSpoke(entries) {
  return entries.some((e) => e.type === "assistant" && !e.isSidechain &&
    textBlocks(e.message?.content).some(carriesAvaLabel));
}

export function sessionTitle(entries) {
  let title = "";
  for (const e of entries) {
    if (e.type === "custom-title" && e.customTitle) title = e.customTitle;
    else if (e.type === "ai-title" && e.aiTitle && !title) title = e.aiTitle;
  }
  return title;
}

function cleanUserText(text) {
  if (/^\s*<local-command-(caveat|stdout)>/.test(text)) return "";
  let t = text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "");
  const cmd = t.match(/<command-name>([^<]*)<\/command-name>/);
  if (cmd) {
    const args = t.match(/<command-args>([\s\S]*?)<\/command-args>/);
    t = `${cmd[1].trim()} ${args ? args[1].trim() : ""}`;
  }
  return t.replace(/\x1b\[[0-9;]*m/g, "").trim();
}

function clip(text, max) {
  return text.length > max ? `${text.slice(0, max)} […${text.length - max} more characters]` : text;
}

// The host's local time, so the diary says 21:52 when he was at his desk at 21:52, not 01:52.
function stamp(ts) {
  if (!ts) return "--:--";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "--:--";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function localZone(date = new Date()) {
  const name = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(date)
    .find((x) => x.type === "timeZoneName")?.value;
  return name || Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
}

// A background task's notification arrives as a user turn. It is not Guillaume speaking.
function notificationLine(text) {
  const tag = (name) => (text.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)) || [])[1]?.trim() || "";
  const summary = tag("summary");
  const result = tag("result");
  return `NOTIFICATION (a background task, not Guillaume): ${summary}${result ? `\n${clip(result, 14000)}` : ""}`;
}

function toolLine(block) {
  const i = block.input || {};
  const what = i.description || i.file_path || i.query || i.prompt?.slice?.(0, 80) || i.command?.slice?.(0, 80) || "";
  return `tool ${block.name}${what ? `: ${String(what).replace(/\s+/g, " ").slice(0, 120)}` : ""}`;
}

// The session as Ava will reread it: Guillaume's words, the replies, one line per tool call.
export function condense(entries, { maxChars = 160000 } = {}) {
  const lines = [];
  let firstTs = null;
  let lastTs = null;
  // A message he types while the session works is stored as a queued_command attachment,
  // not as a user turn. Without it the writer once wrote that he was silent when he was not.
  const spoken = new Set();
  for (const e of entries) {
    if (e.type === "user" && !e.isMeta) for (const raw of textBlocks(e.message?.content)) spoken.add(cleanUserText(raw));
  }
  for (const e of entries) {
    if (e.isSidechain || e.isMeta) continue;
    const ts = e.timestamp;
    const content = e.message?.content;
    let produced = false;
    if (e.type === "attachment" && e.attachment?.type === "queued_command" && e.attachment.origin?.kind === "human") {
      const t = cleanUserText(String(e.attachment.prompt || ""));
      if (t && !spoken.has(t)) {
        lines.push(`[${stamp(ts || e.attachment.timestamp)}] GUILLAUME (while the session was working): ${clip(t, 6000)}`);
        produced = true;
      }
    } else if (e.type === "user") {
      for (const raw of textBlocks(content)) {
        if (/<task-notification>/.test(raw)) { lines.push(`[${stamp(ts)}] ${notificationLine(raw)}`); produced = true; continue; }
        const t = cleanUserText(raw);
        if (t) { lines.push(`[${stamp(ts)}] GUILLAUME: ${clip(t, 6000)}`); produced = true; }
      }
    } else if (e.type === "assistant" && Array.isArray(content)) {
      for (const b of content) {
        if (b.type === "text" && b.text?.trim()) {
          const who = carriesAvaLabel(b.text) ? "AVA" : "ASSISTANT";
          lines.push(`[${stamp(ts)}] ${who}: ${clip(b.text.trim(), 8000)}`);
          produced = true;
        } else if (b.type === "tool_use") {
          lines.push(`[${stamp(ts)}] ${toolLine(b)}`);
          produced = true;
        }
      }
    }
    if (produced && ts) { firstTs ??= ts; lastTs = ts; }
  }
  let text = lines.join("\n");
  if (text.length > maxChars) {
    const head = Math.floor(maxChars * 0.25);
    const tail = maxChars - head;
    text = `${text.slice(0, head)}\n[… ${text.length - maxChars} characters from the middle of the session omitted …]\n${text.slice(-tail)}`;
  }
  return { text, firstTs, lastTs, title: sessionTitle(entries), lines: lines.length };
}

export function extractDiary(output) {
  const matches = [...String(output).matchAll(/<diary>([\s\S]*?)<\/diary>/g)];
  if (!matches.length) return null;
  const body = matches[matches.length - 1][1].trim();
  return body || null;
}

const SECRET_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{10,}/g,
  /sk-[A-Za-z0-9]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /xox[abpr]-[A-Za-z0-9-]{10,}/g,
  /mwt_[A-Za-z0-9_-]{16,}/g, // Miadi person and seat tokens
];

export function redact(text) {
  let t = String(text);
  for (const p of SECRET_PATTERNS) t = t.replace(p, "[redacted]");
  t = t.replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/g, "$1[redacted]");
  // names that end in a secret word too: MIADI_PERSON_TOKEN=..., GITHUB_TOKEN: ...
  t = t.replace(/\b(\w*?(?:token|secret|password|passwd|api[_-]?key))(["']?\s*[:=]\s*["']?)[^\s"']{8,}/gi, "$1$2[redacted]");
  return t;
}

export function slugify(text) {
  return String(text).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "session";
}

export function stateDir(env = process.env) {
  return path.join(env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state"), "ava-companion");
}

// Where her diary lives: her own diaries in sacredava when the host has them.
// (Not AVA_HOME: on gaia that is already the ava account's home directory.)
export function diaryDir(env = process.env) {
  if (env.AVA_DIARY_DIR) return env.AVA_DIARY_DIR;
  const own = path.join(env.AVA_SACREDAVA_DIR || "/src/sacredava", "diaries");
  if (fs.existsSync(own)) return own;
  return path.join(stateDir(env), "diaries");
}

// The newest entry for this session, or for a session this one shares its past with:
// a fork gets a new session id but keeps its parent's first moment (`from:`).
export function previousEntryFor(dir, sessionId, firstTs) {
  if ((!sessionId && !firstTs) || !fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  for (const f of files.slice(0, 200)) {
    const head = fs.readFileSync(f, "utf8").slice(0, 600);
    if (sessionId && head.includes(`session: ${sessionId}\n`)) return f;
    if (firstTs && head.includes(`from: ${firstTs}\n`)) return f;
  }
  return null;
}

export function transcriptFor(cwd, env = process.env) {
  if (env.AVA_COMPANION_TRANSCRIPT && fs.existsSync(env.AVA_COMPANION_TRANSCRIPT)) return env.AVA_COMPANION_TRANSCRIPT;
  const dir = path.join(os.homedir(), ".claude", "projects", String(cwd).replace(/[^a-zA-Z0-9]/g, "-"));
  if (!fs.existsSync(dir)) return null;
  const newest = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
  return newest || null;
}

export function skillBody() {
  const raw = fs.readFileSync(path.join(PLUGIN_ROOT, "skills", "ava-companion", "SKILL.md"), "utf8");
  return raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

export function pluginVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, ".claude-plugin", "plugin.json"), "utf8")).version; }
  catch { return "unknown"; }
}
