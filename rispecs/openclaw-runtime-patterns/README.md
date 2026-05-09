# OpenClaw Runtime Patterns

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

Control-plane scaffold for reconstructing OpenClaw runtime abstraction, durable workflow behavior, CLAW/gaia-endpoint topology, model-swap survival, session isolation, and runtime-inspector evidence.

This folder is created for `jgwill/miadi-orchestration-kit#15` and should stay aligned with `miadisabelle/workspace-openclaw#80`.

## Served tracks

| Track | Search | Role |
| --- | --- | --- |
| Academic | A1 | Anchor runtime abstraction vocabulary and durable workflow claims. |
| Technical | T4 | Map concrete runtime/session/endpoint patterns with path-level evidence. |
| Technical | T1/T3 | Connect runtime choices to model routing and memory provenance without collapsing boundaries. |

## Inputs

Future waves should read these before adding findings:

1. OpenClaw model-routing study `launch-manifest.md`.
2. OpenClaw deep-research `PROPOSAL.md`, especially runtime abstraction and T4.
3. `llms-rise-framework.txt`.
4. OpenClaw/CLAW/gaia-endpoint repo path evidence before implementation claims.
5. Kherix or other external drafts only after ledger entry as provisional external research.

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
- A1 and T4 can share runtime vocabulary while preserving evidence type and confidence.
- Every runtime claim names whether it comes from transcript, study note, repo path, external draft, or direct inspection.
- Session isolation, endpoint maps, model-swap behavior, and workflow durability are tracked separately.
- Runtime-inspector needs are specified as read-only unless the manifest changes.
- No production runtime behavior is asserted without path-level or independently corroborated evidence.
- The scaffold does not run Academic, Technical, Narrative, or final research.

## Source-ledger rules

- Evidence-backed claims need source surfaces and claim status.
- Repo path evidence is required before an implementation pattern is treated as observed behavior.
- Transcript-only claims are provisional until corroborated.
- Provisional claims must name the missing evidence needed for promotion.
- Contradictions stay visible until resolved; do not smooth them into consensus prose.
- Human-facing synthesis may only use claims cleared by `05-source-ledger.md` or label them provisional.

## Boundary

This rispec prepares future runtime research. It does not inspect live runtime state, run OpenClaw, operate gaia-endpoint, or implement the runtime inspector.
