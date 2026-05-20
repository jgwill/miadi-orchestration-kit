---
name: storyweaver-export-packet
description: "Assemble final or provisional story packets with manuscript, metadata, source ledger, continuity, reviews, revision dossier, closure note, and next commissions."
---

# Storyweaver Export Packet

Use this skill when a story, chapter set, book section, Chronicle episode, or related packet is ready to deliver.

## Coordinates

- Primary agent: Export Steward
- Supporting agent: Line Editor
- Supporting agent: Continuity Keeper
- Routing agent: Storyweaver Orchestration Architect

## Required Reading Order

1. `state.md`
2. `artefact-index.md`
3. Accepted chapters, scenes, or episode artefacts
4. `continuity-ledger.md`
5. `research/source-ledger.md`, if sources shaped content
6. `protocol-notes.md`
7. `revision-log.md`
8. `reviews/`

## Workflow

1. Confirm included artefacts are accepted or explicitly provisional.
2. Run final continuity check.
3. Run final line edit when requested.
4. Assemble manuscript or packet.
5. Generate metadata.
6. Include ledgers, reviews, revision log, source notes, protocol notes, and closure.
7. Write follow-up commissions when work remains.
8. Update `state.md` to `closed` only when export integrity is satisfied.

## Artefacts Read

- Accepted story or episode content
- Ledgers, reviews, revision logs, metadata notes, constraints

## Artefacts Written

- `exports/story.md`
- `exports/story-metadata.json`
- `exports/story-packet.md`
- `exports/revision-dossier.md`, when reviews exist
- `exports/closure-note.md`

## Pause Conditions

- Any included artefact is not accepted or explicitly provisional.
- Protocol notes contain unresolved `ask-human` or `do-not-proceed`.
- Continuity has export-blocking conflicts.
- Source ledger is missing for source-shaped claims.

## Acceptance Checklist

- [ ] Packet identifies final, provisional, blocked, and open elements.
- [ ] Metadata matches the packet.
- [ ] Source and protocol ledgers are included when relevant.
- [ ] `state.md` accurately marks closed or next route.
