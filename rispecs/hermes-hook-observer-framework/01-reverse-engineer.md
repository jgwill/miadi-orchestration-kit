# Reverse-Engineer

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This stage reconstructs what the source materials tell us about the Hermes
architecture before any specification or implementation begins.

## Source materials inspected

| Source | Location | Role in reconstruction |
| --- | --- | --- |
| User abstract | Problem statement: academic-style abstract | Primary architectural description |
| User design paragraph | Problem statement: engineering design paragraph | Topology and component roles |
| MAPE-K reference | Cited in abstract as `[1][2]` | Autonomic computing loop model |
| NCP reference | Cited as `[3]` and search `[1]` | Narrative constraint surface |
| Multi-agent org roles | Cited in abstract | Organisational framing for agent roles |

## Reconstructed architecture

### Data plane (task-facing agents)

Hermes task agents execute user-visible work: answering questions, writing code,
running tools. Every participating toolchain—editor, CLI, Copilot-style
assistants, code-review agents—is instrumented with **semantic hooks** that
publish JSON events to a shared message bus.

### Event bus (append-only interaction log)

The message bus is described as Redis Streams or a Kafka-like abstraction. It
forms an append-only interaction log. Events carry:

- prompts
- tool invocations
- failures
- user corrections

Source: user-abstract. Confidence: high (explicit in engineering paragraph).

### Control plane (hook-only agents)

Four stateless observer service types are named:

| Role | Behaviour |
| --- | --- |
| Event Observer | Subscribes to raw event topics, enriches with context |
| Pattern Miner | Performs complex event processing (CEP) on enriched events |
| Critic Agent | Evaluates behaviour against design intent, user preferences, NCP constraints |
| Policy Governor | Emits higher-order quality, risk, and user-alignment signals |

Two stateful Tuner/Coach agent types then consume signals:

| Role | Behaviour |
| --- | --- |
| Tuner | Proposes changes to prompts, routing weights, tool configurations |
| Coach | Proposes NCP narrative-constraint adjustments |

Changes are applied through **configuration updates**, not model retraining.
Source: user design paragraph. Confidence: high.

### MAPE-K mapping

| MAPE-K phase | Hermes equivalent |
| --- | --- |
| Monitor | Event Observer + Pattern Miner |
| Analyse | Critic Agent |
| Plan | Policy Governor + Tuner/Coach |
| Execute | Configuration update pathway |
| Knowledge | Event log (append-only) + NCP narrative state |

Source: abstract cites MAPE-K. Confidence: medium (mapping is inferred,
not stated verbatim).

### NCP surface

The Narrative Context Protocol structures aspirations and values using narrative
beats organised to give agents orientation toward desired results. In Hermes,
NCP acts as a constraint layer that the Critic Agent evaluates against and that
Tuner/Coach agents may update as story-level constraints. NCP is described as a
meta-layer on top of MCP (Model Context Protocol).

Source: user abstract + search [3]. Confidence: medium (NCP role in Hermes is
conceptual; no implementation evidence yet).

## Gaps after reverse-engineering

| Gap | Impact |
| --- | --- |
| No schema definition for hook JSON events | Blocks specification of observer contracts |
| No message bus topology document | Blocks topic naming and subscription design |
| NCP beat structure not detailed | Blocks `ncp_beat` field specification |
| Tuner/Coach feedback pathway is conceptual only | Blocks safe gate design for config updates |
| No working precedent inside this repo | Rispec cannot yet move to `promote` |

## Conclusion

The source materials provide a coherent architectural model at the conceptual
level. The event schema, observer service contracts, and NCP wiring are not yet
specified at the field level. The next stage (`02-intent.md`) should clarify
the desired outcome and structural tensions before attempting field-level
specification.
