---
name: storyweaver-review-loop
description: "Run developmental, critique, continuity, and protocol review on a story or Chronicle artefact and produce a route decision."
---

# Storyweaver Review Loop

Use this skill when the user asks for critique, review, revision readiness, quality assessment, or export readiness.

## Coordinates

- Primary review agent: Developmental Editor
- Pressure review agent: Critique Reviewer
- Protocol agent: Cultural Protocol Steward, when relevant
- Continuity agent: Continuity Keeper, when facts changed
- Revision agent: Revision Weaver, only after a route is chosen

## Required Reading Order

1. Artefact under review
2. `creative-brief.md`
3. `story-bible.md` or episode setting
4. Governing outline or contract
5. `constraints.md`
6. `continuity-ledger.md`
7. `research/source-ledger.md`, when claims or session facts are involved
8. `protocol-notes.md`

## Workflow

1. Identify the artefact, its governing contract, and the stage gate.
2. Run structural/developmental review.
3. Run critique review when requested, high-risk, or source-sensitive.
4. Run protocol review when material is sensitive or consent-dependent.
5. Name route: `accept`, `revise`, `pause`, or `ask-human`.
6. Write specific advancing moves.
7. Apply revisions only when instructed by the user or orchestration architect.
8. Update `state.md`.

## Artefacts Read

- Artefact under review plus brief, bible, contract, ledgers, and constraints

## Artefacts Written

- `reviews/<artefact>-developmental.md`
- `reviews/<artefact>-critique.md`, when run
- `protocol-notes.md`, when updated
- Revision plan

## Review Format

Use:

- Structural Tension
- Observations
- Structural Assessment
- Advancing Moves
- Route

## Pause Conditions

- Route is `pause` or `ask-human`.
- Review reveals unsupported source claims.
- Protocol or continuity blocks advancement.

## Acceptance Checklist

- [ ] Review cites the governing artefacts.
- [ ] Findings are actionable.
- [ ] Route is explicit.
- [ ] `state.md` names the next skill or pause.
