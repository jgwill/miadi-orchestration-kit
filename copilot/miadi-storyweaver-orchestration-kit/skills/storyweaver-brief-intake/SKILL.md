---
name: storyweaver-brief-intake
description: "Extract a story or Chronicle request into creative brief, constraints, protocol flags, and human questions while preserving the original prompt."
---

# Storyweaver Brief Intake

Use this skill when a user gives a new premise, mission, typed starter, session source, or story request.

## Coordinates

- Primary agent: Creative Brief Archaeologist
- Supporting agent: Cultural Protocol Steward, if sensitive material appears
- Routing agent: Storyweaver Orchestration Architect

## Required Reading Order

1. Raw user prompt or session instruction
2. `inputs/original-prompt.md`, if resuming
3. Existing notes, drafts, transcripts, or issue context
4. `state.md`
5. `protocol-notes.md`, if present

## Workflow

1. Preserve the original prompt in `inputs/original-prompt.md`.
2. Extract premise, deliverable, audience, genre or form, tone, point of view, tense, length, and language.
3. Separate operational instructions from prose content.
4. Identify source expectations, citations, canon notes, privacy boundaries, and consent-sensitive material.
5. Write contradictions, unknowns, and optional human questions.
6. Update `state.md` with route and next recommended skill.

## Artefacts Read

- User prompt or `inputs/original-prompt.md`
- Existing drafts, session records, or research notes
- `state.md`

## Artefacts Written

- `inputs/original-prompt.md`
- `creative-brief.md`
- `constraints.md`
- `questions-for-human.md`, only when needed
- `protocol-notes.md`, when relevant

## Brief Sections

Include:

- Desired outcome
- Current reality
- Natural progression
- Audience layers: academic, engineering, narrative
- Story or Chronicle premise
- Output form and deliverables
- Voice, tone, point of view, style, and length
- Content boundaries
- Sources and provenance expectations
- Operational instructions excluded from prose

## Pause Conditions

- Missing choice changes the story direction.
- Source use or personal material requires human consent.
- Operational instruction conflicts with the requested creative form.

## Acceptance Checklist

- [ ] Original prompt is preserved.
- [ ] Creative brief and operational instructions are separated.
- [ ] Sensitive material has a protocol route.
- [ ] Next skill is recorded in `state.md`.
