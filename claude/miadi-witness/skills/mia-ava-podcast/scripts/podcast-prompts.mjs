#!/usr/bin/env node
// podcast-prompts.mjs: the Miadi podcast's prompts, kept in the ceremonial prompt store.
//
// Guillaume, 2026-11-03 (Episode 569, jgwill/Miadi#920): the prompts that write the
// podcast live in the Factory's ceremonial prompt management, so a person or an agent
// revises them there and the generation reads what was revised. The files under
// references/prompts/ are version 1 only. After `seed`, the store is the source.
//
//   node podcast-prompts.mjs list
//   node podcast-prompts.mjs seed [--dry-run]
//   node podcast-prompts.mjs get <name> [--version N | --label L] [--var k=v]...
//   node podcast-prompts.mjs compose --source-file F [--pass survey|dialogue] [--survey-file F]
//        [--context-file F | --context T] [--cast ava,mia,...] [--listener X] [--minutes N]
//        [--label L] [--json]
//   node podcast-prompts.mjs turns <dialogue.md> [--cast ava,mia,...]
//   node podcast-prompts.mjs revise <name> --text-file F [--promote] [--message M]
//
// Keys: CEREMONY_LANGFUSE_* from the environment or $MIADI_SRC/.env, read by
// miadi-run's domainKeys. No key, prompt body or trace content is printed by
// list, seed or revise.
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
export const SEEDS = join(HERE, "..", "references", "prompts")
const KIT = process.env.MIADI_ORCHESTRATION_KIT_ROOT || resolve(HERE, "../../../../..")
const DOMAIN = "ceremony"

export const DEFAULT_CAST = ["ava", "mia", "miette", "mino", "tushell"]
export const PERSONA_PREFIX = "miadi-podcast-persona-"

// ---------- pure ----------

/** Fill {{name}} placeholders. Returns the text and the names left unfilled. */
export function compile(text, vars = {}) {
  const missing = new Set()
  const out = text.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (m, name) => {
    if (vars[name] === undefined || vars[name] === null) { missing.add(name); return m }
    return String(vars[name])
  })
  return { text: out, missing: [...missing] }
}

/** The labelled turns of a dialogue file, as voice_publish_dialogue takes them. */
export function dialogueTurns(markdown, cast = DEFAULT_CAST) {
  const labels = new Map(cast.map((id) => [id.charAt(0).toUpperCase() + id.slice(1), id]))
  const re = new RegExp(`^(${[...labels.keys()].join("|")}): `)
  const turns = []
  const stray = []
  let started = false
  for (const block of markdown.split(/\n\s*\n/)) {
    const b = block.trim()
    if (!b) continue
    const m = re.exec(b)
    if (m) { started = true; turns.push({ persona: labels.get(m[1]), text: b.slice(m[0].length).replace(/\s*\n\s*/g, " ").trim() }); continue }
    if (started) stray.push(b.slice(0, 60))
  }
  return { turns, stray }
}

export function parseArgs(argv) {
  const out = { _: [], var: {} }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("--")) { out._.push(a); continue }
    const key = a.slice(2)
    if (["dry-run", "json", "promote"].includes(key)) { out[key] = true; continue }
    const val = argv[++i]
    if (val === undefined) throw new Error(`--${key} needs a value`)
    if (key === "var") { const eq = val.indexOf("="); out.var[val.slice(0, eq)] = val.slice(eq + 1); continue }
    out[key] = val
  }
  return out
}

// ---------- the store ----------

async function store(env = process.env) {
  const { domainKeys, promptText } = await import(pathToFileURL(join(KIT, "skills/miadi-run/miadi-run.mjs")).href)
  const k = domainKeys(env, DOMAIN)
  if (!k) throw new Error(`${DOMAIN.toUpperCase()}_LANGFUSE_PUBLIC_KEY or _SECRET_KEY is not set (environment or $MIADI_SRC/.env)`)
  const headers = { Authorization: "Basic " + Buffer.from(`${k.pub}:${k.sec}`).toString("base64"), "Content-Type": "application/json" }
  async function call(method, path, body) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(k.base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) })
      if (res.status === 429 && attempt < 3) { await new Promise((r) => setTimeout(r, 5000)); continue }
      const text = await res.text()
      return { status: res.status, body: text ? JSON.parse(text) : null }
    }
  }
  return {
    async get(name, { version, label } = {}) {
      const q = version ? `?version=${version}` : `?label=${encodeURIComponent(label || "production")}`
      const r = await call("GET", `/api/public/v2/prompts/${encodeURIComponent(name)}${q}`)
      if (r.status !== 200) return null
      return { name, version: r.body.version, labels: r.body.labels ?? [], config: r.body.config ?? {}, text: promptText(r.body), reference: `miadi-tracing:${DOMAIN}/prompt/${name}@${r.body.version}` }
    },
    async list(prefix) {
      const rows = []
      for (let page = 1; ; page++) {
        const r = await call("GET", `/api/public/v2/prompts?limit=100&page=${page}`)
        rows.push(...(r.body?.data ?? []).filter((p) => p.name.startsWith(prefix)))
        if (page >= (r.body?.meta?.totalPages ?? 1)) break
      }
      return rows.map((p) => ({ name: p.name, versions: p.versions ?? [], labels: p.labels ?? [] }))
    },
    async create(name, text, { labels = [], config = {}, tags = [], message } = {}) {
      const r = await call("POST", "/api/public/v2/prompts", { name, type: "text", prompt: text, labels, config, tags, ...(message ? { commitMessage: message } : {}) })
      if (r.status !== 200 && r.status !== 201) throw new Error(`creating ${name} answered HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`)
      return { name, version: r.body.version, labels: r.body.labels ?? [] }
    },
  }
}

// ---------- commands ----------

async function list(_, out) {
  const s = await store()
  for (const p of await s.list("miadi-podcast-")) out(`${p.name}  versions ${p.versions.join(",")}  labels ${p.labels.join(",")}`)
}

async function seed(opts, out) {
  const manifest = JSON.parse(readFileSync(join(SEEDS, "prompts.json"), "utf8"))
  const s = opts["dry-run"] ? null : await store()
  for (const p of manifest.prompts) {
    const text = readFileSync(join(SEEDS, p.file), "utf8")
    if (!s) { out(`would seed ${p.name} (${text.length} characters) labelled production`); continue }
    const existing = await s.get(p.name, { label: "latest" })
    if (existing) { out(`${p.name} exists at version ${existing.version}; left as it is`); continue }
    const made = await s.create(p.name, text, {
      labels: ["production"],
      config: p.config,
      tags: ["miadi-podcast", "episode-569"],
      message: "Version 1, seeded from the mia-ava-podcast skill (jgwill/Miadi#920, Episode 569)",
    })
    out(`seeded ${made.name} version ${made.version} [${made.labels.join(",")}]`)
  }
}

async function get(opts, out) {
  const name = opts._[1]
  if (!name) throw new Error("get needs a prompt name")
  const p = await (await store()).get(name, { version: opts.version ? Number(opts.version) : undefined, label: opts.label })
  if (!p) throw new Error(`${name} not found in ${DOMAIN}`)
  const { text, missing } = compile(p.text, opts.var)
  process.stderr.write(`${p.reference} [${p.labels.join(",")}]${missing.length ? ` unfilled: ${missing.join(", ")}` : ""}\n`)
  out(text)
}

async function compose(opts, out) {
  if (!opts["source-file"]) throw new Error("compose needs --source-file")
  const s = await store()
  const label = opts.label || "production"
  const source = readFileSync(opts["source-file"], "utf8")
  const used = []
  const take = async (name) => {
    const p = await s.get(name, { label })
    if (!p) throw new Error(`${name} has no version labelled ${label} in ${DOMAIN}`)
    used.push({ name: p.name, version: p.version, reference: p.reference })
    return p
  }

  let text
  if ((opts.pass || "dialogue") === "survey") {
    const p = await take("miadi-podcast-academic-survey")
    text = compile(p.text, { source }).text
  } else {
    const d = await take("miadi-podcast-dialogue")
    const cast = opts.cast ? opts.cast.split(",").map((c) => c.trim()).filter(Boolean) : (d.config.cast ?? DEFAULT_CAST)
    const listener = opts.listener || d.config.listener || "the person"
    const blocks = []
    for (const id of cast) blocks.push(compile((await take(PERSONA_PREFIX + id)).text, { listener }).text.trim())
    const context = opts["context-file"] ? readFileSync(opts["context-file"], "utf8") : (opts.context || "(none given)")
    const survey = opts["survey-file"] ? readFileSync(opts["survey-file"], "utf8") : "(none: write the survey first with --pass survey)"
    const filled = compile(d.text, { listener, cast: blocks.join("\n\n"), minutes: opts.minutes || d.config.minutes || 3, context, survey, source })
    if (filled.missing.length) throw new Error(`miadi-podcast-dialogue left unfilled: ${filled.missing.join(", ")}`)
    text = filled.text
  }
  if (opts.json) out(JSON.stringify({ prompts: used, text }, null, 2))
  else { process.stderr.write(`prompts: ${used.map((u) => `${u.name}@${u.version}`).join(", ")}\n`); out(text) }
}

function turns(opts, out) {
  const file = opts._[1]
  if (!file) throw new Error("turns needs a dialogue file")
  const cast = opts.cast ? opts.cast.split(",").map((c) => c.trim()) : DEFAULT_CAST
  const { turns: t, stray } = dialogueTurns(readFileSync(file, "utf8"), cast)
  if (stray.length) throw new Error(`text after the first turn that no speaker says: ${stray.map((x) => JSON.stringify(x)).join("; ")}`)
  out(JSON.stringify({ turns: t }, null, 2))
}

async function revise(opts, out) {
  const name = opts._[1]
  if (!name || !opts["text-file"]) throw new Error("revise needs a prompt name and --text-file")
  const s = await store()
  const latest = await s.get(name, { label: "latest" })
  if (!latest) throw new Error(`${name} does not exist; seed it first`)
  const text = readFileSync(opts["text-file"], "utf8")
  if (text === latest.text) { out(`${name} version ${latest.version} already holds this text; nothing written`); return }
  const made = await s.create(name, text, { labels: opts.promote ? ["production"] : [], config: latest.config, message: opts.message })
  out(`${name} version ${made.version} [${made.labels.join(",")}]${opts.promote ? "" : " (not production until promoted)"}`)
}

export async function main(argv, out = console.log) {
  const opts = parseArgs(argv)
  const cmd = opts._[0]
  const table = { list, seed, get, compose, turns, revise }
  if (!table[cmd]) { out("usage: podcast-prompts.mjs list | seed | get | compose | turns | revise (see the header of this file)"); return 2 }
  await table[cmd](opts, out)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  // exitCode, not exit(): exit() ends the process before a piped stdout has flushed.
  main(process.argv.slice(2)).then((code) => { process.exitCode = code }, (e) => { console.error(e.message); process.exitCode = 1 })
}
