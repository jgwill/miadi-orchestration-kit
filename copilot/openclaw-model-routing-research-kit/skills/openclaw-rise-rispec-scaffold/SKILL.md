---
name: openclaw-rise-rispec-scaffold
description: Scaffold OpenClaw model-routing rispecs using Reverse-engineer -> Intent-extract -> Specify -> Export and the standard 5-file rispec shape.
---

Use this skill when creating or reviewing RISE rispec folders for the OpenClaw model-routing study.

## Required RISE Wording

Use this exact phase wording in instructions, reviews, and scaffolds:

`Reverse-engineer -> Intent-extract -> Specify -> Export`

## Standard 5-File Rispec Shape

Create or validate this file set:

1. `README.md`
2. `01-reverse-engineer.md`
3. `02-intent-extract.md`
4. `03-specify.md`
5. `04-export.md`

If a storytelling repository already has a richer local precedent, follow that precedent only when it preserves the same four RISE phases and does not obscure source provenance.

## Process

1. Confirm the target rispec folder is inside an allowed write scope from `launch-manifest.md`.
2. Read the source ledger for the track before writing claims.
3. Create missing files from the standard 5-file shape.
4. In `README.md`, state desired outcome, current reality, scope, source ledger path, related issues, and export target.
5. In `01-reverse-engineer.md`, capture prior art, source evidence, existing implementation signals, and constraints.
6. In `02-intent-extract.md`, extract the study purpose, user need, ethical guardrails, and success criteria.
7. In `03-specify.md`, define behavior, inputs, outputs, constraints, non-goals, acceptance checks, and failure modes.
8. In `04-export.md`, define handoff shape, implementation notes, unresolved questions, and next launch command.
9. Link claims back to source ledger rows.
10. Stop if the rispec would require unsourced claims or writes outside the manifest.

## Acceptance Checks

- RISE wording appears as `Reverse-engineer -> Intent-extract -> Specify -> Export`.
- All five files exist.
- Source ledger path is present.
- Scope and non-goals are explicit.
- Implementation choices remain traceable to sources or are labeled as proposals.
- Export file names the next authorized action and stop conditions.
