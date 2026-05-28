# Vault Knowledge Synthesis — Narrative, Story, Creative Frameworks

**Existing work in the ecosystem** that informs the Miadi Storyweaver Kit.

## Major Vault Holdings

### Storyweaver Rispecs (The Source of Truth)
Path: `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/`

10 files define the full orchestration:
1. Reverse-engineer (prior art, RISE patterns, storytelling package archaeology)
2. Intent (vision, boundaries, acceptance criteria)
3. Pipeline (bootstrap→bible→research→outline→draft→review→revision→export)
4. Agent-roster (13 agents with mandates, inputs, outputs)
5. Skill-surface (9 repeatable skills)
6. State-and-handoff (session state, artefact paths, resume semantics)
7. Plugin-export (Copilot plugin folder structure, manifest)
8. Quality-gates-and-review (review gates, critique formats, acceptance)
9. Source-ledger (provenance tracking)
10. Session-episode-storyforms (extract Episodes, StoryForms, StoryBeats from sessions)

**Key lesson**: Promote durable control-plane patterns (chartering, planning, ledgers, gates). Hold runtime patterns as design documents until they prove operational.

### Etuaptmumk-RSM (Indigenous-AI Collaborative Platform)
Path: `/workspace/repos/miadisabelle/Etuaptmumk-RSM/`

Applies Elder Albert Marshall's Two-Eyed Seeing (Etuaptmumk) to software engineering. Four Directions (East vision / South planning / West action / North wisdom) model. Storyweaver Kit must honor this relational frame, not collapse to generic agents.

**Related to**: Decolonizing-Software article (issue #161).

### Decolonizing Software Engineering via Indigenous Research Paradigm
Path: `/src/IAIP/prototypes/artefacts/article-decolonizing-software-and-science-with-IAIP--2603030849--509d9725-d9fd-406c-a59a-97056028ae33/`

Applies Shawn Wilson's *Research Is Ceremony* to software. Reality IS relationships; entities are derivative. Maps to multi-agent systems where agents are defined BY their relationships, not isolated tools.

**Key thesis**: Decolonize by centering relationality. This frames why agents need explicit handoff contracts, why "specialized agent" means "defined by its relationships," why cultural protocol has authority.

### Narrative Context Protocol (NCP)
Path: `/src/IAIP/prototypes/artefacts/ncp-justification-and-narrativ-tIolMIppS2WdUp6uNb9YtA/`

Transforms agent interactions from mechanical exchanges into narrative events. Central to IAIP. Preserves authentic agent voice across sessions. Treats every interaction as a relationship (not a transaction).

**For Storyweaver**: Agents should "speak" relationally. Brief Archaeologist doesn't just parse text—it recovers creative intent from constraints. Scene Writer doesn't just execute—it honors the story's promises.

### Storyweaver Portal (UI Implementation)
Path: `/src/IAIP/prototypes/artefacts/design--miadi-storytelling--StoryweaverPortal--2605191458--9e05fa39-55a5-4b84-98ad-e2ea65b962f5/`

Working JSX/HTML prototype (weaver-app, weaver-agents, weaver-bible, weaver-episode, weaver-rise, weaver-skills, weaver-drawer). The UI counterpart to the rispecs being authored.

### Three-Universe Beat Model
Path: `/src/Miadi/NARRATIVE_BEATS_RETRIEVAL.md`

Every StoryBeat carries three perspectives: engineer (task_categorization), ceremony (intentional_marking), story_engine (rising_action). Plus `lead_universe` field and `coherence` 0.0–1.0 score.

**Pattern ready**: Can be adopted into Storyweaver state-and-handoff for rich metadata tracking.

### Storytelling Python Package (Source Archaeology)
Path: `/workspace/repos/jgwill/storytelling/`

**Important**: Source archaeology only. DO NOT import or require this package in the Copilot kit. Extract reusable orchestration contracts; leave package internals (LangGraph nodes, FAISS, MCP server implementation) behind.

Useful specs to study:
- Architect Agent Specification
- Character Arc Tracking
- Emotional Beat Enrichment
- Narrative-Aware Story Graph
- Outline-Level RAG (V1 + V3)
- Analytical Feedback Loop
- Creative Orientation Operating Guide

### Multi-Agent Intent + Context Layer Architecture
Path: `/src/IAIP/prototypes/artefacts/article--intent-and-context-layer-in-Multi-Agent-Autonomous-System--260519--3857e496-7f5c-4809-9fb2-f133d1adbbe0/`

**Intent layer**: formalizes goals, delegation, semantic consensus.
**Context layer**: manages shared operational semantics, memory, observability.

LangGraph as durable state-machine framework. Three-layer memory (working/episodic/semantic) with 72.4% compression preserving 92.8% critical info.

**For Storyweaver**: Use this to think about how state flows between agents without token bloat.

### RISE Framework v2 (Draft)
Path: `/src/IAIP/prototypes/artefacts/llms-rise-framework-dee63f48-14d3-44b1-bf32-1219b4528ddb/`

Structural-first methodology: Reality→Inspect→Specify→Export. Structural tension as creative engine. Spec-driven (SpecLang, Spec Kit). Multi-agent protocol with explicit roles, handoffs, artefacts.

**Core principle**: Advancing patterns (spiral, emergence) vs oscillating patterns (problem-solving loops). Storyweaver is an advancing system.

## Key Lessons from Vault

1. **Don't fragment the kit** — Reuse existing stckin-orchestration-kit seed instead of forking too early.
2. **Source archaeology ≠ implementation** — The storytelling package is source truth but should NOT be a runtime dependency.
3. **Promote durable patterns; leave internals** — Promote orchestration contracts; leave LangGraph nodes, FAISS, provider URIs, MCP server details in the package.
4. **Markdown ledgers beat databases** — State manifest + markdown ledger in workspace is sufficient for session memory.
5. **Cultural protocol is a gate, not decoration** — Cultural-protocol-steward must have refusal authority, not just review authority.
6. **Review loops need explicit gates** — Developmental→Critique→Revision sequence prevents drift.
7. **Layered scene drafting** — The package's scene-by-scene expansion (plot→interiority→dialogue→integrated) translates to checklist drafting.
8. **Operational sessions ARE narrative material** — Extract Episodes, StoryForms, StoryBeats from work itself (spec #10).
9. **Create-language matters** — Use "create, manifest, build, shape, advance, preserve, steward, revise, clarify"—not defect-elimination framing.
10. **Path mismatch happens** — Expect archaeological surprise; prior patterns may live in unexpected locations.
11. **Three-universe perspective is load-bearing** — Mia/Miette/Ava (or engineer/ceremony/story_engine) trinity recurs everywhere. Don't collapse to generic.
12. **Indigenous narrative structure is non-linear** — Circular/recursive over linear; balance as progress (not accumulation); web-of-relationships visuals over hierarchies.

## Cross-References

**These foundation files link to:**
- `narrative-theory/` ← Vogler, McKee, Campbell, Cron grounding
- `ai-writing/` ← EMNLP 2025 coherence research, Sudowrite/NovelCrafter tools analysis
- `multi-agent-systems/` ← Agents' Room pattern, Anthropic orchestration, blackboard architectures
- `storyteller-practices/` ← Community ethnography, tool landscape, pain points
- `vault-synthesis/` (this file) ← Links everything to existing ecosystem work

**Next step**: Use these as reference docs while implementing the Copilot plugin. Don't engineer in a vacuum; anchor every design decision back to this foundation.

## Sources (Vault Paths)

- `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/`
- `/workspace/repos/miadisabelle/Etuaptmumk-RSM/`
- `/workspace/repos/jgwill/storytelling/` (archaeology only)
- `/src/IAIP/prototypes/artefacts/` (411 artefacts including deep-searches on RISE, context layers, episodic memory)
- `/src/Miadi/NARRATIVE_BEATS_RETRIEVAL.md`, `/src/Miadi/NARRATIVE_PRACTICES.md`
