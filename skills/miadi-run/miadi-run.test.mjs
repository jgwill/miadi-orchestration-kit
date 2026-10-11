// node --test skills/miadi-run/
// Runs the real script as a process: stub tide, coaia, tmux and launchers on PATH log every call,
// one local server answers as Langfuse and as the episode door. jgwill/miadi-orchestration-kit#84.

import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { createServer } from "node:http"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "miadi-run.mjs")
const PROMPT = "miadiRun-2610110648-test-seat-checkPrepare"
const TRACE = "d87a4c119eb24fb4a718c29e130bd642"
const SECRETS = ["pk-lf-FAKE-PUBLIC-7f3a", "sk-lf-FAKE-SECRET-91c2", "FAKE-WRITER-TOKEN-55e0"]
const BODY_V1 = "repo: example\n<input>\n  the mission, version one\n</input>\n"

let root, stubs, logs, home, server, base
const requests = []
let promptBody = BODY_V1

function stub(name, stdout) {
  const file = join(stubs, name)
  writeFileSync(file, `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${logs}/${name}.log"
env | grep -c '^LANGFUSE_' >> "${logs}/${name}.envcount" || true
${stdout}
`)
  chmodSync(file, 0o755)
}

before(async () => {
  root = mkdtempSync(join(tmpdir(), "miadi-run-test-"))
  stubs = join(root, "bin"); logs = join(root, "logs"); home = join(root, "missions")
  for (const d of [stubs, logs]) mkdirSync(d)
  // tide prints a plan in the state written to logs/tide.state (default "create"); with --run it reports an executed seat
  stub("tide", `STATE=$(cat "${logs}/tide.state" 2>/dev/null || echo create)
if printf '%s\\n' "$@" | grep -qx -- '--run'; then echo "{\\"session\\":\\"episode-9-mia-companion\\",\\"state\\":\\"$STATE\\",\\"executed\\":true,\\"session_id\\":\\"tide-row-1\\"}"; else echo "{\\"session\\":\\"episode-9-mia-companion\\",\\"state\\":\\"$STATE\\",\\"commands\\":[]}"; fi`)
  stub("coaia", `echo "observation sent"`)
  for (const never of ["tmux", "claude", "miacompanionyolo"]) stub(never, "exit 0")

  server = createServer((req, res) => {
    let body = ""
    req.on("data", (c) => { body += c })
    req.on("end", () => {
      requests.push({ method: req.method, url: req.url, body })
      const send = (status, json) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(json)) }
      const u = new URL(req.url, "http://x")
      if (u.pathname === "/api/public/v2/prompts" && u.searchParams.get("name") === PROMPT) return send(200, { data: [{ name: PROMPT, versions: [1], labels: ["latest", "production"], type: "text" }] })
      if (u.pathname === `/api/public/v2/prompts/${PROMPT}`) {
        const v = Number(u.searchParams.get("version"))
        return v === 1 ? send(200, { name: PROMPT, version: 1, type: "text", prompt: promptBody, labels: ["latest", "production"] }) : send(404, {})
      }
      if (u.pathname === `/api/public/traces/${TRACE}`) return send(200, { id: TRACE, name: "Reciprocal mission inquiry — source and synthesis", sessionId: "miadi-reciprocal-mission-261011", input: "never printed", observations: [{ id: "child-1", parentObservationId: "root-1", startTime: "2026-10-11T10:48:01Z" }, { id: "root-1", parentObservationId: null, startTime: "2026-10-11T10:48:00Z" }] })
      if (u.pathname === "/api/chronicle/episodes/9/tracing" && req.method === "POST") return send(JSON.parse(body).dryRun ? 200 : 201, { ok: true })
      return send(404, {})
    })
  })
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => { server.close(); rmSync(root, { recursive: true, force: true }) })

function cli(args) {
  const env = {
    PATH: `${stubs}:${dirname(process.execPath)}:/usr/bin:/bin`,
    HOME: root,
    MIADI_RUN_HOME: home,
    MIADI_ENV_FILE: join(root, "no.env"),
    CEREMONY_LANGFUSE_PUBLIC_KEY: SECRETS[0],
    CEREMONY_LANGFUSE_SECRET_KEY: SECRETS[1],
    CEREMONY_LANGFUSE_BASE_URL: base,
    MIADI_API_URL: base,
    MIADI_API_TOKEN_WRITER: SECRETS[2],
  }
  return new Promise((resolve) => execFile(process.execPath, [SCRIPT, ...args], { env }, (error, stdout, stderr) => resolve({ code: error ? error.code : 0, stdout, stderr })))
}

const log = (name) => (existsSync(join(logs, `${name}.log`)) ? readFileSync(join(logs, `${name}.log`), "utf8").trim().split("\n") : [])
const MISSION = `${PROMPT}.v1`
const PREPARE = ["prepare", "--prompt", PROMPT, "--version", "1", "--trace", TRACE, "--episode", "9"]

test("prepare refuses --run, --launch and --authorized-by before reading anything", async () => {
  for (const extra of [["--run"], ["--launch"], ["--authorized-by", "Guillaume"]]) {
    const r = await cli([...PREPARE, ...extra])
    assert.equal(r.code, 2, r.stderr)
  }
  assert.equal(requests.length, 0)
  assert.deepEqual(log("tide"), [])
})

test("prepare needs an explicit version number", async () => {
  for (const args of [PREPARE.filter((a, i) => i !== 3 && i !== 4), [...PREPARE.slice(0, 4), "latest", ...PREPARE.slice(5)]]) {
    const r = await cli(args)
    assert.equal(r.code, 2, r.stderr)
  }
})

test("prepare --dry-run writes nothing: no mission, no observation, episode door asked with dryRun", async () => {
  const r = await cli([...PREPARE, "--dry-run"])
  assert.equal(r.code, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.dryRun, true)
  assert.equal(existsSync(join(home, MISSION)), false)
  assert.ok(log("tide").every((c) => !c.includes("--run")))
  assert.deepEqual(log("coaia"), [])
  const posts = requests.filter((q) => q.method === "POST")
  assert.equal(posts.length, 2)
  assert.ok(posts.every((q) => JSON.parse(q.body).dryRun === true))
})

test("prepare --dry-run warns when tide's plan would not type the mission prompt", async () => {
  writeFileSync(join(logs, "tide.state"), "re-arm: already listening")
  const r = await cli([...PREPARE, "--dry-run"])
  rmSync(join(logs, "tide.state"))
  assert.equal(r.code, 8, r.stderr)
  assert.equal(JSON.parse(r.stdout).mission.launcher.delivers_brief, false)
  assert.match(r.stderr, /would not type the mission prompt/)
  assert.equal(existsSync(join(home, MISSION)), false)
})

test("prepare cannot execute: tide is asked for its plan only, nothing starts a seat", async () => {
  requests.length = 0
  const r = await cli(PREPARE)
  assert.equal(r.code, 0, r.stderr)

  const tide = log("tide")
  assert.ok(tide.length >= 1)
  for (const call of tide) {
    assert.match(call, /^companion open /)
    assert.doesNotMatch(call, /--run/)
  }
  for (const never of ["tmux", "claude", "miacompanionyolo"]) assert.deepEqual(log(never), [], `${never} was called during prepare`)

  const m = JSON.parse(readFileSync(join(home, MISSION, "mission.json"), "utf8"))
  assert.equal(m.state, "prepared")
  assert.deepEqual(m.launch, { authorized_by: null, at: null, executed: false })
  assert.equal(m.prompt.version, 1)
  assert.equal(m.prompt.sha256, createHash("sha256").update(BODY_V1).digest("hex"))
  assert.equal(readFileSync(m.prompt.brief, "utf8"), BODY_V1)
  assert.equal(statSync(m.prompt.brief).mode & 0o222, 0, "the pinned prompt is read-only")
  assert.equal(m.launcher.session, "episode-9-mia-companion")

  // the episode holds the prompt version and the trace, for real this time
  const held = requests.filter((q) => q.method === "POST").map((q) => JSON.parse(q.body))
  assert.deepEqual(held.map((b) => [b.reference, b.relation, b.dryRun]), [
    [`miadi-tracing:ceremony/prompt/${PROMPT}@1`, "is-prompted-by", false],
    [`miadi-tracing:ceremony/trace/${TRACE}`, "is-traced-in", false],
  ])

  // one appended preparation observation; the trace's name and the prompt's versions are untouched
  const coaia = log("coaia")
  assert.equal(coaia.length, 1)
  assert.match(coaia[0], /^fuse traces add-observation --trace-id d87a4c11\S* --parent-id root-1 /, "a parentless observation would become a root and rename the trace")
  assert.match(coaia[0], /miadi-run · preparation · /)
  assert.doesNotMatch(coaia[0], /--trace-name|prompts create|prompts update|--label/)
})

test("a prepared mission is immutable: the same version cannot be prepared twice", async () => {
  const before = log("tide").length
  const r = await cli(PREPARE)
  assert.equal(r.code, 4, r.stderr)
  assert.equal(log("tide").length, before)
})

test("launch refuses without --authorized-by and leaves the mission prepared", async () => {
  const r = await cli(["launch", MISSION])
  assert.equal(r.code, 3, r.stderr)
  assert.ok(log("tide").every((c) => !c.includes("--run")))
  assert.equal(JSON.parse(readFileSync(join(home, MISSION, "mission.json"), "utf8")).state, "prepared")
})

test("launch refuses when the provider's version no longer matches the pinned sha256", async () => {
  promptBody = BODY_V1 + "changed\n"
  const r = await cli(["launch", MISSION, "--authorized-by", "Guillaume"])
  promptBody = BODY_V1
  assert.equal(r.code, 5, r.stderr)
  assert.ok(log("tide").every((c) => !c.includes("--run")))
})

test("observe will not write preparation or execution, and a return waits for a launch", async () => {
  for (const kind of ["preparation", "execution"]) assert.equal((await cli(["observe", MISSION, "--kind", kind, "--summary", "x"])).code, 2)
  assert.equal((await cli(["observe", MISSION, "--kind", "return", "--summary", "x"])).code, 4)
})

test("launch refuses when tide would re-arm a seat without typing the mission prompt", async () => {
  writeFileSync(join(logs, "tide.state"), "re-arm: start listener")
  const r = await cli(["launch", MISSION, "--authorized-by", "Guillaume"])
  rmSync(join(logs, "tide.state"))
  assert.equal(r.code, 7, r.stderr)
  assert.match(r.stderr, /would not type the mission prompt/)
  assert.ok(log("tide").every((c) => !c.includes("--run")))
  assert.equal(JSON.parse(readFileSync(join(home, MISSION, "mission.json"), "utf8")).state, "prepared")
})

test("launch on an explicit word runs tide --run once and writes the execution observation", async () => {
  const r = await cli(["launch", MISSION, "--authorized-by", "Guillaume"])
  assert.equal(r.code, 0, r.stderr)
  const runs = log("tide").filter((c) => c.includes("--run"))
  assert.equal(runs.length, 1)
  const m = JSON.parse(r.stdout)
  assert.equal(m.state, "launched")
  assert.equal(m.launch.authorized_by, "Guillaume")
  assert.equal(m.launch.tide_session_id, "tide-row-1")
  assert.equal(m.launch.state, "create")
  assert.match(log("coaia").at(-1), /miadi-run · execution · /)
  assert.equal((await cli(["launch", MISSION, "--authorized-by", "Guillaume"])).code, 4, "a mission launches once")
})

test("research and return observations are distinct kinds", async () => {
  assert.equal((await cli(["observe", "--trace", TRACE, "--kind", "research", "--summary", "discussed the prompt"])).code, 0)
  const r = await cli(["observe", MISSION, "--kind", "return", "--summary", "seat opened, mission done"])
  assert.equal(r.code, 0, r.stderr)
  assert.equal(JSON.parse(r.stdout).state, "returned")
  const kinds = log("coaia").map((c) => c.match(/miadi-run · (\w+) · /)[1])
  assert.deepEqual(kinds, ["preparation", "execution", "research", "return"])
  assert.ok(log("coaia").every((c) => c.includes("--parent-id root-1") && !c.includes("--trace-name")), "every observation hangs under the root and leaves the trace name alone")
})

test("no credential reaches telemetry, the mission record, a request body or the output", async () => {
  const places = [
    ...readdirSync(logs).map((f) => readFileSync(join(logs, f), "utf8")),
    readFileSync(join(home, MISSION, "mission.json"), "utf8"),
    ...requests.map((q) => q.body),
    (await cli(["show", MISSION])).stdout,
  ]
  for (const text of places) for (const secret of SECRETS) assert.ok(!text.includes(secret), `a key leaked: ${secret.slice(0, 8)}…`)
  // coaia received the domain keys under the three names it reads, and only those
  const counts = readFileSync(join(logs, "coaia.envcount"), "utf8").trim().split("\n").map(Number)
  assert.ok(counts.every((n) => n === 3), `coaia saw LANGFUSE_* counts ${counts}`)
})
