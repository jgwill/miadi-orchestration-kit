# Miadi Storyweaver Orchestration Kit

RISE specifications for a Copilot-first storytelling orchestration kit that coordinates story creation through specialized agents, repeatable skills, review gates, and exportable story artefacts.

The future kit should live at `copilot/miadi-storyweaver-orchestration-kit/`. These rispecs are the source of truth for the implementation agent that will create that kit.

Mission issue: `jgwill/miadi-orchestration-kit#9`.

## Structural Tension

- **Desired Outcome**: A reusable Miadi-native Copilot kit that can turn a creative prompt into a coherent story workspace through coordinated writing, research, critique, editing, continuity, and export agents.
- **Current Reality**: The storytelling package already demonstrates RISE-aligned narrative generation patterns, but this repository does not yet define a reusable orchestration kit that can run without importing or depending on that package.
- **Natural Progression**: Promote the durable storytelling patterns into implementation-agnostic Copilot orchestration specs, then export those specs into agents, skills, launch instructions, and review contracts.

## Read Order

| File | Purpose |
| --- | --- |
| `01-reverse-engineer.md` | Extracts the reusable patterns from RISE, `llms-txt`, the storytelling rispecs, and existing orchestration kits. |
| `02-intent.md` | Defines the kit vision, boundaries, non-goals, success criteria, and structural tension. |
| `03-pipeline-spec.md` | Specifies the end-to-end storytelling workflow from brief intake to final export. |
| `04-agent-roster.md` | Defines the agents needed to write, review, revise, and steward a story. |
| `05-skill-surface.md` | Defines the Copilot skills the implementation agent should create. |
| `06-state-and-handoff.md` | Specifies session state, artefact paths, handoff contracts, and resume semantics. |
| `07-copilot-plugin-export.md` | Defines the plugin folder, manifest, launch commands, and smoke tests. |
| `08-quality-gates-and-review.md` | Defines review gates, critique formats, consent gates, and final acceptance. |
| `09-source-ledger.md` | Records source provenance and the path mismatch discovered during this mission. |

## Implementation Target

The implementation agent should create a Copilot plugin with this expected shape:

```text
copilot/miadi-storyweaver-orchestration-kit/
  .github/plugin/plugin.json
  README.md
  agents/
    storyweaver-orchestration-architect.md
    creative-brief-archaeologist.md
    world-and-character-architect.md
    narrative-research-weaver.md
    outline-architect.md
    scene-writer.md
    continuity-keeper.md
    developmental-editor.md
    critique-reviewer.md
    revision-weaver.md
    line-editor.md
    cultural-protocol-steward.md
    export-steward.md
  skills/
    storyweaver-session-bootstrap/SKILL.md
    storyweaver-brief-intake/SKILL.md
    storyweaver-story-bible/SKILL.md
    storyweaver-outline-and-beats/SKILL.md
    storyweaver-chapter-wave/SKILL.md
    storyweaver-review-loop/SKILL.md
    storyweaver-continuity-ledger/SKILL.md
    storyweaver-cultural-protocol-check/SKILL.md
    storyweaver-export-packet/SKILL.md
```

## Operating Boundary

The implementation must not import, shell into, or require the existing `jgwill/storytelling` package. That package is source archaeology only. The Copilot kit should be prompt, agent, and artefact orchestration that can operate in any writing workspace.

## Creative Advancement Scenarios

### Scenario 1: Creative Brief To Story Bible

- **Desired Outcome**: The writer has a precise story bible that captures vision, constraints, audience, genre, themes, characters, world, and boundaries.
- **Current Reality**: A prompt may be vivid but incomplete, contradictory, or mixed with operational instructions.
- **Natural Progression**: The brief archaeologist extracts meta-instructions, the world-and-character architect manifests a story bible, and the continuity keeper prepares the first ledger.
- **Achieved Outcome**: The drafting agents can write without repeatedly rediscovering the story's foundation.

### Scenario 2: Story Bible To Reviewed Outline

- **Desired Outcome**: The writer has a chapter or beat outline with visible structural tension, character movement, stakes, and ending trajectory.
- **Current Reality**: Story foundations alone do not tell drafting agents where each scene should advance.
- **Natural Progression**: The outline architect creates the narrative map, the developmental editor evaluates structure, and the revision weaver applies selected improvements.
- **Achieved Outcome**: Chapters can be drafted against a coherent skeleton.

### Scenario 3: Reviewed Outline To Drafted Chapters

- **Desired Outcome**: Each chapter advances plot, character, emotion, and theme while honoring the story bible.
- **Current Reality**: Isolated chapter drafting can drift in voice, continuity, pacing, or promises to the reader.
- **Natural Progression**: The scene writer drafts in layers, the continuity keeper records changes, and critique agents route observations into revision moves.
- **Achieved Outcome**: The story accumulates as a coherent manuscript rather than a stack of disconnected generations.

### Scenario 4: Drafted Chapters To Export Packet

- **Desired Outcome**: The writer receives a complete story export with metadata, review notes, continuity ledger, and implementation-readable provenance.
- **Current Reality**: Final text alone loses the reasoning, sources, constraints, and revision history that make the story resumable.
- **Natural Progression**: The line editor polishes prose, the export steward assembles deliverables, and the orchestration architect records session closure.
- **Achieved Outcome**: The story workspace can be read, resumed, reviewed, or adapted by future agents.
