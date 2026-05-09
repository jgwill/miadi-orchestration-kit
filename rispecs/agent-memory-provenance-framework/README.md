# Agent Memory Provenance Framework

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

Control-plane scaffold for the OpenClaw model-routing study memory work. This rispec gives future waves one home for evidence and specifications about observed, inferred, and user-confirmed memory; provenance metadata; trust; scope; and write-back gates.

This folder is created for `jgwill/miadi-orchestration-kit#15` and should stay aligned with `miadisabelle/workspace-openclaw#80`.

## Served tracks

| Track | Search | Role |
| --- | --- | --- |
| Academic | A2 | Establish provenance, operational memory, trust, and audit vocabulary. |
| Technical | T3 | Turn trust vocabulary into schema, merge behavior, and write-back gates. |
| Preflight | Scaffold readiness | Verify where memory claims and schema proposals belong before research starts. |

## Inputs

Future waves should read these before adding findings:

1. OpenClaw model-routing study `launch-manifest.md`.
2. OpenClaw deep-research `PROPOSAL.md`.
3. `llms-rise-framework.txt`.
4. Transcript or study-note excerpts for memory and user ownership claims.
5. Repo path evidence for memory stores, instruction files, schema definitions, or write-back behavior.
6. External provenance, RAG citation, trust, or memory-system sources after ledger intake.

## What is in this folder

| File | Purpose |
| --- | --- |
| `01-reverse-engineer.md` | Reconstruct what evidence shows about memory states, provenance fields, and confirmation boundaries. |
| `02-intent.md` | State the desired outcome, current reality, structural tension, and non-goals for trusted memory. |
| `03-specify.md` | Define schema, status transitions, write-back gates, review checkpoints, and consumption rules. |
| `04-export.md` | Provide launch, resume, audit, and handoff shapes for memory-provenance work. |
| `05-source-ledger.md` | Preserve source support for every field, trust rule, write-back rule, contradiction, and provisional claim. |

## Acceptance criteria

- The exact RISE wording `Reverse-engineer -> Intent-extract -> Specify -> Export` appears in the README and is used as the folder's stage language.
- A2 and T3 share one trust vocabulary instead of diverging into theory and implementation silos.
- Every proposed memory field is tied to a source-ledger row or marked provisional.
- Every write-back path has a gate that distinguishes observed, inferred, and user-confirmed records.
- Memory records preserve `source`, `observed_at`, `confidence`, `status`, `scope`, `related_task`, and `user_confirmed` before promotion.
- The scaffold does not run Academic, Technical, Narrative, or final research.

## Source-ledger rules

- Evidence-backed claims need exact source pointers.
- Repo path evidence is required before a schema or write-back behavior is called observed.
- Transcript-only claims are provisional until corroborated.
- Provisional schema fields must name the missing evidence needed for promotion.
- Contradictions stay visible until resolved.
- Human confirmation claims must identify whether the human explicitly confirmed, denied, bounded, or merely implied the memory.

## Boundary

This rispec does not write memory, migrate memory, alter instruction files, or decide production memory policy. It defines the control surface for future evidence and specification work.
