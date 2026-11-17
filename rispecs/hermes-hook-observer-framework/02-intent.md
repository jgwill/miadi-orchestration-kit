# Intent-Extract

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Desired outcome

A Codex plugin (`hermes-hook-observer-kit`) and its companion rispec that give
Miadi sessions a replayable, hook-driven observational control plane. The plugin
must:

1. Define a stable JSON event schema for hook events on the Hermes bus.
2. Provide a preparation skill (`hermes-hook-prepare`) that instruments a
   session surface with typed hooks, assigns topic names, and produces a
   subscriber manifest.
3. Provide an observer agent (`hermes-event-observer`) that subscribes to event
   streams, builds long-horizon traces, evaluates behaviour against design
   intent and NCP constraints, and emits quality/risk signals.
4. Wire feedback signals back as prompt updates, routing adjustments, and NCP
   narrative-beat constraints—without retraining the underlying models.
5. Remain entirely in the markdown-skill + configuration-update tier at this
   stage. No live connectors, no model retraining, no external-state mutation.

## Current reality

- No Hermes event schema exists in this repo.
- No observer agent or hook-prepare skill exists yet.
- The `copilot/miadi-adversarial-review-kit` provides the closest pattern
  (critic-agent role, evidence ledger, promotion discipline).
- The `codex/miadi-codex-orchestration-kit` provides the Codex plugin shape.
- The rispec `rispecs/agent-memory-provenance-framework` provides the
  field-level schema and write-back gate pattern to follow.
- NCP is named conceptually but no NCP beat schema is in this repo.

## Structural tension

The abstract promises a closed adaptation loop. Specification at the
markdown-skill tier cannot close the loop in the operational sense—it can only
define the contract surfaces that a future implementation wave would wire up.
This tension must be named clearly so that future waves do not overclaim a
working system from a markdown-only kit.

## Non-goals

- Implementing a live Redis or Kafka connector.
- Storing or migrating actual agent memory records.
- Deciding production NCP beat structure (deferred to NCP track).
- Retraining or fine-tuning any language model.
- Creating a Copilot plugin for Hermes at this stage.

## Direction classification

| Dimension | Assessment |
| --- | --- |
| RISE stage | Specify + Export (this wave produces the rispec and the first plugin shell) |
| STCKIN direction | South → West (planning then markdown implementation) |
| Risk | Low: markdown-only, no live connectors |
| Promotion readiness | `hold` until at least one successful observer-skill run is documented |

## Boundaries

### Must stay provenance-only at this stage
- NCP beat field values
- Message bus topic naming conventions
- Tuner/Coach safe-gate behaviour

### May promote to spec now
- JSON event schema shape (field names, types, required vs optional)
- Observer role contracts (input, output, stop conditions)
- Preparation skill workflow

### Must remain deferred
- Live event bus implementation
- Automatic prompt-update pipeline
- NCP constraint write-back (requires NCP track authorization)
