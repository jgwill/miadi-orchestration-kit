# Source Ledger

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This ledger records claim-level provenance for openclaw runtime patterns.

## Source inventory

| ID | Source | Type | Observed at | Notes |
| --- | --- | --- | --- | --- |
| S1 | `study-notes/openclaw-model-routing-85Q9htV2CBE/launch-manifest.md` | manifest | TBD | Track authorization and write scopes. |
| S2 | `study-notes/openclaw-model-routing-85Q9htV2CBE/preparing-deep-research/PROPOSAL.md` | proposal | TBD | Search targets and rispec need. |
| S3 | `/workspace/repos/jgwill/llms-txt/llms-rise-framework.txt` | framework | TBD | RISE and structural tension reference. |

## Claim inventory

| Claim ID | Claim | Source IDs | Evidence type | Confidence | Status | Scope | Reviewer note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C1 | `<claim>` | `S#` | transcript / repo-path / docs / external-draft | low/medium/high | provisional | Academic/Technical/etc. | `<needed review>` |

## Contradiction register

| Contradiction | Sources in tension | Current handling | Required resolution |
| --- | --- | --- | --- |
| `<tension>` | `S#` vs `S#` | keep visible | `<next evidence needed>` |

## Cleared for synthesis

| Claim ID | Cleared use | Cleared by | Date |
| --- | --- | --- | --- |

## Rejected or superseded claims

| Claim ID | Reason | Superseding source/claim |
| --- | --- | --- |

## Ledger rules

- Do not cite a claim in synthesis unless it appears here.
- Repo path evidence is required before implementation behavior is treated as observed.
- Transcript-only and external-draft claims remain provisional until corroborated.
- Contradictions stay registered until a reviewer resolves them.
- Memory candidates require source, observed_at, confidence, status, scope, related_task, and user_confirmed before write-back.
