# Pipeline Specification

## Structural Tension

- **Desired Outcome**: A repeatable story pipeline that carries a creative prompt through brief, bible, outline, drafting, review, revision, and export without losing intent.
- **Current Reality**: Story work often collapses into one long generation pass, which makes continuity, critique, source use, and resumption fragile.
- **Natural Progression**: Define artefact boundaries and agent handoffs so every phase produces a stable input for the next phase.

## Pipeline Overview

The future Copilot kit should coordinate this pipeline:

```text
Session bootstrap
  -> brief intake
  -> story bible
  -> research weave, optional
  -> outline and beat map
  -> outline review and revision
  -> chapter or scene wave
  -> continuity ledger update
  -> developmental review
  -> critique review
  -> revision weave
  -> line edit
  -> export packet
  -> session closure
```

Every stage writes or updates markdown artefacts in the active story workspace. The state-and-handoff spec defines exact paths.

## RISE Phase Mapping

| RISE Phase | Story Pipeline Work | Primary Artefacts |
| --- | --- | --- |
| Reverse-engineer | Study the prompt, user constraints, sources, existing drafts, and desired story experience. | `creative-brief.md`, `source-ledger.md` |
| Intent-extract | Clarify desired reader experience, themes, stakes, boundaries, audience, and story promise. | `story-bible.md`, `protocol-notes.md` |
| Specify | Create outline, beat map, chapter contracts, review rubrics, and continuity ledger. | `outline.md`, `beat-map.md`, `continuity-ledger.md` |
| Export | Draft, revise, polish, package, and close the story workspace. | `chapters/`, `reviews/`, `exports/` |

## Stage Specifications

### 1. Session Bootstrap

**Purpose**: Establish the story workspace and current working agreement.

**Inputs**:

- user prompt or mission
- optional existing story folder
- optional sources or add-dir paths
- requested output form

**Outputs**:

- `session-charter.md`
- `state.md`
- empty artefact folders when starting fresh

**Completion Gate**: The workspace has a clear desired outcome, current reality, requested deliverables, and pause conditions.

### 2. Brief Intake

**Purpose**: Extract creative and operational instructions from the prompt.

**Inputs**:

- original user prompt
- existing notes, if any

**Outputs**:

- `creative-brief.md`
- initial `constraints.md`
- initial human-question list, only when needed

**Required Extraction**:

- premise
- desired output form
- audience
- genre
- tone
- point of view and tense, if specified
- length or chapter requirements
- content boundaries
- source and research expectations
- cultural or consent-sensitive elements
- operational instructions that should not appear in prose

### 3. Story Bible

**Purpose**: Build the stable foundation for all later writing.

**Inputs**:

- `creative-brief.md`
- optional research pack

**Outputs**:

- `story-bible.md`
- first `continuity-ledger.md`

**Required Sections**:

- story promise
- genre, audience, tone, and style
- central theme and counter-theme
- plot premise
- conflict and stakes
- character roster
- character arcs and wounds
- relationship map
- world and setting notes
- symbols, motifs, and recurring images
- boundaries and consent notes

### 4. Research Weave

**Purpose**: Gather context that will enrich the story without burying the draft under source material.

**Inputs**:

- user-provided sources
- local notes
- URLs or reference snippets
- story bible questions

**Outputs**:

- `research/research-pack.md`
- `research/source-ledger.md`
- source-to-story usage notes

**Completion Gate**: Every promoted claim or detail has a source or is marked as invented worldbuilding.

### 5. Outline And Beat Map

**Purpose**: Create a draftable structure.

**Inputs**:

- `creative-brief.md`
- `story-bible.md`
- `research/research-pack.md`, if present

**Outputs**:

- `outline.md`
- `beat-map.md`
- `chapter-contracts/chapter-##.md`

**Required For Each Chapter Or Major Beat**:

- chapter intent
- characters present
- setting
- active tension
- emotional turn
- character movement
- plot advancement
- reader promise or reveal
- continuity facts added
- open questions carried forward

### 6. Outline Review And Revision

**Purpose**: Strengthen structure before prose drafting.

**Inputs**:

- outline
- story bible
- review rubric

**Outputs**:

- `reviews/outline-review.md`
- updated `outline.md` when revision is accepted
- `revision-log.md`

**Gate**: No chapter drafting begins until the outline review is either accepted or the human explicitly chooses to draft with known uncertainty.

### 7. Chapter Or Scene Wave

**Purpose**: Draft a bounded portion of the story.

**Inputs**:

- story bible
- outline
- relevant chapter contract
- continuity ledger
- research pack, if present

**Outputs**:

- `chapters/chapter-##.md` or `scenes/scene-##.md`
- updated continuity ledger
- draft notes

**Layering Pattern**:

1. plot and action
2. character interiority and relationships
3. dialogue and voice
4. integrated prose

### 8. Continuity Update

**Purpose**: Preserve what the draft established.

**Inputs**:

- new chapter or scene
- previous continuity ledger

**Outputs**:

- updated `continuity-ledger.md`
- optional `character-arcs.md`
- optional `timeline.md`

**Required Ledger Fields**:

- new facts
- changed facts
- promises made to the reader
- unresolved threads
- character state changes
- relationship state changes
- world rules established
- source-dependent details used

### 9. Developmental Review

**Purpose**: Evaluate story structure, pacing, stakes, character, and theme before prose polish.

**Inputs**:

- draft section
- story bible
- outline
- continuity ledger

**Outputs**:

- `reviews/chapter-##-developmental.md`
- prioritized advancing moves

### 10. Critique Review

**Purpose**: Apply sharper pressure to assumptions and weak structure.

**Inputs**:

- draft section
- developmental review
- constraints and consent notes

**Outputs**:

- `reviews/chapter-##-critique.md`
- route recommendation: `accept`, `revise`, `pause`, or `ask-human`

### 11. Revision Weave

**Purpose**: Apply selected review guidance while preserving accepted story intent.

**Inputs**:

- draft section
- selected review guidance
- continuity ledger

**Outputs**:

- revised chapter or scene
- `revision-log.md`
- updated continuity ledger

### 12. Line Edit

**Purpose**: Polish sentence-level style after structure is accepted.

**Inputs**:

- accepted draft
- style guide

**Outputs**:

- polished chapter or manuscript
- line-edit notes when meaningful

### 13. Export Packet

**Purpose**: Make the story usable beyond the session.

**Inputs**:

- all accepted chapters or scenes
- metadata
- reviews
- ledgers

**Outputs**:

- `exports/story.md`
- `exports/story-metadata.json`
- `exports/story-packet.md`
- optional `exports/revision-dossier.md`

## Creative Advancement Scenario: Chapter Draft Wave

- **User Intent**: Create chapter 3 from the accepted outline.
- **Current Reality**: The story bible and first two chapters exist, with open threads recorded in the continuity ledger.
- **Natural Progression Steps**:
  1. The scene writer reads chapter 3's contract and the continuity ledger.
  2. The writer drafts in layers, keeping research and continuity visible.
  3. The continuity keeper records new facts and arc changes.
  4. The developmental editor reviews structure.
  5. The critique reviewer identifies observations and routes revision.
  6. The revision weaver applies accepted moves.
- **Achieved Outcome**: Chapter 3 advances the story and leaves a clear state for chapter 4.

## Minimum Viable Pipeline

If the implementation agent needs a first thin slice, create these skills first:

1. `storyweaver-session-bootstrap`
2. `storyweaver-brief-intake`
3. `storyweaver-story-bible`
4. `storyweaver-outline-and-beats`
5. `storyweaver-chapter-wave`
6. `storyweaver-review-loop`
7. `storyweaver-export-packet`

`storyweaver-continuity-ledger` and `storyweaver-cultural-protocol-check` can be called by the first slice even if they begin as lightweight checklist skills.
