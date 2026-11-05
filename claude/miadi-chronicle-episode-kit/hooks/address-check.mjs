#!/usr/bin/env node
// address-check.mjs — a Stop hook: a reply that names an episode or a circle carries its address.
//
// The terminal opens Miadi addresses in the @miadi/reference-ui grammar (miadi-chronicle://563,
// miadi-circle://circle:<ms>:<id>), so a reply that says "Episode 563" or prints a bare
// circle:<ms>:<id> gives the reader nothing to open. This hook reads the reply of the turn
// that is ending (the assistant text after the last prompt, code spans removed) and, when an
// episode number or a circle id appears without its address, sends the agent back to add them.
//
// The agent sends the complete reply again, never a line of corrections. A Stop block makes the
// next message the last one, and the last message is what a person reads and annotates, so a
// correction there leaves nothing to annotate (Guillaume, 2026-11-05). Claude Code has no event
// before a reply is shown, so Stop is the only place to catch this. The hook keeps the reply's
// character count for the session and counts the next message: under REPEAT_SHARE of it, or still
// without an address, it goes back again. After MAX_SENDS it lets the turn end and says so.
//
// Rule: /etc/claude-code/CLAUDE.md "Miadi addresses in every reply" (jgwill/etc-claude-code#23).
// Exit 0 always; a block is the JSON on stdout.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

/** The share of the reply's characters a message must hold to count as the reply. */
export const REPEAT_SHARE = 0.9
/** How many times one reply is sent back before the turn may end anyway. */
export const MAX_SENDS = 3

/** Episode numbers named in the text ("Episode 563", "episode 563", "ep563", "ep 563"). */
export function episodesNamed(text) {
  const found = new Set()
  for (const m of text.matchAll(/\b(?:[Ee]pisodes?|ep)\s?(\d{1,4})\b/g)) found.add(Number(m[1]))
  return found
}

/** Episode numbers that carry an address (miadi-chronicle:563, miadi-chronicle://0563). */
export function episodesAddressed(text) {
  const found = new Set()
  for (const m of text.matchAll(/miadi-chronicle:(?:\/\/)?(?:ep)?(\d{1,4})\b/g)) found.add(Number(m[1]))
  // A folder name is an address too: miadi-chronicle://2026-10-25-episode-563-…
  for (const m of text.matchAll(/miadi-chronicle:(?:\/\/)?\d{4}-\d{2}-\d{2}-episode-(\d{1,4})-/g)) found.add(Number(m[1]))
  return found
}

/** Circle node ids printed without the miadi-circle scheme. */
export function bareCircles(text) {
  const bare = new Set()
  for (const m of text.matchAll(/(miadi-circle:(?:\/\/)?)?\b(circle:\d{10,}:[a-z0-9]{4,})/g)) if (!m[1]) bare.add(m[2])
  return bare
}

/** Prose only: fenced blocks and inline code are commands and paths, not names for the reader. */
export function prose(text) {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ")
}

export function missingAddresses(text) {
  const body = prose(text)
  // An address inside code still counts as written: it is printed, and the terminal opens it.
  const addressed = episodesAddressed(text)
  const episodes = [...episodesNamed(body)].filter((n) => !addressed.has(n)).sort((a, b) => a - b)
  const circles = [...bareCircles(body)]
  return { episodes, circles }
}

/** The assistant text of the turn that is ending: everything after the last prompt the person typed. */
export function lastReply(transcriptLines) {
  const parts = []
  for (const line of transcriptLines) {
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    const content = entry?.message?.content
    if (entry?.type === "user") {
      const typed = typeof content === "string" || (Array.isArray(content) && content.some((c) => c?.type === "text"))
      if (typed && !entry.isMeta) parts.length = 0
      continue
    }
    if (entry?.type === "assistant" && Array.isArray(content)) {
      for (const c of content) if (c?.type === "text" && typeof c.text === "string") parts.push(c.text)
    }
  }
  return parts.join("\n")
}

/** One "name → address" per thing the text names without its address. */
export function addressLines(text) {
  const { episodes, circles } = missingAddresses(text)
  return [
    ...episodes.map((n) => `Episode ${n} → miadi-chronicle://${n}`),
    ...circles.map((id) => `${id} → miadi-circle://${id}`),
  ]
}

/** What the agent is told. `got` is the length of a message that came back too short. */
export function resendReason({ chars, lines, got }) {
  const head =
    got === undefined
      ? "The reply names Miadi things without their address, so nothing opens from the terminal (/etc/claude-code/CLAUDE.md, \"Miadi addresses in every reply\")."
      : `Your last message has ${got} characters and the reply has ${chars}, so it is not the complete reply.`
  return (
    `${head} A person reads and annotates the last message, so it has to be the whole reply. ` +
    "Send the complete reply again, word for word from its first line to its last, " +
    `with each address beside the first mention of its name: ${lines.join("; ")}. Change nothing else. ` +
    `The reply has ${chars} characters and this hook counts them, so a message with only the addresses comes back.`
  )
}

function stateFile(sessionId) {
  const root = process.env.XDG_CACHE_HOME || join(homedir(), ".cache")
  return join(root, "miadi-address-check", `${sessionId.replace(/[^A-Za-z0-9_.-]/g, "_")}.json`)
}

function readState(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

function writeState(file, state) {
  try {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
    writeFileSync(file, JSON.stringify(state), { mode: 0o600 })
  } catch {
    // Without the count the next stop lets the turn end, which is the old behaviour.
  }
}

function clearState(file) {
  if (file) rmSync(file, { force: true })
}

function main() {
  let input = {}
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}")
  } catch {
    return
  }
  const file = typeof input.session_id === "string" && input.session_id ? stateFile(input.session_id) : null
  const sent = input.stop_hook_active && file ? readState(file) : null
  // Another hook continued this turn, and this one has nothing of its own to check.
  if (input.stop_hook_active && !sent) return
  // A count left by a turn that was interrupted says nothing about this one.
  if (!input.stop_hook_active) clearState(file)

  let text = typeof input.last_assistant_message === "string" ? input.last_assistant_message : ""
  if (!text && !sent && input.transcript_path) {
    try {
      text = lastReply(readFileSync(input.transcript_path, "utf8").split("\n"))
    } catch {
      return
    }
  }
  if (!text) {
    clearState(file)
    return
  }

  const missing = addressLines(text)
  const short = Boolean(sent) && text.length < sent.chars * REPEAT_SHARE
  if (!missing.length && !short) {
    clearState(file)
    return
  }

  if (sent && sent.sends >= MAX_SENDS) {
    clearState(file)
    process.stdout.write(
      JSON.stringify({
        systemMessage: `address-check: asked ${MAX_SENDS} times for the complete reply. The last message has ${text.length} of its ${sent.chars} characters.`,
      }),
    )
    return
  }

  const chars = sent ? sent.chars : text.length
  const lines = sent ? [...new Set([...sent.lines, ...missing])] : missing
  if (file) writeState(file, { chars, lines, sends: (sent ? sent.sends : 0) + 1 })
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: resendReason({ chars, lines, got: short ? text.length : undefined }),
    }),
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()
