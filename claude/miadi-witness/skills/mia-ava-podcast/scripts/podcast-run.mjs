#!/usr/bin/env node
// podcast-run.mjs: the steps of one podcast request that take no writing model.
//
// Guillaume, 2026-11-06: the agent that writes a podcast needs context beyond the message, and
// Episode 564's decision model says which files it reads. So code lists what could matter, Jev
// judges each file, and the writer starts from the verdicts instead of reading a hundred files.
//
//   node podcast-run.mjs handoff <folder> [--dry]
//   node podcast-run.mjs done <folder> --joined <id> --audio-file <name> --turns <n>
//                                      [--seconds <n>] [--episode-file <path>]
//   node podcast-run.mjs failed <folder> --reason "<what stopped it>"
//
// <folder> holds request.json (written by POST /api/voice/podcast, or by hand for a run with no
// app) and content.md when text was sent. `handoff` writes beside them:
//   source.md      what the dialogue is about: the text sent, what the person last asked the
//                  session, the session's last message
//   context.md     who asked, the relations, what the person wants brought out
//   session/       one file per earlier exchange and the session's digest, for the gate to judge
//   handoff.md     the verdicts: what to read whole, what to read from a line, what stays closed
//   handoff.json   the same, for the status door
//
// How the cut is made, measured on the first request (2026-11-06, 43 files, 2,930 lines): with
// read-gate's bars alone Jev admitted 2,230 of 2,237 lines, because every file bears on a broad
// mission. So the message itself goes in as what is known, a file scores relevant x new_to_us, and
// the writer gets the best files that fit MIADI_PODCAST_READ_LINES. Nothing here is calibrated.
//
// What leaves the host: the mission and the content of each candidate, sent to Jev by read-gate.mjs
// (its header says so). A candidate is only a text file under MIADI_PODCAST_READ_ROOTS, never a
// dotfile store, and never a file that looks as if it holds a key. The raw transcript never leaves.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs"
import { dirname, extname, isAbsolute, join, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const READ_GATE = process.env.MIADI_READ_GATE || resolve(HERE, "../../../scripts/read-gate.mjs")

export const MAX_CANDIDATES = 60
export const MAX_EXCHANGES = 30
/** Lines the writer reads beyond the message, unless MIADI_PODCAST_READ_LINES says otherwise. */
export const READ_LINES = 500
/** Below this relevant x new_to_us a file stays closed whatever room is left. */
export const SCORE_FLOOR = 0.4
/** What a skim or a read from a line is counted as, since the seat stops well before the end. */
const PARTIAL_LINES = 40
const TEXT_FILE = new Set([".md", ".markdown", ".txt", ".yaml", ".yml", ".json", ".mjs", ".js", ".ts", ".tsx", ".py", ".sh", ".toml"])
const CLOSED_SEGMENT = /^(\.env.*|\.ssh|\.gnupg|\.aws|\.git|node_modules|\.next.*)$/
const CLOSED_NAME = /(secret|credential|token|password|\.pem$|\.key$)/i
const HOLDS_A_KEY = /((?<![A-Za-z0-9-])sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|\b[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*['"]?[^\s'"$<{]{12,})/

// ---------- pure ----------

/** The folders a candidate may come from: MIADI_PODCAST_READ_ROOTS, else this host's shared trees. */
export function readRoots(env = process.env) {
  const named = env.MIADI_PODCAST_READ_ROOTS?.split(":").map((s) => s.trim()).filter(Boolean)
  if (named?.length) return named
  return [env.MIADI_CHRONICLE_ROOT || "/srv/miadi/episodes/miadi-chronicle", "/home/mia/workspace", "/workspace/repos", "/a/src", "/src", "/srv/miadi"]
}

/** Whether a path may be judged at all: a text file's name, under a root, in no key store. */
export function mayBeJudged(path, roots) {
  if (!isAbsolute(path)) return false
  if (!roots.some((root) => path === root || path.startsWith(root.endsWith(sep) ? root : root + sep))) return false
  if (path.split(sep).some((segment) => CLOSED_SEGMENT.test(segment))) return false
  const name = path.split(sep).pop() ?? ""
  if (CLOSED_NAME.test(name)) return false
  return TEXT_FILE.has(extname(name).toLowerCase())
}

export function holdsAKey(text) {
  return HOLDS_A_KEY.test(text)
}

/** Text a person typed, not what the harness put in the same place. */
export function isPersonText(text) {
  const t = text.trimStart()
  return Boolean(t) && !/^(Stop hook feedback|<task-notification|<system-reminder|<command-|<local-command|Caveat:|\[Request interrupted)/.test(t)
}

function textOf(content) {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content.filter((b) => b?.type === "text" && typeof b.text === "string").map((b) => b.text).join("\n")
}

/**
 * The person's words and what answered them, from a Claude Code transcript's lines. A reply is the
 * longest text of its turn, because a hook can bounce a short note after the real answer, and the
 * text-less tool steps of a turn are left out.
 */
export function exchangesFrom(lines) {
  const exchanges = []
  let current = null
  for (const line of lines) {
    let row
    try {
      row = JSON.parse(line)
    } catch {
      continue
    }
    if (row.isMeta || (row.type !== "user" && row.type !== "assistant")) continue
    const text = textOf(row.message?.content)
    if (row.type === "user") {
      if (!isPersonText(text)) continue
      current = { at: row.timestamp ?? null, person: text.trim(), reply: "" }
      exchanges.push(current)
    } else if (text.trim()) {
      if (!current) {
        current = { at: row.timestamp ?? null, person: "", reply: "" }
        exchanges.push(current)
      }
      if (text.trim().length >= current.reply.length) current.reply = text.trim()
    }
  }
  return exchanges
}

/** Absolute paths a message names, without the punctuation that follows them in a sentence. */
export function namedPaths(text) {
  const found = new Set()
  for (const match of text.matchAll(/(?<![\w./:-])\/(?:[\w@+.-]+\/)+[\w@+.-]*/g)) found.add(match[0].replace(/[.,;:)]+$/, "").replace(/\/$/, ""))
  return [...found]
}

/** Episode numbers a message names: miadi-chronicle://567, or "Episode 567". */
export function namedEpisodes(text) {
  const found = new Set()
  for (const match of text.matchAll(/miadi-chronicle:(?:\/\/)?(\d{1,4})\b|\b[Ee]pisode\s+(\d{1,4})\b/g)) found.add(Number(match[1] ?? match[2]))
  return [...found]
}

/** The gate's mission: what is being done next and for whom, never a rule (read gate, step 1). */
export function missionFor({ source, focus, listener }) {
  const who = listener || "the person who asked"
  const parts = [`A podcast dialogue between Mia and Ava is being written so that ${who} can hear, away from the screen, what this message says, what it decided and what it asks of them.`]
  if (focus) parts.push(`${who} wants it to bring out: ${focus}`)
  parts.push(`The message begins: ${source.slice(0, 1500)}`)
  return parts.join(" ")
}

/** How the writer reads a file, from the gate's verdict (read gate, step 4). */
export function howToRead(record) {
  const from = record.section?.line ? `line ${record.section.line} (${record.section.text})` : null
  if (record.verdict === "read") {
    if (record.action === "read_whole" && record.action_above_bar) return "whole"
    return from ? `the beginning, then from ${from}` : "whole"
  }
  if (record.verdict === "skim") return from ? `from ${from}` : "the first forty lines"
  if (record.verdict === "ask") return "your own eyes decide: Jev did not answer, record a ruling"
  return "stays closed"
}

/** Relevant x new_to_us: a file that bears on the mission and says what the message does not. */
export function scoreOf(record) {
  if (typeof record.relevant !== "number") return null
  return record.relevant * (typeof record.new_to_us === "number" ? record.new_to_us : 1)
}

function linesRead(record) {
  const lines = record.lines ?? 0
  return howToRead(record) === "whole" ? lines : Math.min(lines, PARTIAL_LINES)
}

/**
 * Best score first, each file that fits the budget is admitted and the others stay closed, with
 * the reason beside them. A file Jev did not answer for is left to the writer's eyes.
 */
export function chooseFiles(records, { budget = READ_LINES, floor = SCORE_FLOOR } = {}) {
  let left = budget
  return records
    .map((record) => ({ ...record, score: scoreOf(record) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .map((record) => {
      if (record.verdict === "ask") return { ...record, admitted: true }
      if (record.verdict === "skip") return { ...record, admitted: false, closed: "the gate closed it" }
      if ((record.score ?? 0) < floor) return { ...record, admitted: false, closed: "scored under the floor" }
      const cost = linesRead(record)
      if (cost > left) return { ...record, admitted: false, closed: "past the reading budget" }
      left -= cost
      return { ...record, admitted: true }
    })
}

const fmt = (n) => (typeof n === "number" ? n.toFixed(2) : "?")

export function handoffText({ id, chosen, skipped, shown, dry }) {
  const row = (r) => `| ${shown(r.path)} | ${r.lines ?? "?"} | ${fmt(r.score)} | ${r.admitted ? howToRead(r) : r.closed} |`
  const table = (rows) => (rows.length ? ["| file | lines | score | how |", "|---|---|---|---|", ...rows.map(row)] : ["None."])
  const lines = [`# Handoff for podcast request ${id}`, ""]
  lines.push("Read `request.json`, `context.md` and `source.md` whole. Then read the files below as each line says. Open nothing else without recording a ruling: `read-gate.mjs --ruling read --by <you> --path <file>`.", "")
  if (dry) lines.push("Jev gave no answers for this request. Every candidate is listed for you to choose.", "")
  lines.push("## Read", "", ...table(chosen.filter((r) => r.admitted)), "")
  lines.push("## Closed", "", ...table(chosen.filter((r) => !r.admitted)), "")
  if (skipped.length) lines.push("## Not offered to the gate", "", ...skipped.map((s) => `- ${shown(s.path)}: ${s.reason}`), "")
  return `${lines.join("\n")}\n`
}

// ---------- reading the host ----------

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"))
}

function digestOf(sessionId) {
  try {
    return {
      text: execFileSync("miadi-hooks-interpret", ["digest", sessionId], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }),
      json: JSON.parse(execFileSync("miadi-hooks-interpret", ["digest", sessionId, "--json"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] })),
    }
  } catch {
    return null
  }
}

function episodeFolder(root, number) {
  if (!existsSync(root)) return null
  const pad = String(number).padStart(3, "0")
  const name = readdirSync(root).find((n) => new RegExp(`^\\d{4}-\\d{2}-\\d{2}-episode-0*${number}-`).test(n) || n.includes(`-episode-${pad}-`))
  return name ? join(root, name) : null
}

/** A folder's own text files, without its subfolders: listing, never reading. */
function listFolder(folder) {
  return readdirSync(folder, { withFileTypes: true }).filter((e) => e.isFile() && !e.name.startsWith(".")).map((e) => join(folder, e.name))
}

/** Writes the session's exchanges for the gate. Answers what the source needs from them. */
function readSession(folder, session, out) {
  const digest = digestOf(session.id)
  const transcript = session.transcript_path || (Array.isArray(digest?.json) ? digest.json[0] : digest?.json)?.transcript_path
  if (!transcript || !existsSync(transcript)) throw new Error(`no transcript for session ${session.id}`)
  const exchanges = exchangesFrom(readFileSync(transcript, "utf8").split("\n"))
  const last = exchanges.at(-1)
  if (!last?.reply) throw new Error(`session ${session.id} has no reply to speak about`)
  const dir = join(folder, "session")
  mkdirSync(dir, { recursive: true })
  const earlier = exchanges.slice(0, -1).filter((e) => e.reply).slice(-MAX_EXCHANGES)
  earlier.forEach((e, i) => {
    const file = join(dir, `exchange-${String(i + 1).padStart(2, "0")}.md`)
    writeFileSync(file, `# Exchange ${i + 1} of ${earlier.length}, ${e.at ?? "time not recorded"}\n\n## The person\n\n${e.person}\n\n## The session\n\n${e.reply}\n`)
    out.push(file)
  })
  let written = []
  if (digest) {
    const file = join(dir, "digest.md")
    writeFileSync(file, digest.text)
    out.push(file)
    const json = Array.isArray(digest.json) ? digest.json[0] : digest.json
    written = (json?.creations ?? []).map((c) => c.path).filter(Boolean)
  }
  return { last, written, exchanges: exchanges.length }
}

function handoff(folder, { dry = false, env = process.env } = {}) {
  const request = readJson(join(folder, "request.json"))
  const contentFile = join(folder, "content.md")
  const content = existsSync(contentFile) ? readFileSync(contentFile, "utf8").trim() : ""
  const offered = []
  const named = []
  let fromSession = null
  if (request.session?.id) fromSession = readSession(folder, request.session, offered)
  if (!content && !fromSession) throw new Error("the request holds no content and no session")

  const sections = []
  if (content) sections.push(`## What was sent\n\n${content}`)
  if (fromSession) {
    if (fromSession.last.person) sections.push(`## What the person last asked the session\n\n${fromSession.last.person}`)
    sections.push(`## The session's last message\n\n${fromSession.last.reply}`)
  }
  const source = `${sections.join("\n\n")}\n`
  writeFileSync(join(folder, "source.md"), source)

  const context = [
    `Request ${request.id}, asked at ${request.at} by ${request.by?.name ?? "a person not named"}.`,
    request.session?.name ? `The session it speaks about: ${request.session.name}, id ${request.session.id}${fromSession ? `, ${fromSession.exchanges} exchanges` : ""}.` : null,
    request.episode ? `It belongs to Episode ${request.episode.number}, ${request.episode.path}.` : null,
    request.ceremony ? `It relates to ceremony ${request.ceremony}.` : null,
    request.focus ? `What the person wants it to bring out: ${request.focus}` : null,
  ].filter(Boolean).join("\n")
  writeFileSync(join(folder, "context.md"), `${context}\n`)

  // Listing only. What a message names first, then what its session wrote, then the episodes.
  const roots = readRoots(env)
  const chronicle = env.MIADI_CHRONICLE_ROOT || "/srv/miadi/episodes/miadi-chronicle"
  for (const path of namedPaths(source)) {
    if (!existsSync(path)) continue
    if (statSync(path).isDirectory()) named.push(...listFolder(path))
    else named.push(path)
  }
  named.push(...(fromSession?.written ?? []).filter((p) => existsSync(p) && statSync(p).isFile()))
  const episodes = new Set(namedEpisodes(source))
  if (request.episode?.number) episodes.add(request.episode.number)
  for (const number of episodes) {
    const home = episodeFolder(chronicle, number)
    if (home) named.push(...listFolder(home))
  }

  const skipped = []
  const seen = new Set()
  const candidates = []
  const internal = realpathSync(folder)
  for (const path of [...offered, ...named]) {
    const real = existsSync(path) ? realpathSync(path) : path
    if (seen.has(real)) continue
    seen.add(real)
    if (!real.startsWith(internal + sep) && !mayBeJudged(real, roots)) {
      if (TEXT_FILE.has(extname(real).toLowerCase())) skipped.push({ path: real, reason: "outside the folders the gate may send, or a key store" })
      continue
    }
    if (holdsAKey(readFileSync(real, "utf8"))) {
      skipped.push({ path: real, reason: "looks as if it holds a key, so it was not sent" })
      continue
    }
    if (candidates.length >= MAX_CANDIDATES) {
      skipped.push({ path: real, reason: `past the ${MAX_CANDIDATES} files a request judges` })
      continue
    }
    candidates.push(real)
  }

  const shown = (p) => (p.startsWith(internal + sep) ? p.slice(internal.length + 1) : p)
  let records = []
  let gateError = null
  if (candidates.length && !dry) {
    const missionFile = join(folder, "mission.md")
    writeFileSync(missionFile, `${missionFor({ source, focus: request.focus, listener: request.listener })}\n`)
    try {
      const answer = execFileSync("node", [READ_GATE, "--mission-file", missionFile, "--known-file", join(folder, "source.md"), "--json", ...candidates], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 120_000, stdio: ["ignore", "pipe", "ignore"] })
      records = JSON.parse(answer)
    } catch (error) {
      gateError = error instanceof Error ? error.message.split("\n")[0] : String(error)
    }
  }
  if (dry || gateError) records = candidates.map((path) => ({ path, verdict: "ask", relevant: null, lines: lineCount(path) }))

  const budget = Number(env.MIADI_PODCAST_READ_LINES) > 0 ? Number(env.MIADI_PODCAST_READ_LINES) : READ_LINES
  const chosen = chooseFiles(records, { budget })
  writeFileSync(join(folder, "handoff.md"), handoffText({ id: request.id, chosen, skipped, shown, dry: dry || Boolean(gateError) }))
  const admitted = chosen.filter((r) => r.admitted)
  const summary = {
    at: new Date().toISOString(),
    gate: gateError ? "unavailable" : dry ? "dry" : "jev",
    gate_error: gateError,
    model: records[0]?.model ?? null,
    judged: chosen.length,
    admitted: admitted.length,
    closed: chosen.length - admitted.length,
    not_offered: skipped.length,
    lines_offered: chosen.reduce((n, r) => n + (r.lines ?? 0), 0),
    lines_budget: budget,
    lines_admitted: admitted.reduce((n, r) => n + linesRead(r), 0),
    paid_input_tokens: chosen.reduce((n, r) => n + (r.paid_input_tokens ?? 0), 0),
    files: chosen.map((r) => ({ path: shown(r.path), score: r.score, admitted: r.admitted, how: r.admitted ? howToRead(r) : r.closed })),
  }
  writeFileSync(join(folder, "handoff.json"), `${JSON.stringify(summary, null, 2)}\n`)
  return summary
}

function lineCount(path) {
  return readFileSync(path, "utf8").split("\n").length
}

// ---------- command line ----------

function parse(argv) {
  const opts = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("--")) opts[a.slice(2)] = true
      else {
        opts[a.slice(2)] = next
        i++
      }
    } else opts._.push(a)
  }
  return opts
}

const USAGE = "usage: podcast-run.mjs handoff <folder> [--dry] | done <folder> --joined <id> --audio-file <name> --turns <n> [--seconds <n>] [--episode-file <path>] | failed <folder> --reason <why>"

function main(argv) {
  const opts = parse(argv)
  const [verb, folderArg] = opts._
  if (!verb || !folderArg) throw new Error(USAGE)
  const folder = resolve(folderArg)
  if (!existsSync(join(folder, "request.json"))) throw new Error(`no request.json in ${folder}`)
  if (verb === "handoff") {
    const s = handoff(folder, { dry: opts.dry === true })
    console.log(`handoff.md written · gate ${s.gate}${s.gate_error ? ` (${s.gate_error})` : ""} · ${s.judged} files judged: ${s.admitted} to read, ${s.closed} closed · about ${s.lines_admitted} of ${s.lines_offered} lines · ${s.paid_input_tokens} tokens paid`)
    return
  }
  if (verb === "done") {
    for (const required of ["joined", "audio-file", "turns"]) if (typeof opts[required] !== "string") throw new Error(`done needs --${required}`)
    const result = { at: new Date().toISOString(), state: "published", joined: opts.joined, audio_file: opts["audio-file"], seconds: typeof opts.seconds === "string" ? Number(opts.seconds) : null, turns: Number(opts.turns), episode_file: typeof opts["episode-file"] === "string" ? opts["episode-file"] : null }
    writeFileSync(join(folder, "result.json"), `${JSON.stringify(result, null, 2)}\n`)
    console.log(`result.json written: ${result.audio_file}`)
    return
  }
  if (verb === "failed") {
    if (typeof opts.reason !== "string") throw new Error("failed needs --reason")
    writeFileSync(join(folder, "result.json"), `${JSON.stringify({ at: new Date().toISOString(), state: "failed", reason: opts.reason }, null, 2)}\n`)
    console.log("result.json written: failed")
    return
  }
  throw new Error(USAGE)
}

// realpath both sides: the skill is reached through a symlink, and import.meta.url is already real.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(`podcast-run: ${error.message}`)
    process.exitCode = 1
  }
}
