---
name: hermes-copilot-wave-closure
description: Close a completed Miadi Copilot/Hermes wave by auditing transcript evidence, changed files, validation, commit partitioning, Chronicle impact, and follow-up trigger decisions.
---

Use this skill after a Copilot/Claude/Codex/Gemini/Hermes implementation wave says it is complete.

## Why this exists

A wave can finish without committing anything.

That is not automatically wrong, but it is a distinct orchestration state. For Miadi, commits are disruptive Chronicle events: they change the living repo narrative and what future agents inherit.

## Workflow

1. Read the final wave report.
2. Read the transcript or gist export.
3. Run focused `git status --short` for allowed paths.
4. Run focused diff/stat for the changed paths.
5. Run or re-run the validation script if available.
6. Produce a changed-file ledger grouped by intent.
7. Decide commit partitioning:
   - implementation commit,
   - validation/test commit,
   - PDE/report commit,
   - Chronicle/preproduction commit,
   - orchestration-kit/self-evolution commit.
8. Decide whether Hermes can commit directly or should spawn a closure subagent.
9. Write a Chronicle event card describing what the commit would mean.
10. Emit a closure decision.

## Closure decisions

- `commit_ready`: files are coherent, validation is sufficient, and commit boundaries are clear.
- `commit_ready_with_runtime_caveat`: static checks pass but live secrets/runtime checks remain.
- `needs_commit_subagent`: work is broad enough to deserve a dedicated commit/review worker.
- `needs_human_gate`: committing would create a significant narrative/runtime disruption.
- `partial_retry_required`: report is incomplete, transcript evidence missing, or validation failed.

## Required closure packet

Write `CLOSURE-GATE.md` or equivalent with:

- issue/PDE anchor,
- transcript/gist reference,
- changed-file ledger,
- validation evidence,
- commit plan,
- Chronicle event seed,
- closure decision,
- next trigger.

## Rule

Do not silently leave uncommitted work behind after reporting success. If no commit is made, explicitly say why and what must happen next.
