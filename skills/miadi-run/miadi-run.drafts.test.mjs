// node --test skills/miadi-run/*.test.mjs
// The drafts verb against a draft log shaped as tide writes it (ironsilk 0.9.53), with a provider and
// an episode door held in memory. Episode 548, pre-session-draft-event.md, D3 and D4.

import { test } from "node:test"
import assert from "node:assert/strict"
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { draftEpisode, draftPromptName, main, tlidOf } from "./miadi-run.mjs"

const SESSION = "t1-draft-follow-2610310900"
const NAME = `miadiRun-2610310442-${SESSION}-presession`

function world() {
  const root = mkdtempSync(join(tmpdir(), "miadi-run-drafts-"))
  mkdirSync(join(root, "navigator", "drafts"), { recursive: true })
  const prompts = {}, traces = {}, calls = [], held = []
  const deps = {
    env: {
      MIADI_HOME: join(root, "navigator"),
      MIADI_RUN_HOME: join(root, "missions"),
      MIADI_ENV_FILE: join(root, "no.env"),
      ENG_LANGFUSE_PUBLIC_KEY: "pk-lf-FAKE",
      ENG_LANGFUSE_SECRET_KEY: "sk-lf-FAKE",
      ENG_LANGFUSE_BASE_URL: "http://lf",
      MIADI_API_URL: "http://api",
    },
    now: () => new Date("2026-10-31T09:00:00Z"),
    run: (cmd, args) => {
      calls.push([cmd, ...args])
      const flag = (n) => args[args.indexOf(n) + 1]
      if (args[1] === "prompts" && args[2] === "create") (prompts[flag("--name")] ??= []).push(flag("--prompt"))
      if (args[1] === "traces" && args[2] === "create") traces[flag("--trace-id")] = { name: flag("--name"), session: flag("--session-id") }
      return { status: 0, stdout: "ok", stderr: "" }
    },
    fetch: async (url, init = {}) => {
      const u = new URL(url)
      const answer = (status, body) => ({ status, ok: status < 300, json: async () => body, headers: { get: () => null } })
      if (u.pathname === "/api/public/v2/prompts") {
        const name = u.searchParams.get("name")
        return answer(200, { data: prompts[name] ? [{ name, versions: prompts[name].map((_, i) => i + 1), labels: [], type: "text" }] : [] })
      }
      const p = u.pathname.match(/^\/api\/public\/v2\/prompts\/(.+)$/)
      if (p) {
        const name = decodeURIComponent(p[1]), v = Number(u.searchParams.get("version"))
        return prompts[name]?.[v - 1] !== undefined ? answer(200, { name, version: v, type: "text", prompt: prompts[name][v - 1], labels: [] }) : answer(404, null)
      }
      const t = u.pathname.match(/^\/api\/public\/traces\/(.+)$/)
      if (t && traces[t[1]]) return answer(200, { id: t[1], name: traces[t[1]].name, sessionId: traces[t[1]].session, observations: [{ id: "root-1", parentObservationId: null, startTime: "2026-10-31T08:48:37Z" }] })
      const e = u.pathname.match(/^\/api\/chronicle\/episodes\/(\d+)\/tracing$/)
      if (e && init.method === "POST") { held.push({ episode: e[1], ...JSON.parse(init.body) }); return answer(201, { ok: true }) }
      return answer(404, null)
    },
  }
  const log = join(root, "navigator", "drafts", "events.jsonl")
  let n = 0
  const write = (state, payload, extra = {}) => {
    n += 1
    const id = `tdev:17933700${String(n).padStart(5, "0")}:0000000${n}`
    appendFileSync(log, JSON.stringify({ id, schema_version: "0.1.0", event_type: `tide.draft.${state}`, source: { kind: "terminal", system: "tide", instance: "gaia" },
      subject: { kind: "draft", id: "draft:fc4b1bcbc582" }, occurred_at: "2026-10-31T08:43:16+00:00", observed_at: "2026-10-31T08:43:16+00:00",
      actor: { kind: "person", id: "node:human:1789710466321:95nnhl" }, correlation_id: "draft:fc4b1bcbc582", idempotency_key: id,
      privacy: { classification: "internal", content_included: state === "versioned" }, payload: { pane: "mctgo-2610310442:0.0", kind: "mctgo", ...payload }, ...extra }) + "\n")
    return id
  }
  return { root, deps, prompts, traces, calls, held, write, log }
}

test("a draft's prompt is named after its mctgo session's minute and the session it names", () => {
  assert.equal(draftPromptName({ kind: "mctgo", pane: "mctgo-2610310442:0.0", target_session: SESSION }), NAME)
  assert.equal(draftPromptName({ kind: "mctgo", pane: "mctgo-2610310442:0.0", target_team: "T1" }), null, "no session named yet")
  assert.equal(draftPromptName({ kind: "shell", pane: "work:1.0", target_session: SESSION }), null)
  assert.equal(draftPromptName({ kind: "mctgo", pane: "mctgo-2610310442:0.0", target_session: "t8-t1-miadi-attention-stateloom-integration-$(tlid" }),
    "miadiRun-2610310442-t8-t1-miadi-attention-stateloom-integration-presession", "the part before $(tlid min)")
  const opened = new Date(2026, 9, 31, 4, 42).toISOString()
  assert.equal(draftPromptName({ kind: "mctgo", pane: "work:1.0", target_session: SESSION }, opened), `miadiRun-${tlidOf(opened)}-${SESSION}-presession`)
  assert.equal(tlidOf(opened), "2610310442")
  assert.equal(draftEpisode({ addresses: ["miadi-review://abc", "miadi-chronicle://548"] }), "548")
  assert.equal(draftEpisode({ paths: ["app/tide/"] }), null)
})

test("versions become prompt versions under one trace, the prefilled line and repeats add none", async () => {
  const w = world()
  w.write("versioned", { text: "mctgo ", version: 1, labels: {} })
  w.write("versioned", { text: `mctgo T1 ${SESSION} 'first thought`, version: 2, target_team: "T1", target_session: SESSION })
  const first = await main(["drafts"], w.deps)
  assert.equal(first.handled[0].skipped, "the draft names no session yet")
  assert.equal(first.handled[1].prompt, `miadi-tracing:eng/prompt/${NAME}@1`)
  assert.deepEqual(w.prompts[NAME], [`mctgo T1 ${SESSION} 'first thought`])
  assert.equal(Object.keys(w.traces).length, 1)

  assert.deepEqual((await main(["drafts"], w.deps)).handled, [], "a second run reads only new lines")

  w.write("versioned", { text: `mctgo T1 ${SESSION} 'first thought`, version: 3, target_team: "T1", target_session: SESSION })
  w.write("versioned", { text: `mctgo T1 ${SESSION} 'first thought, then a second'`, version: 4, target_team: "T1", target_session: SESSION })
  const second = await main(["drafts"], w.deps)
  assert.equal(second.handled[0].skipped, "the provider already holds this text")
  assert.equal(second.handled[1].prompt, `miadi-tracing:eng/prompt/${NAME}@2`)
  assert.equal(Object.keys(w.traces).length, 1, "later versions go under the draft's first trace")
  const research = w.calls.filter((c) => c[2] === "traces" && c[3] === "add-observation").at(-1).join(" ")
  assert.match(research, /--type event .*miadi-run · research · miadi-tracing:eng\/prompt\/.*@2/)
})

test("started relates the session to the last version, and holds both on a named episode", async () => {
  const w = world()
  w.write("versioned", { text: `mctgo T1 ${SESSION} 'see miadi-chronicle://548'`, version: 1, target_team: "T1", target_session: SESSION, labels: { addresses: ["miadi-chronicle://548"], team: "T1" } })
  const sent = w.write("sent", { target_team: "T1", target_session: SESSION })
  w.write("started", { target_team: "T1", target_session: SESSION, session_id: "8485453b-697e-4fbc-b108-8652c453f4b5", agent_kind: "claude", labels: { addresses: ["miadi-chronicle://548"], team: "T1" } }, { causation_id: sent })
  const out = await main(["drafts"], w.deps)
  const rel = out.handled.at(-1)
  assert.equal(rel.related, `miadi-tracing:eng/prompt/${NAME}@1`)
  assert.equal(rel.episode, "548")
  const execution = w.calls.find((c) => c.includes("--prompt-name")).join(" ")
  assert.match(execution, new RegExp(`--type generation --prompt-name ${NAME} --prompt-version 1 `))
  assert.match(execution, /"claude_session_id":"8485453b-697e-4fbc-b108-8652c453f4b5"/)
  assert.match(execution, new RegExp(`"sent_event":"${sent}"`))
  assert.deepEqual(w.held.map((h) => [h.episode, h.relation]), [["548", "is-prompted-by"], ["548", "is-traced-in"]])
  const state = JSON.parse(readFileSync(join(w.root, "missions", "drafts-follow.json"), "utf8"))
  assert.equal(state.drafts["draft:fc4b1bcbc582"].started.session_id, "8485453b-697e-4fbc-b108-8652c453f4b5")
})

test("a provider that cannot take a version stops the run at that line, and the next run takes it", async () => {
  const w = world()
  w.write("versioned", { text: `mctgo T1 ${SESSION} 'kept for later'`, version: 1, target_team: "T1", target_session: SESSION })
  const keys = w.deps.env.ENG_LANGFUSE_SECRET_KEY
  delete w.deps.env.ENG_LANGFUSE_SECRET_KEY
  const failed = await main(["drafts"], w.deps)
  assert.ok(failed.stopped, "stopped")
  assert.equal(failed.offset, 0)
  w.deps.env.ENG_LANGFUSE_SECRET_KEY = keys
  const later = await main(["drafts"], w.deps)
  assert.equal(later.handled[0].prompt, `miadi-tracing:eng/prompt/${NAME}@1`)
})

test("--dry-run writes nothing and keeps no position", async () => {
  const w = world()
  w.write("versioned", { text: `mctgo T1 ${SESSION} 'only looked at'`, version: 1, target_team: "T1", target_session: SESSION })
  const out = await main(["drafts", "--dry-run"], w.deps)
  assert.deepEqual(out.handled[0].would, { create: NAME, draft_version: 1, chars: `mctgo T1 ${SESSION} 'only looked at'`.length })
  assert.equal(w.calls.length, 0)
  assert.equal(existsSync(join(w.root, "missions", "drafts-follow.json")), false)
})

test("a line tide is still writing waits for the next run", async () => {
  const w = world()
  w.write("versioned", { text: `mctgo T1 ${SESSION} 'whole'`, version: 1, target_team: "T1", target_session: SESSION })
  appendFileSync(w.log, '{"id":"tdev:1:1","event_type":"tide.draft.vers')
  const out = await main(["drafts"], w.deps)
  assert.equal(out.handled.length, 1)
  assert.equal(out.offset, readFileSync(w.log).length - Buffer.byteLength('{"id":"tdev:1:1","event_type":"tide.draft.vers'))
  writeFileSync(join(w.root, "unused"), "")
})
