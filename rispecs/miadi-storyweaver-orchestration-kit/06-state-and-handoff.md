# State And Handoff Specification

## Structural Tension

- **Desired Outcome**: Story sessions remain resumable, reviewable, and coherent across agents and interruptions.
- **Current Reality**: Multi-agent writing can lose context when drafts, reviews, sources, and decisions are not written into stable artefacts.
- **Natural Progression**: Use a predictable story workspace with state files, ledgers, route decisions, and handoff notes after every major phase.

## Story Workspace Shape

The future kit should operate inside an active story workspace. The default can be `.storyweaver/<slug>/`, but skills should allow a user-provided folder.

```text
.storyweaver/<story-slug>/
  session-charter.md
  state.md
  artefact-index.md
  inputs/
    original-prompt.md
  creative-brief.md
  constraints.md
  protocol-notes.md
  story-bible.md
  character-arcs.md
  relationship-map.md
  timeline.md
  continuity-ledger.md
  outline.md
  beat-map.md
  chapter-contracts/
    chapter-01.md
  research/
    research-pack.md
    source-ledger.md
  chapters/
    chapter-01.md
  scenes/
  reviews/
    outline-review.md
    chapter-01-developmental.md
    chapter-01-critique.md
  revision-log.md
  exports/
    story.md
    story-metadata.json
    story-packet.md
    revision-dossier.md
```

## `state.md` Contract

`state.md` is the primary resume file. It should be readable by humans and agents.

Required sections:

```markdown
# Storyweaver State

## Structural Tension
- Desired Outcome:
- Current Reality:
- Natural Progression:

## Active Stage
brief | bible | research | outline | draft | review | revise | line-edit | export | closed

## Accepted Artefacts
- path:
- status:
- accepted_at:
- accepted_by:

## Pending Artefacts
- path:
- status:
- next_action:

## Current Route
continue | revise | pause | ask-human | closed

## Next Recommended Skill
storyweaver-...

## Blockers Or Pause Conditions
- ...

## Last Handoff
- from_agent:
- to_agent_or_skill:
- summary:
- created_at:
```

## Artefact Status Values

| Status | Meaning |
| --- | --- |
| `draft` | Created but not reviewed. |
| `in-review` | Under active review. |
| `accepted` | Ready as input for later stages. |
| `accepted-with-known-risk` | Usable, but the risk must remain visible. |
| `needs-revision` | Must route to revision before later use. |
| `needs-human` | Requires human decision before continuing. |
| `superseded` | Preserved for history but no longer active. |

## Handoff Note Contract

Every agent handoff should include:

- what was read
- what was created or changed
- accepted facts
- unresolved questions
- next recommended action
- risks or protocol pauses
- exact artefact paths

Handoffs can be appended to `state.md` or written as timestamped notes under `handoffs/` if the implementation agent adds that folder.

## Continuity Ledger Contract

`continuity-ledger.md` should preserve:

- established story facts
- changed facts and rationale
- timeline events
- character states
- relationship states
- world rules
- active promises to the reader
- unresolved questions
- source-dependent details
- forbidden or avoided content

The continuity keeper updates the ledger after:

- story bible creation
- outline revision
- every chapter or scene wave
- accepted revision
- final export check

## Research Source Ledger Contract

`research/source-ledger.md` should separate:

- source path or URL
- source type
- date accessed, when applicable
- summary
- promoted details
- details rejected or avoided
- uncertainty notes
- story artefacts that used the source

The narrative-research-weaver should mark invented details as invented instead of letting them look sourced.

## Review Route Contract

Review agents should end with one route:

| Route | Meaning |
| --- | --- |
| `accept` | Artefact can advance. |
| `revise` | Artefact should route to revision-weaver. |
| `pause` | Work should stop until a blocker clears. |
| `ask-human` | Human choice changes story direction or consent boundary. |

The orchestration architect writes the chosen route to `state.md`.

## Resume Semantics

When resuming, the orchestration architect should:

1. Read `state.md`.
2. Read `artefact-index.md`.
3. Verify listed accepted artefacts exist.
4. Read the latest handoff note if present.
5. Continue from `Next Recommended Skill`.
6. If artefacts are missing or conflict with state, record the mismatch and ask only the minimal human question needed to continue.

## Human Consent Gates

The pipeline must pause for human input when:

- the story uses personal, private, or real-community material without clear permission
- the story asks for sacred, restricted, or culturally specific knowledge
- the requested output conflicts with the user's stated boundaries
- a review route is `ask-human`
- two accepted artefacts contradict each other and the choice changes the story's meaning

## Export Integrity

The export steward can mark the session `closed` only when:

- all included chapters or scenes are accepted
- final continuity check has run
- protocol notes have no unresolved `ask-human` or `do-not-proceed` route
- source ledger is included when research affected story details
- revision log reflects material changes
