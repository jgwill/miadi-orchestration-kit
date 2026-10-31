#!/usr/bin/env node
// miadi-run — a terminal mission prepared from one pinned prompt version, launched only on an
// explicit word, reporting to its trace. jgwill/miadi-orchestration-kit#84.
//
//   create  <prompt-name> --text-file F [--domain d] [--trace <trace-id>] [--session S] [--commit-message T]
//   resolve <prompt-name | trace-id> [--domain d]
//   prepare --prompt <name> --version <N> --trace <trace-id> --episode <ref> [--seat mia] [--add-dir DIR]... [--domain d] [--dry-run]
//   launch  <mission> --authorized-by <who>
//   given   <mission> --session <claude-session-id | prefix | tmux-session> --authorized-by <who> [--at <iso>]
//   prompt  <mission>                                                   (the seat reads its pinned version)
//   backfill <mission>                                                  (summaries of a record made before 0.6.0, from its trace)
//   observe <mission> --kind research|return --summary <text> [--detail-file F]
//   observe --trace <trace-id> --kind research --summary <text>        (research before any mission)
//   show    <mission>
//   drafts  [--dry-run] [--quiet]                                      (tide draft versions become prompt versions)
//
// Prepare never executes: it asks `tide companion open` for its plan (no --run), and the guard in
// run() refuses --run outside launch. No prompt text is written to disk: the brief tide hands the
// seat names the pinned version, and the seat reads it from the provider with `prompt`. Launch reuses `tide companion open --run`; no launcher here.
// Langfuse is read over its public REST API with the domain's keys and written through
// `coaia fuse traces add-observation`. Keys travel in headers and in coaia's environment only.

import { createHash, randomBytes } from "node:crypto"
import { spawnSync } from "node:child_process"
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

export const DOMAINS = ["ceremony", "creative", "eng"]
// The name a terminal mission prompt carries (trace d87a4c119eb24fb4a718c29e130bd642).
export const PROMPT_NAME_RE = /^miadiRun-\d{10}-[A-Za-z0-9][A-Za-z0-9._-]*$/
export const OBSERVATION_KINDS = ["research", "preparation", "execution", "return"]
// The tide companion plan states that type the starter prompt, which carries the brief's path
// (tide_runtime/companion.py). In every other state (a seat already listening, re-armed or
// resumed) the brief never reaches the seat.
export const BRIEF_STATES = ["create", "archive-then-create", "re-arm: launch in the existing shell"]
const KEY_SUFFIXES = ["PUBLIC_KEY", "SECRET_KEY", "BASE_URL"]

export class Refusal extends Error {
  constructor(code, message) { super(message); this.code = code }
}

// ---------- domains and keys ----------

function envFileValues(env) {
  const file = env.MIADI_ENV_FILE || (env.MIADI_SRC ? join(env.MIADI_SRC, ".env") : "")
  if (!file || !existsSync(file)) return {}
  const out = {}
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(new RegExp(`^((?:${DOMAINS.map((d) => d.toUpperCase()).join("|")})_LANGFUSE_[A-Z_]+|MIADI_API_TOKEN_WRITER)=(.*)$`))
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "")
  }
  return out
}

export function domainKeys(env, domain) {
  const file = envFileValues(env)
  const p = `${domain.toUpperCase()}_LANGFUSE_`
  const [pub, sec, base] = KEY_SUFFIXES.map((s) => env[p + s] || file[p + s] || "")
  if (!pub || !sec) return null
  return { pub, sec, base: (base || "https://cloud.langfuse.com").replace(/\/$/, "") }
}

function domainsToTry(env, given) {
  if (given) {
    if (!DOMAINS.includes(given)) throw new Refusal(2, `unknown domain "${given}" (${DOMAINS.join(", ")})`)
    return [given]
  }
  return DOMAINS.filter((d) => domainKeys(env, d))
}

// A 429 is Langfuse's rate limit, not an answer about the resource: wait as it asks (at most 20 s)
// and ask again, three times, so a busy minute does not read as a missing or changed prompt.
async function langfuseGet(deps, domain, path) {
  const k = domainKeys(deps.env, domain)
  if (!k) return { status: 0 }
  for (let attempt = 0; ; attempt += 1) {
    const res = await deps.fetch(k.base + path, { headers: { Authorization: "Basic " + Buffer.from(`${k.pub}:${k.sec}`).toString("base64") } })
    if (res.status === 429 && attempt < 3) {
      const wait = Math.min(Number(res.headers?.get?.("retry-after")) || 5, 20)
      await new Promise((r) => setTimeout(r, wait * 1000))
      continue
    }
    return { status: res.status, body: res.ok ? await res.json() : null }
  }
}

// ---------- provider reads (metadata, and the one prompt body a mission pins) ----------

async function findTrace(deps, id, given) {
  for (const domain of domainsToTry(deps.env, given)) {
    const r = await langfuseGet(deps, domain, `/api/public/traces/${encodeURIComponent(id)}`)
    if (r.status === 200) {
      const t = r.body
      const observations = Array.isArray(t.observations) ? t.observations : []
      // A parentless observation becomes a root and renames the trace (measured 2026-10-11 on
      // Langfuse cloud), so every observation miadi-run adds hangs under the earliest root.
      const root = observations.filter((o) => !o.parentObservationId).sort((a, b) => String(a.startTime ?? "").localeCompare(String(b.startTime ?? "")))[0]?.id ?? null
      return { domain, id, reference: `miadi-tracing:${domain}/trace/${id}`, name: t.name ?? null, session: t.sessionId ?? null, root, timestamp: t.timestamp ?? null, observations: observations.length }
    }
  }
  return null
}

async function findPromptVersions(deps, name, given) {
  for (const domain of domainsToTry(deps.env, given)) {
    const r = await langfuseGet(deps, domain, `/api/public/v2/prompts?name=${encodeURIComponent(name)}`)
    const row = r.body?.data?.find((p) => p.name === name)
    if (row) return { domain, name, reference: `miadi-tracing:${domain}/prompt/${name}`, versions: row.versions ?? [], labels: row.labels ?? [], type: row.type ?? null }
  }
  return null
}

export function promptText(p) {
  if (typeof p.prompt === "string") return p.prompt
  if (Array.isArray(p.prompt)) return p.prompt.map((m) => `${m.role ?? "message"}: ${m.content ?? ""}`).join("\n\n")
  throw new Refusal(5, `prompt ${p.name} v${p.version} has no text`)
}

async function getPromptVersion(deps, domain, name, version) {
  const r = await langfuseGet(deps, domain, `/api/public/v2/prompts/${encodeURIComponent(name)}?version=${version}`)
  if (r.status !== 200) throw new Refusal(5, `prompt ${name} v${version} not readable in ${domain} (HTTP ${r.status})`)
  if (r.body.version !== version) throw new Refusal(5, `asked for ${name} v${version}, the provider answered v${r.body.version}`)
  const text = promptText(r.body)
  return { text, sha256: sha256(text), labels: r.body.labels ?? [] }
}

export const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex")

// ---------- commands ----------

// The one place a command runs. Outside launch, `--run` never reaches tide.
function run(deps, phase, cmd, args, options = {}) {
  if (phase !== "launch" && args.includes("--run")) throw new Refusal(9, `refused: ${cmd} --run outside launch`)
  return deps.run(cmd, args, options)
}

export function companionArgs({ episode, seat, brief, addDirs = [], launch = false }) {
  return ["companion", "open", "--episode", String(episode), "--seat", seat, "--brief", brief, ...addDirs.flatMap((d) => ["--add-dir", d]), "--format", "json", ...(launch ? ["--run"] : [])]
}

// Only these three names reach coaia; every other Langfuse variable is dropped from its environment.
function coaiaEnv(env, domain) {
  const k = domainKeys(env, domain)
  if (!k) throw new Refusal(1, `${domain.toUpperCase()}_LANGFUSE_PUBLIC_KEY or _SECRET_KEY is not set`)
  const clean = Object.fromEntries(Object.entries(env).filter(([n]) => !/LANGFUSE_/.test(n)))
  return { ...clean, LANGFUSE_PUBLIC_KEY: k.pub, LANGFUSE_SECRET_KEY: k.sec, LANGFUSE_BASE_URL: k.base }
}

// A new observation is appended; no earlier observation, trace name or prompt version is touched.
// Execution (the pinned version given to a seat) and return (what the seat made of it) are
// generations linked to that prompt version, so the prompt's page in Langfuse lists the mission
// (coaia >= 0.5.3, jgwill/coaiajs#14). Research and preparation stay events.
export const LINKED_KINDS = ["execution", "return"]

export function observationArgs({ traceId, root, session, kind, subject, input, output, metadata, prompt }) {
  if (!OBSERVATION_KINDS.includes(kind)) throw new Refusal(2, `unknown observation kind "${kind}"`)
  if (!root) throw new Refusal(4, `trace ${traceId} has no root observation to append under; appending would rename it`)
  const linked = prompt && LINKED_KINDS.includes(kind)
  return [
    "fuse", "traces", "add-observation",
    "--trace-id", traceId,
    "--parent-id", root,
    ...(linked ? ["--type", "generation", "--prompt-name", prompt.name, "--prompt-version", String(prompt.version)] : ["--type", "event"]),
    "--name", `miadi-run · ${kind} · ${subject}`,
    "--input", JSON.stringify(input ?? {}),
    "--output", JSON.stringify(output ?? {}),
    "--metadata", JSON.stringify({ miadi_run: { kind, ...metadata } }),
    ...(session ? ["--session-id", session] : []),
  ]
}

// The session that writes an event or an observation, so a reader can open the session that did
// the work (0.6.0, jgwill/Miadi#868). Claude Code gives every tool call its session id.
export const writerOf = (env) => env.CLAUDE_CODE_SESSION_ID || null

function observe(deps, phase, trace, kind, subject, payload, summary) {
  const by = writerOf(deps.env)
  const args = observationArgs({ traceId: trace.id, root: trace.root, session: trace.session, kind, subject, ...payload, metadata: { ...(payload.metadata ?? {}), ...(by ? { by } : {}) } })
  const r = run(deps, phase, "coaia", args, { env: coaiaEnv(deps.env, trace.domain) })
  return { kind, at: deps.now().toISOString(), ok: r.status === 0, ...(by ? { by } : {}), ...(summary ? { summary } : {}), ...(r.status === 0 ? {} : { error: (r.stderr || r.stdout || "").trim().slice(0, 300) }) }
}

async function holdOnEpisode(deps, episode, body, dryRun) {
  const api = (deps.env.MIADI_API_URL || "").replace(/\/$/, "")
  if (!api) return { reference: body.reference, status: "pending", note: "MIADI_API_URL unset: hold it with the chronicle_episode_tracing MCP tool" }
  const headers = { "Content-Type": "application/json" }
  // the episode door asks a token even on loopback; a timer's environment has only the env file
  const token = deps.env.MIADI_API_TOKEN_WRITER || envFileValues(deps.env).MIADI_API_TOKEN_WRITER
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await deps.fetch(`${api}/api/chronicle/episodes/${encodeURIComponent(episode)}/tracing`, { method: "POST", headers, body: JSON.stringify({ ...body, dryRun }) })
  return { reference: body.reference, relation: body.relation, status: res.status, held: res.ok && !dryRun }
}

// ---------- create: the person's text becomes a prompt version ----------

// Adds one version and sets no label, so no earlier version and no label moves. The research trace
// is the one given, or a new one opened with the version as its root observation.
async function create(deps, opts) {
  const name = opts.positional[0]
  if (!name || !PROMPT_NAME_RE.test(name)) throw new Refusal(2, "create needs a prompt name miadiRun-<yyMMddHHmm>-<tmuxName>-<missionName>")
  if (!opts.textFile) throw new Refusal(2, "create needs --text-file <F>: the prompt text as the person wrote it")
  const text = readFileSync(opts.textFile, "utf8")
  if (!text.trim()) throw new Refusal(2, `${opts.textFile} is empty`)

  const existing = await findPromptVersions(deps, name, opts.domain)
  const domain = existing?.domain ?? opts.domain ?? "ceremony"
  if (!DOMAINS.includes(domain)) throw new Refusal(2, `unknown domain "${domain}" (${DOMAINS.join(", ")})`)
  const trace = opts.trace ? await findTrace(deps, opts.trace, opts.domain) : null
  if (opts.trace && !trace) throw new Refusal(4, `trace ${opts.trace} is in no configured domain`)
  if (trace && !trace.root) throw new Refusal(4, `trace ${opts.trace} has no root observation to append under; appending would rename it`)
  const latest = existing?.versions?.length ? Math.max(...existing.versions) : null
  if (latest && (await getPromptVersion(deps, domain, name, latest)).sha256 === sha256(text)) {
    throw new Refusal(4, `prompt ${name} v${latest} already holds this text`)
  }

  const made = run(deps, "create", "coaia", ["fuse", "prompts", "create", "--name", name, "--prompt", text, "--type", "text", "--commit-message", opts.commitMessage || "miadi-run create"], { env: coaiaEnv(deps.env, domain) })
  if (made.status !== 0) throw new Refusal(1, `the provider refused prompt ${name}: ${(made.stderr || made.stdout || "").trim().slice(0, 300)}`)
  const after = await findPromptVersions(deps, name, domain)
  const version = after?.versions?.length ? Math.max(...after.versions) : null
  if (!version || version === latest) throw new Refusal(1, `prompt ${name} shows no new version in ${domain}`)
  const pinned = await getPromptVersion(deps, domain, name, version)
  if (pinned.sha256 !== sha256(text)) throw new Refusal(5, `prompt ${name} v${version} does not hold the text that was sent (sha256)`)

  const reference = `miadi-tracing:${domain}/prompt/${name}@${version}`
  const input = { prompt: reference, prompt_sha256: pinned.sha256 }
  const by = writerOf(deps.env)
  const metadata = { miadi_run: { kind: "research", prompt: reference, created: true, ...(by ? { by } : {}) } }
  let held
  if (trace) {
    held = { id: trace.id, reference: trace.reference, opened: false, ...observe(deps, "create", trace, "research", reference, { input, output: { created: version }, metadata: { prompt: reference, created: true } }) }
  } else {
    const id = randomBytes(16).toString("hex")
    const session = opts.session || name
    const r = run(deps, "create", "coaia", ["fuse", "traces", "create", "--name", name, "--trace-id", id, "--session-id", session, "--input", JSON.stringify(input), "--output", JSON.stringify({ created: version }), "--metadata", JSON.stringify(metadata)], { env: coaiaEnv(deps.env, domain) })
    held = { id, reference: `miadi-tracing:${domain}/trace/${id}`, session, opened: true, kind: "research", ok: r.status === 0, ...(r.status === 0 ? {} : { error: (r.stderr || r.stdout || "").trim().slice(0, 300) }) }
  }
  return {
    prompt: { domain, name, version, reference, sha256: pinned.sha256 },
    trace: held,
    next: `miadi-run prepare --prompt ${name} --version ${version} --trace ${held.id} --episode <ref>`,
  }
}

// The brief tide asks the seat to read first. It carries no prompt text: the seat reads the pinned
// version from the provider (Guillaume, 2026-10-13), and starts the work without waiting for a take
// (the first launch, 2026-10-13, opened a seat that only listened).
export function missionBrief({ id, reference, sha256: sum, episode, trace, script }) {
  return `# Mission ${id}

This seat was opened to carry out a mission, not only to listen. After your opening lines, begin the
mission now and do not wait for a take. The listener keeps hearing takes in the background while you work.

The mission prompt is ${reference} (sha256 ${sum}). Read it from the provider, not from a file:

  node ${script} prompt ${id}

It prints that version and refuses if the provider no longer holds the same text.

Episode: ${episode}. Trace: ${trace}.
When the mission is done, or stops, report on the trace:

  node ${script} observe ${id} --kind return --summary "<what exists now>" --detail-file <findings, commits, open questions>
`
}

// ---------- seats, from the binding line ----------

// The capture plugin (claude/miadi-session-observability) keeps one line per event of every Claude
// session: its tmux pane, its names and, from 0.1.12, the `session.mission` it was launched with.
export function sessionRoot(env) {
  return env.CLAUDE_SESSIONDATA_ROOT || env.MIADI_SESSION_DIR || env.MIADI_SESSIONDATA_ROOT || env.SESSION_DATA_ROOT || env.CONDUCTOR_SESSION_ROOT || "/src/_sessiondata"
}

function bindingLines(env) {
  const file = join(sessionRoot(env), "data", "terminal_bindings.jsonl")
  if (!existsSync(file)) return []
  const out = []
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue
    try { out.push(JSON.parse(line)) } catch { /* a torn line is skipped */ }
  }
  return out
}

const seatOf = (b) => ({ session_id: b.session_id, tmux: b.tmux?.session ?? null, pane_id: b.tmux?.pane_id ?? null, host: b.host ?? null, at: b.at ?? null })

// The sessions that recorded this mission at their start (`session.mission`).
export function seatsOf(env, id) {
  const seats = new Map()
  for (const b of bindingLines(env)) {
    if (b.event === "session.mission" && b.mission?.id === id && b.session_id) seats.set(b.session_id, { ...seatOf(b), source: b.mission.source ?? null })
  }
  return [...seats.values()]
}

// A session named by its id, an 8-character prefix of it, or its tmux session; the latest wins.
export function findSeat(env, ref) {
  const hits = bindingLines(env).filter((b) => b.session_id && (b.session_id === ref || (ref.length >= 8 && b.session_id.startsWith(ref)) || b.tmux?.session === ref))
  if (!hits.length) return null
  const latest = hits.at(-1)
  const others = [...new Set(hits.map((b) => b.session_id))].filter((s) => s !== latest.session_id)
  return { ...seatOf(latest), ...(others.length ? { others } : {}) }
}

// ---------- missions ----------

const missionHome = (env) => env.MIADI_RUN_HOME || join(homedir(), ".miadi", "missions")
export const missionId = (name, version) => `${name}.v${version}`

function missionDir(env, id) {
  if (!/^[A-Za-z0-9._@-]+$/.test(id)) throw new Refusal(2, `"${id}" is not a mission id`)
  return join(missionHome(env), id)
}

function loadMission(env, id) {
  const file = join(missionDir(env, id), "mission.json")
  if (!existsSync(file)) throw new Refusal(4, `no mission ${id} in ${missionHome(env)}`)
  return JSON.parse(readFileSync(file, "utf8"))
}

const saveMission = (env, m) => writeFileSync(join(missionDir(env, m.id), "mission.json"), JSON.stringify(m, null, 2) + "\n")

async function resolve(deps, opts) {
  const what = opts.positional[0]
  if (!what) throw new Refusal(2, "resolve needs a prompt name or a trace id")
  if (/^[0-9a-f]{32}$/.test(what)) {
    const trace = await findTrace(deps, what, opts.domain)
    if (!trace) throw new Refusal(4, `trace ${what} is in no configured domain`)
    return { resource: "trace", ...trace }
  }
  const prompt = await findPromptVersions(deps, what, opts.domain)
  if (!prompt) throw new Refusal(4, `prompt ${what} is in no configured domain`)
  return { resource: "prompt", ...prompt, next: `miadi-run prepare --prompt ${what} --version <one of ${prompt.versions.join(",")}> --trace <trace-id> --episode <ref>` }
}

async function prepare(deps, opts) {
  for (const flag of ["run", "launch", "authorizedBy"]) {
    if (opts[flag] !== undefined) throw new Refusal(2, "prepare never launches: --run, --launch and --authorized-by belong to `miadi-run launch`")
  }
  const version = Number(opts.version)
  if (!opts.prompt || !Number.isInteger(version) || version < 1) throw new Refusal(2, "prepare needs --prompt <name> and --version <N>: a mission pins one version number")
  if (!opts.trace || !opts.episode) throw new Refusal(2, "prepare needs --trace <trace-id> and --episode <ref>")
  const id = missionId(opts.prompt, version)
  const dir = missionDir(deps.env, id)
  if (existsSync(join(dir, "mission.json"))) throw new Refusal(4, `mission ${id} is already prepared; a revised prompt is a new version and a new mission`)

  const found = await findPromptVersions(deps, opts.prompt, opts.domain)
  if (!found) throw new Refusal(4, `prompt ${opts.prompt} is in no configured domain`)
  if (!found.versions.includes(version)) throw new Refusal(4, `prompt ${opts.prompt} has versions ${found.versions.join(",")}, not ${version}`)
  const pinned = await getPromptVersion(deps, found.domain, opts.prompt, version)
  const trace = await findTrace(deps, opts.trace, opts.domain)
  if (!trace) throw new Refusal(4, `trace ${opts.trace} is in no configured domain`)
  if (!trace.root) throw new Refusal(4, `trace ${opts.trace} has no root observation to append under; appending would rename it`)

  const seat = opts.seat || "mia"
  const scratch = opts.dryRun ? mkdtempSync(join(tmpdir(), "miadi-run-")) : dir
  mkdirSync(scratch, { recursive: true })
  const brief = join(scratch, "brief.md")
  const promptRef = `miadi-tracing:${found.domain}/prompt/${opts.prompt}@${version}`
  let saved = false
  try {
    writeFileSync(brief, missionBrief({ id, reference: promptRef, sha256: pinned.sha256, episode: String(opts.episode), trace: trace.reference, script: fileURLToPath(import.meta.url) }))
    chmodSync(brief, 0o444)
    const planned = run(deps, "prepare", "tide", companionArgs({ episode: opts.episode, seat, brief, addDirs: opts.addDirs }))
    if (planned.status !== 0) throw new Refusal(6, `tide companion open (plan) failed: ${(planned.stderr || "").trim().slice(0, 300)}`)
    const plan = JSON.parse(planned.stdout)

    const relations = [
      await holdOnEpisode(deps, opts.episode, { reference: promptRef, name: opts.prompt, relation: "is-prompted-by" }, !!opts.dryRun),
      await holdOnEpisode(deps, opts.episode, { reference: trace.reference, name: trace.name ?? undefined, session: trace.session ?? undefined, relation: "is-traced-in" }, !!opts.dryRun),
    ]
    const mission = {
      schema: "miadi-run/mission@1",
      id,
      state: "prepared",
      prompt: { domain: found.domain, name: opts.prompt, version, reference: promptRef, sha256: pinned.sha256, labels_at_prepare: pinned.labels, brief },
      trace: { domain: trace.domain, id: trace.id, reference: trace.reference, name: trace.name, session: trace.session, root: trace.root },
      episode: { ref: String(opts.episode), relations },
      launcher: { kind: "companion", seat, add_dirs: opts.addDirs, session: plan.session ?? null, plan_state: plan.state ?? null, delivers_brief: BRIEF_STATES.includes(plan.state), refused: plan.refused ?? null },
      prepared_at: deps.now().toISOString(),
      prepared_by: writerOf(deps.env),
      launch: { authorized_by: null, at: null, executed: false },
      observations: [],
    }
    const payload = {
      input: { prompt: promptRef, trace: trace.reference, episode: String(opts.episode) },
      output: { state: "prepared", launcher: "tide companion open", session: mission.launcher.session, plan_state: mission.launcher.plan_state, delivers_brief: mission.launcher.delivers_brief, launched: false },
      metadata: { mission: id, prompt: promptRef, prompt_sha256: pinned.sha256, episode: String(opts.episode), seat, launch_authorized: false },
    }
    if (opts.dryRun) return { dryRun: true, mission, observation: observationArgs({ traceId: trace.id, root: trace.root, session: trace.session, kind: "preparation", subject: id, ...payload }).slice(3) }
    mission.observations.push(observe(deps, "prepare", trace, "preparation", id, payload))
    saveMission(deps.env, mission)
    saved = true
    return mission
  } finally {
    // a dry run leaves nothing; a prepare that failed before its record leaves no half mission
    if (opts.dryRun || !saved) rmSync(scratch, { recursive: true, force: true })
  }
}

async function launch(deps, opts) {
  const id = opts.positional[0]
  if (!id) throw new Refusal(2, "launch needs a mission id")
  const mission = loadMission(deps.env, id)
  if (mission.state !== "prepared") throw new Refusal(4, `mission ${id} is ${mission.state}; a mission launches once, a new run is a new prompt version`)
  if (typeof opts.authorizedBy !== "string" || !opts.authorizedBy.trim()) throw new Refusal(3, `launch needs --authorized-by <who>: the person's explicit word to run ${id}`)

  const remote = await getPromptVersion(deps, mission.prompt.domain, mission.prompt.name, mission.prompt.version)
  if (remote.sha256 !== mission.prompt.sha256) throw new Refusal(5, `prompt ${mission.prompt.reference} no longer matches what was prepared (sha256)`)

  // The seat may have changed since prepare: ask tide again and launch only where it types the brief.
  const seatArgs = { episode: mission.episode.ref, seat: mission.launcher.seat, brief: mission.prompt.brief, addDirs: mission.launcher.add_dirs }
  const replanned = run(deps, "launch", "tide", companionArgs(seatArgs))
  let now = null
  try { now = JSON.parse(replanned.stdout) } catch { /* reported below */ }
  if (replanned.status !== 0 || !now) throw new Refusal(6, `tide companion open (plan) failed: ${(replanned.stderr || "").trim().slice(0, 300)}`)
  if (!BRIEF_STATES.includes(now.state)) {
    throw new Refusal(7, `tide's plan for ${now.session ?? "the seat"} is "${now.state}": it would not type the mission prompt. The mission stays prepared. Close that seat, or archive it on the person's word (tide companion open --episode ${mission.episode.ref} --archive --run), then launch again.`)
  }

  const ran = run(deps, "launch", "tide", companionArgs({ ...seatArgs, launch: true }), { stdin: "inherit" })
  let result = null
  try { result = JSON.parse(ran.stdout) } catch { /* tide refused before printing its plan */ }
  const executed = ran.status === 0 && result?.executed === true && BRIEF_STATES.includes(result.state)
  if (!executed) {
    throw new Refusal(7, `tide did not open the seat (exit ${ran.status}); the mission stays prepared. From your own terminal: tide mode controller, then\n  node ${fileURLToPath(import.meta.url)} launch ${id} --authorized-by "${opts.authorizedBy}"\n${(ran.stderr || "").trim().slice(0, 300)}`)
  }
  mission.state = "launched"
  const seen = seatsOf(deps.env, id).at(-1)
  mission.launch = { authorized_by: opts.authorizedBy.trim(), at: deps.now().toISOString(), executed: true, via: "tide", state: result.state, session: result.session ?? mission.launcher.session, tide_session_id: result.session_id ?? null, claude_session_id: seen?.session_id ?? null, recorded_by: writerOf(deps.env) }
  mission.observations.push(observe(deps, "launch", mission.trace, "execution", id, {
    prompt: { name: mission.prompt.name, version: mission.prompt.version },
    input: { prompt: mission.prompt.reference, authorized_by: mission.launch.authorized_by },
    output: { state: "launched", via: "tide", plan_state: mission.launch.state, session: mission.launch.session, tide_session_id: mission.launch.tide_session_id, claude_session_id: mission.launch.claude_session_id },
    metadata: { mission: id, prompt: mission.prompt.reference, prompt_sha256: mission.prompt.sha256, episode: mission.episode.ref, launch_authorized: true },
  }))
  saveMission(deps.env, mission)
  return mission
}

// A mission given by hand to a seat that already runs: a tmux session named after the prompt, where
// the person or a coordinator at the person's word sends the mission (miadi-chronicle:558,
// 2026-10-15: two missions done this way stayed "prepared", and their prompt pages listed nothing).
// Nothing is typed or started here. The record names the seat and who gave the word, and the
// execution generation links that seat to the pinned prompt version.
async function given(deps, opts) {
  const id = opts.positional[0]
  if (!id) throw new Refusal(2, "given needs a mission id")
  if (!opts.session) throw new Refusal(2, "given needs --session <claude-session-id | 8-character prefix | tmux session>: the seat that received the mission")
  const mission = loadMission(deps.env, id)
  if (mission.state !== "prepared") throw new Refusal(4, `mission ${id} is ${mission.state}; a mission is given or launched once`)
  if (typeof opts.authorizedBy !== "string" || !opts.authorizedBy.trim()) throw new Refusal(3, `given needs --authorized-by <who>: the person whose word gave ${id} to that seat`)
  const at = opts.at ?? deps.now().toISOString()
  if (Number.isNaN(Date.parse(at))) throw new Refusal(2, `--at ${opts.at} is not a time`)
  const seat = findSeat(deps.env, opts.session)
  if (!seat) throw new Refusal(4, `no session ${opts.session} in ${join(sessionRoot(deps.env), "data", "terminal_bindings.jsonl")}`)

  const remote = await getPromptVersion(deps, mission.prompt.domain, mission.prompt.name, mission.prompt.version)
  if (remote.sha256 !== mission.prompt.sha256) throw new Refusal(5, `prompt ${mission.prompt.reference} no longer matches what was prepared (sha256)`)

  mission.state = "launched"
  mission.launch = { authorized_by: opts.authorizedBy.trim(), at, executed: true, via: "given", session: seat.tmux, pane_id: seat.pane_id, host: seat.host, claude_session_id: seat.session_id, recorded_at: deps.now().toISOString(), recorded_by: writerOf(deps.env) }
  mission.observations.push(observe(deps, "given", mission.trace, "execution", id, {
    prompt: { name: mission.prompt.name, version: mission.prompt.version },
    input: { prompt: mission.prompt.reference, authorized_by: mission.launch.authorized_by },
    output: { state: "launched", via: "given", given_at: at, session: seat.tmux, claude_session_id: seat.session_id },
    metadata: { mission: id, prompt: mission.prompt.reference, prompt_sha256: mission.prompt.sha256, episode: mission.episode.ref, launch_authorized: true, via: "given" },
  }))
  saveMission(deps.env, mission)
  return mission
}

// What the seat reads first: the pinned version, from the provider, only while it matches.
async function promptCmd(deps, opts) {
  const id = opts.positional[0]
  if (!id) throw new Refusal(2, "prompt needs a mission id")
  const mission = loadMission(deps.env, id)
  const remote = await getPromptVersion(deps, mission.prompt.domain, mission.prompt.name, mission.prompt.version)
  if (remote.sha256 !== mission.prompt.sha256) throw new Refusal(5, `prompt ${mission.prompt.reference} no longer matches what was prepared (sha256)`)
  return { promptText: remote.text }
}

async function observeCmd(deps, opts) {
  const kind = opts.kind
  if (kind !== "research" && kind !== "return") throw new Refusal(2, "observe takes --kind research or return; preparation and execution are written by prepare and launch")
  if (!opts.summary) throw new Refusal(2, "observe needs --summary <text>")
  const detail = opts.detailFile ? readFileSync(opts.detailFile, "utf8") : undefined
  const id = opts.positional[0]
  if (!id) {
    if (kind !== "research" || !opts.trace) throw new Refusal(2, "without a mission, observe takes --trace <id> --kind research")
    const trace = await findTrace(deps, opts.trace, opts.domain)
    if (!trace) throw new Refusal(4, `trace ${opts.trace} is in no configured domain`)
    return observe(deps, "observe", trace, "research", trace.id, { input: { summary: opts.summary }, output: detail ? { detail } : {}, metadata: {} }, opts.summary)
  }
  const mission = loadMission(deps.env, id)
  if (kind === "return" && mission.state === "prepared") throw new Refusal(4, `mission ${id} has not launched; a return follows a launch`)
  const done = observe(deps, "observe", mission.trace, kind, id, {
    prompt: { name: mission.prompt.name, version: mission.prompt.version },
    input: { summary: opts.summary },
    output: detail ? { detail } : {},
    metadata: { mission: id, prompt: mission.prompt.reference, episode: mission.episode.ref, state: mission.state, seat_sessions: missionSeats(deps.env, mission).map((s) => s.session_id) },
  }, opts.summary)
  mission.observations.push(done)
  if (kind === "return" && done.ok) mission.state = "returned"
  saveMission(deps.env, mission)
  return mission
}

// The seat the launch or the hand-off recorded, every session that recorded the mission itself, and
// every session that signed one of its events or observations.
function missionSeats(env, mission) {
  const seats = seatsOf(env, mission.id)
  const named = mission.launch?.claude_session_id
  if (named && !seats.some((s) => s.session_id === named)) seats.unshift({ session_id: named, tmux: mission.launch.session ?? null, source: mission.launch.via ?? null })
  const signers = [mission.prepared_by, mission.launch?.recorded_by, ...(mission.observations ?? []).map((o) => o.by)]
  for (const by of signers) if (by && !seats.some((s) => s.session_id === by)) seats.push({ session_id: by, tmux: null, source: "signed" })
  return seats
}

// A record made before 0.6.0 kept no summary. Each research and return observation written for the
// mission is read back from its trace, in time order, and its summary kept in the record. Nothing is
// written to the trace.
async function backfill(deps, opts) {
  const id = opts.positional[0]
  if (!id) throw new Refusal(2, "backfill needs a mission id")
  const mission = loadMission(deps.env, id)
  const r = await langfuseGet(deps, mission.trace.domain, `/api/public/traces/${encodeURIComponent(mission.trace.id)}`)
  if (r.status !== 200) throw new Refusal(4, `trace ${mission.trace.id} not readable in ${mission.trace.domain} (HTTP ${r.status})`)
  const onTrace = {}
  for (const o of (r.body.observations ?? []).filter((o) => typeof o.name === "string" && o.name.endsWith(` · ${id}`)).sort((a, b) => String(a.startTime ?? "").localeCompare(String(b.startTime ?? "")))) {
    const kind = o.name.split(" · ")[1]
    ;(onTrace[kind] ??= []).push(o)
  }
  const seen = {}
  let filled = 0
  for (const entry of mission.observations ?? []) {
    if (!entry.ok) continue // a refused observation never reached the trace
    const i = (seen[entry.kind] = (seen[entry.kind] ?? -1) + 1)
    if (entry.summary || (entry.kind !== "return" && entry.kind !== "research")) continue
    let input = onTrace[entry.kind]?.[i]?.input
    if (typeof input === "string") { try { input = JSON.parse(input) } catch { /* plain text has no summary field */ } }
    if (input && typeof input.summary === "string") { entry.summary = input.summary; filled += 1 }
  }
  if (filled) saveMission(deps.env, mission)
  return { id, filled, observations: mission.observations }
}

function show(deps, opts) {
  const mission = loadMission(deps.env, opts.positional[0] ?? "")
  return { ...mission, seats: missionSeats(deps.env, mission) }
}

// ---------- cli ----------

// ---------- drafts: a session being prepared becomes prompt versions ----------

// tide writes a draft's life to <MIADI_HOME>/drafts/events.jsonl (ironsilk 0.9.53, jgwill/Miadi#691).
// Each `tide.draft.versioned` of a mctgo draft that names its session becomes one version of
// miadiRun-<yyMMddHHmm>-<session>-presession in the eng domain, under one research trace per draft,
// and `tide.draft.started` relates the session that began to the last version, as an execution
// generation linked to it. A draft naming an episode holds the prompt and the trace there too.
// Episode 548, pre-session-draft-event.md, D3 and D4.
export const DRAFT_DOMAIN = "eng"
const draftEventsFile = (env) => join(env.MIADI_HOME || join(homedir(), ".miadi", "navigator"), "drafts", "events.jsonl")
const draftsFollowFile = (env) => join(missionHome(env), "drafts-follow.json")

// yyMMddHHmm in local time, as a person's tlid reads.
export function tlidOf(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const two = (n) => String(n).padStart(2, "0")
  return `${two(d.getFullYear() % 100)}${two(d.getMonth() + 1)}${two(d.getDate())}${two(d.getHours())}${two(d.getMinutes())}`
}

// The prompt a draft's versions go to: its mctgo-<yyMMddHHmm> session's minute, else the minute it opened.
// A session name still holding a shell substitution (`t8-x-$(tlid min)`, expanded only on Enter) is
// named by the part before it.
export function draftPromptName(payload, openedAt) {
  const raw = typeof payload?.target_session === "string" ? payload.target_session.trim() : ""
  const target = raw.replace(/[^A-Za-z0-9._-].*$/s, "").replace(/[-_.]+$/, "")
  if (payload?.kind !== "mctgo" || !target) return null
  const m = String(payload.pane ?? "").split(":")[0].match(/^mctgo-(\d{10})$/)
  const stamp = m ? m[1] : tlidOf(openedAt)
  // D8: once mctdraft gives the draft its session id, the prompt is named by it.
  const id = typeof payload.session_id === "string" && UUID_RE.test(payload.session_id) ? `-${payload.session_id.toLowerCase()}` : ""
  const name = `miadiRun-${stamp}-${target}-presession${id}`
  return PROMPT_NAME_RE.test(name) ? name : null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The episode folder numbered n on the ledger, when exactly one carries it.
export function episodeFolderOf(env, n) {
  const root = env.MIADI_CHRONICLE_ROOT || "/srv/miadi/episodes/miadi-chronicle"
  const re = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-episode-0*${Number(n)}-`)
  try {
    const hits = readdirSync(root).filter((d) => re.test(d))
    return hits.length === 1 ? hits[0] : null
  } catch {
    return null
  }
}

// The episodes a draft's labels name: miadi-chronicle://<n> directly, miadi-ceremony://<id> through
// the episode the ceremony was held for (its episode_path on the chronicle wheel). H4.
export async function draftEpisodes(deps, labels) {
  const out = []
  for (const a of Array.isArray(labels?.addresses) ? labels.addresses : []) {
    const ep = String(a).match(/^miadi-chronicle:(?:\/\/)?(\d+)\b/)
    const ce = String(a).match(/^(?:miadi-)?ceremony:(?:\/\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i)
    let folder = null
    if (ep) folder = episodeFolderOf(deps.env, ep[1])
    else if (ce && deps.env.MIADI_CHRONICLE_MW_URL) {
      const res = await deps.fetch(`${deps.env.MIADI_CHRONICLE_MW_URL.replace(/\/$/, "")}/api/ceremonies/${ce[1]}`).catch(() => null)
      const body = res?.ok ? await res.json() : null
      folder = (body?.ceremony ?? body)?.episode_path ?? null
    }
    if (folder && !out.some((o) => o.folder === folder)) out.push({ folder, address: String(a), ...(ce ? { ceremony: ce[1].toLowerCase() } : {}) })
  }
  return out
}

// A draft that names an episode is a planned follow-up of it (Guillaume, 2026-10-31): the first version
// that names it is held on the episode as `is-followed-up-by`, before any session exists.
export const FOLLOW_UP_RELATION = "is-followed-up-by"

async function followUp(deps, rec, e, reference) {
  rec.followed ??= []
  const held = []
  for (const place of await draftEpisodes(deps, e.payload?.labels)) {
    if (rec.followed.includes(place.folder)) continue
    const r = await holdOnEpisode(deps, place.folder, { reference, name: rec.prompt.name, relation: FOLLOW_UP_RELATION }, false)
    if (typeof r.status === "number" && r.status < 300) rec.followed.push(place.folder)
    held.push({ episode: place.folder, status: r.status })
  }
  return held
}

// A line in the binding line that names the episode the session worked in, as the capture hook's
// lines do, so the room's Sessions card and the inventory see it. Written at the moment the agent was
// seen running, so a later hook line stays the session's newest.
function bindSession(deps, e, place) {
  const line = {
    at: new Date(e.occurred_at).toISOString(), event: "session.episode", source: "tide-draft", agent: e.payload?.agent_kind ?? "claude",
    session_id: e.payload.session_id, host: e.source?.instance ?? null, tmux: { session: e.payload?.target_session ?? null },
    episode: { id: place.folder, source: "draft" }, draft: e.subject.id, address: place.address, ...(place.ceremony ? { ceremony: place.ceremony } : {}),
  }
  appendFileSync(join(sessionRoot(deps.env), "data", "terminal_bindings.jsonl"), JSON.stringify(line) + "\n")
  return { episode: place.folder, ...(place.ceremony ? { ceremony: place.ceremony } : {}) }
}

// A version's words leave the host only after the credential rules tide applies to pane captures
// (jgwill/Miadi#745) have redacted them: a token pasted into a primer would otherwise become a prompt
// version as typed (Episode 548, pre-session-draft-audience.md, F5 and H1a). Without the rules nothing
// is sent.
export function secretRules(env) {
  const files = [env.MIADI_SECRET_RULES, env.MIADI_SRC && join(env.MIADI_SRC, "packages", "tide-contract", "schema", "secret-redaction.json")].filter(Boolean)
  const file = files.find((f) => existsSync(f))
  if (!file) throw new Refusal(1, "no secret-redaction rules (MIADI_SECRET_RULES, or $MIADI_SRC/packages/tide-contract/schema/secret-redaction.json): a draft's words do not leave the host unchecked")
  return JSON.parse(readFileSync(file, "utf8"))
}

export function redactSecrets(text, ruleset) {
  const mask = ruleset.mask ?? "***"
  const keep = (v) => v.slice(0, v.length >= 7 ? 6 : v.length >= 4 ? 4 : v.length) + mask
  const found = []
  let out = text
  for (const rule of ruleset.rules ?? []) {
    let n = 0
    const regex = new RegExp(rule.pattern, (rule.flags ?? "") + "g")
    out = out.replace(regex, (match, label, value) => {
      n += 1
      if (rule.kind === "block") return rule.replacement ?? mask
      if (rule.kind === "labelled") return label + keep(value)
      return keep(match)
    })
    if (n) found.push({ rule: rule.name, count: n })
  }
  return { text: out, redacted: found }
}

async function draftVersion(deps, rec, e, opts) {
  const at = { event: e.id, draft: e.subject.id }
  if (rec.versions.some((v) => v.event === e.id)) return null
  const name = rec.prompt?.name ?? draftPromptName(e.payload, rec.opened_at)
  if (!name) return { ...at, skipped: e.payload?.kind === "mctgo" ? "the draft names no session yet" : "a shell draft stays on the host" }
  if (typeof e.payload?.text !== "string" || !e.payload.text.trim()) return { ...at, skipped: "the version holds no text" }
  const { text, redacted } = redactSecrets(e.payload.text, secretRules(deps.env))
  const note = redacted.length ? ` · redacted ${redacted.map((r) => `${r.count} ${r.rule}`).join(", ")}` : ""
  if (opts.dryRun) return { ...at, would: { create: name, draft_version: e.payload.version, chars: text.length, ...(redacted.length ? { redacted } : {}) } }
  const dir = mkdtempSync(join(tmpdir(), "miadi-run-draft-"))
  const file = join(dir, "text")
  writeFileSync(file, text, { mode: 0o600 })
  try {
    const out = await create(deps, { positional: [name], textFile: file, domain: rec.prompt?.domain ?? DRAFT_DOMAIN, trace: rec.trace?.id, session: rec.trace?.session ?? (UUID_RE.test(String(e.payload.session_id)) ? String(e.payload.session_id).toLowerCase() : String(e.payload.pane ?? "").split(":")[0]), commitMessage: `tide.draft.versioned ${e.subject.id} v${e.payload.version}${note}` })
    rec.prompt = { domain: out.prompt.domain, name }
    if (!rec.trace) rec.trace = { id: out.trace.id, session: out.trace.session }
    rec.versions.push({ event: e.id, draft_version: e.payload.version, prompt_version: out.prompt.version, reference: out.prompt.reference, sha256: out.prompt.sha256, at: e.occurred_at, ...(redacted.length ? { redacted } : {}) })
    const followed = await followUp(deps, rec, e, out.prompt.reference)
    return { ...at, prompt: out.prompt.reference, trace: out.trace.reference, ...(redacted.length ? { redacted } : {}), ...(followed.length ? { follows_up: followed } : {}), ...(out.trace.ok === false ? { warning: `trace not written: ${out.trace.error}` } : {}) }
  } catch (err) {
    if (!(err instanceof Refusal && err.code === 4 && /already holds this text/.test(err.message))) throw err
    rec.prompt ??= { domain: DRAFT_DOMAIN, name }
    const last = rec.versions.findLast((v) => v.prompt_version)
    rec.versions.push({ event: e.id, draft_version: e.payload.version, prompt_version: last?.prompt_version ?? null, reference: last?.reference ?? null, same_text: true })
    return { ...at, skipped: "the provider already holds this text" }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function draftStarted(deps, rec, e, opts) {
  const at = { event: e.id, draft: e.subject.id }
  if (rec.started?.event === e.id) return null
  const started = { event: e.id, at: e.occurred_at, session: e.payload?.target_session ?? null, session_id: e.payload?.session_id ?? null, agent_kind: e.payload?.agent_kind ?? null }
  const last = rec.versions.findLast((v) => v.prompt_version)
  if (!rec.prompt || !last) { if (!opts.dryRun) rec.started = started; return { ...at, skipped: "no prompt version to relate the session to", started } }
  if (opts.dryRun) return { ...at, would: { execution: last.reference, session_id: started.session_id } }
  const trace = await findTrace(deps, rec.trace.id, rec.prompt.domain)
  if (!trace?.root) throw new Refusal(4, `trace ${rec.trace.id} is not readable with a root observation yet`)
  const observation = observe(deps, "drafts", trace, "execution", `${rec.prompt.name}.v${last.prompt_version}`, {
    prompt: { name: rec.prompt.name, version: last.prompt_version },
    input: { prompt: last.reference, draft: e.subject.id, authorized_by: e.actor?.id ?? null },
    output: { state: "started", via: "tide-draft", session: started.session, claude_session_id: started.session_id, agent_kind: started.agent_kind },
    metadata: { draft: e.subject.id, prompt: last.reference, sent_event: e.causation_id ?? null, started_event: e.id },
  })
  const places = await draftEpisodes(deps, e.payload?.labels)
  const episodes = []
  for (const place of places) {
    episodes.push({
      ...(started.session_id ? bindSession(deps, e, place) : { episode: place.folder }),
      relations: [
        // the prompt is already held as the episode's follow-up when an earlier version named it
        ...(rec.followed?.includes(place.folder) ? [] : [await holdOnEpisode(deps, place.folder, { reference: last.reference, name: rec.prompt.name, relation: "is-prompted-by" }, false)]),
        await holdOnEpisode(deps, place.folder, { reference: trace.reference, name: trace.name ?? undefined, session: trace.session ?? undefined, relation: "is-traced-in" }, false),
      ],
    })
  }
  const mission = draftMission(deps, rec, e, last, trace, started, observation, episodes)
  rec.started = { ...started, prompt: last.reference, observation, episodes, mission: mission.id }
  return { ...at, related: last.reference, session_id: started.session_id, ...(observation.ok ? {} : { warning: `execution not written: ${observation.error}` }), ...(episodes.length ? { episodes: episodes.map((x) => x.episode) } : {}) }
}

// H5: the session that began from a draft is a mission, so /missions lists it with its prompt version,
// its trace and its episode. The person's Enter on the draft is the launch (`via: "draft"`).
function draftMission(deps, rec, e, last, trace, started, observation, episodes) {
  const id = missionId(rec.prompt.name, last.prompt_version)
  const dir = missionDir(deps.env, id)
  if (existsSync(join(dir, "mission.json"))) return { id, existed: true }
  const number = episodes.map((x) => String(x.episode).match(/-episode-0*(\d+)-/)?.[1]).find(Boolean) ?? ""
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "mission.json"), JSON.stringify({
    schema: "miadi-run/mission@1",
    id,
    state: "launched",
    prompt: { domain: rec.prompt.domain, name: rec.prompt.name, version: last.prompt_version, reference: last.reference, sha256: last.sha256 ?? null },
    trace: { domain: trace.domain, id: trace.id, reference: trace.reference, name: trace.name, session: trace.session, root: trace.root },
    episode: { ref: number, relations: episodes.flatMap((x) => x.relations ?? []) },
    launcher: { kind: "tide-draft", session: started.session },
    prepared_at: rec.versions[0]?.at ?? started.at,
    prepared_by: null,
    launch: { authorized_by: e.actor?.id ?? null, at: started.at, executed: true, via: "draft", session: started.session, claude_session_id: started.session_id, recorded_by: writerOf(deps.env) },
    draft: e.subject.id,
    observations: [observation],
  }, null, 2) + "\n")
  return { id }
}

// A draft that ends without a session leaves its ending on its prompt's trace, so a prompt nobody
// will run says why (Guillaume, 2026-10-31: no dead bodies).
export const DRAFT_ENDINGS = ["tide.draft.cleared", "tide.draft.abandoned", "tide.draft.expired", "tide.draft.withdrawn"]

async function draftEnded(deps, rec, e, opts) {
  const at = { event: e.id, draft: e.subject.id }
  if (rec.ended || !rec.trace || !rec.prompt || rec.started) return null
  const ending = e.event_type.slice("tide.draft.".length)
  if (opts.dryRun) return { ...at, would: { ended: ending, trace: rec.trace.id } }
  const trace = await findTrace(deps, rec.trace.id, rec.prompt.domain)
  if (!trace?.root) throw new Refusal(4, `trace ${rec.trace.id} is not readable with a root observation yet`)
  const last = rec.versions.findLast((v) => v.prompt_version)
  const observation = observe(deps, "drafts", trace, "research", `${rec.prompt.name} · ${ending}`, {
    input: { draft: e.subject.id, prompt: last?.reference ?? null },
    output: { state: ending, reason: e.payload?.reason ?? null, became_a_session: false },
    metadata: { draft: e.subject.id, ended_event: e.id, ending },
  })
  rec.ended = { event: e.id, state: ending, reason: e.payload?.reason ?? null, at: e.occurred_at, observation }
  return { ...at, ended: ending, trace: `miadi-tracing:${rec.prompt.domain}/trace/${rec.trace.id}`, ...(observation.ok ? {} : { warning: `ending not written: ${observation.error}` }) }
}

// The ready flag and its moment, kept on the prompt's trace beside the versions (Episode 548,
// pre-session-draft-ready.md, step 2): when the person flagged the text, and whether tide pressed Enter.
// From D11 (Guillaume, 2026-10-31) `sent` only says the line ran; `unstarted` says no session followed,
// and the draft is a draft again. Both are marks on the trace, never an ending.
export const DRAFT_MARKS = ["tide.draft.readied", "tide.draft.unreadied", "tide.draft.due", "tide.draft.sent", "tide.draft.unstarted"]

async function draftMark(deps, rec, e, opts) {
  const at = { event: e.id, draft: e.subject.id }
  rec.marks ??= []
  if (rec.marks.includes(e.id) || !rec.trace || !rec.prompt) return null
  const mark = e.event_type.slice("tide.draft.".length)
  const p = e.payload ?? {}
  const detail = Object.fromEntries(["send_at", "scheduler", "window_seconds", "sent", "reason"].filter((k) => p[k] !== undefined).map((k) => [k, p[k]]))
  if (opts.dryRun) return { ...at, would: { mark, ...detail } }
  const trace = await findTrace(deps, rec.trace.id, rec.prompt.domain)
  if (!trace?.root) throw new Refusal(4, `trace ${rec.trace.id} is not readable with a root observation yet`)
  const last = rec.versions.findLast((v) => v.prompt_version)
  const observation = observe(deps, "drafts", trace, "research", `${rec.prompt.name} · ${mark}`, {
    input: { draft: e.subject.id, prompt: last?.reference ?? null },
    output: { state: mark, ...detail },
    metadata: { draft: e.subject.id, event: e.id, mark },
  })
  rec.marks.push(e.id)
  return { ...at, mark, ...detail, ...(observation.ok ? {} : { warning: `${mark} not written: ${observation.error}` }) }
}

// Reads the lines written since the last run, in order. A line the provider cannot take yet stops
// the run there, so the next run starts from it; nothing is skipped by a failure.
async function drafts(deps, opts) {
  const file = draftEventsFile(deps.env)
  const stateFile = draftsFollowFile(deps.env)
  const state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : { schema: "miadi-run/drafts-follow@1", offset: 0, drafts: {} }
  if (!existsSync(file)) return { file, offset: state.offset, handled: [] }
  const bytes = readFileSync(file)
  if (bytes.length < state.offset) state.offset = 0 // the log was replaced
  const handled = []
  let offset = state.offset
  let stopped = null
  const rest = bytes.subarray(offset).toString("utf8")
  for (const raw of rest.split(/(?<=\n)/)) {
    if (!raw.endsWith("\n")) break // a line tide is still writing
    let e = null
    try { e = JSON.parse(raw) } catch { /* an unreadable line is passed over */ }
    if (e && typeof e.event_type === "string" && e.event_type.startsWith("tide.draft.") && e.subject?.id) {
      const rec = state.drafts[e.subject.id] ?? { opened_at: e.occurred_at, versions: [] }
      try {
        const out = e.event_type === "tide.draft.versioned" ? await draftVersion(deps, rec, e, opts)
          : e.event_type === "tide.draft.started" ? await draftStarted(deps, rec, e, opts)
          : DRAFT_ENDINGS.includes(e.event_type) ? await draftEnded(deps, rec, e, opts)
          : DRAFT_MARKS.includes(e.event_type) ? await draftMark(deps, rec, e, opts) : null
        if (out) handled.push(out)
      } catch (err) {
        stopped = { event: e.id, draft: e.subject.id, error: err.message }
        break
      }
      if (!opts.dryRun) state.drafts[e.subject.id] = rec
    }
    offset += Buffer.byteLength(raw, "utf8")
  }
  if (!opts.dryRun) {
    state.offset = offset
    mkdirSync(missionHome(deps.env), { recursive: true })
    writeFileSync(stateFile, JSON.stringify(state, null, 2) + "\n")
  }
  return { file, offset, handled, ...(stopped ? { stopped } : {}), ...(opts.dryRun ? { dryRun: true } : {}), ...(opts.quiet ? { quiet: true } : {}) }
}

export function parseArgs(argv) {
  const opts = { positional: [], addDirs: [] }
  const takes = { "--domain": "domain", "--prompt": "prompt", "--version": "version", "--trace": "trace", "--episode": "episode", "--seat": "seat", "--authorized-by": "authorizedBy", "--kind": "kind", "--summary": "summary", "--detail-file": "detailFile", "--text-file": "textFile", "--session": "session", "--commit-message": "commitMessage", "--at": "at" }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (takes[a]) opts[takes[a]] = argv[++i]
    else if (a === "--add-dir") opts.addDirs.push(argv[++i])
    else if (a === "--dry-run") opts.dryRun = true
    else if (a === "--quiet") opts.quiet = true
    else if (a === "--run") opts.run = true
    else if (a === "--launch") opts.launch = true
    else if (a.startsWith("--")) throw new Refusal(2, `unknown flag ${a}`)
    else opts.positional.push(a)
  }
  return opts
}

export const defaultDeps = () => ({
  env: process.env,
  fetch: globalThis.fetch,
  now: () => new Date(),
  run: (cmd, args, { env, stdin } = {}) => {
    const r = spawnSync(cmd, args, { env: env ?? process.env, encoding: "utf8", stdio: [stdin ?? "ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 })
    return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? (r.error ? String(r.error.message) : "") }
  },
})

const USAGE = `miadi-run create  <prompt-name> --text-file F [--domain d] [--trace <trace-id>] [--session S] [--commit-message T]
miadi-run resolve <prompt-name | trace-id> [--domain d]
miadi-run prepare --prompt <name> --version <N> --trace <trace-id> --episode <ref> [--seat mia] [--add-dir DIR]... [--domain d] [--dry-run]
miadi-run launch  <mission> --authorized-by <who>
miadi-run given   <mission> --session <claude-session-id | prefix | tmux-session> --authorized-by <who> [--at <iso>]
miadi-run prompt  <mission>
miadi-run backfill <mission>
miadi-run observe <mission> --kind research|return --summary <text> [--detail-file F]
miadi-run observe --trace <trace-id> --kind research --summary <text>
miadi-run show    <mission>
miadi-run drafts  [--dry-run] [--quiet]`

export async function main(argv, deps = defaultDeps()) {
  const [verb, ...rest] = argv
  if (!verb || verb === "-h" || verb === "--help") return { usage: USAGE }
  const opts = parseArgs(rest)
  if (verb === "create") return create(deps, opts)
  if (verb === "resolve") return resolve(deps, opts)
  if (verb === "prepare") return prepare(deps, opts)
  if (verb === "launch") return launch(deps, opts)
  if (verb === "given") return given(deps, opts)
  if (verb === "prompt") return promptCmd(deps, opts)
  if (verb === "observe") return observeCmd(deps, opts)
  if (verb === "show") return show(deps, opts)
  if (verb === "backfill") return backfill(deps, opts)
  if (verb === "drafts") return drafts(deps, opts)
  throw new Refusal(2, `unknown verb "${verb}"\n${USAGE}`)
}

// What a mission record says went wrong without stopping it: an observation the provider refused,
// an episode door that refused a relation.
export function warnings(out) {
  const w = []
  for (const o of Array.isArray(out?.observations) ? out.observations : []) if (!o.ok) w.push(`${o.kind} observation not written: ${o.error ?? "coaia failed"}`)
  for (const r of out?.episode?.relations ?? []) if (typeof r.status === "number" && r.status >= 400) w.push(`episode door refused ${r.reference} (HTTP ${r.status})`)
  const launcher = (out?.mission ?? out)?.launcher
  if (launcher?.delivers_brief === false && (out?.mission ?? out)?.state === "prepared") w.push(`tide's plan for ${launcher.session} is "${launcher.plan_state}": a launch now would not type the mission prompt`)
  if (out?.trace?.ok === false) w.push(`${out.trace.kind} trace ${out.trace.id} not written: ${out.trace.error ?? "coaia failed"}`)
  if (out && out.kind && out.ok === false) w.push(`${out.kind} observation not written: ${out.error ?? "coaia failed"}`)
  if (out?.stopped) w.push(`drafts stopped at ${out.stopped.event} (${out.stopped.draft}): ${out.stopped.error}`)
  for (const h of Array.isArray(out?.handled) ? out.handled : []) if (h?.warning) w.push(`${h.event}: ${h.warning}`)
  return w
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then(
    (out) => {
      if (typeof out?.promptText === "string") process.stdout.write(out.promptText)
      else if (!(out?.quiet && out.handled?.length === 0 && !out.stopped)) console.log(out?.usage ?? JSON.stringify(out, null, 2))
      const w = warnings(out)
      if (w.length) { for (const line of w) console.error(`miadi-run: ${line}`); process.exitCode = 8 }
    },
    (e) => { console.error(`miadi-run: ${e.message}`); process.exitCode = e instanceof Refusal ? e.code : 1 },
  )
}
