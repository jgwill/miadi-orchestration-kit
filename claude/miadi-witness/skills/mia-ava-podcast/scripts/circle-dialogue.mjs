#!/usr/bin/env node
// circle-dialogue: speak a checked Mia and Ava dialogue in a talking circle, and read
// what people answered to its turns before writing the next one (Episode 553).
//
//   node circle-dialogue.mjs post --ceremony <id> --file <dialogue.md> [--source <text>] [--from <n>] [--dry-run]
//   node circle-dialogue.mjs post --circle <circle-id> --intention "<the person's words>" \
//        [--episode-path <episode folder name>] --file <dialogue.md> [--source <text>] [--dry-run]
//   node circle-dialogue.mjs answers --ceremony <id> [--json]
//
// post: opens the ceremony when --circle is given (bound to an episode only with --episode-path,
// since a staged folder has none), writes the provenance diary entry under
// the composer's token, then posts each turn under its host's token, in order, and stops at
// the first refusal. --from <n> resumes at turn n and writes no second diary entry. It refuses
// a file with text after the first turn that is not a turn (a turn is one paragraph).
// answers: lists each turn's answers (makes sense, or does not, with the note), recorded by
// jgwill/Miadi's turn answer route. When a person answers a turn twice, the latest counts.
//
// Tokens are read by name from the environment, else from the env files below, and never
// printed: Mia MIADI_MIA_TOKEN, Ava MIADI_AVA_SEAT_TOKEN (then MIADI_AVA_TOKEN), and the seat
// that composed the dialogue, by --composer-var or CIRCLE_DIALOGUE_COMPOSER_VAR (default
// MIADI_MINO_TOKEN, the witness seat). The API is MIADI_API_URL.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HOST_TOKENS = { Mia: ["MIADI_MIA_TOKEN"], Ava: ["MIADI_AVA_SEAT_TOKEN", "MIADI_AVA_TOKEN"] };

export function envFiles(env = process.env) {
  if (env.CIRCLE_DIALOGUE_ENV_FILES) return env.CIRCLE_DIALOGUE_ENV_FILES.split(":").filter(Boolean);
  return [join(homedir(), ".env"), join(env.MIADI_SRC || "/src/Miadi", ".env"), "/home/ava/.env"];
}

/** The first of `names` set in the environment or in one of the env files, or null. */
export function resolveToken(names, env = process.env, files = envFiles(env)) {
  for (const name of names) if (env[name]) return env[name];
  for (const name of names) {
    for (const file of files) {
      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const line = text.split("\n").reverse().find((l) => l.startsWith(`${name}=`));
      if (line) return line.slice(name.length + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    }
  }
  return null;
}

/** The survey's field titles, the labelled turns in order, and any other text after the first turn. */
export function parseDialogue(text) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const turns = [];
  const fields = [];
  const stray = [];
  for (const block of blocks) {
    const m = block.match(/^(Mia|Ava): ([\s\S]+)$/);
    if (m) turns.push({ host: m[1], said: m[2].replace(/\s*\n\s*/g, " ") });
    else if (!turns.length) for (const h of block.matchAll(/^#{3,4} (.+)$/gm)) fields.push(h[1].trim());
    else stray.push(block);
  }
  return { fields, turns, stray };
}

async function call(base, token, method, path, json) {
  const res = await fetch(`${base.replace(/\/+$/, "")}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(json ? { "content-type": "application/json" } : {}) },
    ...(json ? { body: JSON.stringify(json) } : {}),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  return { ok: res.ok, status: res.status, data };
}

export async function post(opts, env = process.env, out = console.log) {
  const base = env.MIADI_API_URL;
  if (!base) throw new Error("MIADI_API_URL is not set");
  const { fields, turns, stray } = parseDialogue(readFileSync(opts.file, "utf8"));
  if (!turns.length) throw new Error(`${opts.file} has no Mia: or Ava: turns`);
  if (stray.length) throw new Error(`${opts.file} has ${stray.length} block(s) after the first turn that are not turns, starting: ${stray[0].slice(0, 60)}`);
  const from = opts.from ? Number(opts.from) : 1;
  if (!Number.isInteger(from) || from < 1 || from > turns.length) throw new Error(`--from must be a turn number from 1 to ${turns.length}`);
  const composerVar = opts.composerVar || env.CIRCLE_DIALOGUE_COMPOSER_VAR || "MIADI_MINO_TOKEN";
  const tokens = { composer: resolveToken([composerVar], env), Mia: resolveToken(HOST_TOKENS.Mia, env), Ava: resolveToken(HOST_TOKENS.Ava, env) };
  for (const [who, token] of Object.entries(tokens)) if (!token) throw new Error(`no token for ${who}: set ${who === "composer" ? composerVar : HOST_TOKENS[who].join(" or ")}`);
  const diary = [
    `I composed this dialogue from ${opts.source || basename(opts.file)}.`,
    "Mia and Ava speak words written for them here, not words they said elsewhere.",
    fields.length ? `The dialogue walks through: ${fields.join(", ")}.` : "",
    "Answer a turn when it does not make sense, or when it does and should be kept.",
  ].filter(Boolean).join(" ");
  if (opts.dryRun) {
    out(`dry run: ${turns.length} turns (${turns.filter((t) => t.host === "Mia").length} Mia, ${turns.filter((t) => t.host === "Ava").length} Ava), ${fields.length} fields${from > 1 ? `, resuming at turn ${from}` : ""}`);
    out(from > 1 ? "diary: none, resuming" : `diary: ${diary}`);
    return { ceremony: opts.ceremony ?? null, posted: 0 };
  }
  let ceremony = opts.ceremony;
  if (!ceremony) {
    const r = await call(base, tokens.composer, "POST", `/api/circles/${encodeURIComponent(opts.circle)}/ceremonies`, { intention: opts.intention, type: "talking_circle", direction: "east", ...(opts.episodePath ? { episode_path: basename(opts.episodePath) } : {}) });
    if (!r.ok) throw new Error(`opening the ceremony: HTTP ${r.status} ${r.data.error ?? ""}`);
    ceremony = r.data.ceremony.id;
    out(`opened miadi-ceremony://${ceremony}`);
  }
  if (from === 1) {
    const d = await call(base, tokens.composer, "POST", `/api/ceremony/${encodeURIComponent(ceremony)}/diary`, { content: diary, entryType: "observation" });
    if (!d.ok) throw new Error(`diary: HTTP ${d.status} ${d.data.error ?? ""}`);
  }
  let posted = 0;
  for (let n = from; n <= turns.length; n++) {
    const t = turns[n - 1];
    const resume = `Resume with --ceremony ${ceremony} --from ${n}.`;
    let r;
    try {
      r = await call(base, tokens[t.host], "POST", `/api/ceremony/${encodeURIComponent(ceremony)}/turns`, { said: t.said });
    } catch (err) {
      throw new Error(`turn ${n} (${t.host}) not sent: ${err.message}. ${posted} turns were posted. ${resume}`);
    }
    if (!r.ok) throw new Error(`turn ${n} (${t.host}) refused: HTTP ${r.status} ${r.data.error ?? ""}. ${posted} turns were posted. ${resume}`);
    posted++;
  }
  const back = await call(base, tokens.composer, "GET", `/api/ceremony/${encodeURIComponent(ceremony)}`);
  out(`miadi-ceremony://${ceremony}: ${posted} turns posted, the room reads ${back.data.turns?.length ?? "?"} turns and ${back.data.diary?.length ?? "?"} diary entries`);
  return { ceremony, posted };
}

export async function answers(opts, env = process.env, out = console.log) {
  const base = env.MIADI_API_URL;
  if (!base) throw new Error("MIADI_API_URL is not set");
  const token = resolveToken([opts.composerVar || env.CIRCLE_DIALOGUE_COMPOSER_VAR || "MIADI_MINO_TOKEN", ...HOST_TOKENS.Mia], env);
  if (!token) throw new Error("no token to read the ceremony");
  const r = await call(base, token, "GET", `/api/ceremony/${encodeURIComponent(opts.ceremony)}`);
  if (!r.ok) throw new Error(`reading the ceremony: HTTP ${r.status} ${r.data.error ?? ""}`);
  if ((r.data.turns ?? []).length && !r.data.turns.some((t) => "responses" in t)) throw new Error("this Miadi does not return answers yet (jgwill/Miadi's turn answer route is not deployed here)");
  const rows = (r.data.turns ?? []).map((t, i) => ({ index: i + 1, id: t.id, speaker: t.speaker_name ?? t.speaker, said: t.prose ?? t.description, answers: t.responses ?? [] })).filter((t) => t.answers.length);
  if (opts.json) out(JSON.stringify(rows, null, 2));
  else if (!rows.length) out("no answers yet");
  else for (const t of rows) {
    out(`turn ${t.index}, ${t.speaker}: ${t.said.slice(0, 100)}${t.said.length > 100 ? "…" : ""}`);
    for (const a of t.answers) out(`  ${a.speaker_name ?? a.speaker}: ${a.stance}${a.note ? `. ${a.note}` : ""}`);
  }
  return rows;
}

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--json") o.json = true;
    else if (a.startsWith("--")) o[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
    else o._.push(a);
  }
  return o;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const o = args(process.argv.slice(2));
  const verb = o._[0];
  const usage = readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 9).map((l) => l.replace(/^\/\/ ?/, "")).join("\n");
  try {
    if (verb === "post" && o.file && existsSync(o.file) && (o.ceremony || (o.circle && o.intention))) await post(o);
    else if (verb === "answers" && o.ceremony) await answers(o);
    else {
      console.error(usage);
      process.exit(2);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
