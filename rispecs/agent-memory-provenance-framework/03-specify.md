# Specify

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This stage defines the control-plane contract for memory provenance, schema proposals, and write-back gates.

## Required reading order

1. This README.
2. `05-source-ledger.md`.
3. `01-reverse-engineer.md`.
4. `02-intent.md`.
5. Active A2 or T3 findings only if the study manifest authorizes the track.
6. Source evidence named by the active ledger rows.

## Memory record contract

Every proposed memory record shape must include or explicitly reject with rationale:

| Field | Requirement |
| --- | --- |
| `content` | The memory claim itself, phrased narrowly. |
| `source` | Exact source pointer or confirmation event. |
| `observed_at` | When the source was observed. |
| `confidence` | Low, medium, or high with evidence reason. |
| `status` | `observed`, `inferred`, `user-confirmed`, `contradicted`, `deprecated`, or another ledger-backed status. |
| `scope` | Where the memory may be used. |
| `related_task` | Study, issue, workflow, or user task that produced the memory. |
| `user_confirmed` | Boolean or richer confirmation object; must not be inferred. |

## Write-back gates

| Gate | Required before passing |
| --- | --- |
| Observation gate | Source pointer, `observed_at`, scope, and status are present. |
| Inference gate | Inference rationale and confidence are recorded; no overwrite of confirmed data. |
| Confirmation gate | Explicit human confirmation source is recorded. |
| Contradiction gate | Conflicting claims are linked and review owner is named. |
| Export gate | Ledger row exists and promotion status is clear. |

## Status transition rules

- `observed` may become `inferred` only with rationale and confidence.
- `observed` or `inferred` may become `user-confirmed` only through explicit human confirmation.
- Any state may become `contradicted` when a conflicting source appears.
- `contradicted` may not become `user-confirmed` until the contradiction is resolved.
- `deprecated` records remain auditable unless a separate retention rule authorizes removal.

## Lane contract

| Lane | Owns | Exit artefact |
| --- | --- | --- |
| A2 provenance lane | Trust vocabulary and provenance concepts | Vocabulary map with evidence status. |
| T3 schema lane | Fields, transitions, merge behavior, write-back gates | Schema proposal with ledger pointers. |
| Review lane | Unsupported trust claims and unsafe promotions | Revision list and stop conditions. |
| Ledger lane | Claim status and contradiction tracking | Updated `05-source-ledger.md`. |

## Stop conditions

- A write-back is proposed without source, status, confidence, scope, and confirmation state.
- An inferred claim is treated as user-confirmed.
- A schema field is promoted without evidence or explicit provisional status.
- A repo behavior claim lacks path-level evidence.
- The active track is not authorized by the launch manifest.

## Handoff shape

The handoff to `04-export.md` should include:

- proposed schema,
- field-level evidence status,
- transition rules,
- write-back gates,
- unresolved contradictions,
- audit prompts for memory promotion.
