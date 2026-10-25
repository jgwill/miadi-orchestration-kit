#!/usr/bin/env node
// address-check.mjs — a Stop hook: a reply that names an episode or a circle carries its address.
//
// The terminal opens Miadi addresses in the @miadi/reference-ui grammar (miadi-chronicle://563,
// miadi-circle://circle:<ms>:<id>), so a reply that says "Episode 563" or prints a bare
// circle:<ms>:<id> gives the reader nothing to open. This hook reads the reply of the turn
// that is ending (the assistant text after the last prompt, code spans removed) and, when an
// episode number or a circle id appears without its address, sends the agent back once to add
// them. With stop_hook_active it lets the turn end, so it never loops.
//
// Rule: /etc/claude-code/CLAUDE.md "Miadi addresses in every reply" (jgwill/etc-claude-code#23).
// Exit 0 always; a block is the JSON on stdout.

import { readFileSync } from "node:fs"

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

function main() {
  let input = {}
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}")
  } catch {
    return
  }
  if (input.stop_hook_active) return
  let text = typeof input.last_assistant_message === "string" ? input.last_assistant_message : ""
  if (!text && input.transcript_path) {
    try {
      text = lastReply(readFileSync(input.transcript_path, "utf8").split("\n"))
    } catch {
      return
    }
  }
  if (!text) return
  const { episodes, circles } = missingAddresses(text)
  if (!episodes.length && !circles.length) return
  const lines = [
    ...episodes.map((n) => `Episode ${n} → miadi-chronicle://${n}`),
    ...circles.map((id) => `${id} → miadi-circle://${id}`),
  ]
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason:
        "The reply names Miadi things without their address, so nothing opens from the terminal (/etc/claude-code/CLAUDE.md, \"Miadi addresses in every reply\"). " +
        `Send one short line that gives them: ${lines.join("; ")}. Do not repeat the reply.`,
    }),
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()
