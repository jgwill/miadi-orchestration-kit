# Hermes Hook Observer Kit

Codex-native plugin for the Hermes observational control plane. Instruments
session surfaces with typed semantic hooks, runs the observer agent to build
long-horizon traces, and emits quality/risk/alignment signals back into the
control plane—without retraining any underlying language model.

## Included components

### Agent

| Agent | Role |
| --- | --- |
| `hermes-event-observer` | Subscribes to event streams, builds long-horizon traces, applies MAPE-K phases (Monitor → Analyse → Plan), evaluates behaviour against design intent and NCP narrative constraints, emits critique records and policy proposals. |

### Skill

| Skill | Use |
| --- | --- |
| `hermes-hook-prepare` | Turn an uninstrumented session surface into a typed, observable event surface. Assigns `source_agent` identifiers, topic names, observer patterns, and NCP beat state. Produces a subscriber manifest. |

### Template

| Template | Use |
| --- | --- |
| `templates/hook-event.json` | JSON shape for a Hermes hook event. Copy, fill required fields, omit optional fields. |

## Architecture

```
Data plane (task agents)
  │ emit JSON events
  ▼
hermes.raw ──► Event Observer ──► hermes.enriched
                                        │
                                  Pattern Miner ──► hermes.signals
                                        │
                                  Critic Agent ──► hermes.critiques
                                        │
                                  Policy Governor ──► hermes.policy
                                        │
                                  Tuner/Coach ──► config delta (auditable)
```

The event log is append-only. Changes are applied as configuration updates.
No model retraining occurs.

## Grounding

This kit is grounded in three source bodies cited in the companion rispec:

- **MAPE-K autonomic computing loops** (Monitor, Analyse, Plan, Execute,
  Knowledge) — maps to the observer role chain above.
- **Multi-agent organisational role theory** — the five observer roles
  (Event Observer, Pattern Miner, Critic Agent, Policy Governor, Tuner/Coach)
  follow organisational-role separation.
- **Narrative Context Protocol (NCP)** — `ncp_beat` is a first-class field in
  every hook event; the Critic Agent evaluates NCP beat violations; Tuner/Coach
  may propose NCP constraint updates.

## Companion rispec

`rispecs/hermes-hook-observer-framework/` contains the full RISE specification:

| File | Purpose |
| --- | --- |
| `README.md` | Overview and acceptance criteria |
| `01-reverse-engineer.md` | Architectural reconstruction from source materials |
| `02-intent.md` | Desired outcome, tensions, non-goals, promotion boundaries |
| `03-specify.md` | Event schema, observer role contracts, write-back gates |
| `04-export.md` | Handoff shape, promotion decision record, next proving run |
| `05-source-ledger.md` | All claims with confidence and status |

## Promotion status

**Current: `split`** — the markdown-skill tier is ready to use. Full operational
promotion to `promote` requires one documented successful observer-skill run
recorded in `rispecs/hermes-hook-observer-framework/05-source-ledger.md`
under `operational-precedent`.

## Deliberately not included

These items remain deferred until stronger evidence exists:

- Live Redis Streams or Kafka connector (implementation wave required).
- NCP beat schema and beat sequence (deferred to NCP track).
- Automatic Tuner/Coach configuration delta application (requires auditable
  update pathway design and at least one accepted delta).
- Copilot version of this kit (deferred; create a separate kit when the
  operational pattern is proven).

## Local use

Add the plugin as a local Codex plugin:

```bash
codex plugin marketplace add /workspace/repos/jgwill/miadi-orchestration-kit/codex/hermes-hook-observer-kit
```

Then ask Codex to use the preparation skill:

```text
Use hermes-hook-prepare to instrument this session surface with typed hooks.
```

Or invoke the observer agent directly:

```text
Run hermes-event-observer on the current event trace for session <session_id>.
```
