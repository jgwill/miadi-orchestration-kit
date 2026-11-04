// node --test claude/miadi-witness/skills/mia-ava-podcast/scripts/podcast-prompts.test.mjs
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { compile, dialogueTurns, parseArgs, pins, SEEDS, DEFAULT_CAST, PERSONA_PREFIX } from "./podcast-prompts.mjs"

test("compile fills placeholders and names the ones left", () => {
  assert.deepEqual(compile("Hi {{listener}}, {{ minutes }} min, {{cast}}", { listener: "Guillaume", minutes: 3 }), {
    text: "Hi Guillaume, 3 min, {{cast}}",
    missing: ["cast"],
  })
})

test("dialogue turns map five labels to their personas and skip the survey", () => {
  const md = "## Academics\n\n### Phonetics\n\nSounds.\n\nAva: What changed?\n\nMia: One track.\nStill Mia.\n\nMiette: It is easier to hear.\n\nMino: Verified once.\n\nTushell: Episode 553 asked for it."
  const { turns, stray } = dialogueTurns(md)
  assert.deepEqual(stray, [])
  assert.deepEqual(turns.map((t) => t.persona), ["ava", "mia", "miette", "mino", "tushell"])
  assert.equal(turns[1].text, "One track. Still Mia.")
})

test("a block no cast member says, after the first turn, is reported", () => {
  const { stray } = dialogueTurns("Ava: Hi.\n\nNarrator: Meanwhile.", ["ava", "mia"])
  assert.deepEqual(stray, ["Narrator: Meanwhile."])
})

test("arguments: flags, values and repeated --var", () => {
  assert.deepEqual(parseArgs(["get", "x", "--var", "a=1", "--var", "b=c=d", "--json"]), { _: ["get", "x"], var: { a: "1", b: "c=d" }, json: true })
})

test("every seed in the manifest exists, and the dialogue prompt names the default cast", () => {
  const manifest = JSON.parse(readFileSync(join(SEEDS, "prompts.json"), "utf8"))
  for (const p of manifest.prompts) assert.ok(readFileSync(join(SEEDS, p.file), "utf8").trim(), p.file)
  const dialogue = manifest.prompts.find((p) => p.name === "miadi-podcast-dialogue")
  assert.deepEqual(dialogue.config.cast, DEFAULT_CAST)
  for (const id of DEFAULT_CAST) assert.ok(manifest.prompts.some((p) => p.name === PERSONA_PREFIX + id), id)
})

test("the dialogue seed has a placeholder for everything compose fills", () => {
  const text = readFileSync(join(SEEDS, "miadi-podcast-dialogue.md"), "utf8")
  for (const v of ["listener", "cast", "minutes", "context", "survey", "source"]) assert.match(text, new RegExp(`\\{\\{${v}\\}\\}`), v)
})

test("bold speaker labels are read as speakers", () => {
  const { turns } = dialogueTurns("**Ava:** What changed?\n\n**Mia**: One track.")
  assert.deepEqual(turns, [{ persona: "ava", text: "What changed?" }, { persona: "mia", text: "One track." }])
})

test("pins read name@version, repeated, and refuse anything else", () => {
  assert.deepEqual(parseArgs(["compose", "--pin", "a@2", "--pin", "b-c@10"]).pin, ["a@2", "b-c@10"])
  assert.deepEqual(pins(["a@2", "b-c@10"]), { a: 2, "b-c": 10 })
  assert.throws(() => pins(["a"]), /<name>@<version>/)
})
