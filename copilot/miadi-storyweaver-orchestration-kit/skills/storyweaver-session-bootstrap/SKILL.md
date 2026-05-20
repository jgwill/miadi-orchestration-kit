---
name: storyweaver-session-bootstrap
description: "Start or resume a Miadi Storyweaver workspace with session charter, state manifest, artefact index, delegation map, and next-skill route."
---

# Storyweaver Session Bootstrap

Use this skill when starting or resuming story, book, Chronicle, voice, visual, or foundations work.

## Coordinates

- Primary agent: Storyweaver Orchestration Architect
- Supporting agent: Creative Brief Archaeologist, when no accepted brief exists
- Supporting agent: Cultural Protocol Steward, when the prompt is sensitive

## Required Reading Order

1. User prompt or resume instruction
2. Existing `.storyweaver/<slug>/state.md`, if present
3. Existing `session-charter.md`, if present
4. Existing `artefact-index.md`, if present
5. Latest handoff, review, or source ledger named in state

## Workflow

1. Choose or confirm the workspace path. Default to `.storyweaver/<slug>/`.
2. Create required folders: `inputs/`, `research/`, `chapter-contracts/`, `chapters/`, `scenes/`, `reviews/`, `exports/`, and optional `episodes/`.
3. Write or update `session-charter.md` with desired outcome, current reality, deliverables, constraints, and pause conditions.
4. Write or update `state.md` with active stage, accepted artefacts, pending artefacts, current route, next skill, blockers, and last handoff.
5. Write or update `artefact-index.md` so Iris/Hermes can see what exists and what each file is for.
6. Decide the next skill: usually `storyweaver-brief-intake`, `storyweaver-session-to-episode`, or resume from `Next Recommended Skill`.

## Artefacts Read

- `state.md`
- `session-charter.md`
- `artefact-index.md`
- Existing story, research, review, or episode artefacts

## Artefacts Written

- `session-charter.md`
- `state.md`
- `artefact-index.md`
- Empty workspace folders when needed

## State Update

Set:

- `Active Stage`: `brief`, `research`, `outline`, `draft`, `review`, `export`, or `closed`
- `Current Route`: `continue`, `revise`, `pause`, `ask-human`, or `closed`
- `Next Recommended Skill`
- `Last Handoff` with next agent, input files, expected outputs, and pause triggers

## Pause Conditions

- The requested deliverable is unclear.
- The workspace path would overwrite unrelated work.
- State and artefacts conflict in a way that changes the workflow.
- Sensitive or canon-shaping material appears without route guidance.

## Acceptance Checklist

- [ ] A supervising Iris/Hermes operator can answer what launches next.
- [ ] `state.md` names the stage, route, next skill, blockers, and handoff.
- [ ] `artefact-index.md` lists current files and expected future files.
- [ ] The next skill is concrete and invokable.
