# Source Ledger

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This ledger preserves provenance for the Miadi Chronicle orchestration core. It separates direct evidence, promoted patterns, and inference.

## Source inventory

| ID | Source | Type | Use |
| --- | --- | --- | --- |
| S1 | `/workspace/worktrees/miadi-chronicle-orchestration-core/README.md` | current repo | Root listing pattern for reusable kits and RISE outputs. |
| S2 | `/workspace/worktrees/miadi-chronicle-orchestration-core/copilot/openclaw-model-routing-research-kit/README.md` | current repo | Example of focused kit README, launch boundary, and operating scope. |
| S3 | `/workspace/worktrees/miadi-chronicle-orchestration-core/copilot/stckin-orchestration-kit/README.md` | current repo | Example of compact Miadi-native orchestration kit documentation. |
| S4 | `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/README.md` | contrast branch | Broad Storyweaver mission, structural tension, plugin target, and read order. |
| S5 | `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/04-agent-roster.md` | contrast branch | Generic writing-agent roster. |
| S6 | `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/05-skill-surface.md` | contrast branch | Generic Storyweaver skill surface. |
| S7 | `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/06-state-and-handoff.md` | contrast branch | Generic story workspace, continuity ledger, and resume semantics. |
| S8 | `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/08-quality-gates-and-review.md` | contrast branch | Generic review gates and route format. |
| S9 | `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/09-source-ledger.md` | contrast branch | Provenance style and promoted-claim structure. |
| S10 | `/src/storytelling/llms/docs/storytelling.md` | framework docs | Story pipeline, checkpoints, RAG, IAIP, session persistence. |
| S11 | `/src/storytelling/llms/docs/narrative-craft.md` | framework docs | Narrative beats across engineer, ceremony, and story dimensions. |
| S12 | `/src/storytelling/llms/docs/rise-framework.md` | framework docs | RISE phase definitions and specification-as-prose-code framing. |
| S13 | `/src/storytelling/llms/docs/structural-tension.md` | framework docs | Desired outcome/current reality/action structure and tension language. |
| S14 | `/src/storytelling/llms/docs/medicine-wheel-research.md` | framework docs | Four Directions, Two-Eyed AI, relational/ceremonial framing. |
| S15 | `/src/storytelling/rispecs/ApplicationLogic.md` | framework rispec | Story foundation, chapter layering, critique/revision, polish/export flow. |
| S16 | `/src/storytelling/rispecs/Creative_Orientation_Operating_Guide.md` | framework rispec | Structural tension block and advancing-language rules. |
| S17 | `/src/storytelling/rispecs/Session_Management_Architecture.md` | framework rispec | Persistent creative sessions, checkpoints, resume, branching opportunities. |
| S18 | `/src/storytelling/rispecs/Narrative_Intelligence_Integration_Specification.md` | framework rispec | StoryBeat, character state, theme, emotion, analysis readiness. |
| S19 | `/src/storytelling/rispecs/Analytical_Feedback_Loop_Specification.md` | framework rispec | Analysis, gap routing, enrichment, validation, rollback. |
| S20 | `~/.hermes/voice-episodes/INDEX.md` | Hermes archive | Root voice episode index and Miadi Chronicle series entry. |
| S21 | `~/.hermes/voice-episodes/miadi-chronicle/INDEX.md` | Hermes archive | Miadi Chronicle episode list, focus notes, and artifact listings. |
| S22 | `~/.hermes/voice-episodes/miadi-chronicle/2026-05-04-episode-001-the-portal-and-the-tree/chapter-01-script.md` | Hermes archive | Tushell/Miadi source reality, orchestration kit bundle, PDE tree, chronicle vessel. |
| S23 | `~/.hermes/voice-episodes/miadi-chronicle/2026-05-07-episode-006-continuity-note-and-book-one-outline/script.md` | Hermes archive | Continuity note, branch/trunk return, Book One six-chapter outline. |
| S24 | `~/.hermes/voice-episodes/miadi-chronicle/2026-05-08-episode-007-book-one-point-of-view-shifts/script.md` | Hermes archive | POV options, Tushell/Miadi complementarity, Book One audio outline, stewardship shift. |
| S25 | `~/.hermes/skills/creative/chronicle-chapter-revision/SKILL.md` | Hermes skill | Silent developmental review, concise notes, targeted rewrite, TTS-ready narration, chapter artifact shape. |
| S26 | `~/.hermes/skills/media/voice-episode-archiving/SKILL.md` | Hermes skill | Durable voice episode folders, script/narration/audio/indexes, archive-first behavior. |
| S27 | `~/.hermes/skills/media/voice-episode-archiving/references/iris-kherix-interoperability.md` | Hermes skill reference | `voice-episode/v1` metadata direction, cache vs archive distinction, cross-agent levels. |

## Direct evidence claims

| Claim ID | Claim | Sources | Status |
| --- | --- | --- | --- |
| D1 | The older Storyweaver branch is broad, writing-pipeline-oriented, and points toward a future Copilot plugin implementation. | S4, S5, S6, S7, S8 | Direct evidence |
| D2 | The current repo already lists reusable RISE outputs separately from Copilot kits. | S1 | Direct evidence |
| D3 | `/src/storytelling` supports RISE, structural tension, session persistence, narrative beats, narrative intelligence, and analytical feedback loops. | S10-S19 | Direct evidence |
| D4 | The Hermes voice archive has a `miadi-chronicle` series with indexed episodes and artifact lists. | S20, S21 | Direct evidence |
| D5 | Episode 001 identifies Tushell as Portal of Knowing and Miadi as House of Orchestration, with the chronicle as a spoken vessel for making the work intelligible. | S22 | Direct evidence |
| D6 | Episode 006 defines continuity notes as carryable orientation artifacts for branch work returning to a trunk. | S23 | Direct evidence |
| D7 | Episode 006 and Episode 007 both present a six-chapter Book One arc. | S23, S24 | Direct evidence |
| D8 | Episode 007 describes a point-of-view/stewardship shift where Tushell holds entering/orientation and Miadi carries coordination/accountability. | S24 | Direct evidence |
| D9 | `chronicle-chapter-revision` prescribes draft, silent developmental review, concise revision notes, targeted rewrite, and TTS preparation. | S25 | Direct evidence |
| D10 | `voice-episode-archiving` prescribes stable voice episode folders, `script.md`, `narration.txt`, `episode.ogg`, indexes, and archive-first promotion. | S26 | Direct evidence |
| D11 | `voice-episode/v1` interoperability separates temporary `audio_cache/` from durable `voice-episodes/` archives and suggests metadata/catalog fields. | S27 | Direct evidence |

## Promoted patterns

| Pattern ID | Promoted orchestration rule | Source support | Scope |
| --- | --- | --- | --- |
| P1 | Chronicle work must begin by situating house, trunk, branch, and archive context before drafting or revising. | D5, D6, D8 | Durable chronicle core |
| P2 | Tushell/Miadi distinctions are review criteria for chapter purpose, not only worldbuilding flavor. | D5, D8 | Durable chronicle core |
| P3 | Continuity notes are required when branch work needs to return a carryable gain to the trunk. | D6, D7 | Durable chronicle core |
| P4 | Book One's six-chapter outline is the active trunk shape until a later source-ledger entry revises it. | D7, D8 | Active trunk pattern |
| P5 | Chapter revision should use silent developmental review, concise notes, targeted rewrite, and TTS-ready narration. | D9 | Reusable workflow |
| P6 | Voice episodes should be archive-first artifacts, not cache-only audio outputs. | D10, D11 | Reusable workflow |
| P7 | Hermes Agent should be treated as a consumer of the resulting orchestration knowledge. | S25, S26 | Reusable package boundary |
| P8 | Generic Storyweaver agents/skills may inform future packaging, but they should not override Hermes archive evidence. | D1, D4-D11 | Promotion boundary |

## Inferences

| Inference ID | Inference | Basis | Required caution |
| --- | --- | --- | --- |
| I1 | A smaller RISE core is safer than merging the older Storyweaver branch as-is. | D1 compared with D4-D11 | This is a design inference for this change, not a permanent rejection of Storyweaver. |
| I2 | A future plugin or skill package may expose workflows such as orient, continuity note, chapter wave, archive review, and source ledger. | P1-P6 plus repo kit patterns S1-S3 | Do not implement without a later request or issue. |
| I3 | Archive schema work may eventually benefit from `episode.yaml` and `catalog.jsonl`. | D11 | Current Miadi Chronicle examples do not all prove that schema is already present. |
| I4 | Book One's POV shift should be tested in cadence as well as topic. | D8 plus `chronicle-chapter-revision` spoken-quality lens D9 | Treat as creative guidance, not a rigid style rule. |

## Contradictions and boundaries

| Boundary | Handling |
| --- | --- |
| Older Storyweaver branch expects a future plugin; current task forbids creating one. | Keep export guidance future-facing and implementation-agnostic. |
| `/src/storytelling` is a generic generation package, while the target is chronicle orchestration. | Promote only method-level patterns; do not import runtime assumptions. |
| `voice-episode/v1` metadata is suggested by interoperability notes, while current archive examples are mostly markdown/index/audio artifacts. | Mark schema/catalog claims as future-compatible inference unless direct files exist in the target episode. |
| Book One outline is active but still evolving. | Treat as current trunk pattern, not immutable canon. |
| Hermes archive paths may contain private local lineage. | Cite paths for provenance; do not publish private fields by default. |

## Cleared for use in this package

The following claims are cleared for current synthesis:

- The core must be chronicle/orientation/continuity/audio-archive specific.
- Tushell and Miadi should be encoded as source reality and review responsibilities.
- Continuity note, branch/trunk return, Book One arc, and POV/stewardship shift belong in the spec.
- Chronicle chapter revision and voice episode archiving are reusable orchestration knowledge.
- The older Storyweaver branch is contrast/reference, not merge authority.
- Future packaging can be described but not implemented in this change.
