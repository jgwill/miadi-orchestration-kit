# Hermes Hook Observer Framework

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

Hermes is a multi-agent, event-driven assistant that exposes its internal
life—prompts, tool invocations, failures, and user corrections—as structured
hooks on an event bus. This rispec defines the control-plane scaffold for
designing, specifying, and eventually implementing the hook-driven observational
agents that subscribe to those streams, build long-horizon traces, and feed
adaptations back into Hermes without retraining the underlying language models.

The work is grounded in three source bodies: MAPE-K autonomic computing loops,
multi-agent organisational role theory, and the Narrative Context Protocol (NCP)
as a constraint surface for story-level alignment.

## Served tracks

| Track | Role |
| --- | --- |
| Architecture | Define event schema, message bus topology, observer service contracts. |
| Specification | Turn observer roles into typed skill and agent contracts. |
| NCP integration | Map NCP narrative constraints onto the control-plane feedback surface. |
| Promotion gate | Decide when enough evidence exists to scaffold the `hermes-hook-observer-kit` Codex plugin fully. |

## Inputs

Future waves should read these before adding findings:

1. Academic abstract and engineering design paragraph provided by the user.
2. MAPE-K loop literature (monitor, analyse, plan, execute + knowledge base).
3. NCP design surface: narrative beats, roles, co-authorship constraints.
4. `copilot/miadi-adversarial-review-kit` for pattern precedent on
   critic-agent roles.
5. `codex/miadi-codex-orchestration-kit` for Codex plugin shape reference.
6. Any future event-bus or message-broker configuration evidence.

## What is in this folder

| File | Purpose |
| --- | --- |
| `01-reverse-engineer.md` | Reconstruct what the source materials tell us about Hermes architecture. |
| `02-intent.md` | State the desired outcome, current reality, structural tension, and non-goals. |
| `03-specify.md` | Define agent roles, event schema, skill contracts, observer patterns, and NCP feedback wiring. |
| `04-export.md` | Provide launch, resume, audit, and handoff shapes. |
| `05-source-ledger.md` | Track every claim, evidence pointer, confidence level, and contradiction. |

## Acceptance criteria

- The RISE wording `Reverse-engineer -> Intent-extract -> Specify -> Export`
  appears in this README and is used as the folder stage language.
- Every observer role (Event Observer, Pattern Miner, Critic Agent, Policy
  Governor, Tuner/Coach) has a typed skill or agent contract in `03-specify.md`.
- The JSON event schema has at minimum: `event_id`, `source_agent`, `event_type`,
  `timestamp`, `payload`, `session_id`, and `ncp_beat` fields.
- NCP feedback wiring is explicitly named as a control-plane output, not a
  data-plane concern.
- No live external mutation is scaffolded at this rispec stage.
- Every field in the schema is tied to a source-ledger row or marked provisional.
- Write-back gates follow the same pattern as
  `rispecs/agent-memory-provenance-framework/03-specify.md`.

## Source-ledger rules

- Evidence-backed claims need exact source pointers.
- Transcript or abstract claims are provisional until corroborated by
  working code, running precedent, or a cited paper.
- Provisional schema fields must name the missing evidence needed for promotion.
- Contradictions stay visible until resolved.
- Claims derived only from the problem statement abstract are marked
  `source: user-abstract` and confidence `low` until corroborated.

## Boundary

This rispec does not implement the event bus, write to any external system,
mutate agent memory, or decide production message-broker policy. It defines
the conceptual and specification surface for future implementation waves.
