# Quality Gates And Review Specification

## Structural Tension

- **Desired Outcome**: Story artefacts advance through clear review gates that strengthen narrative quality without collapsing into endless revision.
- **Current Reality**: Writing workflows often oscillate between drafting and broad critique because review standards and route decisions are not explicit.
- **Natural Progression**: Define gates, rubrics, route decisions, and review output formats so critique produces targeted advancement.

## Review Output Format

All review agents should use this structure:

```markdown
# Review: <artefact>

## Structural Tension
- Desired Outcome:
- Current Reality:
- Natural Progression:

## Observations
- Neutral factual observations grounded in the artefact.

## Structural Assessment
State whether the artefact currently advances, partially advances, or oscillates relative to the desired outcome.

## Advancing Moves
- Specific revisions or decisions that would move the artefact forward.

## Route
accept | revise | pause | ask-human
```

## Gate 1: Brief Acceptance

**Artefacts**:

- `creative-brief.md`
- `constraints.md`
- `protocol-notes.md`, when relevant

**Rubric**:

- Desired story output is clear.
- Audience and form are named or intentionally open.
- Operational instructions are separated from prose content.
- Content boundaries are visible.
- Sensitive material has a route.

**Routes**:

- `accept`: proceed to story bible
- `revise`: brief archaeologist updates brief
- `ask-human`: missing choice changes story direction
- `pause`: protocol route blocks continuation

## Gate 2: Story Bible Acceptance

**Artefacts**:

- `story-bible.md`
- `character-arcs.md`
- `relationship-map.md`
- `continuity-ledger.md`

**Rubric**:

- Story promise is specific.
- Main characters have motivations, pressures, and arc direction.
- Setting supports conflict and theme.
- Stakes are legible.
- Tone and style can guide the scene writer.
- Known constraints are incorporated.

**Routes**:

- `accept`: proceed to outline
- `revise`: world-and-character architect updates bible
- `ask-human`: unresolved core creative choice

## Gate 3: Outline Acceptance

**Artefacts**:

- `outline.md`
- `beat-map.md`
- `chapter-contracts/`

**Rubric**:

- Each chapter or beat advances plot and character.
- Emotional turns are visible.
- Stakes progress naturally.
- Reader promises have likely payoff locations.
- Ending trajectory is visible enough for drafting.
- Research or protocol constraints are not contradicted.

**Routes**:

- `accept`: proceed to chapter wave
- `revise`: revision-weaver updates outline from review
- `accepted-with-known-risk`: proceed while recording risk in `state.md`
- `ask-human`: structural choice changes the story's meaning

## Gate 4: Chapter Developmental Review

**Artefacts**:

- target chapter or scene
- chapter contract
- story bible
- continuity ledger

**Rubric**:

- The draft fulfills the chapter contract.
- The scene has movement rather than static explanation.
- Character choices align with current arc state.
- Dialogue reveals character and pressure.
- The chapter creates, escalates, or resolves a clear tension.
- The ending changes reader expectation or story state.

**Routes**:

- `accept`: run continuity update and optional line edit
- `revise`: revision-weaver applies targeted changes
- `ask-human`: draft took an unexpected but viable direction that needs choice

## Gate 5: Critique Review

**Artefacts**:

- target draft
- developmental review
- constraints
- protocol notes

**Rubric**:

- No major contradiction with accepted story state.
- No unsupported claims presented as sourced truth.
- No content boundary is crossed.
- No character motivation depends on unexplained convenience.
- No important promise is forgotten.
- No cultural or consent-sensitive material proceeds without a route.

**Routes**:

- `accept`: proceed
- `revise`: apply selected critique
- `pause`: protocol or consent concern blocks continuation
- `ask-human`: a story-level decision is required

## Gate 6: Final Export Review

**Artefacts**:

- assembled story
- metadata
- continuity ledger
- source ledger
- protocol notes
- revision log

**Rubric**:

- All included sections are accepted.
- Continuity ledger has no export-blocking conflicts.
- Metadata matches the story.
- Source ledger is included when sources shaped the story.
- Protocol notes have no unresolved pause.
- The export packet identifies what is final and what remains open.

**Routes**:

- `accept`: export and close
- `revise`: revise specific section
- `pause`: unresolved consent or provenance blocker

## Scoring Guidance

Numeric scores are optional. If used, prefer simple labels:

| Label | Meaning |
| --- | --- |
| `strong` | The artefact advances the desired outcome with no material blocker. |
| `workable` | The artefact can advance with known limits recorded. |
| `thin` | The artefact needs targeted strengthening before later stages depend on it. |
| `blocked` | A decision, contradiction, or protocol issue prevents advancement. |

## Anti-Oscillation Rule

Review should not create endless open-ended rewriting. Every critique must either:

- name a specific revision,
- identify a human decision,
- accept the current artefact with known risk,
- or pause for a clear boundary reason.

## Cultural Protocol Gate

When the cultural protocol steward routes `ask-human` or `do-not-proceed`, no drafting agent should continue the sensitive portion. The session may continue on unrelated story parts only if `state.md` clearly isolates the blocked material.
