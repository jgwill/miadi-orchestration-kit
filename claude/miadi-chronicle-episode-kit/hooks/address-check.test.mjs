// node --test hooks/address-check.test.mjs — the address Stop hook on fixtures.
import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { lastReply, missingAddresses } from "./address-check.mjs"

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "address-check.mjs")
const run = (input) => spawnSync(process.execPath, [HOOK], { input: JSON.stringify(input), encoding: "utf8" })

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

test("the hook blocks once with the addresses, and lets a second stop through", () => {
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
