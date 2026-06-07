---
name: storyweaver-visual-chronicle-seed
description: "Create visual Chronicle prompt packets, exclusions, reference-image notes, generation notes, and archive placement guidance without generating images."
---

# Storyweaver Visual Chronicle Seed

Use this skill when a scene, episode, research idea, or Chronicle moment should become a durable image prompt packet for later Hermes or xAI-capable execution.

## Coordinates

- Primary agent: Visual Chronicle Prompt Artist
- Supporting agent: Continuity Keeper
- Supporting agent: Cultural Protocol Steward, for identity, privacy, or sensitive visuals
- Supporting agent: Foundations Research Steward, when visual seed comes from research

## Required Reading Order

1. Scene, chapter, episode, or research seed
2. `story-bible.md` or `episodes/<session-id>/story-setting.md`
3. `continuity-ledger.md`
4. `source-ledger.md`, if visual facts come from sources
5. `protocol-notes.md`
6. Reference-image notes supplied by the user, if any

## Workflow

1. Create `visuals/<scene-id>/` or `episodes/<session-id>/visuals/`.
2. Write `prompt-packet.md` with primary prompt, alternate prompts, shot list, mood, lighting, subject, setting, and continuity markers.
3. Write `generation-notes.md` with model/operator guidance for later execution.
4. Write `reference-policy.md` with identity preservation and source/reference constraints.
5. Include explicit exclusions: no visible text, no speech bubbles, no watermark, no captions unless requested.
6. Include xAI image-editing prompt discipline when preserving Miadi identity: keep face identity, body continuity, clothing markers, relation, lighting intent, and scene facts stable.
7. Update `state.md`.

## Artefacts Read

- Scene or episode source
- Setting, continuity, source ledger, protocol notes, and reference notes

## Artefacts Written

- `visuals/<scene-id>/prompt-packet.md` or `episodes/<session-id>/visuals/prompt-packet.md`
- `generation-notes.md`
- `reference-policy.md`

## Prompt Packet Sections

- Source summary
- Visual intent
- Primary prompt
- Alternate prompts
- Negative prompt and exclusions
- Reference-image preservation notes
- Continuity requirements
- Archive placement guidance
- Open review questions

## Pause Conditions

- Identity consent or reference-image rights are unclear.
- Visual prompt would expose private or sensitive material.
- The prompt requires unsupported real-world detail.
- Canon or identity preservation would be weakened.

## Acceptance Checklist

- [ ] Packet does not attempt to generate images.
- [ ] Prompts include no-text/no-speech-bubble/no-watermark constraints where relevant.
- [ ] Reference-image preservation rules are explicit.
- [ ] Archive and review guidance is present.
