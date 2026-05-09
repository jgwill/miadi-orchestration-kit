# Export

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This stage defines how memory provenance work is launched, resumed, audited, and handed off after the study manifest authorizes a track.

## Launch prompt shape

Use this only after the active manifest authorizes A2 or T3:

```text
Read the OpenClaw model-routing study launch manifest, this rispec folder, and the current source ledger first.

Operate only on the authorized track.
Use the RISE path: Reverse-engineer -> Intent-extract -> Specify -> Export.

Goal:
- For A2, produce provenance and trust vocabulary with source status.
- For T3, produce schema, transition, and write-back gate proposals.

Required handoff:
- exact sources read,
- source status for each memory field and trust rule,
- schema or vocabulary outputs,
- contradictions,
- unsupported claims that remain provisional,
- no memory write-back unless separately authorized.
```

## Resume pattern

On resume:

1. Confirm manifest authorization.
2. Read `05-source-ledger.md` before any synthesis.
3. Read the last handoff or track findings.
4. Continue only the next incomplete lane.
5. Do not consume memory records that lack status and source.

## Audit pattern

An audit pass should verify:

- every schema field has a ledger row,
- observed, inferred, and user-confirmed states are separated,
- `source`, `observed_at`, `confidence`, `status`, `scope`, `related_task`, and `user_confirmed` are present before promotion,
- transcript-only memory claims remain provisional,
- repo behavior claims have path evidence,
- contradictions remain visible,
- no memory was written during scaffold work.

## Export destinations

| Destination | Allowed content | Required status |
| --- | --- | --- |
| A2 findings | Provenance vocabulary and trust model | Ledger-backed or provisional. |
| T3 findings | Schema, transitions, merge and write-back gates | Ledger-backed with repo path evidence for observed behavior. |
| Memory tooling work | Candidate schema only | Separate authorization required before writes. |
| Study handoff | Blockers, evidence gaps, next safe instruction | No final synthesis unless authorized. |

## Handoff checklist

- Source ledger updated.
- Field-level evidence recorded.
- Write-back gates named.
- Contradictions preserved.
- Confirmation source requirements explicit.
- Next track entry point names the manifest authorization requirement.
