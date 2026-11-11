#!/usr/bin/env node
// purpose-prompts.mjs: the Deep Diver's purposes (what happened, where we are going, teaser),
// kept in the ceremonial prompt store as miadi-deepdiver-purpose-<name>.
//
// Guillaume, 2026-11-10: the prompts that direct the Deep Diver's videos should be ones a
// person or an agent revises where the Factory keeps its prompts, as the podcast's are
// (mia-ava-podcast, podcast-prompts.mjs). The files under ../purposes/ are version 1 only.
// After `seed`, the store is the source; `get` falls back to the file when the store has none.
//
//   node purpose-prompts.mjs list
//   node purpose-prompts.mjs seed [--dry-run]
//   node purpose-prompts.mjs get <name> [--version N | --label L]
//   node purpose-prompts.mjs revise <name> --text-file F [--promote] [--message M]
//   node purpose-prompts.mjs promote <name> --version N
//
// Keys: CEREMONY_LANGFUSE_* from the environment or $MIADI_SRC/.env, read through
// miadi-run's domainKeys.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const PURPOSES = join(HERE, "..", "purposes")
const KIT = process.env.MIADI_ORCHESTRATION_KIT_ROOT || resolve(HERE, "../../..")
const DOMAIN = "ceremony"
export const PREFIX = "miadi-deepdiver-purpose-"

export function purposeFiles(dir = PURPOSES) {
  return readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => ({ name: PREFIX + basename(f, ".md"), file: join(dir, f) }))
}

export function promptName(name) {
  return name.startsWith(PREFIX) ? name : PREFIX + name
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("--")) { out._.push(a); continue }
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith("--")) out[key] = true
    else { out[key] = next; i++ }
  }
  return out
}

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
      return { name, version: r.body.version, labels: r.body.labels ?? [], text: promptText(r.body) }
    },
    async list() {
      const rows = []
      for (let page = 1; ; page++) {
        const r = await call("GET", `/api/public/v2/prompts?limit=100&page=${page}`)
        rows.push(...(r.body?.data ?? []).filter((p) => p.name.startsWith(PREFIX)))
        if (page >= (r.body?.meta?.totalPages ?? 1)) break
      }
      return rows.map((p) => ({ name: p.name, versions: p.versions ?? [], labels: p.labels ?? [] }))
    },
    async label(name, version, labels) {
      const r = await call("PATCH", `/api/public/v2/prompts/${encodeURIComponent(name)}/versions/${version}`, { newLabels: labels })
      if (r.status !== 200) throw new Error(`labelling ${name} version ${version} answered HTTP ${r.status}`)
      return { version: r.body.version, labels: r.body.labels ?? [] }
    },
    async create(name, text, { labels = [], message } = {}) {
      const r = await call("POST", "/api/public/v2/prompts", { name, type: "text", prompt: text, labels, tags: ["miadi-deepdiver"], ...(message ? { commitMessage: message } : {}) })
      if (r.status !== 200 && r.status !== 201) throw new Error(`creating ${name} answered HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 200)}`)
      return { version: r.body.version, labels: r.body.labels ?? [] }
    },
  }
}

async function list(_, out) {
  const s = await store()
  for (const p of await s.list()) out(`${p.name}  versions ${p.versions.join(",")}  labels ${p.labels.join(",")}`)
}

async function seed(opts, out) {
  const s = opts["dry-run"] ? null : await store()
  for (const { name, file } of purposeFiles()) {
    if (opts["dry-run"]) { out(`would seed ${name} from ${basename(file)}`); continue }
    if (await s.get(name, { label: "latest" })) { out(`${name} exists; revise it instead`); continue }
    const made = await s.create(name, readFileSync(file, "utf8"), { labels: ["production"], message: `seeded from purposes/${basename(file)}` })
    out(`${name} version ${made.version} [${made.labels.join(",")}]`)
  }
}

async function get(opts, out) {
  const name = promptName(opts._[1] || "")
  if (name === PREFIX) throw new Error("get needs a purpose name")
  const file = join(PURPOSES, name.slice(PREFIX.length) + ".md")
  let p = null
  try { p = await (await store()).get(name, { version: opts.version, label: opts.label }) } catch (e) { process.stderr.write(`store: ${e.message}\n`) }
  if (p) { process.stderr.write(`${name} version ${p.version} [${p.labels.join(",")}] from the ceremonial store\n`); out(p.text); return }
  if (!existsSync(file)) throw new Error(`${name} is in neither the store nor ${file}`)
  process.stderr.write(`${name} from ${file} (not in the store)\n`)
  out(readFileSync(file, "utf8"))
}

async function revise(opts, out) {
  const name = promptName(opts._[1] || "")
  if (name === PREFIX || !opts["text-file"]) throw new Error("revise needs a purpose name and --text-file")
  const s = await store()
  const latest = await s.get(name, { label: "latest" })
  if (!latest) throw new Error(`${name} does not exist; seed it first`)
  const text = readFileSync(opts["text-file"], "utf8")
  if (text === latest.text) { out(`${name} version ${latest.version} already holds this text; nothing written`); return }
  const made = await s.create(name, text, { labels: opts.promote ? ["production"] : [], message: opts.message })
  out(`${name} version ${made.version} [${made.labels.join(",")}]${opts.promote ? "" : " (not production until promoted)"}`)
}

async function promote(opts, out) {
  const name = promptName(opts._[1] || "")
  const version = Number(opts.version)
  if (name === PREFIX || !version) throw new Error("promote needs a purpose name and --version N")
  const s = await store()
  const p = await s.get(name, { version })
  if (!p) throw new Error(`${name} has no version ${version} in ${DOMAIN}`)
  const made = await s.label(name, version, [...p.labels.filter((l) => l !== "latest" && l !== "production"), "production"])
  out(`${name} version ${made.version} is production [${made.labels.join(",")}]`)
}

export async function main(argv, out = console.log) {
  const opts = parseArgs(argv)
  const table = { list, seed, get, revise, promote }
  const cmd = table[opts._[0]]
  if (!cmd) { out("usage: purpose-prompts.mjs list | seed [--dry-run] | get <name> | revise <name> --text-file F [--promote] | promote <name> --version N"); return 2 }
  await cmd(opts, out)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`purpose-prompts: ${e.message}`); process.exit(1) })
}
