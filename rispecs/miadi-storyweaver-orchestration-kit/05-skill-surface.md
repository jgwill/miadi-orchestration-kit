# Skill Surface Specification

## Structural Tension

- **Desired Outcome**: A compact set of Copilot skills that can run the storytelling pipeline without requiring users to remember every agent and artefact path.
- **Current Reality**: Agent roles alone do not create repeatable workflows; users need invokable skills that coordinate reading, writing, review, and export.
- **Natural Progression**: Define each skill by trigger, workflow, required inputs, artefact outputs, and agent collaboration.

## Skill Design Rules

Each skill should include:

- frontmatter `name` and `description`
- when to use
- required reading order
- workflow steps
- artefacts to create or update
- agent handoffs
- pause conditions
- acceptance checklist

Skills should prefer markdown artefacts over hidden state.

## Required Skills

### storyweaver-session-bootstrap

**Use When**: Starting or resuming a story creation session.

**Coordinates**:

- storyweaver-orchestration-architect
- creative-brief-archaeologist, when no brief exists

**Workflow**:

1. Locate or create the story workspace.
2. Read existing `state.md`, `session-charter.md`, and artefact index if present.
3. Write structural tension for the session.
4. Record active deliverables, constraints, and pause conditions.
5. Decide the next skill to invoke.

**Outputs**:

- `session-charter.md`
- `state.md`
- `artefact-index.md`

### storyweaver-brief-intake

**Use When**: A user gives a new prompt, premise, mission, or story request.

**Coordinates**:

- creative-brief-archaeologist
- cultural-protocol-steward, if sensitive material appears

**Workflow**:

1. Preserve the original prompt in `inputs/original-prompt.md`.
2. Extract story intent and operational instructions.
3. Separate manuscript content from agent instructions.
4. Identify contradictions, unknowns, and optional human questions.
5. Create initial constraints and consent notes.

**Outputs**:

- `creative-brief.md`
- `constraints.md`
- `questions-for-human.md`, only if needed
- `protocol-notes.md`, when relevant

### storyweaver-story-bible

**Use When**: A creative brief exists and drafting needs a stable foundation.

**Coordinates**:

- world-and-character-architect
- narrative-research-weaver, if sources are requested
- continuity-keeper

**Workflow**:

1. Read the accepted brief and constraints.
2. Incorporate research context when present.
3. Build the story bible.
4. Initialize character arcs, relationship map, motifs, and world rules.
5. Create the first continuity ledger.

**Outputs**:

- `story-bible.md`
- `character-arcs.md`
- `relationship-map.md`
- `continuity-ledger.md`

### storyweaver-outline-and-beats

**Use When**: The story bible is ready and the user wants a structure.

**Coordinates**:

- outline-architect
- developmental-editor
- revision-weaver when review requires changes

**Workflow**:

1. Read brief, story bible, constraints, and research pack.
2. Create outline and beat map.
3. Write chapter contracts.
4. Run outline developmental review.
5. Revise outline when the review route is `revise`.
6. Mark outline state as `accepted`, `accepted-with-known-risk`, or `needs-human`.

**Outputs**:

- `outline.md`
- `beat-map.md`
- `chapter-contracts/`
- `reviews/outline-review.md`
- `revision-log.md`

### storyweaver-chapter-wave

**Use When**: Drafting one or more chapters, scenes, beats, or sections from an accepted outline.

**Coordinates**:

- scene-writer
- continuity-keeper
- developmental-editor
- critique-reviewer
- revision-weaver

**Workflow**:

1. Select the target chapter, scene, or beat range.
2. Read relevant contracts, story bible, continuity ledger, and research context.
3. Draft using the layered scene pattern.
4. Update continuity ledger.
5. Run developmental review.
6. Run critique review when requested by policy or user.
7. Route to revision, human pause, or acceptance.

**Outputs**:

- `chapters/chapter-##.md` or `scenes/scene-##.md`
- `reviews/chapter-##-developmental.md`
- `reviews/chapter-##-critique.md`, when run
- updated `continuity-ledger.md`
- updated `revision-log.md`

### storyweaver-review-loop

**Use When**: The user asks for critique, review, revision readiness, or quality assessment.

**Coordinates**:

- developmental-editor
- critique-reviewer
- cultural-protocol-steward, when relevant
- revision-weaver, only after a route is chosen

**Workflow**:

1. Identify artefact under review and its governing brief.
2. Run structural review.
3. Run adversarial critique when requested or high-risk.
4. Produce route recommendation.
5. Apply selected revisions only when instructed by user or orchestration architect.

**Outputs**:

- review markdown in `reviews/`
- route recommendation
- revision plan

### storyweaver-continuity-ledger

**Use When**: A draft, outline, revision, or story bible changes story facts.

**Coordinates**:

- continuity-keeper
- scene-writer or revision-weaver as needed

**Workflow**:

1. Compare changed text to current ledger.
2. Record new facts and changed facts.
3. Update character state, timeline, relationships, and world rules.
4. Name unresolved promises and payoff obligations.
5. Mark continuity risks before the next chapter wave.

**Outputs**:

- `continuity-ledger.md`
- `character-arcs.md`
- `timeline.md`, when useful

### storyweaver-cultural-protocol-check

**Use When**: The story involves Indigenous knowledge, living cultures, sacred material, personal trauma, real communities, private stories, or consent-sensitive material.

**Coordinates**:

- cultural-protocol-steward
- narrative-research-weaver
- storyweaver-orchestration-architect

**Workflow**:

1. Identify the sensitive material and its source.
2. Separate public knowledge, user-owned experience, invented material, and uncertain authority.
3. Record consent assumptions and limits.
4. Recommend `continue`, `continue-with-boundaries`, `ask-human`, or `do-not-proceed`.
5. Update constraints for drafting agents.

**Outputs**:

- `protocol-notes.md`
- updated `constraints.md`
- route recommendation

### storyweaver-export-packet

**Use When**: The story or story segment is ready to deliver.

**Coordinates**:

- export-steward
- line-editor
- continuity-keeper
- storyweaver-orchestration-architect

**Workflow**:

1. Confirm accepted chapters or scenes.
2. Run final continuity check.
3. Run final line edit when requested.
4. Assemble manuscript.
5. Generate metadata.
6. Package story, source ledger, reviews, revision log, and continuity ledger.
7. Write closure note with next possible advances.

**Outputs**:

- `exports/story.md`
- `exports/story-metadata.json`
- `exports/story-packet.md`
- `exports/revision-dossier.md`, when reviews exist

## Skill Invocation Contract

When a skill needs human input, it should ask concise questions only after checking existing artefacts. It should not ask the user to confirm obvious defaults when the brief gives enough context.

When a skill writes or updates an artefact, it should update `state.md` with:

- stage
- latest artefacts
- accepted or pending status
- next recommended skill
- blockers or pause conditions

## Minimal Skill Frontmatter Pattern

```markdown
---
name: storyweaver-brief-intake
description: Extract a story request into creative brief, constraints, and protocol notes for the Miadi Storyweaver Orchestration Kit.
---
```

## Acceptance Checklist

- Every required skill has a single clear responsibility.
- Each skill lists artefacts it reads and writes.
- Each skill routes to agents by role, not by vague helper language.
- Review and protocol skills can pause the pipeline.
- Export skill cannot mark unfinished or unresolved work as final without state support.
