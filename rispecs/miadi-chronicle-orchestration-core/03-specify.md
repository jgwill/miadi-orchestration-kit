# Specify

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This document defines the reusable orchestration contract for Miadi Chronicle work. It is implementation-agnostic and does not create a plugin.

## Required reading order

Before drafting, revising, or packaging chronicle work, read:

1. the active user request or mission brief,
2. this folder's `README.md`,
3. `05-source-ledger.md`,
4. the relevant Miadi Chronicle series index,
5. the current episode or chapter scripts named by the task,
6. the relevant Hermes skill guidance for chapter revision or voice episode archiving,
7. `/src/storytelling` structural tension and session/feedback sources only as supporting method,
8. the older Storyweaver branch only when the task asks for comparison or future plugin planning.

## Workspace classes

| Class | Role | Examples |
| --- | --- | --- |
| Kit repo | Reusable RISE knowledge and later package planning. | `rispecs/miadi-chronicle-orchestration-core/` |
| Chronicle archive | Durable voice episode evidence and outputs. | `~/.hermes/voice-episodes/miadi-chronicle/` |
| Hermes skill source | Existing operational workflows to promote as reusable knowledge. | `chronicle-chapter-revision`, `voice-episode-archiving` |
| Storytelling framework source | Generic method references for RISE, session persistence, narrative intelligence, and feedback loops. | `/src/storytelling/...` |
| Contrast branch | Older broad Storyweaver rispecs used for comparison, not merge authority. | `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/...` |

## Chronicle artifact contract

Chronicle work should produce or update only the artifacts needed for the active stage.

| Artifact | Required meaning |
| --- | --- |
| Chapter or episode script | Authored markdown with title, role, purpose, source context, and spoken structure. |
| Revision notes | Concise developmental notes, separate from narration, naming strengths, risks, and targeted rewrite moves. |
| Narration text | TTS-ready plain text derived from revised script, with markdown noise removed and spoken cadence considered. |
| Audio file | Durable media artifact only when audio generation is in scope; predictable name such as `episode.ogg` or `chapter-XX.ogg`. |
| Continuity note | Carryable orientation artifact for branch work, naming prior relation, current question, branch gain, trunk return, and next move. |
| Source ledger | Claim-level provenance that separates direct evidence, promoted patterns, and inference. |
| Handoff note | Short resume packet for the next agent: files read, files changed, current trunk, active branch, risks, and next authorized action. |

## House responsibility contract

Tushell and Miadi should be treated as governing orientations for chapter purpose and review.

| House | Primary responsibility | Review question |
| --- | --- | --- |
| Tushell / Portal of Knowing | Entry, orientation, threshold, access, approach, first contact with complexity. | Does this help the listener enter without scattering or premature certainty? |
| Miadi / House of Orchestration | Coordination, delegation, boundaries, runtime truth, handoffs, memory, lineage, accountable movement. | Does this help many actors, contexts, and responsibilities remain legible and trustworthy? |
| Shared continuity zone | Branch/trunk relation, continuity notes, return gifts, Book One coherence. | Does this preserve relation between local inquiry and the governing trunk? |

## Continuity contract

When work happens on a branch, the future agent must record:

- trunk question or Book One chapter arc it belongs to,
- branch question being explored,
- prior episode/chapter relation,
- carryable gain produced by the branch,
- whether the branch can return now or needs more exploration,
- and what artifact should travel back to the trunk.

A continuity note is required when:

- the task resumes after interruption,
- an episode changes the Book One arc,
- a chapter shifts house responsibility or point of view,
- a review branch produces a new framing,
- or an archive split/recovery clip changes what counts as the canonical episode.

## Book One contract

Current Book One continuity should be treated as provisional but active trunk shape:

| Chapter | Working title | Primary function | House orientation |
| --- | --- | --- | --- |
| 1 | The Threshold and the Bundle | Introduce the houses, bundle, PDE tree, and first law of situating before action. | Tushell |
| 2 | The Parent Question | Compress the governing inquiry into one carryable sentence. | Tushell leaning toward Miadi |
| 3 | Houses of Tension | Show decomposition without fragmentation: boundary, memory, runtime, lineage, delegation, human workflow. | Mixed |
| 4 | The Orchestration Grammar | Teach handles such as boundary, handoff, memory, lineage, gate, scene, operator, and return. | Miadi |
| 5 | Branches, Continuity, and Return | Explain healthy branching, continuity notes, and returning local gains to the trunk. | Miadi with Tushell memory |
| 6 | The Transfer of Stewardship | Stage the shift from threshold voice to orchestration voice at the operator horizon. | Miadi |

Future changes may revise this arc, but they must state whether they are direct evidence, promoted pattern, or inference in `05-source-ledger.md`.

## Point-of-view and stewardship contract

For Book One audio form, the current preferred design is:

- Tushell holds the entering.
- Miadi carries the road.
- The hinge should be audible in topic and cadence.
- The shift is a transfer of interpretive stewardship, not a stylistic trick.

Any new chapter or revision should identify:

- current narrator/custodian,
- what truth that custodian can access,
- what remains withheld or emerging,
- where the next stewardship shift may happen,
- and how the shift supports the listener's orientation.

## Chapter revision contract

When revising a chronicle chapter or interlude, use the reusable pattern from `chronicle-chapter-revision`:

1. Draft the chapter with role, emotional purpose, concrete teaching purpose, and forward pull.
2. Run a silent developmental review for orientation, teaching clarity, narrative motion, spoken-word quality, boundary discipline, and reusability.
3. Save concise revision notes with strengths, risks, and 3 to 5 rewrite recommendations.
4. Apply targeted rewrite only where needed.
5. Derive TTS-ready narration from the revised script.

The listener should receive the finished chapter, not the machinery of the review, unless transparency is requested.

## Voice episode archive contract

When audio archiving is in scope, future implementations should follow the archive-first pattern:

- store durable episodes under `~/.hermes/voice-episodes/` or an explicitly supplied archive root,
- keep one episode per stable folder,
- save authored `script.md` or chapter-specific script files,
- save `narration.txt` or chapter-specific narration files,
- save predictable audio filenames,
- save revision notes when the episode has editorial or continuity significance,
- update root and series indexes,
- treat `audio_cache/` as temporary provider/cache output,
- and preserve private lineage fields only when appropriate for the target archive.

This rispec records the contract; it does not generate audio or rewrite indexes.

## Review gate

Before a chronicle artifact is accepted, review for:

- source-ledger grounding,
- house responsibility clarity,
- branch/trunk continuity,
- Book One arc impact,
- spoken cadence and TTS readiness,
- archive durability when audio exists,
- and separation between direct evidence, promoted pattern, and inference.

Route decisions:

| Route | Meaning |
| --- | --- |
| `accept` | The artifact can advance as-is. |
| `revise` | Apply targeted changes and update revision notes. |
| `continue-branch` | The branch has not produced a carryable return yet. |
| `return-to-trunk` | The branch has a clear gain to integrate into the trunk. |
| `pause` | Consent, source, archive, or continuity boundary blocks advancement. |

## Export expectations

Every export or handoff should name:

- target consumer: Hermes Agent, Codex, Copilot, Claude, Gemini, Kherix, or human operator,
- trunk and branch status,
- accepted source claims,
- provisional inferences,
- changed artifacts,
- archive actions taken or explicitly not taken,
- and the next safe entry point.
