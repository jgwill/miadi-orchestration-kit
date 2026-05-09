# Miadi Chronicle Orchestration Core

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

Focused orchestration rispecs for chronicle, orientation, continuity, and audio-archive work around the Miadi Chronicle. This package is a revision-before-merge core extracted into current main. It is not a merge of the older broad Storyweaver rispec branch and it does not create a Copilot plugin.

## Structural tension

- **Desired outcome**: Future agents, including Hermes Agent itself, can consume a small Miadi-native chronicle core that preserves Tushell/Miadi orientation, branch continuity, Book One shape, chapter revision, and archive-first voice episode discipline.
- **Current reality**: The older Storyweaver rispec branch describes a generic writing pipeline and plugin target, while the strongest current evidence lives in Hermes skills, Miadi Chronicle voice episodes, Book One continuity notes, and archive folders.
- **Natural progression**: Reverse-engineer the source reality, extract the chronicle-specific intent, specify implementation-agnostic orchestration expectations, and leave export guidance for a later skill or plugin package only when repeated use proves the boundary.

## Source reality

This core treats the following as first-class source reality, not decorative story language:

- Tushell is the Portal of Knowing: orientation, entry, threshold, access, and how a traveler meets complexity without scattering.
- Miadi is the House of Orchestration: coordination, delegation, memory, lineage, runtime boundaries, handoffs, and accountable movement.
- The Miadi Chronicle is a spoken vessel for making orchestration work humanly intelligible.
- Continuity notes preserve relation between branch work and trunk inquiry.
- Book One currently carries a six-chapter orientation arc with a point-of-view and stewardship shift from Tushell toward Miadi.
- Voice episodes are durable archive artifacts with scripts, narration text, audio, revision notes when useful, and indexes.

## Read order

| File | Purpose |
| --- | --- |
| `01-reverse-engineer.md` | Compares older Storyweaver assumptions with Hermes chronicle/archive evidence and names what was missing. |
| `02-intent.md` | Defines desired outcome, current reality, structural tension, non-goals, and natural progression for this smaller core. |
| `03-specify.md` | Defines the reusable contract for chronicle work: workspace classes, artifacts, review, continuity, archive, and export expectations. |
| `04-export.md` | Describes how future agents could manifest a skill or plugin package later without implementing it in this change. |
| `05-source-ledger.md` | Preserves direct evidence, promoted patterns, inferences, and source boundaries. |

## Scope

This package is about chronicle/orientation/continuity/audio-archive orchestration. It is not a generic fiction-writing kit, a manuscript generator, a publishing platform, or a Copilot plugin implementation.

Use it when work involves:

- Miadi Chronicle chapters, interludes, continuity notes, or Book One planning,
- Tushell/Miadi orientation and stewardship distinctions,
- branch/trunk return logic in a knowledge tree,
- Hermes voice episode archive conventions,
- chapter revision for spoken output,
- or future agent-facing packaging of these patterns.

## Acceptance criteria

- The package stays in the standard five-file RISE shape plus README.
- Claims about source reality are ledger-backed or explicitly marked as inference.
- Hermes skills and voice episodes are treated as orchestration sources, not only private outputs.
- The older Storyweaver branch is used only as contrast/reference.
- Tushell, Miadi, continuity notes, branch/trunk return, Book One chapter arc, and POV/stewardship shift are explicit.
- Chapter revision and voice episode archiving are reusable knowledge.
- No plugin, runtime code, schema generator, or archive migration is implemented here.
