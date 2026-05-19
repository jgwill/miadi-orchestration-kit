---
name: miadi-session-bootstrap
description: Use when starting a Miadi Codex orchestration session from a raw user prompt, mission brief, transcript excerpt, or workspace context. Produces a session charter, artifact folder, initial source ledger, and optional RISE wave-plan stub.
---

# Miadi Session Bootstrap

Use this skill to convert unstructured intent into a replayable Codex session
surface before implementation or research begins.

## Required inputs

Accept one or more of:

- raw user prompt or mission brief,
- transcript excerpt,
- workspace path,
- evidence roots to inspect,
- existing rispec, issue, PDE, or artifact folder,
- explicit direction hint if the user provides one.

If a required fact cannot be inferred from files or prompt context, mark it as
`unknown` and continue with a guarded assumption. Do not invent source facts.

## Workflow

1. Read local instruction files that govern the workspace:
   - `AGENTS.md`
   - nested `AGENTS.md` files that apply to the write path
   - relevant README or rispec files named by the prompt
2. Establish current reality:
   - existing files and folders that matter,
   - active git state,
   - known plugin or skill surfaces,
   - constraints from the user prompt.
3. Establish desired outcome:
   - the concrete end-state,
   - the artifact(s) expected,
   - the decision that should be possible after the session.
4. Classify the session direction:
   - East: inquiry, PDE, orientation, chartering.
   - South: planning, protocol, readiness, consent gates.
   - West: implementation, remediation, engaged practice.
   - North: reflection, closeout, archive, wisdom synthesis.
5. Create an artifact folder unless the user supplied one:
   - default: `.miadi/sessions/<YYYYMMDDHHMM>-<slug>/`
   - keep the slug short and filesystem-safe.
6. Write:
   - `SESSION_CHARTER.md`
   - `SOURCE_LEDGER.md`
   - `WAVE_PLAN.md` only when the mission is ready to decompose.
7. End with the next action:
   - proceed to wave planning,
   - run readiness review,
   - ask for a missing authorization,
   - pause because a stop gate was reached.

## Session charter shape

Use `templates/session-charter.md` from this plugin as the shape. Preserve these
sections:

- Objective
- Current Reality
- Desired Outcome
- Direction Assessment
- Roots to Inspect
- Artifact Folder
- Lane Contract
- Main-Lane Preservation Rule
- Required Outputs
- Boundaries
- Audit Note

## Stop gates

Stop and ask before:

- writing outside the active repo or user-approved artifact root,
- mutating external systems,
- storing secrets or tokens in artifacts,
- promoting a rispec to plugin when readiness is unclear,
- treating inferred memory as user-confirmed.

## Output contract

The final skill output must name:

- artifact folder,
- files written,
- direction classification,
- evidence roots inspected,
- next skill to invoke, if any.
