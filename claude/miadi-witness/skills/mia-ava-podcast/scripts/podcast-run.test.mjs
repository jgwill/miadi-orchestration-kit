// node podcast-run.test.mjs
// Earned on the first request (2026-11-06): the gate's bars alone admitted 2,230 of 2,237 lines,
// and a key check matched "desk-a-place-where-guillaume-writes".
import assert from "node:assert/strict"
import { chooseFiles, exchangesFrom, holdsAKey, howToRead, isPersonText, mayBeJudged, missionFor, namedEpisodes, namedPaths, scoreOf } from "./podcast-run.mjs"

let passed = 0
const t = (name, fn) => { fn(); passed++; console.log(`ok ${name}`) }
const rec = (over) => ({ path: "/x", verdict: "read", relevant: 0.9, new_to_us: 0.9, action: "read_whole", action_above_bar: true, lines: 100, ...over })

t("a word that ends in sk- is not a key, a real shape is", () => {
  assert.equal(holdsAKey("desk-a-place-where-guillaume-writes-261030.md"), false)
  assert.equal(holdsAKey("task-with-a-very-long-slug-name-here"), false)
  assert.equal(holdsAKey("key sk-abcdefghijklmnopqrstuvwxyz"), true)
  assert.equal(holdsAKey("MIADI_API_TOKEN=abcdefghijklmnop"), true)
  assert.equal(holdsAKey("MIADI_API_TOKEN=$FROM_ENV"), false)
})

t("only text files under a root, never a key store", () => {
  const roots = ["/srv/miadi", "/workspace/repos"]
  assert.equal(mayBeJudged("/srv/miadi/episodes/a.md", roots), true)
  assert.equal(mayBeJudged("/srv/miadix/a.md", roots), false)
  assert.equal(mayBeJudged("/etc/passwd", roots), false)
  assert.equal(mayBeJudged("/srv/miadi/.env.local", roots), false)
  assert.equal(mayBeJudged("/srv/miadi/x/.ssh/config.md", roots), false)
  assert.equal(mayBeJudged("/srv/miadi/x/api-token.md", roots), false)
  assert.equal(mayBeJudged("/srv/miadi/x/take.mp3", roots), false)
})

t("a hook's bounce is not the person, and a reply is the longest text of its turn", () => {
  assert.equal(isPersonText("Stop hook feedback:\nchart-pulse"), false)
  assert.equal(isPersonText("<task-notification>x"), false)
  const line = (type, text, extra = {}) => JSON.stringify({ type, timestamp: "t", message: { content: [{ type: "text", text }] }, ...extra })
  const got = exchangesFrom([
    line("user", "first ask"),
    line("assistant", "the long real answer to the first ask"),
    line("user", "Stop hook feedback: say it again"),
    line("assistant", "short note"),
    "not json",
    line("user", "second ask"),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash" }] } }),
    line("assistant", "second answer"),
  ])
  assert.deepEqual(got.map((e) => [e.person, e.reply]), [["first ask", "the long real answer to the first ask"], ["second ask", "second answer"]])
})

t("the paths and episodes a message names", () => {
  assert.deepEqual(namedPaths("are in `/home/mia/workspace/.mino/design/261106-x.md`, which I sent. See https://a.b/c/d and /srv/miadi/x/."), ["/home/mia/workspace/.mino/design/261106-x.md", "/srv/miadi/x"])
  assert.deepEqual(namedEpisodes("Episode 567 (miadi-chronicle://567) and Episode 120, miadi-chronicle://568"), [567, 120, 568])
})

t("the mission says what is being done and for whom, with the focus", () => {
  const m = missionFor({ source: "the words", focus: "the fiction team", listener: "Guillaume" })
  assert.match(m, /so that Guillaume can hear/)
  assert.match(m, /bring out: the fiction team/)
  assert.match(m, /begins: the words/)
})

t("score is relevant x new_to_us, and a gate with no new_to_us scores on relevant", () => {
  assert.ok(Math.abs(scoreOf(rec({ relevant: 0.5, new_to_us: 0.5 })) - 0.25) < 1e-9)
  assert.equal(scoreOf(rec({ relevant: 0.5, new_to_us: null })), 0.5)
  assert.equal(scoreOf(rec({ relevant: null })), null)
})

t("the best files that fit are admitted, the rest stay closed and say why", () => {
  const got = chooseFiles([
    rec({ path: "/low", relevant: 0.5, new_to_us: 0.5, lines: 5 }),
    rec({ path: "/big", relevant: 0.9, new_to_us: 0.9, lines: 90 }),
    rec({ path: "/top", relevant: 1, new_to_us: 1, lines: 60 }),
    rec({ path: "/fits", relevant: 0.8, new_to_us: 0.8, lines: 30 }),
    rec({ path: "/gate", verdict: "skip", relevant: 0.9, new_to_us: 0.9, lines: 1 }),
    rec({ path: "/nojev", verdict: "ask", relevant: null, lines: 900 }),
  ], { budget: 100, floor: 0.4 })
  const by = Object.fromEntries(got.map((r) => [r.path, r]))
  assert.equal(by["/top"].admitted, true)
  assert.equal(by["/big"].closed, "past the reading budget")
  assert.equal(by["/fits"].admitted, true)
  assert.equal(by["/low"].closed, "scored under the floor")
  assert.equal(by["/gate"].closed, "the gate closed it")
  assert.equal(by["/nojev"].admitted, true)
  assert.equal(got[0].path, "/top")
})

t("a skim costs forty lines against the budget, not the whole file", () => {
  const got = chooseFiles([rec({ path: "/skim", verdict: "skim", lines: 900 })], { budget: 40 })
  assert.equal(got[0].admitted, true)
  assert.equal(howToRead(got[0]), "the first forty lines")
})

console.log(`${passed} passed`)
