---
name: miadi-closeout-handoff
description: Use when closing a Miadi Codex session, wave, research pass, or plugin-building task. Verifies planned work, updates source-ledger status, records gaps, and writes a replayable handoff.
---

# Miadi Closeout Handoff

Use this skill at the end of a session or wave. The goal is to leave enough
evidence that a cheap resume or audit can continue without reading chat history.

## Read first

1. Active `SESSION_CHARTER.md`.
2. Active `WAVE_PLAN.md`.
3. Active `SOURCE_LEDGER.md`.
4. Git status and changed files.
5. Test, validation, or smoke-check outputs if available.

## Verification workflow

For each planned item:

1. Mark status:
   - `done`
   - `partial`
   - `not-started`
   - `deferred`
   - `blocked`
2. Attach evidence:
   - changed path,
   - source-ledger row,
   - command output summary,
   - manual review note.
3. Identify emergent work that was not in the original plan.
4. Identify claims that must not be promoted.
5. Record follow-up work with owner and next action.

## Quality checks

Run checks proportional to risk. At minimum:

- validate JSON/YAML/Markdown syntax for files changed,
- inspect `git diff --stat`,
- run available tests for touched code paths when applicable,
- ensure no secrets or tokens were written,
- ensure unready rispecs were not promoted as plugins.

If a check cannot be run, record why.

## Output artifacts

Write or update these in the active artifact folder:

- `SESSION_SUMMARY.md`
- `HANDOFF.md`
- `SOURCE_LEDGER.md` summary section

Use `templates/handoff.md` from this plugin as the handoff base.

## Final report shape

The user-facing closeout should include:

- files created or changed,
- verification performed,
- work intentionally left out,
- blocked or deferred items,
- recommended next action.

Keep the report concise. Do not hide unresolved risks.
