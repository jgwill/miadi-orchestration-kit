---
name: miadi-rise-wave-plan
description: Use when a Miadi mission is ready to be decomposed into RISE-aligned execution waves with scope, evidence roots, write boundaries, acceptance gates, and handoff artifacts.
---

# Miadi RISE Wave Plan

Use this skill after the mission has a sufficiently clear charter. Its purpose
is to prevent agents from improvising wave boundaries mid-session.

## Read first

1. The active `SESSION_CHARTER.md`, if present.
2. Any source ledger already created for the session.
3. Existing rispec files or acceptance criteria named by the user.
4. Relevant Copilot kit templates if the mission references them:
   - `copilot/openclaw-model-routing-research-kit/templates/track-handoff.md`
   - `copilot/session-charter-template.md`

## Wave model

Use the RISE path unless the charter clearly requires a smaller subset:

| Wave | Direction | Purpose |
| --- | --- | --- |
| R | Reverse-engineer | Inspect ancestors of the work: current code, prior specs, artifact folders, and evidence. |
| I | Intent-extract | Clarify desired outcome, structural tension, boundaries, and risks. |
| S | Specify | Produce or revise specs, task contracts, acceptance gates, and write scopes. |
| E | Export | Produce handoffs, ledgers, promotion notes, and next-session routing. |

For implementation-heavy missions, add West execution waves between Specify and
Export. Keep write scopes disjoint when parallel agents are involved.

## Required fields per wave

Each wave entry must include:

- wave id and direction,
- scope,
- owner or agent role,
- files or directories allowed for reading,
- files or directories allowed for writing,
- source-ledger obligations,
- acceptance gate,
- handoff artifact path,
- stop conditions,
- model or reasoning preference if the mission requires one.

## Decomposition rules

- Do not turn speculative rispecs into plugin implementation waves unless a
  readiness review says `promote`.
- Split exploration from implementation when a task needs unknown codebase facts.
- Assign shared-file work to one owner or sequence it across waves.
- Name all write scopes explicitly.
- Prefer artifacted handoffs over chat-only state.
- Use absolute paths for cross-repo roots and repo-relative paths for local
  artifacts.

## Output contract

Write or update `WAVE_PLAN.md` in the active artifact folder. Use
`templates/wave-plan.md` from this plugin as the base shape.

The final user-facing summary must include:

- number of waves,
- first wave to execute,
- blocked waves, if any,
- files written,
- whether any rispec promotion was rejected or deferred.
