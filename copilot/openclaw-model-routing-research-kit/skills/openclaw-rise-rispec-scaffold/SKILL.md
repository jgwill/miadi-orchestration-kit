---
name: openclaw-rise-rispec-scaffold
description: Scaffold OpenClaw model-routing rispecs using Reverse-engineer -> Intent-extract -> Specify -> Export and the standard 6-file rispec packet shape.
---

Use this skill when creating or reviewing RISE rispec folders for the OpenClaw model-routing study.

## Required RISE Wording

Use this exact phase wording in instructions, reviews, and scaffolds:

`Reverse-engineer -> Intent-extract -> Specify -> Export`

## Standard Rispec Packet Shape

Create or validate this file set. Each numbered file is the one its RISE phase leaves, as in
jgwill/llms-txt `llms-rise-framework.txt` 2.0.0 and `llms-rispecs-layout.md`:

1. `README.md`: the packet's roadmap
2. `01-reverse-engineer.md`: Phase 1, R
3. `02-intent.md`: Phase 2, I
4. `03-specify.md`: Phase 3, S
5. `04-export.md`: Phase 4, E
6. `05-source-ledger.md`: the sources the phases drew on

The packet folder sits under `rispecs/<packet>/` and gets a row in `rispecs/README.md`.

If a storytelling repository already has a richer local precedent, follow that precedent only when it preserves the same four RISE phases and does not obscure source provenance.

## Process

1. Confirm the target rispec folder is inside an allowed write scope from `launch-manifest.md`.
2. Read the source ledger for the track before writing claims.
3. Create missing files from the standard packet shape.
4. In `README.md`, state desired outcome, current reality, scope, source ledger path, related issues, and export target.
5. In `01-reverse-engineer.md`, capture prior art, source evidence, existing implementation signals, and constraints.
6. In `02-intent.md`, extract the study purpose, user need, ethical guardrails, and success criteria.
7. In `03-specify.md`, define behavior, inputs, outputs, constraints, non-goals, acceptance checks, and failure modes.
8. In `04-export.md`, define handoff shape, implementation notes, unresolved questions, and next launch command.
9. Link claims back to rows of `05-source-ledger.md` (or of the track ledger it points to).
10. Stop if the rispec would require unsourced claims or writes outside the manifest.

## Acceptance Checks

- RISE wording appears as `Reverse-engineer -> Intent-extract -> Specify -> Export`.
- All six files exist, and the packet has a row in `rispecs/README.md`.
- Source ledger path is present.
- Scope and non-goals are explicit.
- Implementation choices remain traceable to sources or are labeled as proposals.
- Export file names the next authorized action and stop conditions.
