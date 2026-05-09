# Permission Scoping Orchestration

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

Control-plane scaffold for researching and specifying principle-of-least-authority boundaries, capability amplification checkpoints, human review gates, and read/write/execute stop conditions for OpenClaw-style agent runtimes.

This folder is created for `jgwill/miadi-orchestration-kit#15` and should stay aligned with `miadisabelle/workspace-openclaw#80`.

## Served tracks

| Track | Search | Role |
| --- | --- | --- |
| Academic | A3 | Ground permission scoping, capability amplification, and human review vocabulary. |
| Technical | T1/T4 | Map permission gates to routing policy, runtime inspection, execution surfaces, and stop conditions. |
| Preflight | Scaffold readiness | Confirm future waves know how to separate read-only research from write/execute authority. |

## Inputs

Future waves should read these before adding findings:

1. OpenClaw model-routing study `launch-manifest.md`.
2. OpenClaw deep-research `PROPOSAL.md`, especially A3 and technical track constraints.
3. `llms-rise-framework.txt`.
4. Any transcript/study-note claims about permissions, review points, or capability escalation.
5. Repo path evidence before asserting runtime behavior, connector authority, or live execution capability.

## What is in this folder

| File | Purpose |
| --- | --- |
| `01-reverse-engineer.md` | Reconstruct what source evidence actually shows before deriving intent. |
| `02-intent.md` | State desired outcome, current reality, structural tension, non-goals, and stop conditions. |
| `03-specify.md` | Define the reusable orchestration contract future waves must satisfy. |
| `04-export.md` | Provide launch, resume, audit, handoff, and promotion shapes for later work. |
| `05-source-ledger.md` | Preserve claim-level provenance, evidence type, status, contradictions, and reuse rules. |

## Acceptance criteria

- The exact RISE wording `Reverse-engineer -> Intent-extract -> Specify -> Export` appears in the README and is used as the folder's stage language.
- A3 can write literature-style permission findings here without mixing them with implementation conclusions.
- Technical waves can represent read-only, write, execute, network, connector, and memory authority as separate scopes.
- Every capability amplification claim names its trigger, reviewer, allowed action, denied action, and rollback/stop condition.
- No live Discord/OpenClaw connector work is implied by this scaffold.
- All permission rules are ledger-backed or explicitly provisional.
- The scaffold does not run Academic, Technical, Narrative, or final research.

## Source-ledger rules

- Evidence-backed claims need source surfaces and claim status.
- Repo path evidence is required before an implementation pattern is treated as observed behavior.
- Transcript-only claims are provisional until corroborated.
- Provisional claims must name the missing evidence needed for promotion.
- Contradictions stay visible until resolved; do not smooth them into consensus prose.
- Human-facing synthesis may only use claims cleared by `05-source-ledger.md` or label them provisional.

## Boundary

This rispec defines orchestration boundaries for future research. It does not grant permissions, run connectors, modify runtime policies, or approve live execution.
