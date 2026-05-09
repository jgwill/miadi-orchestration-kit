# Specify

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This document defines the reusable orchestration contract for openclaw runtime patterns once future evidence has been reconstructed and intent has been extracted.

## Contract

A future wave updating this rispec must provide:

1. evidence entries in `05-source-ledger.md`,
2. reconstructed observations in `01-reverse-engineer.md`,
3. intent statements in `02-intent.md`,
4. specification changes here with acceptance criteria,
5. export or handoff notes in `04-export.md`.

## Required claim fields

| Field | Required meaning |
| --- | --- |
| `claim` | Atomic statement being promoted or kept provisional. |
| `source` | Path, URL, transcript reference, repo path, or external draft identifier. |
| `evidence_type` | `repo-path`, `docs`, `transcript`, `external-draft`, `direct-inspection`, or `synthesis`. |
| `confidence` | Low / medium / high plus reason. |
| `status` | `provisional`, `corroborated`, `contradicted`, `cleared-for-synthesis`, or `rejected`. |
| `scope` | Academic / Technical / Narrative / Final integration / reusable kit. |
| `review_gate` | Human or agent review required before use. |

## Acceptance gate

A specification change is acceptable only when:

- it names which future track it serves,
- it references source-ledger evidence,
- it preserves unauthorized-action boundaries from the launch manifest,
- it distinguishes current-instance findings from reusable orchestration rules,
- it adds an export/handoff consequence if later agents need to act on it.

## Stop conditions

- Evidence source is missing or unverifiable.
- A live connector, runtime action, or message send would be needed but not authorized.
- The change depends on Academic/Technical/Narrative findings that do not exist yet.
- The claim affects memory write-back without required provenance fields.
