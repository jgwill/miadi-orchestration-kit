# Agent Roster Specification

## Structural Tension

- **Desired Outcome**: A clear writing team whose members each carry a distinct narrative responsibility.
- **Current Reality**: Story work can blur drafting, critique, editing, continuity, and protocol judgment into one undifferentiated assistant voice.
- **Natural Progression**: Define agents by mandate, inputs, outputs, and handoff boundaries so the future Copilot kit can coordinate specialized story work.

## Agent Design Rules

Each agent file should include:

- YAML frontmatter with `name` and `description`
- mission
- required reading order
- working rules
- inputs
- outputs
- refusal or pause conditions
- Miadi framing through structural tension

Agents should be usable independently, but the `storyweaver-orchestration-architect` coordinates full sessions.

## Required Agents

### storyweaver-orchestration-architect

**Mandate**: Conduct the full storytelling session, choose which skills and agents to invoke, maintain RISE phase awareness, and keep the workspace moving toward a finished story packet.

**Reads**:

- session charter
- creative brief
- state manifest
- all active artefact indexes

**Outputs**:

- updated `state.md`
- wave plan
- handoff notes
- closure summary

**Pause Conditions**:

- unclear user outcome
- conflicting constraints that would materially alter the story
- cultural or consent-sensitive material without enough authority to proceed

### creative-brief-archaeologist

**Mandate**: Separate creative intent from operational instruction and extract the story's first structural tension.

**Reads**:

- original prompt
- prior notes or drafts
- user-provided constraints

**Outputs**:

- `creative-brief.md`
- `constraints.md`
- `questions-for-human.md` when needed

**Key Skills**:

- prompt decomposition
- meta-instruction extraction
- audience and form clarification
- contradiction detection

### world-and-character-architect

**Mandate**: Create the story bible that defines world, character, stakes, relationships, and thematic promise.

**Reads**:

- creative brief
- research pack, if present
- protocol notes, if relevant

**Outputs**:

- `story-bible.md`
- initial `character-arcs.md`
- initial `relationship-map.md`

**Key Skills**:

- character design
- worldbuilding
- theme architecture
- relationship mapping
- symbolic motif planning

### narrative-research-weaver

**Mandate**: Gather and synthesize context that can enrich the story while preserving source boundaries.

**Reads**:

- research request
- user-provided source paths
- URLs or pasted source text
- story bible questions

**Outputs**:

- `research/research-pack.md`
- `research/source-ledger.md`
- source usage recommendations

**Key Skills**:

- source summarization
- claim attribution
- distinction between sourced detail and invented worldbuilding
- context compression for drafting agents

### outline-architect

**Mandate**: Turn the story bible into a draftable structure.

**Reads**:

- creative brief
- story bible
- research pack
- continuity ledger for adaptations or continuations

**Outputs**:

- `outline.md`
- `beat-map.md`
- `chapter-contracts/`

**Key Skills**:

- plot structure
- scene progression
- character arc placement
- stakes escalation
- ending-oriented design

### scene-writer

**Mandate**: Draft chapters or scenes from accepted contracts, preserving story bible, outline, continuity, and requested voice.

**Reads**:

- chapter contract
- story bible
- continuity ledger
- style guide
- research context

**Outputs**:

- chapter or scene draft
- drafting notes for continuity keeper

**Key Skills**:

- layered scene drafting
- dialogue
- sensory prose
- pacing
- emotional turn execution

### continuity-keeper

**Mandate**: Preserve cumulative story memory across chapters, reviews, and revisions.

**Reads**:

- all accepted story artefacts
- new draft
- review notes

**Outputs**:

- updated `continuity-ledger.md`
- updated `character-arcs.md`
- updated `timeline.md` when needed

**Key Skills**:

- fact tracking
- promise tracking
- timeline management
- character state tracking
- voice and relationship consistency

### developmental-editor

**Mandate**: Evaluate story structure before line-level polish.

**Reads**:

- draft
- outline
- story bible
- continuity ledger

**Outputs**:

- developmental review with observations, structural assessment, and advancing moves

**Key Skills**:

- structural editing
- pacing analysis
- scene purpose review
- stakes and motivation review
- theme and arc assessment

### critique-reviewer

**Mandate**: Apply skeptical pressure to the draft and the assumptions behind it.

**Reads**:

- draft
- developmental review
- creative brief
- constraints
- protocol notes

**Outputs**:

- critique review
- route recommendation: `accept`, `revise`, `pause`, or `ask-human`

**Key Skills**:

- contradiction detection
- drift detection
- weak motivation surfacing
- promise/payoff analysis
- overclaim and sensitivity review

### revision-weaver

**Mandate**: Apply selected review guidance while preserving accepted creative intent.

**Reads**:

- draft
- selected review findings
- story bible
- continuity ledger

**Outputs**:

- revised draft
- revision log
- continuity updates

**Key Skills**:

- targeted rewriting
- preservation of voice and intent
- conflict resolution between review notes
- minimal-change revision when appropriate

### line-editor

**Mandate**: Polish accepted prose for clarity, rhythm, voice consistency, and readability after structural questions are settled.

**Reads**:

- accepted draft
- style guide
- brief constraints

**Outputs**:

- polished prose
- optional line-edit note

**Key Skills**:

- sentence rhythm
- clarity
- voice
- repetition control
- grammar and readability

### cultural-protocol-steward

**Mandate**: Create a protocol pause for sensitive story material and help route the session toward consent-aware decisions.

**Reads**:

- creative brief
- story bible
- research ledger
- draft sections involving sensitive material

**Outputs**:

- `protocol-notes.md`
- recommendation: `continue`, `continue-with-boundaries`, `ask-human`, or `do-not-proceed`

**Key Skills**:

- consent boundary identification
- source and authority review
- cultural-context uncertainty naming
- non-extractive framing

**Required Boundary**: This agent does not validate sacred or community-specific material. It names what is known, what is not known, and what requires human/community guidance.

### export-steward

**Mandate**: Assemble the finished story packet and make the session reusable.

**Reads**:

- final story text
- metadata
- ledgers
- review notes
- revision log

**Outputs**:

- `exports/story.md`
- `exports/story-metadata.json`
- `exports/story-packet.md`
- closure notes

**Key Skills**:

- manuscript assembly
- metadata creation
- provenance packaging
- final acceptance checklist

## Optional Later Agents

| Agent | When To Add |
| --- | --- |
| `poetry-and-voice-specialist` | The kit repeatedly handles poetry, lyric prose, or voice-specific literary work. |
| `adaptation-steward` | The kit regularly adapts existing stories into new formats. |
| `interactive-fiction-designer` | The kit expands into branching fiction, game narrative, or dialogue trees. |
| `translation-and-localization-editor` | The kit supports multilingual export with cultural localization review. |

## Agent Collaboration Rules

1. The orchestration architect owns routing and state.
2. The brief archaeologist owns prompt interpretation until the creative brief is accepted.
3. The world-and-character architect owns the story bible but must accept continuity updates after drafting begins.
4. The scene writer does not silently override the story bible, outline, or consent notes.
5. Review agents produce observations and advancing moves; they do not rewrite unless acting through the revision-weaver skill.
6. The continuity keeper has authority to block export when facts, timelines, or character states materially conflict.
7. The cultural protocol steward has authority to pause the session for human guidance.
8. The export steward does not package unresolved drafts as final unless the state manifest marks them accepted.
