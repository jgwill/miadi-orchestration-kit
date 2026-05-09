# Export

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This document defines how openclaw runtime patterns findings should be exported after future authorized research waves update the rispec.

## Export targets

- Per-track findings in the OpenClaw model-routing study folder.
- `model-routing-matrix.md` rows where this rispec contributes routing or runtime policy implications.
- `delegation-status.md` updates when this rispec unblocks a track.
- Handoff files for Academic, Technical, Narrative, or Final integration agents.
- Future plugin-gap or runtime-inspector issues only after evidence proves the gap.

## Handoff shape

```markdown
## Rispec handoff: OpenClaw Runtime Patterns
- RISE path: Reverse-engineer -> Intent-extract -> Specify -> Export
- Updated files:
- Cleared claims:
- Provisional claims:
- Contradictions:
- Stop conditions still active:
- Next authorized action:
```

## Promotion rules

- Export only claims that are ledger-backed or explicitly labelled provisional.
- Preserve contradictions in the handoff instead of hiding them.
- Do not export memory candidates unless they include source, observed_at, confidence, status, scope, related_task, and user_confirmed.
- Do not export launch commands that exceed the current manifest authorization.

## Resume instructions

A later agent should read `README.md`, `05-source-ledger.md`, and this file before continuing. If the launch manifest still authorizes only Preflight, the agent must stop before running any research track.
