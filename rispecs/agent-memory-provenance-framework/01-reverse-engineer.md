# Reverse-engineer

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This stage reconstructs what the OpenClaw model-routing study evidence actually shows about memory provenance, trust levels, metadata, scope, and write-back gates.

It does not decide the final schema. It prepares evidence for `02-intent.md`.

## Source surfaces to inspect later

| Surface | Evidence to extract | Minimum handling |
| --- | --- | --- |
| Study manifest | Required memory metadata and write-back gate language | Treat as control-plane evidence. |
| Study proposal | A2/T3 scope, trust-tier claims, schema brief | Treat as planning evidence, not final findings. |
| Transcript and study notes | Claims about user-owned memory and confirmation | Mark transcript-only until corroborated. |
| Repo path evidence | Memory files, schema code, persistence layers, merge tools, instruction updates | Require exact path and observed behavior. |
| External sources | provenance, audit, RAG citation, agent memory literature or docs | Keep terminology source-classed. |
| Human confirmation | explicit user or operator decision about a memory item | Record as confirmation evidence, not inference. |

## Evidence-backed observation shape

Each reconstructed observation should include:

- claim text,
- memory state affected,
- source class and exact pointer,
- evidence status,
- candidate field or transition,
- confidence,
- missing corroboration,
- whether it can affect write-back.

## Trust states to reconstruct

| State | What to look for | Boundary |
| --- | --- | --- |
| `observed` | Behavior or source text directly observed by an agent. | Observation is not confirmation. |
| `inferred` | A conclusion derived from context or repeated behavior. | Must carry lower confidence and cannot overwrite confirmation. |
| `user-confirmed` | A human explicitly confirms, corrects, or bounds the memory. | Requires source pointer to the confirming act. |
| `contradicted` | A later source conflicts with a stored memory. | Must remain visible until resolved. |
| `deprecated` | A memory is no longer valid but should remain auditable. | Do not delete without retention rule. |

## Required metadata evidence

Future waves must determine source support for:

- `source`,
- `observed_at`,
- `confidence`,
- `status`,
- `scope`,
- `related_task`,
- `user_confirmed`,
- optional `confirmed_at`,
- optional `expires_at`,
- optional contradiction or supersession pointer.

## Boundaries

- Do not treat chat history as trusted memory without provenance.
- Do not promote an inferred preference into user-confirmed memory.
- Do not collapse source, confidence, and status into one field.
- Do not write memory during scaffold work.
- Do not run Academic or Technical research from this scaffold.

## Handoff shape

The handoff to `02-intent.md` should contain:

- supported trust-state vocabulary,
- candidate metadata fields with source status,
- write-back risks,
- unresolved contradictions,
- claims that must remain provisional.
