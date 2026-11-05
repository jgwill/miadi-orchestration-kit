// node --test hooks/address-check.test.mjs — the address Stop hook on fixtures.
import { after, test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { lastReply, missingAddresses } from "./address-check.mjs"

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "address-check.mjs")
const CACHE = mkdtempSync(join(tmpdir(), "address-check-cache-"))
const run = (input) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify(input), encoding: "utf8", env: { ...process.env, XDG_CACHE_HOME: CACHE } })
after(() => rmSync(CACHE, { recursive: true, force: true }))

// The shape of the reply that showed the fault: questions and decisions, with one episode named bare.
const REPLY = [
  "🧠: DeepDiver now knows the step-by-step flow, and Episode 251 (miadi-chronicle://251) holds the plans.",
  "Q3 Producer notes: a false premise like Episode 565's would not show up in them.",
  "- D1: Should /deepdive stop at a plan by default? I recommend yes for every explainer and deck.",
  "- D2: Should I run a first Jev trial on the three kept plans? I recommend yes.",
  "🌸: You can now read and correct what a video plans to say before any of the day's videos is spent on it.",
].join("\n\n")
const CORRECTION = "🧠: Episode 565 → miadi-chronicle://565\n\n🌸: This address lets you open that episode directly from the terminal."
const COMPLETE = REPLY.replace("Episode 565's", "Episode 565's (miadi-chronicle://565)")

test("an episode or circle named without its address is found; an addressed one is not", () => {
  assert.deepEqual(missingAddresses("Episode 563 is minted."), { episodes: [563], circles: [] })
  assert.deepEqual(missingAddresses("Episode 563 (miadi-chronicle://563) is minted."), { episodes: [], circles: [] })
  assert.deepEqual(missingAddresses("ep563 and miadi-chronicle:0563"), { episodes: [], circles: [] })
  assert.deepEqual(missingAddresses("ep349 relates to miadi-chronicle://2026-10-25-episode-563-x"), { episodes: [349], circles: [] })
  assert.deepEqual(missingAddresses("its circle circle:1791110394383:jj1ql8 opened"), { episodes: [], circles: ["circle:1791110394383:jj1ql8"] })
  assert.deepEqual(missingAddresses("its circle miadi-circle://circle:1791110394383:jj1ql8 opened"), { episodes: [], circles: [] })
  assert.deepEqual(missingAddresses("step 3, deep 4, 12 episodes"), { episodes: [], circles: [] })
})

test("code spans are commands, not names for the reader", () => {
  assert.deepEqual(missingAddresses("ran `git commit -m \"ep563: x\"` and\n```\ncircle:1791110394383:jj1ql8\n```"), { episodes: [], circles: [] })
})

test("the reply of the ending turn is the assistant text after the last typed prompt", () => {
  const lines = [
    { type: "user", message: { content: "first prompt" } },
    { type: "assistant", message: { content: [{ type: "text", text: "Episode 1 old" }] } },
    { type: "user", message: { content: [{ type: "text", text: "second prompt" }] } },
    { type: "assistant", message: { content: [{ type: "text", text: "part one" }, { type: "tool_use", name: "Bash" }] } },
    { type: "user", message: { content: [{ type: "tool_result", content: "ok" }] } },
    { type: "assistant", message: { content: [{ type: "text", text: "Episode 563 done" }] } },
  ].map((l) => JSON.stringify(l))
  assert.equal(lastReply(lines), "part one\nEpisode 563 done")
})

test("the hook blocks with the addresses, and without a session it lets a second stop through", () => {
  const dir = mkdtempSync(join(tmpdir(), "address-check-"))
  try {
    const transcript = join(dir, "t.jsonl")
    writeFileSync(transcript, [JSON.stringify({ type: "user", message: { content: "go" } }), JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Episode 563's circle circle:1791110394383:jj1ql8 is open." }] } })].join("\n"))
    const blocked = run({ transcript_path: transcript, stop_hook_active: false })
    assert.equal(blocked.status, 0)
    const out = JSON.parse(blocked.stdout)
    assert.equal(out.decision, "block")
    assert.match(out.reason, /miadi-chronicle:\/\/563/)
    assert.match(out.reason, /miadi-circle:\/\/circle:1791110394383:jj1ql8/)
    assert.equal(run({ transcript_path: transcript, stop_hook_active: true }).stdout, "")
    assert.equal(run({ last_assistant_message: "Episode 563 (miadi-chronicle://563)." }).stdout, "")
    assert.equal(run({}).stdout, "")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("the first block asks for the complete reply, with its character count", () => {
  const out = JSON.parse(run({ session_id: "first", last_assistant_message: REPLY, stop_hook_active: false }).stdout)
  assert.equal(out.decision, "block")
  assert.match(out.reason, /Episode 565 → miadi-chronicle:\/\/565/)
  assert.match(out.reason, /Send the complete reply again/)
  assert.ok(out.reason.includes(`has ${REPLY.length} characters`))
  assert.doesNotMatch(out.reason, /Do not repeat|one short line/)
})

test("a line of corrections goes back, and the complete reply ends the turn", () => {
  const id = "correction"
  assert.equal(JSON.parse(run({ session_id: id, last_assistant_message: REPLY }).stdout).decision, "block")
  const back = JSON.parse(run({ session_id: id, last_assistant_message: CORRECTION, stop_hook_active: true }).stdout)
  assert.equal(back.decision, "block")
  assert.ok(back.reason.includes(`has ${CORRECTION.length} characters and the reply has ${REPLY.length}`))
  assert.match(back.reason, /miadi-chronicle:\/\/565/, "the address is kept though the correction carried it")
  assert.equal(run({ session_id: id, last_assistant_message: COMPLETE, stop_hook_active: true }).stdout, "")
  assert.equal(run({ session_id: id, last_assistant_message: "ok", stop_hook_active: true }).stdout, "", "nothing is left to check")
})

test("a complete reply that still lacks the address goes back", () => {
  const id = "still-bare"
  run({ session_id: id, last_assistant_message: REPLY })
  const back = JSON.parse(run({ session_id: id, last_assistant_message: REPLY, stop_hook_active: true }).stdout)
  assert.equal(back.decision, "block")
  assert.match(back.reason, /^The reply names Miadi things/)
})

test("after three sends the turn ends and says so, so it never loops", () => {
  const id = "cap"
  run({ session_id: id, last_assistant_message: REPLY })
  for (let i = 0; i < 2; i++) assert.equal(JSON.parse(run({ session_id: id, last_assistant_message: CORRECTION, stop_hook_active: true }).stdout).decision, "block")
  const released = JSON.parse(run({ session_id: id, last_assistant_message: CORRECTION, stop_hook_active: true }).stdout)
  assert.equal(released.decision, undefined)
  assert.match(released.systemMessage, /asked 3 times/)
  assert.equal(run({ session_id: id, last_assistant_message: CORRECTION, stop_hook_active: true }).stdout, "")
})

test("another hook continuing the turn, or a count left by an interrupted turn, changes nothing", () => {
  assert.equal(run({ session_id: "other-hook", last_assistant_message: REPLY, stop_hook_active: true }).stdout, "")
  const id = "interrupted"
  run({ session_id: id, last_assistant_message: REPLY })
  assert.equal(run({ session_id: id, last_assistant_message: "done", stop_hook_active: false }).stdout, "")
  assert.equal(run({ session_id: id, last_assistant_message: "done", stop_hook_active: true }).stdout, "")
})
