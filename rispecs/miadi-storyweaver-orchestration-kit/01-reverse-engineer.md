# Reverse Engineer: Storytelling Orchestration Patterns

## Structural Tension

- **Desired Outcome**: Extract the durable storytelling orchestration patterns that can become a Copilot kit.
- **Current Reality**: The strongest source patterns are spread across `llms-txt`, the `jgwill/storytelling` rispecs, and existing `miadi-orchestration-kit` plugin folders.
- **Natural Progression**: Separate source archaeology from implementation, promote only reusable orchestration contracts, and leave package-specific runtime details behind.

## Source Observations

The RISE framework treats specifications as prose code. It asks the implementer to move through Reverse-engineer, Intent-extract, Specify, and Export while preserving creative orientation, structural tension, and implementation-agnostic specs.

The storytelling docs describe a narrative generation system that advances through prompt analysis, story elements, outline generation, chapter-by-chapter drafting, revision, polish, metadata, and export. Optional patterns include persistent sessions, retrieval-augmented context, IAIP ceremonial phases, character arc tracking, emotional beat enrichment, and analytical feedback loops.

The storytelling rispecs contain a useful agent model. Its architect agent performs creative archaeology, extracts prompts, defines schemas, documents configuration, maps procedural logic, and self-corrects by asking whether another agent could implement without source access.

The current orchestration-kit repository already packages Copilot plugins as folders with `.github/plugin/plugin.json`, `README.md`, `agents/`, and `skills/`. Existing kits keep launch commands explicit, keep scope narrow, and treat rispec folders as durable orchestration knowledge.

## Reusable Patterns To Preserve

### Prompt Analysis As First-Class Intake

The future kit needs a brief-intake pass that extracts:

- story premise and desired outcome
- meta-instructions such as length, tone, audience, language, and format
- content boundaries and consent requirements
- preferred genre, style, point of view, tense, and pacing
- operational instructions that should guide agents but not appear in the manuscript

This mirrors the storytelling package's `GET_IMPORTANT_BASE_PROMPT_INFO` pattern while staying independent from its exact prompt implementation.

### Story Foundation Before Drafting

Before a writer agent drafts prose, the kit should create a story bible with:

- title candidates
- genre and audience
- theme and emotional promise
- premise, conflict, stakes, and desired ending state
- characters, motivations, wounds, relationships, voice markers, and arcs
- setting, cultural context, constraints, and symbols

This preserves the package's story-elements stage as an orchestration artefact rather than a code module.

### Outline And Chapter Progression

The future kit should support both chapter outlines and beat outlines. The outline must be reviewed before drafting begins. Each chapter should carry:

- chapter intent
- scene list
- character movement
- emotional turn
- continuity changes
- unresolved promises
- research or source context to carry forward

### Layered Scene Drafting

The package's scene-by-scene generation uses layered expansion. The Copilot kit should translate that into agent handoffs:

1. plot and action draft
2. character interiority and relationship draft
3. dialogue and voice draft
4. integration draft that reads as finished prose

The future skill can implement this as a checklist even when only one agent performs the drafting.

### Review Loops With Explicit Gates

The storytelling rispecs include planned critique, completion, and revision loops. The orchestration kit should make those loops operational through:

- developmental review before line editing
- critique observations before revision
- continuity review after every chapter wave
- consent and cultural protocol checks when relevant
- final export review before closure

### Persistent Story Workspace

The session-management specification promotes checkpointing at natural boundaries. The Copilot kit should not need a database to gain this quality. It should use markdown artefacts and a state manifest in the active story workspace.

### Retrieval As Optional Context Weaving

RAG patterns should become a research-weaving skill, not a dependency on any vector stack. The kit should accept local files, user notes, URLs, and pasted source material, then produce source-grounded research packs and attribution ledgers.

### Cultural Protocol As A Gate, Not Decoration

The IAIP integration demonstrates ceremonial phases and Two-Eyed Seeing. The kit should include an explicit cultural protocol steward for stories involving living communities, Indigenous knowledge, sacred material, personal trauma, or other consent-sensitive material. This steward does not authorize appropriation; it creates a pause, names uncertainty, and routes to human consent.

## Patterns To Leave Behind

The kit should not reproduce Python package architecture, LangGraph nodes, provider URI parsing, FAISS setup, package dependency tiers, or MCP server implementation. Those are package implementation details. The orchestration kit should define Copilot agents and skills that can work in a repo, writing folder, or manuscript workspace.

The kit should not assume chapter count, scene count, or revision count. Defaults can be proposed, but the brief intake and human instructions should govern shape.

The kit should not claim cultural validation. It can support consent-aware review, source attribution, and refusal/deferral when the story request exceeds available permission.

## Structural Assessment

The source material advances naturally toward a Copilot kit because the storytelling package already separated intent, prompts, data schemas, workflow, session state, and quality loops into rispecs. The implementation challenge is to preserve those qualities while changing runtime form from a Python generation package into a reusable agent-orchestration plugin.

## Advancing Moves

1. Define the story pipeline as artefact transitions rather than code transitions.
2. Define each agent by mandate, inputs, outputs, and refusal boundaries.
3. Define skills as user-invoked workflows that coordinate agents and update story artefacts.
4. Export a Copilot plugin shape that matches existing kits in this repository.
