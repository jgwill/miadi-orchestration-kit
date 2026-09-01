# Source Ledger

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

All claims in this rispec are tracked here. Confidence: `low`, `medium`,
or `high`. Status: `observed`, `inferred`, `user-confirmed`, `provisional`,
`contradicted`.

## Schema and architecture claims

| Claim | Source | Confidence | Status | Notes |
| --- | --- | --- | --- | --- |
| Hermes publishes hooks as JSON events to a shared message bus | user-abstract: engineering paragraph | high | inferred | No schema file exists yet |
| Message bus is Redis Streams or Kafka-like | user-abstract: engineering paragraph | high | inferred | No config evidence; implementation TBD |
| Event types include: prompt, tool_invocation, failure, correction | user-abstract: engineering paragraph | high | inferred | Derived from "prompts, tool invocations, failures, corrections" |
| Four stateless observer service types: Event Observer, Pattern Miner, Critic Agent, Policy Governor | user-abstract: engineering paragraph | high | inferred | Role names inferred from descriptions |
| Two stateful Tuner/Coach types that propose config changes | user-abstract: engineering paragraph | medium | inferred | "Safe, auditable changes" language is in abstract; gate design is provisional |
| Changes applied through config updates, not model retraining | user-abstract: engineering paragraph | high | inferred | Explicit in abstract |
| `ncp_beat` field in event schema | user-abstract + NCP references [1][3] | low | provisional | NCP beat structure not defined in this repo; needs NCP track input |
| `trace_id` assigned by Pattern Miner | 03-specify.md: observer lane | medium | inferred | Logical deduction from CEP role; no implementation evidence |
| Payload contracts by event_type | 03-specify.md: payload contracts table | medium | inferred | Derived from MAPE-K and abstract; not corroborated by running code |

## MAPE-K mapping claims

| Claim | Source | Confidence | Status | Notes |
| --- | --- | --- | --- | --- |
| Event Observer + Pattern Miner map to Monitor phase | 01-reverse-engineer.md | medium | inferred | Mapping is structural inference, not stated verbatim |
| Critic Agent maps to Analyse phase | 01-reverse-engineer.md | medium | inferred | |
| Policy Governor + Tuner/Coach map to Plan + Execute phases | 01-reverse-engineer.md | medium | inferred | |
| Event log maps to Knowledge base | 01-reverse-engineer.md | medium | inferred | |

## NCP claims

| Claim | Source | Confidence | Status | Notes |
| --- | --- | --- | --- | --- |
| NCP structures aspirations using narrative beats | user-abstract: source [3] | medium | provisional | NCP beat schema not in this repo |
| NCP acts as constraint surface for Critic Agent | user-abstract | medium | provisional | No implementation evidence |
| Tuner/Coach may update NCP narrative-beat constraints | user-abstract | low | provisional | Requires NCP track authorization before gate can be designed |

## Operational precedent claims

| Claim | Source | Confidence | Status | Notes |
| --- | --- | --- | --- | --- |
| `miadi-adversarial-review-kit` provides closest pattern for critic-agent role | 02-intent.md + repo inspection | high | observed | Confirmed by reading `agents/miadi-adversarial-reviewer.md` |
| `agent-memory-provenance-framework` provides write-back gate pattern | 02-intent.md + repo inspection | high | observed | Confirmed by reading `03-specify.md` |
| No working Hermes observer run has been documented | repo inspection | high | observed | No precedent file exists |

## Provisional items requiring resolution

| Item | Missing evidence | Next action |
| --- | --- | --- |
| `ncp_beat` field specification | NCP beat schema from NCP track | Await NCP track; mark provisional |
| Bus topology config | Implementation wave with Redis/Kafka config | Defer |
| Tuner/Coach safe-gate behaviour | At least one accepted config delta | Defer |
| Full operational promotion | One documented successful observer-skill run | Record in this ledger when complete |

## Contradictions

None recorded at initial specification wave.
