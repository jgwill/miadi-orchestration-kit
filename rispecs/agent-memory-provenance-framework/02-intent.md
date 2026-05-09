# Intent-extract

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This stage defines the structural tension for memory provenance in the OpenClaw model-routing study.

## Desired outcome

Future agents can carry useful memory across sessions and model swaps without turning vague context into false authority. Each memory record remains auditable through source, observed time, confidence, status, scope, related task, and explicit human confirmation state before any write-back.

## Current reality

The study points toward persistent, user-owned memory, but the starting conditions are mixed:

- memory may be observed, inferred, or user-confirmed,
- provider memory and local memory can blur,
- session notes can look more authoritative than they are,
- later agents may consume memory without seeing its source or confidence,
- write-back can silently promote weak claims.

## Structural tension

| Current reality | Desired outcome | Advancing move |
| --- | --- | --- |
| Memory often appears as untyped context. | Memory records expose trust state and provenance. | Require metadata before write-back or reuse. |
| Inference can masquerade as confirmation. | Human confirmation is explicit and auditable. | Separate `inferred` from `user-confirmed` in status and ledger. |
| Model swaps can carry stale assumptions forward. | Memory survives model swaps only through scoped, reviewable records. | Attach scope, related task, confidence, and observed time. |
| Contradictions can be overwritten. | Contradictions remain visible until resolved. | Add contradiction status and review handoff. |

## Creative advancement scenarios

### Scenario: preserve an observed preference

**Desired Outcome:** A future agent can remember an observed preference without overstating trust.

**Current Reality:** The preference may come from behavior, not direct user confirmation.

**Natural Progression:** The memory is recorded as `observed`, given a source pointer, `observed_at`, confidence, scope, and related task.

**Resolution:** The record can guide low-risk behavior while still inviting confirmation before higher-impact use.

### Scenario: promote confirmed memory

**Desired Outcome:** A user-confirmed memory can safely guide future sessions.

**Current Reality:** The system needs to distinguish confirmation from inference and transcript summary.

**Natural Progression:** A confirmation event updates `user_confirmed`, status, confidence, and source pointer while preserving prior history.

**Resolution:** Future agents can rely on the memory within its declared scope and still audit how it became trusted.

## Non-goals

- Do not implement a memory database.
- Do not write or migrate memories.
- Do not decide production retention policy.
- Do not treat memory as identity or narrative framing; use the storytelling rispecs for that later.
- Do not run Academic, Technical, Narrative, or final research.

## Handoff shape

The handoff to `03-specify.md` should provide:

- approved trust-state vocabulary,
- required metadata fields,
- write-back risk model,
- contradiction handling intent,
- evidence gaps that block schema promotion.
