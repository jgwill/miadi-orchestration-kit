# Model Routing Source Ledger

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This ledger preserves provenance for model-routing orchestration claims in the OpenClaw model-routing study.

## Related issues

- `miadisabelle/workspace-openclaw#80`
- `jgwill/miadi-orchestration-kit#15`

## Ledger rules

| Status | Meaning | Promotion rule |
| --- | --- | --- |
| Evidence | Directly supported by a cited source surface. | Can be used if the source pointer is specific. |
| Repo path evidence | Supported by code, config, docs, or test paths in a repo. | Required for implementation behavior claims. |
| Transcript-only claim | Present in transcript or video notes only. | Keep provisional until corroborated. |
| Provisional claim | Plausible but missing sufficient support. | Name missing evidence before reuse. |
| Contradiction | Sources conflict or imply incompatible rules. | Preserve until a review lane resolves it. |

## Source classes

| Source class | Examples | Use |
| --- | --- | --- |
| Study control | `launch-manifest.md`, `PROPOSAL.md` | Scope, tracks, file expectations, guardrails. |
| Transcript and notes | source video transcript, timestamped notes | Motivation and candidate claims. |
| Repo path evidence | OpenClaw, CLAW, gaia-endpoint, LangGraph paths | Observed implementation behavior. |
| External sources | papers, docs, framework references | Vocabulary and comparable patterns. |
| Human confirmation | explicit operator decision or review note | Permission to promote or bound a claim. |

## Seed entries

| ID | Claim | Status | Evidence pointer | Notes |
| --- | --- | --- | --- | --- |
| MR-001 | This rispec serves A1 and T1 for the OpenClaw model-routing study. | Evidence | Study proposal section "Rispec Scaffold Index"; issue `jgwill/miadi-orchestration-kit#15` context. | Control-plane scope only. |
| MR-002 | Required RISE wording is `Reverse-engineer -> Intent-extract -> Specify -> Export`. | Evidence | Study launch manifest "RISE Wording (Required Exactly)". | Must remain exact. |
| MR-003 | Proposed model tiers include `local/small`, `cheap/bulk`, and `premium`. | Provisional claim | Study proposal context summary and model-routing rispec brief. | Needs corroboration before becoming routing policy. |
| MR-004 | Implementation claims about dispatch or runtime model selection require repo path evidence. | Evidence | Study launch manifest source-quality rules. | Applies to T1. |
| MR-005 | Transcript-only routing claims are provisional until corroborated. | Evidence | Study launch manifest required source quality. | Applies to A1 and T1. |

## Claim intake table

| ID | Claim | Source class | Exact pointer | Status | Confidence | Related track | Missing evidence | Resolution notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<id>` | `<claim>` | `<class>` | `<path/url/time>` | `<status>` | `<low/medium/high>` | `<A1/T1>` | `<needed support>` | `<review result>` |

## Contradiction log

| ID | Conflicting claims | Sources | Current handling | Review owner |
| --- | --- | --- | --- | --- |
| `<id>` | `<claim A vs claim B>` | `<pointers>` | `<preserve/provisional/resolved>` | `<lane>` |

## Reuse rule

No routing rule, tier recommendation, fallback path, or review-gate claim should be exported without a ledger row. If evidence is not strong enough, export the row as provisional and name the exact corroboration needed.
