# Reverse-Engineer

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This document reconstructs what the source evidence shows before defining future behavior. It uses the older Storyweaver rispec branch as contrast only.

## Source surfaces inspected

Current repo patterns:

- `/workspace/worktrees/miadi-chronicle-orchestration-core/README.md`
- `/workspace/worktrees/miadi-chronicle-orchestration-core/copilot/openclaw-model-routing-research-kit/README.md`
- `/workspace/worktrees/miadi-chronicle-orchestration-core/copilot/stckin-orchestration-kit/README.md`

Older Storyweaver branch contrast:

- `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/README.md`
- `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/04-agent-roster.md`
- `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/05-skill-surface.md`
- `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/06-state-and-handoff.md`
- `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/08-quality-gates-and-review.md`
- `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/09-source-ledger.md`

Storytelling framework sources:

- `/src/storytelling/llms/docs/storytelling.md`
- `/src/storytelling/llms/docs/narrative-craft.md`
- `/src/storytelling/llms/docs/rise-framework.md`
- `/src/storytelling/llms/docs/structural-tension.md`
- `/src/storytelling/llms/docs/medicine-wheel-research.md`
- `/src/storytelling/rispecs/ApplicationLogic.md`
- `/src/storytelling/rispecs/Creative_Orientation_Operating_Guide.md`
- `/src/storytelling/rispecs/Session_Management_Architecture.md`
- `/src/storytelling/rispecs/Narrative_Intelligence_Integration_Specification.md`
- `/src/storytelling/rispecs/Analytical_Feedback_Loop_Specification.md`

Hermes chronicle and archive evidence:

- `~/.hermes/voice-episodes/INDEX.md`
- `~/.hermes/voice-episodes/miadi-chronicle/INDEX.md`
- `~/.hermes/voice-episodes/miadi-chronicle/2026-05-04-episode-001-the-portal-and-the-tree/chapter-01-script.md`
- `~/.hermes/voice-episodes/miadi-chronicle/2026-05-07-episode-006-continuity-note-and-book-one-outline/script.md`
- `~/.hermes/voice-episodes/miadi-chronicle/2026-05-08-episode-007-book-one-point-of-view-shifts/script.md`
- `~/.hermes/skills/creative/chronicle-chapter-revision/SKILL.md`
- `~/.hermes/skills/media/voice-episode-archiving/SKILL.md`
- `~/.hermes/skills/media/voice-episode-archiving/references/iris-kherix-interoperability.md`

## What the older Storyweaver branch already contained

| Observed pattern | Evidence surface | Status for this core |
| --- | --- | --- |
| A broad writing pipeline from brief intake through story bible, outline, chapter waves, review, and export. | Storyweaver `README.md`, `05-skill-surface.md`, `06-state-and-handoff.md` | Useful as contrast, too broad for this change. |
| A future Copilot plugin target with many agents and skills. | Storyweaver `README.md`, `04-agent-roster.md`, `07-copilot-plugin-export.md` referenced by README | Deferred; this core is implementation-agnostic. |
| Generic continuity ledgers, character arcs, timeline, review routes, and export packets. | Storyweaver `06-state-and-handoff.md`, `08-quality-gates-and-review.md` | Useful generic mechanics, but not sufficient for Miadi Chronicle continuity. |
| A source ledger that cites `/src/storytelling`-style patterns and existing kit conventions. | Storyweaver `09-source-ledger.md` | Useful provenance style, but missing Hermes archive and Miadi/Tushell chronicle evidence. |

## What was missing for the chronicle core

The older branch did not treat these as first-class orchestration sources:

- Hermes Agent as a direct consumer of the resulting kit, not only an external beneficiary.
- `chronicle-chapter-revision` as an existing silent developmental review workflow for spoken chapters.
- `voice-episode-archiving` as an archive-first workflow with stable episode folders, script, narration, audio, indexes, and optional metadata.
- The Miadi Chronicle voice episode archive as durable design evidence.
- Tushell as Portal of Knowing and Miadi as House of Orchestration as source reality for orientation and stewardship.
- Continuity notes as branch/trunk return artifacts, not merely generic state notes.
- Book One as a six-chapter orientation grammar, not an open-ended fiction outline.
- Point-of-view shift as a stewardship transfer from Tushell-held entering toward Miadi-held carrying.
- Recovery and split-audio archive behavior as evidence that audio episodes need durable, inspectable folders rather than only final prose.

## Chronicle-specific evidence reconstructed

| Reconstructed observation | Evidence surfaces |
| --- | --- |
| The Miadi Chronicle archive is organized as a voice episode series with a root index, series index, dated episode folders, scripts, narration files, audio files, and revision notes. | `~/.hermes/voice-episodes/INDEX.md`; `~/.hermes/voice-episodes/miadi-chronicle/INDEX.md`; `voice-episode-archiving/SKILL.md` |
| Episode 001 names Tushell, Miadi, the Miadi Orchestration Kit, the PDE tree, and the chronicle as distinct but related houses/vessels. | Episode 001 `chapter-01-script.md` |
| Tushell is positioned around entry and orientation, while Miadi is positioned around coordination, memory, handoffs, runtime truth, and accountable movement. | Episode 001 `chapter-01-script.md`; Episode 006 `script.md`; Episode 007 `script.md` |
| Continuity notes preserve relation, summarize branch connection to prior work, carry the current question, and enable return to the trunk without rebuilding context. | Episode 006 `script.md` |
| Branches are healthy when they make one child tension local and return with a clarified distinction, better question, reusable method, or new chronicle chapter. | Episode 006 `script.md` |
| Book One currently has a six-chapter arc: threshold and bundle, parent question, houses of tension, orchestration grammar, branches/continuity/return, and transfer of stewardship. | Episode 006 `script.md`; Episode 007 `script.md` |
| The Book One voice design favors a shift where Tushell holds the threshold and Miadi inherits the road. | Episode 007 `script.md` |
| Chronicle chapter revision expects draft, silent developmental review, concise notes, targeted rewrite, and TTS-ready narration. | `chronicle-chapter-revision/SKILL.md` |
| Durable voice episodes are promoted into `voice-episodes/` with stable folders, authored script, narration text, audio, indexes, and optional metadata/catalog fields. | `voice-episode-archiving/SKILL.md`; `iris-kherix-interoperability.md` |

## Generic storytelling evidence worth retaining

The `/src/storytelling` sources contribute reusable mechanics that should be adapted, not copied wholesale:

- RISE phase discipline and specification-as-prose-code.
- Structural tension blocks with desired outcome, current reality, and natural progression.
- Persistent sessions and checkpoints at natural progression boundaries.
- Narrative beats across technical, ceremonial, and story dimensions.
- Narrative intelligence concepts: character state, theme, emotional target, beat metadata, and downstream analysis.
- Analytical feedback loops that identify gaps, route targeted enrichment, validate results, and roll back harmful changes.

For this core, these mechanics support chronicle continuity and review. They do not authorize a generic writing pipeline or runtime implementation.

## Boundary of this stage

Reverse-engineering stops at reconstruction:

- what the older branch did and omitted,
- what Hermes archive evidence proves directly,
- what `/src/storytelling` contributes as reusable method,
- what should stay provisional until future packaging work.

Specification and export decisions belong in later RISE stages.
