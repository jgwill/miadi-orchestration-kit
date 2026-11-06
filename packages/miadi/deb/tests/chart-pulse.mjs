// node --test tests/chart-pulse.mjs: the commit check, and that its block leaves the complete reply last.
import { after, test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "../miadi-chronicle-server/usr/lib/miadi-chronicle-server/chart-pulse/chart-pulse.mjs")
const ROOT = mkdtempSync(join(tmpdir(), "chart-pulse-"))
after(() => rmSync(ROOT, { recursive: true, force: true }))

const REPLY = "🧠: The work is committed.\n\nQ1 Which version do we keep?\n\nD1: Stop at a plan by default. I recommend yes.\n\n🌸: You can read the plan before anything is spent on it."
const NOTE = "🧠: The chart moved."
let n = 0

function seat() {
  const id = `s${++n}`
  const dir = join(ROOT, id)
  execFileSync("git", ["init", "-q", dir])
  execFileSync("git", ["-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "the work"])
  const store = join(dir, "store.jsonl")
  writeFileSync(store, "")
  const yesterday = Date.now() / 1000 - 86400
  utimesSync(store, yesterday, yesterday)
  const run = (verb, input, env = { MIADI_CHART_PULSE_STORE: store }) =>
    spawnSync(process.execPath, [SCRIPT, verb], {
      input: JSON.stringify({ session_id: id, ...input }),
      encoding: "utf8",
      env: { ...process.env, MIADI_CHART_PULSE_STORE: "", XDG_CACHE_HOME: join(dir, "cache"), ...env },
    })
  run("record", { cwd: dir, tool_input: { command: 'git commit -m "the work"' } })
  return { id, dir, store, run }
}

test("a session with no store is not checked", () => {
  const { dir, run } = seat()
  assert.equal(run("stop", { last_assistant_message: REPLY }, {}).stdout, "")
  assert.equal(run("record", { cwd: dir, tool_input: { command: "git commit -m x" } }, {}).status, 0)
})

test("a commit with no chart move stops the turn and asks for the complete reply", () => {
  const { run } = seat()
  const out = JSON.parse(run("stop", { last_assistant_message: REPLY }).stdout)
  assert.equal(out.decision, "block")
  assert.match(out.reason, /1 commit\(s\)/)
  assert.match(out.reason, /the work/)
  assert.match(out.reason, /send your complete reply again/)
  assert.ok(out.reason.includes(`has ${REPLY.length} characters`))
  assert.doesNotMatch(out.reason, /say in one line/)
})

test("a short note goes back, the complete reply ends the turn, and the reminder fires once", () => {
  const { run } = seat()
  run("stop", { last_assistant_message: REPLY })
  const back = JSON.parse(run("stop", { last_assistant_message: NOTE, stop_hook_active: true }).stdout)
  assert.equal(back.decision, "block")
  assert.ok(back.reason.includes(`has ${NOTE.length} characters and the reply has ${REPLY.length}`))
  assert.equal(run("stop", { last_assistant_message: REPLY, stop_hook_active: true }).stdout, "")
  assert.equal(run("stop", { last_assistant_message: "later", stop_hook_active: true }).stdout, "")
  assert.equal(run("stop", { last_assistant_message: "later" }).stdout, "")
})

test("after three sends the turn ends and says so, so it never loops", () => {
  const { run } = seat()
  run("stop", { last_assistant_message: REPLY })
  for (let i = 0; i < 2; i++) assert.equal(JSON.parse(run("stop", { last_assistant_message: NOTE, stop_hook_active: true }).stdout).decision, "block")
  const released = JSON.parse(run("stop", { last_assistant_message: NOTE, stop_hook_active: true }).stdout)
  assert.equal(released.decision, undefined)
  assert.match(released.systemMessage, /asked 3 times/)
})

test("a chart store that moved after the commit lets the turn end", () => {
  const { store, run } = seat()
  const soon = Date.now() / 1000 + 10
  utimesSync(store, soon, soon)
  assert.equal(run("stop", { last_assistant_message: REPLY }).stdout, "")
})

test("another hook continuing the turn, or a count left by an interrupted turn, changes nothing", () => {
  const { run } = seat()
  assert.equal(run("stop", { last_assistant_message: NOTE, stop_hook_active: true }).stdout, "")
  run("stop", { last_assistant_message: REPLY })
  assert.equal(run("stop", { last_assistant_message: "done" }).stdout, "")
  assert.equal(run("stop", { last_assistant_message: "done", stop_hook_active: true }).stdout, "")
})

