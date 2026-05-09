# Agent Memory Provenance Source Ledger

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This ledger preserves provenance for memory trust, schema, and write-back claims in the OpenClaw model-routing study.

## Related issues

- `miadisabelle/workspace-openclaw#80`
- `jgwill/miadi-orchestration-kit#15`

## Ledger rules

| Status | Meaning | Promotion rule |
| --- | --- | --- |
| Evidence | Directly supported by a cited source surface. | Can be used if the source pointer is specific. |
| Repo path evidence | Supported by code, config, docs, or test paths in a repo. | Required for schema or write-back behavior claims. |
| Transcript-only claim | Present in transcript or video notes only. | Keep provisional until corroborated. |
| Provisional claim | Plausible but missing sufficient support. | Name missing evidence before reuse. |
| Contradiction | Sources conflict or imply incompatible memory rules. | Preserve until a review lane resolves it. |

## Source classes

| Source class | Examples | Use |
| --- | --- | --- |
| Study control | `launch-manifest.md`, `PROPOSAL.md` | Scope, required metadata, track boundaries. |
| Transcript and notes | source video transcript, timestamped notes | Candidate claims about memory ownership or trust. |
| Repo path evidence | memory schemas, stores, merge tools, instruction files | Observed implementation behavior. |
| External sources | provenance papers, RAG docs, memory-system references | Vocabulary and comparable patterns. |
| Human confirmation | explicit user correction, confirmation, or denial | Promotion to `user-confirmed`. |

## Seed entries

| ID | Claim | Status | Evidence pointer | Notes |
| --- | --- | --- | --- | --- |
| AMP-001 | This rispec serves A2 and T3 for the OpenClaw model-routing study. | Evidence | Study proposal section "Rispec Scaffold Index"; issue `jgwill/miadi-orchestration-kit#15` context. | Control-plane scope only. |
| AMP-002 | Required RISE wording is `Reverse-engineer -> Intent-extract -> Specify -> Export`. | Evidence | Study launch manifest "RISE Wording (Required Exactly)". | Must remain exact. |
| AMP-003 | Memory candidates must carry `source`, `observed_at`, `confidence`, `status`, `scope`, `related_task`, and `user_confirmed` before write-back. | Evidence | Study launch manifest required source quality. | Required by this scaffold. |
| AMP-004 | Trust states include observed, inferred, and user-confirmed candidates. | Provisional claim | Study proposal context summary and memory rispec brief. | Needs source support before final schema. |
| AMP-005 | Repo path evidence is required before write-back behavior is treated as observed. | Evidence | Study launch manifest source-quality rules. | Applies to T3. |

## Claim intake table

| ID | Claim | Source class | Exact pointer | Status | Confidence | Related track | Missing evidence | Resolution notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<id>` | `<claim>` | `<class>` | `<path/url/time>` | `<status>` | `<low/medium/high>` | `<A2/T3>` | `<needed support>` | `<review result>` |

## Memory field ledger

| Field | Purpose | Evidence pointer | Status | Write-back gate |
| --- | --- | --- | --- | --- |
| `source` | Provenance for the memory claim. | AMP-003 | Evidence | Required. |
| `observed_at` | Time the source was observed. | AMP-003 | Evidence | Required. |
| `confidence` | Trust estimate. | AMP-003 | Evidence | Required. |
| `status` | Trust state. | AMP-003 | Evidence | Required. |
| `scope` | Allowed use boundary. | AMP-003 | Evidence | Required. |
| `related_task` | Producing task or workflow. | AMP-003 | Evidence | Required. |
| `user_confirmed` | Explicit human confirmation state. | AMP-003 | Evidence | Required. |

## Contradiction log

| ID | Conflicting claims | Sources | Current handling | Review owner |
| --- | --- | --- | --- | --- |
| `<id>` | `<claim A vs claim B>` | `<pointers>` | `<preserve/provisional/resolved>` | `<lane>` |

## Reuse rule

No memory field, trust-state rule, merge behavior, or write-back gate should be exported without a ledger row. If evidence is not strong enough, export it as provisional and name the exact corroboration needed.
