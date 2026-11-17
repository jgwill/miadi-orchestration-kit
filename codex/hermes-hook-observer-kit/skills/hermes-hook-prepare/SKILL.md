---
name: hermes-hook-prepare
description: Use when starting a Hermes-instrumented session. Instruments the session surface with typed semantic hooks, assigns event-bus topic names, defines the hook event schema in context, and produces a subscriber manifest that the hermes-event-observer agent can consume.
---

# Hermes Hook Prepare

Use this skill to convert an uninstrumented session or mission surface into a
typed, observable event surface before implementation or research begins.

## Required inputs

Accept one or more of:

- description of the session, mission, or toolchain surface to instrument,
- list of participating agents or toolchain components,
- active NCP narrative beat (if known; leave null if not),
- existing `SESSION_CHARTER.md` from `miadi-session-bootstrap`,
- event-bus configuration (topic prefix, bus type); default to `hermes.*`
  topic namespace and Redis Streams if unspecified,
- desired observer pattern set from: `failure-loop`, `prompt-drift`,
  `routing-loop`, `ncp-beat-violation`.

If a required fact cannot be inferred, mark it `unknown` and continue with a
guarded assumption. Do not invent source-agent identifiers.

## Workflow

1. **Read context files** that govern the session:
   - `AGENTS.md` in the active workspace
   - `SESSION_CHARTER.md` if present
   - any rispec or plugin README named by the user
2. **Identify instrumentation surface**:
   - list every participating agent or toolchain component
   - assign a canonical `source_agent` identifier to each
   - identify which `event_type` values each component may emit
3. **Define topic assignments**:
   - `hermes.raw` — raw hook events from data-plane agents
   - `hermes.enriched` — enriched events from Event Observer
   - `hermes.signals` — pattern signals from Pattern Miner
   - `hermes.critiques` — critique records from Critic Agent
   - `hermes.policy` — policy proposals from Policy Governor
4. **Resolve NCP beat**:
   - if `ncp_beat` is provided, record it as the starting beat
   - if not provided, set `ncp_beat: null` and note it as provisional
5. **Produce the subscriber manifest** (see output contract below).
6. **Produce a hook schema summary** confirming which fields are required and
   which are optional for this session (from `templates/hook-event.json`).
7. **Name the next action**:
   - if the session charter is present → invoke `hermes-event-observer` agent
   - if the session charter is missing → invoke `miadi-session-bootstrap` first
   - if NCP beat is unknown → flag as provisional and continue

## Subscriber manifest shape

```
## Hermes Subscriber Manifest

Session: <session_id>
Prepared: <timestamp>

### Source agents
| source_agent | event_types_emitted |
| --- | --- |

### Topic assignments
| topic | subscriber_role | event_types |
| --- | --- | --- |
| hermes.raw | Event Observer | all |
| hermes.enriched | Pattern Miner | all |
| hermes.signals | Critic Agent | signal |
| hermes.critiques | Policy Governor | quality, risk, alignment |
| hermes.policy | Tuner/Coach | policy |

### Active observer patterns
| pattern | trigger_condition | signal_type | severity |
| --- | --- | --- | --- |

### NCP beat
Current beat: <beat or null>
Status: <confirmed | provisional>

### Hook schema
Required fields: event_id, event_type, source_agent, session_id, timestamp, payload
Optional fields: ncp_beat, trace_id, confidence, tags

### Next action
```

## Stop gates

Stop and ask before:

- assigning `source_agent` identifiers that include secrets or credentials,
- writing the manifest outside the active artifact root,
- setting NCP beat to a value that has not been provided or confirmed,
- subscribing to external live systems beyond the session scope,
- proposing observer patterns that require live external state.

## Output contract

The final skill output must name:

- artifact folder or chat surface where the manifest was written,
- list of `source_agent` identifiers assigned,
- topic assignments confirmed,
- NCP beat status (confirmed or provisional),
- active observer patterns,
- next skill or agent to invoke.
