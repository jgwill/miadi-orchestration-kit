#!/usr/bin/env node
// miadi-chart-pulse: a seat's chart moves with its commits.
//
//   miadi-chart-pulse record   PostToolUse (Bash): when a command committed, note the commit
//                              (sha, time, subject, repository).
//   miadi-chart-pulse stop     Stop: if this session committed and the chart store was not
//                              written within WINDOW_MIN before a commit or any time after it,
//                              stop the turn from ending, naming those commits, once per commit.
//
// MIADI_CHART_PULSE_STORE names the chart store, one file. A session without it is not checked.
//
// A Stop block makes the next message the last one, and the last message is what a person reads
// and annotates (`tan`). So the agent moves the chart and then sends its complete reply again.
// The hook keeps the reply's character count and counts what comes back: under REPEAT_SHARE of
// it goes back again, up to MAX_SENDS, then the turn ends and says so (Guillaume, 2026-11-05).
//
// Earned 2026-10-03: after a reboot a seat committed for hours and moved no chart until William
// noticed. It lived in that seat's own folder until other hosts needed it.
// Ref: jgwill/miadi-orchestration-kit#103. Exit 0 always; a block is the JSON on stdout.

import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join } from "node:path"
import { homedir } from "node:os"
import { gitInvocations } from "./git-command.mjs"

const STORE = process.env.MIADI_CHART_PULSE_STORE
if (!STORE) process.exit(0)

const STATE_DIR = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "miadi-chart-pulse")
const WINDOW_MIN = 20
const FRESH_SEC = 300
const REPEAT_SHARE = 0.9
const MAX_SENDS = 3

const input = JSON.parse(readFileSync(0, "utf8") || "{}")
const session = String(input.session_id || "unknown").replace(/[^\w-]/g, "")
const stateFile = join(STATE_DIR, `${session}.json`)

function load() {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8"))
  } catch {
    return { commits: [] }
  }
}
function save(state) {
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(stateFile, JSON.stringify(state, null, 1))
}
function git(dir, args) {
  return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
}
function storeMtimeSec() {
  try {
    return statSync(STORE).mtimeMs / 1000
  } catch {
    return 0
  }
}
function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }))
}

function record() {
  const command = input?.tool_input?.command
  if (typeof command !== "string") return
  const dirs = new Set(gitInvocations(command, input.cwd || process.cwd()).filter((g) => g.sub === "commit").map((g) => g.dir))
  if (!dirs.size) return
  const state = load()
  const now = Date.now() / 1000
  for (const dir of dirs) {
    let line
    try {
      line = git(dir, ["log", "-1", "--format=%H%x09%ct%x09%s"])
    } catch {
      continue
    }
    const [sha, ct, subject] = line.split("\t")
    if (now - Number(ct) > FRESH_SEC || state.commits.some((c) => c.sha === sha)) continue
    let repo = dir
    try {
      repo = git(dir, ["rev-parse", "--show-toplevel"])
    } catch {}
    state.commits.push({ sha, ct: Number(ct), subject, repo, storeAtCommit: storeMtimeSec(), reminded: false })
  }
  save(state)
}

/** The stop after this hook's own block: the last message has to be the complete reply. */
function checkResend(state, reply) {
  const { chars, sends } = state.resend
  if (!reply || reply.length >= chars * REPEAT_SHARE) {
    delete state.resend
    save(state)
    return
  }
  if (sends >= MAX_SENDS) {
    delete state.resend
    save(state)
    process.stdout.write(
      JSON.stringify({
        systemMessage: `chart-pulse: asked ${MAX_SENDS} times for the complete reply. The last message has ${reply.length} of its ${chars} characters.`,
      }),
    )
    return
  }
  state.resend.sends = sends + 1
  save(state)
  block(
    `chart-pulse: your last message has ${reply.length} characters and the reply has ${chars}, so it is not the complete reply. ` +
      "A person reads and annotates the last message. Send the complete reply again, word for word from its first line to its last.",
  )
}

function stop() {
  const state = load()
  const reply = typeof input.last_assistant_message === "string" ? input.last_assistant_message : ""
  if (input.stop_hook_active) {
    if (state.resend) checkResend(state, reply)
    return
  }
  // A count left by a turn that was interrupted says nothing about this one.
  if (state.resend) {
    delete state.resend
    save(state)
  }

  const storeNow = storeMtimeSec()
  const unmoved = state.commits.filter(
    (c) => !c.reminded && storeNow < c.ct && c.storeAtCommit < c.ct - WINDOW_MIN * 60,
  )
  if (!unmoved.length) return
  for (const c of unmoved) c.reminded = true
  if (reply) state.resend = { chars: reply.length, sends: 1 }
  save(state)
  const list = unmoved.map((c) => `${c.sha.slice(0, 8)} ${c.repo.split("/").pop()}: ${c.subject}`).join("\n")
  block(
    `chart-pulse: ${unmoved.length} commit(s) this session and the chart store has not moved with them:\n${list}\n` +
      "Move the chart they belong to (update_current_reality, mark_action_complete, a beat). " +
      "A person reads and annotates the last message, so then send your complete reply again as your last message, word for word from its first line to its last. " +
      "If no chart move applies, add one line at its end saying why. " +
      (reply ? `The reply has ${reply.length} characters and this hook counts them, so a short note comes back. ` : "") +
      "This reminder fires once per commit.",
  )
}

try {
  if (process.argv[2] === "record") record()
  else if (process.argv[2] === "stop") stop()
} catch {
  // A reminder that cannot run must not stop the seat's work.
}
process.exit(0)
