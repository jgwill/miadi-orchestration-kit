# Security Remediation Orchestration

RISE-oriented orchestration specs for security-hardening work that begins in a live issue folder, extracts reusable patterns, and exports them back into repeatable Miadi execution waves.

This folder was first authored from the evidence set for `jgwill/Miadi#263`, but it is deliberately scoped as **orchestration knowledge**, not as an application-security policy manual.

## What is in this folder

| File | Purpose |
| --- | --- |
| `01-reverse-engineer.md` | Reconstructs what the issue-263 evidence actually shows, with claim-level provenance and without prescribing the solution. |
| `02-intent.md` | Defines desired outcome, current reality, structural tension, and non-goals. |
| `03-specify.md` | States the durable orchestration contract: waves, lanes, reviews, inputs, outputs. |
| `04-export.md` | Gives launch, resume, audit, and handoff patterns for live execution. |
| `05-issue-263-source-ledger.md` | Records exact provenance, current-instance examples, and claim-level source support for promoted rules. |

## How to use this rispec

1. Read the active issue review and orchestration folder first, including its current `EXECUTION_LOG.md` or equivalent state tracker.
2. Use `05-issue-263-source-ledger.md` to see which issue-263 paths are durable provenance and which are only current-instance examples.
3. Read `01-reverse-engineer.md` to reconstruct the evidence before promoting anything into durable rules.
4. Read `02-intent.md` before creating or revising waves so the work stays outcome-oriented.
5. Use `03-specify.md` as the execution contract for lanes, handoffs, review gates, and exit artefacts.
6. Use `04-export.md` when preparing launch commands, audits, resume instructions, or skill invocation prompts.

## Boundary

Reusable rules belong here.

Issue-specific evidence, intermediate notes, and execution logs stay in the issue workspace, such as the current-instance issue-263 folder:

- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263`

If a future security issue repeats a similar orchestration pattern, extend this folder carefully. Do not fork a new plugin or duplicate these specs until repeated use proves a new reusable kit boundary is needed.
