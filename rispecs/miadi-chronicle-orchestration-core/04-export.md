# Export

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This document describes how the chronicle core can be exported into later work. It does not implement a plugin, skill, schema, archive generator, or migration.

## Current export boundary

The export for this change is the rispec package itself:

```text
rispecs/miadi-chronicle-orchestration-core/
  README.md
  01-reverse-engineer.md
  02-intent.md
  03-specify.md
  04-export.md
  05-source-ledger.md
```

The root `README.md` should list this as a reusable RISE output.

## Future manifestation options

Only after repeated use proves the boundary, a future wave could manifest this core as one or more of:

| Future artifact | Possible role | Required source before implementation |
| --- | --- | --- |
| Hermes skill package | Let Hermes Agent invoke chronicle continuity, chapter revision, and voice archive review directly. | Current Hermes skill files plus this rispec. |
| Copilot plugin folder | Provide agents/skills for chronicle orchestration across Codex/Copilot-style sessions. | Existing kit README patterns, source ledger, and a fresh implementation issue. |
| Archive schema update | Normalize `episode.yaml`, catalog, and index generation around chronicle needs. | `voice-episode-archiving`, interoperability notes, and live archive examples. |
| Review checklist | Lightweight reviewer for Book One continuity, house responsibility, and TTS readiness. | `03-specify.md` review gate and current chapter artifacts. |
| Handoff template | Standard packet for branch/trunk return and future agent resume. | Episode 006 continuity-note evidence and this core's continuity contract. |

## Future skill/package sketch

A later package could expose a compact set of workflows:

- `chronicle-session-orient`: read archive indexes, identify trunk/branch, name house responsibility, and prepare the next move.
- `chronicle-continuity-note`: produce a branch/trunk return note with carryable gain and next entry point.
- `chronicle-chapter-wave`: draft or revise one spoken chapter using silent developmental review and targeted rewrite.
- `chronicle-voice-archive-review`: verify script, narration, audio, revision notes, metadata, and indexes.
- `chronicle-source-ledger`: update direct evidence, promoted patterns, and inferences for chronicle work.

These names are sketches, not implementation instructions.

## Handoff shape

Use this shape when handing the rispec to a future agent:

```markdown
## Rispec handoff: Miadi Chronicle Orchestration Core
- RISE path: Reverse-engineer -> Intent-extract -> Specify -> Export
- Target consumer:
- Updated files:
- Direct evidence used:
- Promoted patterns:
- Provisional inferences:
- Active trunk:
- Active branch:
- Continuity note needed: yes/no
- Archive action needed: yes/no
- Next authorized action:
```

## Export rules

- Export only claims supported in `05-source-ledger.md` or explicitly labelled as inference.
- Do not treat the older Storyweaver branch as the canonical source for chronicle work.
- Do not create a plugin from this package without a separate implementation issue or request.
- Do not convert archive conventions into public publishing behavior unless the task explicitly authorizes publishing.
- Do not expose private lineage fields from Hermes archives by default.
- Preserve Hermes Agent as a consumer in package language; do not write only for external agents.

## Resume instructions

A later agent continuing this work should:

1. read this file and `05-source-ledger.md`,
2. inspect the active Miadi Chronicle index and latest relevant episode folder,
3. identify whether the task is trunk work, branch work, archive review, chapter revision, or package manifestation,
4. update only the smallest needed artifact set,
5. leave a handoff with direct evidence, promoted patterns, inferences, and next entry point.

## Stop conditions

Stop before export if:

- the target consumer is unclear,
- the work would implement a plugin or skill without authorization,
- the archive paths or episode identity are ambiguous,
- the branch cannot state its trunk relation,
- or a claim cannot be placed in the source ledger.
