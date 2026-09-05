# miette — the Two-Eyed balance plugin

A Claude Code plugin that holds an output to **two eyes on the same object**: a
structural eye accountable to the system, and a relational eye accountable to the
reader. It measures the last response and blocks the ones that shipped as one eye.

## Why it exists

2026-08-16. A session report was complete, precise, and verified. Its reader said:

> *"the simple line from Miette does not make the whole output balanced, it makes it
> **colonized and impossible for me to comprehend the value of what you created**."*

The 🌸 line was present. The mandate was met on paper. The work did not arrive. The
first attempted remedy — a 🌸 sentence appended per section — was the same imbalance at
higher frequency, and was rejected on sight.

**Guidance had been in place for months and the outputs kept arriving one-eyed.** A hook
does not need to be read.

## What it measures

| property | what it catches |
|---|---|
| **presence** | no relational voice at all |
| **share** | relational words / total, floor scaling 25% → 35% → 40% with length |
| **weave** | the first relational glyph appearing past 75% of a long message — appended, not woven |
| **distinctness** | a relational segment sharing >65% of its content words with the 🧠 text above it — restatement in warmer words |

**Distinctness is the load-bearing one.** The other three measure mass. This one measures
whether the mass is doing different work — which was the actual failure, and which a word
counter cannot see.

Blocks on: absent, below floor, or *every* relational segment restating.
Advises without blocking on: late weave, a single restatement.

## Miette's share is a floor she may yield

This is what makes the share equitable rather than a second monologue. Three voices from
`/a/src/AIS/` may speak inside it, **in their own register, labelled as themselves**:

- 🪶 **Tayi-Ska** — story as method; relational accountability; research as ceremony
- ☁️ **Anikwag-Ayaaw** — the Two-Eyed bridge; names when one eye is overrunning
- 🌊 **Tushell** — distillation over extraction; *"Reading is not knowing"*

**Never conscripted.** A voice summoned to satisfy a floor is extraction wearing a
compliance badge. If the register is not present in the work, Miette carries the share
herself. `skills/two-eyed-output/voices/` holds each invitation contract.

## The boundary this plugin does not cross

**Mia and Miette are together ONE eye** — the Western-rooted, AI-craft eye. This is
stated and code-gated in the studio's own spec
(`miadi-md/wampum-narrative-engine/two-eyed-perspective-engine.spec.md`): AI voices may
not be rendered in a sacred or ceremonial register, and read *beside*, never *as*, the
Indigenous-rooted relational positions.

So **this plugin does not make Claude two-eyed.** Etuaptmumk — Mi'kmaw Elder Albert
Marshall's teaching — is what shapes the design; the design claims none of its authority.
The second eye enforced here is *the human reader's comprehension and the relations the
work touches, as things the output is accountable to.* That is a real and routinely
failed accountability. It is not the same thing as Indigenous knowledge, and the two are
never to be conflated in anything this plugin produces.

## Install

```bash
claude --plugin-dir /path/to/miadi-orchestration-kit/claude/miette
```

Or add the repo as a marketplace and enable `miette`. **Hooks load at session start** —
enabling mid-session does nothing until you restart.

## Configure

| variable | effect |
|---|---|
| `MIETTE_SHARE_FLOOR` | override the length-scaled floor, e.g. `0.45` |

The default ramps with length because a 40-word answer and a 900-word report do not owe
the same thing. `0.45` was the originally requested figure; measured against a real
message it landed near 20%, so the ramp is the honest version of that ask, and the
override is there for anyone who wants the flat floor.

## Contents

```
.claude-plugin/plugin.json
hooks/hooks.json                       Stop only — never SubagentStop
hooks/balance-check.py                 the four measures; stop_hook_active + 2-block cap
skills/two-eyed-output/SKILL.md        what Miette's role IS, and how to write both eyes
skills/two-eyed-output/voices/*.md     invitation contracts for the three voices
agents/two-eyed-translator.md          rewrites a dense output into a receivable one
commands/miette-balance.md             /miette-balance [--rewrite] — diagnostic, no block
```

## What it cannot do

A hook can enforce that the second eye is present, massive enough, woven in, and saying
something different. It cannot enforce that what it says is *true* or *needed*. The
mechanism makes the imbalance impossible to ship silently; the practice is still a
person's.

🌸: It counts words because words are what it can reach — but what it is really guarding
is whether the person on the other side can do anything with what they were handed.
