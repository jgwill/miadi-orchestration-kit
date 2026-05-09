# Discord Integration Patterns

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

Control-plane scaffold for studying Discord channels, threads, webhooks, bot events, and message surfaces as agent delivery and event-sourcing contexts while preserving the current read-only research posture.

This folder is created for `jgwill/miadi-orchestration-kit#15` and should stay aligned with `miadisabelle/workspace-openclaw#80`.

## Served tracks

| Track | Search | Role |
| --- | --- | --- |
| Technical | T2 | Map Discord execution surfaces, event shapes, thread semantics, and webhook/bot constraints. |
| Narrative | N1/N2/N3 later | Provide vocabulary for channel identity and messenger framing after Academic/Technical language settles. |
| Preflight | Scaffold readiness | Keep Discord work read-only until a manifest explicitly authorizes connector behavior. |

## Inputs

Future waves should read these before adding findings:

1. OpenClaw model-routing study `launch-manifest.md`.
2. OpenClaw deep-research `PROPOSAL.md`, especially T2 and Narrative caveats.
3. `llms-rise-framework.txt`.
4. Discord documentation or repo path evidence before making implementation claims.
5. Any existing bot/channel/thread examples must be entered in the source ledger before synthesis.

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
- T2 has a stable home for Discord surface evidence before any live connector work exists.
- Channels, threads, messages, webhooks, permissions, and event replay are separate claim categories.
- Read-only analysis is visibly separated from sending messages, creating threads, or subscribing to events.
- Narrative terms do not override technical semantics before Technical findings exist.
- Contradictions between Discord docs, runtime behavior, and product narrative remain visible.
- The scaffold does not run Academic, Technical, Narrative, or final research.

## Source-ledger rules

- Evidence-backed claims need source surfaces and claim status.
- Repo path evidence is required before an implementation pattern is treated as observed behavior.
- Transcript-only claims are provisional until corroborated.
- Provisional claims must name the missing evidence needed for promotion.
- Contradictions stay visible until resolved; do not smooth them into consensus prose.
- Human-facing synthesis may only use claims cleared by `05-source-ledger.md` or label them provisional.

## Boundary

This rispec is for research and specification of Discord patterns. It does not authorize live Discord API calls, message sends, webhook creation, or bot control.
