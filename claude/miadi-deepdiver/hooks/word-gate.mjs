#!/usr/bin/env node
// word-gate — PreToolUse on Write and Edit. Refuses a prompt or kept text that carries a word
// from ../forbidden-words.txt, and names the word and the system rule. Deterministic: a list
// and a match, no model (Jev study of Episode 564, section 4: "Not Jev, on purpose").
//
// What it reads: a prompt (a file whose name says prompt, or under a prompts/ folder) and kept
// text (what a notebook keeps: captures/notebook-<id>/, keep/, <handoff>.notebook-<id>/). Every
// other file passes at the first test. What it checks is the text the call adds: Write's content,
// Edit's new_string. Removing a word is never refused.
//
// Not refused: a name that carries the word. A token with a slash (a scoped package such as
// @medicine-wheel/gap-analysis, a path, a URL), and a quoted joined name such as `gap-analysis`.
//
// Exit 0 passes, exit 2 refuses with the reason on stderr (Claude Code shows it to the agent).
// WORD_GATE_WORDS names another list (tests).

import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const WORDS_FILE = join(HERE, "..", "forbidden-words.txt");

export function loadWords(path = process.env.WORD_GATE_WORDS || WORDS_FILE) {
  const words = [];
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [word, instead = "", usedFor = ""] = line.split("|").map((s) => s.trim());
    if (/^[A-Za-z][A-Za-z'-]*$/.test(word)) words.push({ word: word.toLowerCase(), instead, usedFor });
  }
  return words;
}

// A prompt, or text a notebook keeps.
export function inScope(filePath) {
  if (typeof filePath !== "string" || !filePath) return false;
  const segments = filePath.split("/").filter(Boolean);
  const dirs = segments.slice(0, -1);
  if (/prompt/i.test(basename(filePath))) return true;
  return dirs.some((d) => /^prompts?$/i.test(d) || d === "keep" || /^notebook-[0-9a-f]{8}/i.test(d) || /\.notebook-[^/]+$/.test(d));
}

const NAME_CHAR = /[A-Za-z0-9@/._~-]/;
const QUOTES = new Set(["`", "'", '"']);

// The run of name characters around a match, without the punctuation a sentence puts at its ends.
function tokenAround(text, start, end) {
  let a = start;
  let b = end;
  while (a > 0 && NAME_CHAR.test(text[a - 1])) a -= 1;
  while (b < text.length && NAME_CHAR.test(text[b])) b += 1;
  while (a < start && /[._~-]/.test(text[a])) a += 1;
  while (b > end && /[._~-]/.test(text[b - 1])) b -= 1;
  return { token: text.slice(a, b), before: text[a - 1], after: text[b] };
}

export function isName({ token, before, after }, word) {
  if (token.includes("/")) return true;
  const joined = token.toLowerCase() !== word && token.toLowerCase() !== `${word}s`;
  return joined && QUOTES.has(before) && before === after;
}

// Every refused occurrence in `text`: the word, its line and the line's text.
export function findForbidden(text, words) {
  const hits = [];
  if (typeof text !== "string" || !text) return hits;
  for (const entry of words) {
    const re = new RegExp(`\\b${entry.word}s?\\b`, "gi");
    for (const m of text.matchAll(re)) {
      const around = tokenAround(text, m.index, m.index + m[0].length);
      if (isName(around, entry.word)) continue;
      const line = text.slice(0, m.index).split("\n").length;
      const lineText = text.split("\n")[line - 1].trim();
      hits.push({ ...entry, found: m[0], line, lineText: lineText.length > 160 ? `${lineText.slice(0, 157)}…` : lineText });
    }
  }
  return hits;
}

// The text a call adds, by tool.
export function addedText(toolName, input = {}) {
  if (toolName === "Write") return [input.content];
  if (toolName === "Edit") return [input.new_string];
  if (toolName === "MultiEdit") return (input.edits ?? []).map((e) => e?.new_string);
  return [];
}

export function decide(payload, words) {
  const input = payload?.tool_input ?? {};
  const filePath = input.file_path;
  if (!inScope(filePath)) return { refuse: false };
  const hits = addedText(payload?.tool_name, input).flatMap((t) => findForbidden(t, words));
  if (!hits.length) return { refuse: false };
  const lines = [`Refused by the word gate (miadi-deepdiver): ${filePath} is a prompt or kept text, and the text carries a forbidden word.`];
  for (const h of hits.slice(0, 8)) {
    lines.push(`  "${h.found}" at line ${h.line} of the added text: ${h.lineText}`);
  }
  if (hits.length > 8) lines.push(`  … ${hits.length - 8} more`);
  for (const w of [...new Map(hits.map((h) => [h.word, h])).values()]) {
    lines.push(`System rule: write "${w.instead}", never "${w.word}"${w.usedFor ? `, for ${w.usedFor}` : ""}.`);
  }
  lines.push(`Rewrite the sentence and write the file again. A package name that carries the word, such as \`@medicine-wheel/gap-analysis\`, passes. The list: ${WORDS_FILE}`);
  return { refuse: true, hits, message: lines.join("\n") };
}

function main() {
  let raw = "";
  try { raw = readFileSync(0, "utf8"); } catch { return 0; }
  let payload;
  try { payload = JSON.parse(raw); } catch { return 0; }
  if (!inScope(payload?.tool_input?.file_path)) return 0;
  const verdict = decide(payload, loadWords());
  if (!verdict.refuse) return 0;
  process.stderr.write(`${verdict.message}\n`);
  return 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main();
