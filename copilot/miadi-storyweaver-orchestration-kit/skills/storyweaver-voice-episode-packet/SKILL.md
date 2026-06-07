---
name: storyweaver-voice-episode-packet
description: "Prepare voice episode files: script.md, narration.txt, revision-notes.md, episode.yaml, source context, index-update guidance, and split/recovery notes."
---

# Storyweaver Voice Episode Packet

Use this skill when a Chronicle episode should become a voice-ready archive packet. The skill prepares files only; it does not generate audio.

## Coordinates

- Primary agent: Voice Episode Producer
- Supporting agent: Line Editor
- Supporting agent: Chronicle Episode Steward
- Supporting agent: Cultural Protocol Steward, when voice presentation may alter consent or certainty

## Required Reading Order

1. `episodes/<session-id>/episode.md`
2. `episodes/<session-id>/source-ledger.md`
3. `episodes/<session-id>/storybeats.jsonl`, if present
4. `episodes/<session-id>/storyforms.md`, if present
5. `episodes/<session-id>/story-setting.md`, if present
6. `constraints.md` and `protocol-notes.md`
7. Existing voice archive conventions if supplied by the operator

## Workflow

1. Create `episodes/<session-id>/voice/`.
2. Write `script.md` with episode structure, speaker cues if needed, source-aware scene turns, and production notes.
3. Write `narration.txt` as clean spoken text with no markdown control syntax unless requested.
4. Write `revision-notes.md` with claims, uncertainties, pronunciation notes, and editorial choices.
5. Write `episode.yaml` with title, slug, date, source packet, status, tags, duration estimate, and archive placement.
6. Write `index-update.md` describing how to update a voice archive index.
7. Add split/recovery clip guidance when the narration is long.
8. Update `state.md`.

## Artefacts Read

- Episode packet, source ledger, story beats, story forms, protocol notes, and archive guidance

## Artefacts Written

- `episodes/<session-id>/voice/script.md`
- `episodes/<session-id>/voice/narration.txt`
- `episodes/<session-id>/voice/revision-notes.md`
- `episodes/<session-id>/voice/episode.yaml`
- `episodes/<session-id>/voice/index-update.md`

## Metadata Guidance

`episode.yaml` should include:

- `title`
- `slug`
- `status`
- `source_packet`
- `created_at`
- `audience_layers`
- `tags`
- `duration_estimate`
- `requires_review`
- `archive_guidance`

## Pause Conditions

- Voice narration would imply unsupported certainty.
- Episode contains unresolved consent or protocol blockers.
- Requested voice style conflicts with source or protocol boundaries.

## Acceptance Checklist

- [ ] Voice packet is complete without requiring private Hermes paths.
- [ ] `narration.txt` is speakable.
- [ ] Metadata is catalog-ready.
- [ ] Index guidance is explicit and non-destructive.
