# Export

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This stage defines how model-routing orchestration knowledge is launched, resumed, audited, and handed off after the study manifest authorizes a track.

## Launch prompt shape

Use this only after the active manifest authorizes A1 or T1:

```text
Read the OpenClaw model-routing study launch manifest, this rispec folder, and the current source ledger first.

Operate only on the authorized track.
Use the RISE path: Reverse-engineer -> Intent-extract -> Specify -> Export.

Goal:
- For A1, produce vocabulary and taxonomy findings for model routing.
- For T1, produce routing matrix rows, fallback expectations, and review gates.

Required handoff:
- exact sources read,
- claim status for every routing rule,
- model-routing matrix rows,
- contradictions,
- unsupported claims that remain provisional,
- next safe resume instruction.
```

## Resume pattern

On resume:

1. Read the launch manifest and confirm the authorized track.
2. Read `05-source-ledger.md` before any synthesis.
3. Read the last track findings or handoff file.
4. Continue only the next incomplete lane.
5. Preserve prior contradictions unless resolved with evidence.

## Audit pattern

An audit pass should verify:

- the exact RISE wording is preserved,
- every matrix row has a ledger pointer,
- implementation claims have repo path evidence,
- transcript-only claims remain provisional,
- cost and capability claims are not merged without support,
- fallback and review gates are explicit,
- no Academic, Technical, Narrative, or final research was run during scaffold work.

## Export destinations

| Destination | Allowed content | Required status |
| --- | --- | --- |
| A1 findings | Taxonomy, vocabulary, academic source map | Ledger-backed or clearly provisional. |
| T1 findings | Routing matrix, dispatch contract, fallback and review gates | Ledger-backed with repo path evidence for implementation behavior. |
| Other rispecs | Permission, memory, runtime, or Discord constraints that affect routing | Cross-linked and source-ledgered. |
| Study handoff | Next command, blockers, evidence gaps | No final synthesis unless authorized. |

## Handoff checklist

- Source ledger updated.
- Matrix rows status-tagged.
- Contradictions preserved.
- Claims separated by source type.
- Review asks written as concrete evidence gaps.
- Next track entry point names the manifest authorization requirement.
