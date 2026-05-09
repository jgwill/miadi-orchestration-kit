# Specify

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This stage defines the control-plane contract for future model-routing research or implementation waves.

## Required reading order

1. This README.
2. `05-source-ledger.md`.
3. `01-reverse-engineer.md`.
4. `02-intent.md`.
5. Active track findings only if the study manifest authorizes the track.
6. Source evidence named by the active ledger rows.

## Routing decision contract

Every proposed routing rule must declare:

| Field | Requirement |
| --- | --- |
| Task class | What the agent step is trying to produce. |
| Task signals | Observable inputs used to decide the route. |
| Candidate tier | Example tier such as `local/small`, `cheap/bulk`, or `premium`, if evidence supports that label. |
| Capability reason | Why that tier can handle the step. |
| Cost or latency reason | Whether cost or speed matters for the step. |
| Safety reason | Whether permission scope, data sensitivity, or review risk changes the route. |
| Fallback path | What happens when the selected tier fails or is unavailable. |
| Review gate | Whether a human or reviewer lane must inspect before escalation or final output. |
| Evidence status | Evidence, provisional claim, repo path evidence, transcript-only claim, or contradiction. |

## Model-routing matrix output

Future waves should produce rows shaped like:

| Step | Signals | Preferred tier | Fallback | Review gate | Evidence pointer | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `<task step>` | `<observed signals>` | `<tier>` | `<fallback>` | `<gate>` | `<ledger id>` | `<status>` |

Rows without a ledger pointer stay provisional.

## Lane contract

| Lane | Owns | Exit artefact |
| --- | --- | --- |
| A1 taxonomy lane | Terms, external concepts, academic framing | Vocabulary map with source status. |
| T1 implementation lane | Dispatch behavior, path evidence, pseudo-interface shape | Routing matrix rows and implementation notes. |
| Review lane | Contradictions, unsupported tier choices, overbroad claims | Revision list with required evidence. |
| Ledger lane | Claim status and source support | Updated `05-source-ledger.md`. |

## Review gates

Require review before a routing rule is promoted when:

- a task moves from low-cost to premium tier,
- a task crosses from read-only analysis into write or execute authority,
- the route handles sensitive memory or user data,
- the fallback changes output quality or trust level,
- the evidence is transcript-only or inferred from naming.

## Stop conditions

- The active track is not authorized by the launch manifest.
- A routing conclusion lacks ledger status.
- A repo implementation claim has no path-level evidence.
- A contradiction is discovered but not recorded.
- A proposed export would write outside the authorized study or rispec scope.

## Handoff shape

The handoff to `04-export.md` should include:

- the matrix rows ready for reuse,
- unresolved matrix rows that must remain provisional,
- review decisions,
- exact evidence pointers,
- next authorized launch or audit prompt shape.
