# Model Routing Orchestration

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

Control-plane scaffold for the OpenClaw model-routing study. This rispec gives future Academic and Technical waves one place to put evidence, intent, specifications, and export notes about model tiers, routing policy, fallback behavior, review gates, and model-routing matrix outputs.

This folder is created for `jgwill/miadi-orchestration-kit#15` and should stay aligned with `miadisabelle/workspace-openclaw#80`.

## Served tracks

| Track | Search | Role |
| --- | --- | --- |
| Academic | A1 | Establish vocabulary for runtime abstraction, model mobility, and cost/capability tradeoffs. |
| Technical | T1 | Turn the vocabulary into step-aware routing contracts, dispatch traces, fallback gates, and matrix outputs. |
| Preflight | Scaffold readiness | Verify that later research waves know where claims and evidence belong before any track runs. |

## Inputs

Future waves should read these before adding findings:

1. OpenClaw model-routing study `launch-manifest.md`.
2. OpenClaw deep-research `PROPOSAL.md`.
3. `llms-rise-framework.txt`.
4. Transcript or study-note excerpts for model-routing claims.
5. Repo path evidence for any OpenClaw, CLAW, gaia-endpoint, LangGraph, or dispatch implementation claim.
6. Prior track findings only after they have source-ledger entries.

## What is in this folder

| File | Purpose |
| --- | --- |
| `01-reverse-engineer.md` | Reconstruct what evidence shows about model routing without defining final policy. |
| `02-intent.md` | State the desired outcome, current reality, structural tension, and boundaries for routed execution. |
| `03-specify.md` | Define the orchestration contract for task signals, tier selection, fallback, review, and matrix outputs. |
| `04-export.md` | Provide launch, resume, audit, and handoff shapes for future model-routing waves. |
| `05-source-ledger.md` | Preserve claim-level provenance, evidence type, status, contradictions, and reuse rules. |

## Acceptance criteria

- The exact RISE wording `Reverse-engineer -> Intent-extract -> Specify -> Export` appears in the README and is used as the folder's stage language.
- A1 and T1 can both write here without creating separate vocabularies for the same routing pattern.
- Every routing rule distinguishes task signal, model tier, fallback condition, review gate, and expected matrix output.
- Cost/capability tradeoffs are treated as evidence-backed claims, not assumptions.
- Any model-routing matrix row can be traced to source-ledger evidence or marked provisional.
- The scaffold does not run Academic, Technical, Narrative, or final research.

## Source-ledger rules

- Evidence-backed claims need source surfaces and claim status.
- Repo path evidence is required before an implementation pattern is treated as observed behavior.
- Transcript-only claims are provisional until corroborated.
- Provisional claims must name the missing evidence needed for promotion.
- Contradictions stay visible until resolved; do not smooth them into consensus prose.
- Cost, latency, capability, safety, and review-gate claims must be tracked separately when their evidence differs.

## Boundary

This rispec controls the model-routing study surface. It does not select live models, run routing simulations, authorize connector work, or decide production routing policy.
