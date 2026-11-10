// node --test skills/miadi-run/*.test.mjs
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
import { domainKeys } from "./miadi-run.mjs"

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "miadi-run.mjs")
const PROMPT = "miadiRun-2610110648-test-seat-checkPrepare"
const TRACE = "d87a4c119eb24fb4a718c29e130bd642"
const SECRETS = ["pk-lf-FAKE-PUBLIC-7f3a", "sk-lf-FAKE-SECRET-91c2", "FAKE-WRITER-TOKEN-55e0"]
const BODY_V1 = "repo: example\n<input>\n  the mission, version one\n</input>\n"
// create: a prompt the provider does not hold until coaia's stub records it in logs/created.<N>.txt
const NEW = "miadiRun-2610130900-test-seat-createFromText"
const NEW_V1 = "@app/pde @lib/pde  we have into @app/chronicle/\n(.pde/... could be an outside path)\n"
const NEW_V2 = NEW_V1 + "and a second thought\n"

// the binding line: one seat named after NEW's prompt, and one session that recorded MISSION at its start
const SEAT_ID = "aaaa1111-2222-4333-8444-555566667777"
const SEAT_TMUX = `${NEW}-seat`
const LAUNCHED_ID = "bbbb2222-3333-4444-8555-666677778888"
// the session running every command of this test, as Claude Code names it to a tool call
const SIGNER = "cccc3333-4444-4555-8666-777788889999"
// start: a prompt of its own in the eng domain, and the session the stub mct's seat binds
const START = "miadiRun-2611101653-test-seat-startVerb"
const STARTED_ID = "dddd4444-5555-4666-8777-888899990000"
const ENG = {}

let root, stubs, logs, home, server, base, sessiondata
const requests = []
let promptBody = BODY_V1
let limited = false
const traceLookups = {}

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
  sessiondata = join(root, "sessiondata"); mkdirSync(join(sessiondata, "data"), { recursive: true })
  writeFileSync(join(sessiondata, "data", "terminal_bindings.jsonl"), [
    { session_id: SEAT_ID, at: "2026-10-15T12:34:36Z", host: "gaia", tmux: { session: SEAT_TMUX, pane_id: "%7" } },
    { session_id: LAUNCHED_ID, at: "2026-10-15T12:40:00Z", event: "session.mission", tmux: { session: "episode-9-mia-companion", pane_id: "%9" }, mission: { id: `${PROMPT}.v1`, source: "prompt" } },
  ].map((l) => JSON.stringify(l)).join("\n") + "\n")
  // tide prints a plan in the state written to logs/tide.state (default "create"); with --run it reports an executed seat
  stub("tide", `STATE=$(cat "${logs}/tide.state" 2>/dev/null || echo create)
if printf '%s\\n' "$@" | grep -qx -- '--run'; then echo "{\\"session\\":\\"episode-9-mia-companion\\",\\"state\\":\\"$STATE\\",\\"executed\\":true,\\"session_id\\":\\"tide-row-1\\"}"; else echo "{\\"session\\":\\"episode-9-mia-companion\\",\\"state\\":\\"$STATE\\",\\"commands\\":[]}"; fi`)
  stub("coaia", `prev=""; name=""
for a in "$@"; do
  [ "$prev" = "--name" ] && name="$a"
  if [ "$prev" = "--prompt" ]; then
    if [ "$name" = "${START}" ]; then f=start-created; else f=created; fi
    n=$(ls "${logs}"/$f.*.txt 2>/dev/null | wc -l); printf '%s' "$a" > "${logs}/$f.$((n+1)).txt"
  fi
  prev="$a"
done
echo "observation sent"`)
  // tmux answers has-session from logs/tmux.sessions; nothing else is ever expected of it
  stub("tmux", `if [ "$1" = has-session ]; then grep -qxF -- "\${3#=}" "${logs}/tmux.sessions" 2>/dev/null; exit $?; fi
exit 0`)
  for (const never of ["claude", "miacompanionyolo"]) stub(never, "exit 0")
  // mct new: a dry run prints a plan and refuses a mission (none is prepared yet); a real run starts
  // the seat, whose agent writes its binding line, unless logs/mct.nobind holds it back
  stub("mct", `if printf '%s\n' "$@" | grep -qx -- '--dry-run'; then
  if printf '%s\n' "$@" | grep -qx -- '--mission'; then echo "No prepared mission" >&2; exit 2; fi
  echo "tmux new-session -d -s $3"; exit 0
fi
[ -f "${logs}/mct.fail" ] && { echo "tmux: no server" >&2; exit 4; }
[ -f "${logs}/mct.nobind" ] && exit 0
printf '{"session_id":"${STARTED_ID}","at":"%s","event":"session.start","tmux":{"session":"%s","pane_id":"%%11"}}\n' "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" "$3" >> "${sessiondata}/data/terminal_bindings.jsonl"`)

  server = createServer((req, res) => {
    let body = ""
    req.on("data", (c) => { body += c })
    req.on("end", () => {
      requests.push({ method: req.method, url: req.url, body })
      const send = (status, json) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(json)) }
      const u = new URL(req.url, "http://x")
      // one rate limit before the first answer about the busy prompt, as Langfuse sends it
      if (u.pathname === `/api/public/v2/prompts/${PROMPT}` && !limited) { limited = true; res.writeHead(429, { "Retry-After": "0" }); return res.end("{}") }
      if (u.pathname === "/api/public/v2/prompts" && u.searchParams.get("name") === PROMPT) return send(200, { data: [{ name: PROMPT, versions: [1], labels: ["latest", "production"], type: "text" }] })
      if (u.pathname === `/api/public/v2/prompts/${PROMPT}`) {
        const v = Number(u.searchParams.get("version"))
        return v === 1 ? send(200, { name: PROMPT, version: 1, type: "text", prompt: promptBody, labels: ["latest", "production"] }) : send(404, {})
      }
      const made = readdirSync(logs).filter((f) => /^created\.\d+\.txt$/.test(f)).length
      if (u.pathname === "/api/public/v2/prompts" && u.searchParams.get("name") === NEW) return send(200, { data: made ? [{ name: NEW, versions: Array.from({ length: made }, (_, i) => i + 1), labels: ["latest"], type: "text" }] : [] })
      if (u.pathname === `/api/public/v2/prompts/${NEW}`) {
        const file = join(logs, `created.${Number(u.searchParams.get("version"))}.txt`)
        return existsSync(file) ? send(200, { name: NEW, version: Number(u.searchParams.get("version")), type: "text", prompt: readFileSync(file, "utf8"), labels: [] }) : send(404, {})
      }
      const startMade = readdirSync(logs).filter((f) => /^start-created\.\d+\.txt$/.test(f)).length
      if (u.pathname === "/api/public/v2/prompts" && u.searchParams.get("name") === START) return send(200, { data: startMade ? [{ name: START, versions: Array.from({ length: startMade }, (_, i) => i + 1), labels: ["latest"], type: "text" }] : [] })
      if (u.pathname === `/api/public/v2/prompts/${START}`) {
        const file = join(logs, `start-created.${Number(u.searchParams.get("version"))}.txt`)
        return existsSync(file) ? send(200, { name: START, version: Number(u.searchParams.get("version")), type: "text", prompt: readFileSync(file, "utf8"), labels: [] }) : send(404, {})
      }
      // a trace create opened: unknown for its first two reads, as the provider is slow to hold it
      const opened = u.pathname.match(/^\/api\/public\/traces\/([0-9a-f]{32})$/)
      if (opened && opened[1] !== TRACE) {
        traceLookups[opened[1]] = (traceLookups[opened[1]] ?? 0) + 1
        if (existsSync(join(logs, "trace.never")) || traceLookups[opened[1]] <= 2) return send(404, {})
        return send(200, { id: opened[1], name: START, sessionId: "start-seat", observations: [{ id: "start-root", parentObservationId: null, startTime: "2026-11-10T22:00:00Z" }] })
      }
      if (u.pathname === `/api/public/traces/${TRACE}`) return send(200, { id: TRACE, name: "Reciprocal mission inquiry — source and synthesis", sessionId: "miadi-reciprocal-mission-261011", input: "never printed", observations: [{ id: "child-1", parentObservationId: "root-1", startTime: "2026-10-11T10:48:01Z" }, { id: "root-1", parentObservationId: null, startTime: "2026-10-11T10:48:00Z" }, { id: "ret-1", parentObservationId: "root-1", startTime: "2026-10-12T09:00:00Z", name: `miadi-run · return · ${PROMPT}.v1`, input: JSON.stringify({ summary: "seat opened, mission done" }) }] })
      if (u.pathname === "/api/chronicle/episodes/9/tracing" && req.method === "POST") return send(JSON.parse(body).dryRun ? 200 : 201, { ok: true })
      return send(404, {})
    })
  })
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  base = `http://127.0.0.1:${server.address().port}`
  Object.assign(ENG, { ENG_LANGFUSE_PUBLIC_KEY: SECRETS[0], ENG_LANGFUSE_SECRET_KEY: SECRETS[1], ENG_LANGFUSE_BASE_URL: base })
})

after(() => { server.close(); rmSync(root, { recursive: true, force: true }) })

function cli(args, extra = {}) {
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
    CLAUDE_SESSIONDATA_ROOT: sessiondata,
    CLAUDE_CODE_SESSION_ID: SIGNER,
    MIADI_RUN_START_POLL_MS: "20",
    MIADI_RUN_START_WAIT_S: "5",
    MIADI_RUN_START_BIND_WAIT_S: "1",
    ...extra,
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

test("a rate limit (429) is waited out, not read as a missing prompt", async () => {
  assert.equal(limited, true, "the dry runs above already met one 429 on the prompt and went on")
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
  // the brief names the pinned version and starts the seat; the prompt text stays in the provider
  const brief = readFileSync(m.prompt.brief, "utf8")
  assert.doesNotMatch(brief, /the mission, version one/, "no prompt text is written to disk")
  assert.match(brief, new RegExp(`miadi-tracing:ceremony/prompt/${PROMPT}@1 \\(sha256 ${m.prompt.sha256}\\)`))
  assert.match(brief, new RegExp(`miadi-run\\.mjs prompt ${MISSION.replace(/\./g, "\\.")}\\n`))
  assert.match(brief, /begin the\nmission now and do not wait for a take/)
  assert.equal(statSync(m.prompt.brief).mode & 0o222, 0, "the brief is read-only")
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
  assert.equal(m.prepared_by, SIGNER, "the record names the session that prepared it")
  assert.match(coaia[0], new RegExp(`"by":"${SIGNER}"`), "the observation names the session that wrote it")
})

test("a prepared mission is immutable: the same version cannot be prepared twice", async () => {
  const before = log("tide").length
  const r = await cli(PREPARE)
  assert.equal(r.code, 4, r.stderr)
  assert.equal(log("tide").length, before)
})

test("prompt prints the pinned version from the provider, and refuses once the provider's text differs", async () => {
  const r = await cli(["prompt", MISSION])
  assert.equal(r.code, 0, r.stderr)
  assert.equal(r.stdout, BODY_V1)
  promptBody = BODY_V1 + "changed\n"
  const changed = await cli(["prompt", MISSION])
  promptBody = BODY_V1
  assert.equal(changed.code, 5, changed.stderr)
  assert.equal(changed.stdout, "")
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
  assert.equal(m.launch.claude_session_id, LAUNCHED_ID, "the seat's own session, from its session.mission line")
  assert.match(log("coaia").at(-1), /miadi-run · execution · /)
  assert.match(log("coaia").at(-1), new RegExp(`--type generation --prompt-name ${PROMPT} --prompt-version 1 `), "the execution is a generation linked to the pinned prompt version")
  assert.equal((await cli(["launch", MISSION, "--authorized-by", "Guillaume"])).code, 4, "a mission launches once")
})

test("research and return observations are distinct kinds", async () => {
  assert.equal((await cli(["observe", "--trace", TRACE, "--kind", "research", "--summary", "discussed the prompt"])).code, 0)
  const r = await cli(["observe", MISSION, "--kind", "return", "--summary", "seat opened, mission done"])
  assert.equal(r.code, 0, r.stderr)
  const returned = JSON.parse(r.stdout)
  assert.equal(returned.state, "returned")
  assert.deepEqual([returned.observations.at(-1).summary, returned.observations.at(-1).by], ["seat opened, mission done", SIGNER], "a return keeps its summary and its writer in the record")
  assert.equal(returned.launch.recorded_by, SIGNER)
  const kinds = log("coaia").map((c) => c.match(/miadi-run · (\w+) · /)[1])
  assert.deepEqual(kinds, ["preparation", "execution", "research", "return"])
  const types = log("coaia").map((c) => c.match(/--type (\w+)/)[1])
  assert.deepEqual(types, ["event", "generation", "event", "generation"], "execution and return link the prompt; research and preparation do not")
  assert.match(log("coaia").at(-1), new RegExp(`--prompt-name ${PROMPT} --prompt-version 1 `))
  assert.ok(log("coaia").every((c) => c.includes("--parent-id root-1") && !c.includes("--trace-name")), "every observation hangs under the root and leaves the trace name alone")
})

test("create refuses a name outside the miadiRun convention, and a missing or empty text, before writing", async () => {
  const empty = join(root, "empty.txt"); writeFileSync(empty, "  \n")
  const text = join(root, "new-v1.txt"); writeFileSync(text, NEW_V1)
  for (const args of [["create", "pde-into-chronicle", "--text-file", text], ["create", NEW], ["create", NEW, "--text-file", empty]]) {
    const r = await cli(args)
    assert.equal(r.code, 2, r.stderr)
  }
  assert.ok(log("coaia").every((c) => !c.startsWith("fuse prompts create")))
})

test("create makes the person's text a new version, sets no label, and opens its research trace", async () => {
  const before = log("coaia").length
  const r = await cli(["create", NEW, "--text-file", join(root, "new-v1.txt")])
  assert.equal(r.code, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.prompt.version, 1)
  assert.equal(out.prompt.reference, `miadi-tracing:ceremony/prompt/${NEW}@1`)
  assert.equal(readFileSync(join(logs, "created.1.txt"), "utf8"), NEW_V1, "the provider holds the text exactly as written")
  assert.equal(out.prompt.sha256, createHash("sha256").update(NEW_V1).digest("hex"))
  assert.equal(out.trace.opened, true)
  assert.match(out.trace.id, /^[0-9a-f]{32}$/)
  const calls = log("coaia").slice(before).join("\n")
  assert.match(calls, /^fuse prompts create --name miadiRun-2610130900-test-seat-createFromText --prompt /m)
  assert.doesNotMatch(calls, /--labels|--label |prompts update/)
  assert.match(calls, new RegExp(`^fuse traces create --name ${NEW} --trace-id ${out.trace.id} --session-id ${NEW} `, "m"))
  assert.equal(out.next, `miadi-run prepare --prompt ${NEW} --version 1 --trace ${out.trace.id} --episode <ref>`)
})

test("create refuses to add a version that repeats the latest text", async () => {
  const r = await cli(["create", NEW, "--text-file", join(root, "new-v1.txt")])
  assert.equal(r.code, 4, r.stderr)
  assert.equal(existsSync(join(logs, "created.2.txt")), false)
})

test("create with --trace adds the new version as a research observation under that trace's root", async () => {
  const text = join(root, "new-v2.txt"); writeFileSync(text, NEW_V2)
  const r = await cli(["create", NEW, "--text-file", text, "--trace", TRACE])
  assert.equal(r.code, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.prompt.version, 2)
  assert.equal(out.trace.opened, false)
  const added = log("coaia").filter((c) => c.startsWith("fuse traces add-observation")).at(-1)
  assert.match(added, /--parent-id root-1 /)
  assert.match(added, new RegExp(`miadi-run · research · miadi-tracing:ceremony/prompt/${NEW}@2`))
  assert.doesNotMatch(added, /--trace-name/)
})

const GIVEN = `${NEW}.v2`

test("given refuses without a seat, an authorization or a known session, and starts nothing", async () => {
  const prep = await cli(["prepare", "--prompt", NEW, "--version", "2", "--trace", TRACE, "--episode", "9"])
  assert.equal(prep.code, 0, prep.stderr)
  const tideBefore = log("tide").length
  assert.equal((await cli(["given", GIVEN, "--authorized-by", "Guillaume"])).code, 2)
  assert.equal((await cli(["given", GIVEN, "--session", SEAT_TMUX])).code, 3)
  assert.equal((await cli(["given", GIVEN, "--session", "ffffffff", "--authorized-by", "Guillaume"])).code, 4)
  assert.equal((await cli(["given", GIVEN, "--session", SEAT_TMUX, "--authorized-by", "Guillaume", "--at", "yesterday-ish"])).code, 2)
  assert.equal(log("tide").length, tideBefore)
  assert.equal(JSON.parse(readFileSync(join(home, GIVEN, "mission.json"), "utf8")).state, "prepared")
})

test("given records the seat a mission was handed to and links it to the prompt version, typing nothing", async () => {
  const tideBefore = log("tide").length
  const r = await cli(["given", GIVEN, "--session", SEAT_ID.slice(0, 8), "--authorized-by", "Guillaume", "--at", "2026-10-15T15:20:00Z"])
  assert.equal(r.code, 0, r.stderr)
  const m = JSON.parse(r.stdout)
  assert.equal(m.state, "launched")
  assert.equal(m.launch.via, "given")
  assert.equal(m.launch.claude_session_id, SEAT_ID)
  assert.equal(m.launch.session, SEAT_TMUX)
  assert.equal(m.launch.at, "2026-10-15T15:20:00Z")
  assert.equal(log("tide").length, tideBefore, "given asks tide nothing")
  for (const never of ["tmux", "claude", "miacompanionyolo"]) assert.deepEqual(log(never), [], `${never} was called`)
  const exec = log("coaia").at(-1)
  assert.match(exec, /miadi-run · execution · /)
  assert.match(exec, new RegExp(`--type generation --prompt-name ${NEW} --prompt-version 2 `))
  assert.match(exec, new RegExp(`"claude_session_id":"${SEAT_ID}"`))
  assert.equal((await cli(["given", GIVEN, "--session", SEAT_TMUX, "--authorized-by", "Guillaume"])).code, 4, "a mission is given once")
})

test("show and a return name the seat sessions of a mission", async () => {
  const shown = JSON.parse((await cli(["show", MISSION])).stdout)
  assert.deepEqual(shown.seats.map((s) => s.session_id), [LAUNCHED_ID, SIGNER], "the seat that recorded the mission, then the session that signed its events")
  const r = await cli(["observe", GIVEN, "--kind", "return", "--summary", "done in its own seat"])
  assert.equal(r.code, 0, r.stderr)
  assert.match(log("coaia").at(-1), new RegExp(`"seat_sessions":\\["${SEAT_ID}","${SIGNER}"\\]`))
})

test("backfill reads a return's summary back from the trace into a record made before 0.6.0", async () => {
  const file = join(home, MISSION, "mission.json")
  const m = JSON.parse(readFileSync(file, "utf8"))
  for (const o of m.observations) delete o.summary
  writeFileSync(file, JSON.stringify(m, null, 2))
  const coaiaBefore = log("coaia").length
  const r = await cli(["backfill", MISSION])
  assert.equal(r.code, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.filled, 1)
  assert.equal(JSON.parse(readFileSync(file, "utf8")).observations.find((o) => o.kind === "return").summary, "seat opened, mission done")
  assert.equal(log("coaia").length, coaiaBefore, "backfill writes nothing to the trace")
})

test("show lists the sessions that signed a mission's events beside its seat", async () => {
  const shown = JSON.parse((await cli(["show", MISSION])).stdout)
  assert.deepEqual(shown.seats.map((s) => [s.session_id, s.source]), [[LAUNCHED_ID, "prompt"], [SIGNER, "signed"]])
})

const STARTING = ["--episode", "9", "--team", "T8", "--authorized-by", "Guillaume"]
const startText = (n) => { const f = join(root, `start-${n}.txt`); writeFileSync(f, `start the seat, take ${n}\n`); return f }

test("start refuses before writing anything: a name outside the convention, no --authorized-by, a missing flag, a tmux session that exists", async () => {
  const text = startText(0)
  const coaiaBefore = log("coaia").length
  const asked = requests.length
  writeFileSync(join(logs, "tmux.sessions"), "t8-already-here\n")
  const cases = [
    [2, ["start", "t8-start-verb", "--text-file", text, "--session", "t8-new", ...STARTING]],
    [3, ["start", START, "--text-file", text, "--session", "t8-new", "--episode", "9", "--team", "T8"]],
    [2, ["start", START, "--text-file", text, "--session", "t8-new", "--episode", "9", "--authorized-by", "Guillaume"]],
    [4, ["start", START, "--text-file", text, "--session", "t8-already-here", ...STARTING]],
    [4, ["start", START, "--text-file", text, "--session", "t8-already-here", ...STARTING, "--dry-run"]],
  ]
  for (const [code, args] of cases) {
    const r = await cli(args, ENG)
    assert.equal(r.code, code, `${args.join(" ")}: ${r.stderr}`)
  }
  assert.match((await cli(cases[3][1], ENG)).stderr, /tmux session t8-already-here exists/)
  assert.equal(log("coaia").length, coaiaBefore, "no prompt version, no trace")
  assert.equal(requests.length, asked, "the provider is not even asked")
  assert.deepEqual(log("mct"), [])
})

test("start --dry-run writes nothing: it prints create and prepare, and runs mct new --dry-run", async () => {
  const coaiaBefore = log("coaia").length
  const r = await cli(["start", START, "--text-file", startText(1), "--session", "t8-start-dry", "--cwd", "/work/kit", ...STARTING, "--dry-run"], ENG)
  assert.equal(r.code, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.dryRun, true)
  assert.match(out.would_run[0], new RegExp(`miadi-run\\.mjs create ${START} --text-file \\S+ --domain eng --session t8-start-dry$`))
  assert.match(out.would_run[1], new RegExp(`miadi-run\\.mjs prepare --prompt ${START} --version '<N>' --trace '<trace-id>' --episode 9 --domain eng$`))
  assert.equal(out.would_run[2], `mct new T8 t8-start-dry --remote -d --mission '${START}.v<N>' --authorized-by Guillaume --cwd /work/kit`)
  assert.equal(out.mct_dry_run.status, 0)
  assert.equal(out.mct_dry_run.plan, "tmux new-session -d -s t8-start-dry")
  assert.deepEqual(log("mct"), ["new T8 t8-start-dry --remote -d --cwd /work/kit --dry-run"])
  assert.equal(log("coaia").length, coaiaBefore)
  assert.equal(existsSync(join(logs, "start-created.1.txt")), false)
  assert.equal(readdirSync(home).some((d) => d.startsWith(START)), false, "no mission")
})

test("start creates the version, prepares it once the provider reads the trace, opens the seat with mct and names its session", async () => {
  // an older session that once held the same tmux name is not the new seat
  writeFileSync(join(sessiondata, "data", "terminal_bindings.jsonl"), JSON.stringify({ session_id: "eeee5555-6666-4777-8888-999900001111", at: "2026-10-01T08:00:00Z", tmux: { session: "t8-start-real" } }) + "\n", { flag: "a" })
  const mctBefore = log("mct").length
  const r = await cli(["start", START, "--text-file", startText(2), "--session", "t8-start-real", "--cwd", "/work/kit", ...STARTING], ENG)
  assert.equal(r.code, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  const id = `${START}.v1`
  assert.equal(out.mission, id)
  assert.equal(out.prompt, `miadi-tracing:eng/prompt/${START}@1`)
  assert.match(out.trace, /^miadi-tracing:eng\/trace\/[0-9a-f]{32}$/)
  assert.equal(out.tmux, "t8-start-real")
  assert.equal(out.session_id, STARTED_ID)
  assert.equal(out.open, `${join(root, "workspace", ".mino", "bin", "session-door")} ${STARTED_ID} --open`)
  const traceId = out.trace.split("/").at(-1)
  assert.equal(traceLookups[traceId], 3, "two refusals while the provider could not read the trace, then prepare")
  assert.match(log("coaia").join("\n"), new RegExp(`fuse traces create --name ${START} --trace-id ${traceId} --session-id t8-start-real `), "the trace's session is the tmux name")
  const m = JSON.parse(readFileSync(join(home, id, "mission.json"), "utf8"))
  assert.equal(m.state, "prepared", "mct's helper records given once the brief is pasted")
  assert.equal(m.trace.id, traceId)
  assert.deepEqual(log("mct").slice(mctBefore), [`new T8 t8-start-real --remote -d --mission ${id} --authorized-by Guillaume --cwd /work/kit`])
})

test("start prints the tmux name when the seat's binding line is not written yet", async () => {
  writeFileSync(join(logs, "mct.nobind"), "")
  const r = await cli(["start", START, "--text-file", startText(3), "--session", "t8-start-unbound", ...STARTING], ENG)
  rmSync(join(logs, "mct.nobind"))
  assert.equal(r.code, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  assert.equal(out.mission, `${START}.v2`)
  assert.equal(out.session_id, null)
  assert.equal(out.open, "t8-start-unbound")
})

test("start stops after its bound when the provider never reads the trace, and when mct refuses, saying what to run next", async () => {
  writeFileSync(join(logs, "trace.never"), "")
  const mctBefore = log("mct").length
  const slow = await cli(["start", START, "--text-file", startText(4), "--session", "t8-start-slow", ...STARTING], { ...ENG, MIADI_RUN_START_WAIT_S: "0.2" })
  rmSync(join(logs, "trace.never"))
  assert.equal(slow.code, 4, slow.stderr)
  assert.match(slow.stderr, /is in no configured domain after \d+ tries/)
  assert.match(slow.stderr, new RegExp(`miadi-run\\.mjs prepare --prompt ${START} --version 3 --trace [0-9a-f]{32} --episode 9 --domain eng\\n  mct new T8 t8-start-slow --remote -d --mission ${START}\\.v3 --authorized-by Guillaume`))
  assert.equal(existsSync(join(home, `${START}.v3`)), false, "not prepared")
  assert.equal(log("mct").length, mctBefore, "no seat opened")

  writeFileSync(join(logs, "mct.fail"), "")
  const refused = await cli(["start", START, "--text-file", startText(5), "--session", "t8-start-refused", ...STARTING], ENG)
  rmSync(join(logs, "mct.fail"))
  assert.equal(refused.code, 6, refused.stderr)
  assert.match(refused.stderr, new RegExp(`mission ${START}\\.v4 is prepared, but mct new refused \\(exit 4\\): tmux: no server`))
  assert.equal(JSON.parse(readFileSync(join(home, `${START}.v4`, "mission.json"), "utf8")).state, "prepared")
})

test("the creative domain's keys are read from the env file", () => {
  const file = join(root, "creative.env")
  writeFileSync(file, "CREATIVE_LANGFUSE_PUBLIC_KEY=pk-c\nCREATIVE_LANGFUSE_SECRET_KEY=sk-c\n")
  assert.deepEqual(domainKeys({ MIADI_ENV_FILE: file }, "creative"), { pub: "pk-c", sec: "sk-c", base: "https://cloud.langfuse.com" })
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
