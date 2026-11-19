## Context

Part of jgwill/miadi-orchestration-kit#160. Domain: Engineering. Team: T1, session continuity, with
the witness plugin for the passes.

- Every session has an inventory record (477 on gaia on 2026-11-19), written at exit and nightly by
  `miadi-witness` `inventory.mjs`, and read once at exit by Jev (`inventory-at-exit.mjs`, a bar of
  0.6). No record carries a score.
- The factory states rules agents break again and again, and each is fixed by hand when Guillaume
  notices it: work left uncommitted (the kit's `AGENTS.md`, "Agent ownership of repo state"), the
  reversible finish handed back as a question (`/etc/claude-code/CLAUDE.md`, "Infer the Trivial
  Non-Destructive Finish"), the wrong model (jgwill/Miadi#1060, jgwill/Miadi#1028).
- The definitions those rules live in are spread over the kit's plugins and `teams/`,
  `/etc/claude-code` and jgwill/llms-txt. No single list names them.
- `rispecs/session-exit-reasons/` specifies a pass that groups exit reasons into patterns (S4) and
  counts their recurrence (S5). Not built.

## Desired State

Scorers are files in the kit (`scorers/<name>.md`), each with its judge, what it reads, when it
passes, its threshold and who set it. The nightly pass writes their results to each record's
`scores[]`. Failures that share a condition (three sessions in fourteen days) form a pattern. A seat
investigates it and says, for each session, whether a definition was missing, ambiguous, ignored or
the run varied. Only a missing or ambiguous definition becomes a proposal: problem, solution,
target, evidence, expected effect and the experience it creates, recorded with `propose_work` and
ruled in the cycle's talking circle. After the change lands, the next windows say whether it held.
`factory/definitions.yaml` names every place a definition lives, so a proposal can target only those.

## Action Steps

- [ ] S8: `factory/definitions.yaml`, first version by hand: the kit's plugins, `teams/`, `scorers/`, `/etc/claude-code` (jgwill/etc-claude-code), jgwill/llms-txt, stateloom drawings, each with its owning team and how a change lands
- [ ] S2: the scorer format and the first four scorers: `exit-reason`, `wrong-model`, `left-uncommitted` (counted) and `handed-back-finish` (one Jev choice)
- [ ] S2: the nightly pass writes `scores[]` to each record it reads, never rewriting a score already written, and SCHEMA.md in the inventory folder gets a "Scores" section
- [ ] S3: patterns with ids kept across passes, checked after the nightly pass
- [ ] S4: the investigation, a `miadi-witness` skill writing its file in the pass folder, changing nothing else
- [ ] S5: the proposal recorded with `propose_work`, its branch pushed, its PR opened after a "makes sense" ruling
- [ ] S7: recurrence per landed proposal: `held`, `partly` or `returned`
- [ ] The exit-reasons issue (jgwill/miadi-orchestration-kit#162) builds its pass as these steps for the scorer `exit-reason`

## Structural Tension

The rules the factory wants followed are written, and each break of them is seen only when a person
happens to look. Scoring every session against its own rules, and turning what recurs into a
proposal with its evidence, makes the factory's correction its own work, with the person ruling.

## Related

- Parent: jgwill/miadi-orchestration-kit#160
- Specification: `rispecs/self-improvement-cycle/03-specify.md`, S2 to S5, S7, S8
- jgwill/Miadi#1062 (`miadi-hooks-interpret exits`, which the scorers read)
- jgwill/miadi-orchestration-kit#162 (exit reasons), jgwill/Miadi#1063 (the app's views), jgwill/medicine-wheel#178 (the wheel's records)
- miadi-review:d47ef197-8fc2-4f81-be25-67d4e335d104 v8, its question on Langfuse score configurations (answered in S2)
- Episode 564 (miadi-chronicle://564), Episode 573 (miadi-chronicle://573)
