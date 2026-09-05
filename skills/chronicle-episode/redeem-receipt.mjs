/**
 * Retry episode-node registration and rewrite .mw-registration.json truthfully.
 * Driven by redeem-receipt.sh (VESSEL, MW_URL, IW, DRY_RUN in the environment).
 *
 * registerEpisodeNode preflights GET /api/nodes/<id>, so an existing card is
 * reported already-registered and never overwritten. Writes exactly one file.
 */

import { basename, join } from "node:path"
import { readFileSync, writeFileSync } from "node:fs"

const vessel = process.env.VESSEL.replace(/\/+$/, "")
const episodeName = basename(vessel)
const { registerEpisodeNode } = await import(`file://${process.env.IW}`)

/** Tolerant read of the vessel manifest — top-level plain scalars only. */
function manifestField(yaml, key) {
  const match = new RegExp(`^${key}:[ \\t]*(.+)$`, "m").exec(yaml)
  if (!match) return undefined
  const raw = match[1].trim()
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === "string") return parsed
  } catch {
    // Not a JSON scalar — strip a single layer of YAML quoting.
  }
  return raw.replace(/^[\x22\x27]|[\x22\x27]$/g, "")
}

let number, title, goal
try {
  const yaml = readFileSync(join(vessel, "episode.yaml"), "utf8")
  number = manifestField(yaml, "episode")
  title = manifestField(yaml, "title")
  goal = manifestField(yaml, "goal")
} catch {
  // Manifest optional — the directory name is the durable identity.
}

const sourceIssue = (() => {
  try {
    const yaml = readFileSync(join(vessel, "episode.yaml"), "utf8")
    const match = /[\w.-]+\/[\w.-]+#\d+/.exec(yaml)
    return match ? match[0] : undefined
  } catch {
    return undefined
  }
})()

const input = {
  episodeName,
  name: number && title ? `Episode ${number} — ${title}` : episodeName,
  description: goal ?? "",
  sourceIssue,
}

/**
 * --dry-run is read-only against the wheel too: preflight GET alone, never a
 * POST. Paid for on 2026-08-04 — a "dry" run that still registered ep241,
 * because gating only the file write leaves the network write live.
 */
async function preflightOnly(mwUrl, episodeName) {
  const base = mwUrl.replace(/\/+$/, "")
  const nodeId = `chronicle:${episodeName}`
  try {
    const response = await fetch(`${base}/api/nodes/${encodeURIComponent(nodeId)}`)
    if (response.ok) return { state: "already-registered", node_id: nodeId }
    if (response.status === 404) return { state: "would-register", node_id: nodeId }
    return { state: "would-stay-pending", node_id: nodeId, error: `GET ${base}: HTTP ${response.status}` }
  } catch (error) {
    return {
      state: "would-stay-pending",
      node_id: nodeId,
      error: `medicine-wheel unreachable at ${base}: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

const dryRun = process.env.DRY_RUN === "1"
const outcome = dryRun
  ? await preflightOnly(process.env.MW_URL, episodeName)
  : await registerEpisodeNode(process.env.MW_URL, input)

const receipt = {
  state: outcome.state,
  node_id: outcome.node_id,
  timestamp: new Date().toISOString(),
  url: process.env.MW_URL,
}
if (outcome.error) receipt.error = outcome.error

const receiptPath = join(vessel, ".mw-registration.json")
if (dryRun) {
  console.log(`dry run — nothing written, nothing posted.`)
  console.log(`  wheel says: ${outcome.state}${outcome.error ? ` (${outcome.error})` : ""}`)
  console.log(`  node id:    ${outcome.node_id}`)
  console.log(`  would card: ${input.name}`)
  console.log(`  receipt to be rewritten on a real run: ${receiptPath}`)
} else {
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8")
  console.log(`wrote ${receiptPath}: ${outcome.state} ${outcome.node_id}`)
  if (outcome.state === "pending") {
    console.log(`still pending — ${outcome.error}`)
    console.log("The receipt is now truthful about the failure. Commit it, and retry when the wheel answers.")
  } else {
    console.log(`Now stage it by name:\n  git -C /srv/miadi/episodes add ${receiptPath}`)
  }
}

process.exitCode = outcome.state === "pending" || outcome.state === "would-stay-pending" ? 1 : 0
