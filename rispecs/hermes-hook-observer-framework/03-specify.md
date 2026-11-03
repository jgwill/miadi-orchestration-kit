# Specify

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Required reading order

1. `rispecs/hermes-hook-observer-framework/README.md`.
2. `05-source-ledger.md`.
3. `01-reverse-engineer.md`.
4. `02-intent.md`.
5. `copilot/miadi-adversarial-review-kit/agents/miadi-adversarial-reviewer.md`
   for critic-agent role pattern.
6. `rispecs/agent-memory-provenance-framework/03-specify.md` for
   write-back gate pattern.

## Hook event schema

Every semantic hook published to the Hermes event bus must conform to this
shape. Fields marked `required` must be present for an event to pass the
observation gate.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `event_id` | string (UUID) | yes | Globally unique event identifier. |
| `event_type` | string (enum) | yes | One of: `prompt`, `tool_invocation`, `tool_result`, `failure`, `correction`, `routing`, `ncp_update`, `signal`. |
| `source_agent` | string | yes | Identifier of the agent or toolchain component that emitted the event. |
| `session_id` | string | yes | Identifier of the Hermes session this event belongs to. |
| `timestamp` | string (ISO 8601) | yes | Wall-clock time at emission. |
| `payload` | object | yes | Event-type-specific content (see payload contracts below). |
| `ncp_beat` | string or null | no | Active NCP narrative beat at emission time, if known. Null when NCP is not active. |
| `trace_id` | string or null | no | Long-horizon trace this event belongs to, assigned by Pattern Miner. |
| `confidence` | string | no | `low`, `medium`, or `high`; set by observer enrichment, not by source agent. |
| `tags` | array of strings | no | Free-form labels for routing or filtering. |

Source: user design paragraph (field names inferred). Confidence: medium.
Provisional: `ncp_beat` field — awaits NCP beat schema definition.

### Payload contracts by event_type

| event_type | Minimum payload fields |
| --- | --- |
| `prompt` | `content`, `model`, `temperature` (optional) |
| `tool_invocation` | `tool_name`, `input` |
| `tool_result` | `tool_name`, `output`, `duration_ms` |
| `failure` | `error_type`, `message`, `recoverable` |
| `correction` | `original_event_id`, `corrected_by`, `diff_summary` |
| `routing` | `from_agent`, `to_agent`, `reason` |
| `ncp_update` | `beat`, `constraint_delta` |
| `signal` | `signal_type`, `severity`, `findings_summary` |

## Observer role contracts

### Event Observer

- **Input**: raw event topic subscription (all event types)
- **Processing**: enrich event with session context, assign `trace_id` if
  pattern miner has opened a trace, emit enriched event to `enriched` topic
- **Output**: enriched event object on `hermes.enriched` topic
- **Stop conditions**: stop enrichment and flag when `event_id` is missing
  or `source_agent` is unknown
- **Source-ledger obligation**: log every unrecognised `event_type`

### Pattern Miner

- **Input**: `hermes.enriched` topic
- **Processing**: sliding-window complex event processing; detect: repetitive
  failures, prompt drift, routing loops, NCP beat violations
- **Output**: pattern signal on `hermes.signals` topic; open or close trace
  records
- **Stop conditions**: do not emit a pattern signal without at least two
  corroborating events in the same `session_id`
- **Source-ledger obligation**: record pattern rule used and event count

### Critic Agent

- **Input**: `hermes.signals` topic + active design-intent manifest
- **Processing**: evaluate signals against design intent, user preferences,
  and NCP narrative constraints; classify as `quality`, `risk`, or
  `alignment`
- **Output**: critique record on `hermes.critiques` topic
- **Stop conditions**: do not classify a signal as `risk` without naming the
  design-intent or NCP rule that was violated
- **Source-ledger obligation**: cite the design-intent or NCP rule for every
  `risk` classification

### Policy Governor

- **Input**: `hermes.critiques` topic
- **Processing**: aggregate critiques by severity and session; decide whether
  to emit a policy-update proposal
- **Output**: policy-update proposal on `hermes.policy` topic; proposals are
  advisory and require Tuner/Coach confirmation
- **Stop conditions**: do not emit a policy update that mutates external state
  without an explicit write-scope gate
- **Source-ledger obligation**: record aggregation window and critique count

### Tuner/Coach

- **Input**: `hermes.policy` topic
- **Processing**: translate policy proposals into safe, auditable configuration
  changes: prompt updates, routing-weight adjustments, NCP narrative-beat
  constraint changes
- **Output**: configuration delta record; applied only through auditable
  update pathway
- **Stop conditions**: reject any delta that requires model retraining, live
  external mutation, or secret-handling changes not already scoped
- **Source-ledger obligation**: log every accepted and rejected delta with
  rationale

## Write-back gates

| Gate | Required before passing |
| --- | --- |
| Observation gate | `event_id`, `source_agent`, `event_type`, `timestamp`, `session_id` present |
| Enrichment gate | `trace_id` assigned and `ncp_beat` resolved or explicitly null |
| Pattern gate | At least two corroborating events in same `session_id` |
| Critique gate | Design-intent or NCP rule cited for every `risk` classification |
| Policy gate | Severity threshold met; critique count exceeds configured minimum |
| Config-update gate | No model retraining; no external-state mutation; write scope named |

## Lane contract for specification wave

| Lane | Owns | Exit artefact |
| --- | --- | --- |
| Schema lane | Event schema fields and payload contracts | Schema table with ledger pointers |
| Observer lane | Role contracts, stop conditions, source-ledger obligations | Observer contract table |
| NCP lane | `ncp_beat` field and NCP constraint feedback surface | NCP wiring note (provisional) |
| Review lane | Overclaims, unsafe gate proposals | Revision list |
| Ledger lane | Claim status and contradictions | Updated `05-source-ledger.md` |

## Stop conditions for this rispec

- A write-back gate is proposed without named scope and explicit stop condition.
- An inferred claim about NCP beat structure is treated as specified.
- A configuration delta is described as automatically applied without an
  auditable update pathway.
- Claims about live Redis or Kafka topology are added without implementation
  evidence.
