# Intent: Miadi Storyweaver Orchestration Kit

## Structural Tension

- **Desired Outcome**: A future implementation agent can create a focused Copilot plugin that orchestrates complete story creation through RISE-aligned agents and skills.
- **Current Reality**: The repo has orchestration-kit patterns and storytelling source specs, but no dedicated storytelling orchestration contract.
- **Natural Progression**: Specify the kit boundary, agent roles, skill surfaces, state artefacts, review gates, and export requirements before creating plugin files.

## Proposed Kit Title

**Miadi Storyweaver Orchestration Kit**

The title names the kit's function: weaving story from brief, research, draft, review, revision, and export threads. It also leaves room for non-fiction narrative, memoir-like material, game lore, and ceremonial storytelling workflows without binding the kit to the existing `storytelling` package.

## Core Creative Intent

Enable a writer to create a coherent story workspace from a creative prompt by coordinating specialized agents that each steward one part of narrative creation:

- vision and brief extraction
- world and character architecture
- research context and source stewardship
- outline and beat design
- drafting
- continuity
- developmental editing
- critique
- revision
- line editing
- cultural protocol review
- export and session closure

## Primary Users

| User | Desired Outcome |
| --- | --- |
| Writer | Turn a premise into a complete, reviewed manuscript or story packet. |
| Game or lore designer | Create coherent narrative arcs, character histories, scenes, and canon ledgers. |
| Research-creation practitioner | Generate narrative artefacts while preserving sources, protocols, consent notes, and reflection. |
| Implementation agent | Build the Copilot plugin from these rispecs without needing the `jgwill/storytelling` package. |

## Non-Goals

- Do not implement a Python story generator.
- Do not import from or shell into `jgwill/storytelling`.
- Do not create a generic creative-writing textbook.
- Do not hard-code one chapter count, genre, prose style, or story structure.
- Do not claim cultural authority for stories involving specific communities, sacred knowledge, or lived trauma.
- Do not replace human editorial consent where the story involves personal or community-sensitive material.

## Scope Of The First Copilot Kit

The first implementation should include:

1. one plugin folder under `copilot/`
2. a plugin manifest
3. a README with launch and smoke-test commands
4. agent markdown files for the full writing team
5. skill folders for session bootstrap, brief intake, story bible, outline, chapter wave, review loop, continuity ledger, cultural protocol, and export packet
6. no runtime dependencies beyond Copilot's plugin loading of markdown agents and skills

The first implementation may defer automation such as scripts, schemas, or CLI tools. The primary value is reusable orchestration behavior.

## Acceptance Criteria

The future kit is acceptable when:

- a Copilot session can load the plugin with `--plugin-dir`
- the session can name the storyweaver agents and skills in a smoke test
- `storyweaver-session-bootstrap` creates or updates a story workspace contract
- `storyweaver-brief-intake` separates manuscript content from instructions and constraints
- `storyweaver-story-bible` produces a reusable story foundation
- `storyweaver-outline-and-beats` produces a reviewable outline
- `storyweaver-chapter-wave` can draft at least one chapter from the outline and story bible
- `storyweaver-review-loop` produces observations, structural assessment, and advancing moves
- `storyweaver-continuity-ledger` records story facts and open promises
- `storyweaver-export-packet` assembles final manuscript, metadata, and provenance
- cultural-protocol-sensitive work pauses for human guidance when consent or authority is unclear

## Language Contract

All kit agents and skills should use create-language:

- create, manifest, build, shape, advance, preserve, steward, revise, clarify

They should avoid framing the work as defect elimination except in literal technical contexts. Review agents can name risks and gaps, but their output should separate neutral observations from advancement recommendations.

## Structural Assessment

This mission advances the repo by creating a middle layer between a full story-generation application and a human-operated writing session. The kit does not need runtime machinery to be valuable. Its durable contribution is the coordination contract that makes each writing pass resumable, reviewable, and implementable.
