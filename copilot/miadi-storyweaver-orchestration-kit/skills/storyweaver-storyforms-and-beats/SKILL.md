---
name: storyweaver-storyforms-and-beats
description: "Extract StoryForms, StoryBeats, Story Setting, related work, and follow-up commissions from sessions, episodes, chapters, or Chronicle packets."
---

# Storyweaver StoryForms And Beats

Use this skill when a session or story artefact reveals reusable narrative structure, auditable turns, contextual setting, or future commissions.

## Coordinates

- Primary agent: StoryForms And Beats Cartographer
- Supporting agent: Continuity Keeper
- Supporting agent: Chronicle Episode Steward
- Routing agent: Storyweaver Orchestration Architect

## Required Reading Order

1. Episode, session source, chapter, scene, or source packet
2. `episodes/<session-id>/source-ledger.md`, when present
3. `episodes/<session-id>/episode.md`, when present
4. Existing `storyforms/index.md`, if present
5. Related issues, rispecs, workstream notes, or research files
6. `state.md`

## Workflow

1. Extract Story Setting: workspaces, repos, tools, agents, channels, session IDs, permissions, context, and active tension.
2. Extract ordered StoryBeats as JSONL, with source and impact for each beat.
3. Identify reusable StoryForms with trigger conditions, participants, required artefacts, risks, and examples.
4. Update optional shared `storyforms/index.md`.
5. Map related work.
6. Write follow-up commissions if new work emerged.
7. Update continuity and `state.md`.

## Artefacts Read

- Episode or story sources
- Source ledger
- Related work notes
- Existing StoryForms

## Artefacts Written

- `episodes/<session-id>/story-setting.md`
- `episodes/<session-id>/storybeats.jsonl`
- `episodes/<session-id>/storyforms.md`
- `episodes/<session-id>/related-work.md`
- `episodes/<session-id>/followup-commissions.md`
- Optional `storyforms/index.md`

## StoryBeat JSONL Shape

```json
{"order":1,"beat":"A source-auditable turn happened.","source":"<path-or-url>","kind":"observed","impact":"What changed because of the beat."}
```

## Pause Conditions

- A beat cannot be tied to source.
- A StoryForm overgeneralizes sensitive or private context.
- Story Setting would expose private information without permission.

## Acceptance Checklist

- [ ] Every StoryBeat has a source.
- [ ] StoryForms are reusable and named.
- [ ] Story Setting preserves actual operational context.
- [ ] Follow-up commissions are concrete.
