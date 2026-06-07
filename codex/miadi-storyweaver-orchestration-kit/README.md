# Miadi Storyweaver Orchestration Kit for Codex

Codex-native Storyweaver workflows for building durable story and Chronicle
workspaces from creative prompts, research sources, operational sessions, and
Miadi Chronicle material.

This plugin mirrors the canonical Storyweaver skill surface from:

```text
copilot/miadi-storyweaver-orchestration-kit/
```

It packages that workflow as a Codex plugin with `.codex-plugin/plugin.json`,
Codex `SKILL.md` files, agent reference notes, and reusable workspace templates.

## Included Skills

| Skill | Use |
| --- | --- |
| `storyweaver-session-bootstrap` | Start or resume `.storyweaver/<slug>/` with charter, state, and index. |
| `storyweaver-brief-intake` | Preserve the original prompt and extract creative brief, constraints, and protocol notes. |
| `storyweaver-story-bible` | Build the story foundation, character arcs, relationship map, and first continuity ledger. |
| `storyweaver-outline-and-beats` | Create outline, beat map, chapter contracts, and outline review route. |
| `storyweaver-chapter-wave` | Draft chapter, scene, or beat waves and route through continuity and review. |
| `storyweaver-review-loop` | Run developmental, critique, continuity, and protocol review against an artefact. |
| `storyweaver-continuity-ledger` | Update story facts, timelines, promises, source-dependent details, and risks. |
| `storyweaver-cultural-protocol-check` | Pause or bound work involving sensitive culture, privacy, trauma, or consent. |
| `storyweaver-export-packet` | Assemble story manuscript, metadata, ledgers, reviews, revision dossier, and closure note. |
| `storyweaver-session-to-episode` | Convert meaningful sessions into source-led Chronicle episode packets. |
| `storyweaver-storyforms-and-beats` | Extract StoryForms, StoryBeats, Story Setting, related work, and follow-up commissions. |
| `storyweaver-voice-episode-packet` | Prepare a voice-episode archive packet without generating audio. |
| `storyweaver-visual-chronicle-seed` | Create visual prompt packets and generation notes without generating images. |
| `storyweaver-foundations-bridge` | Turn research foundations into source-led story and Chronicle seeds. |

## Codex Use

From this repository after the branch is merged to `main`, add the plugin as a
local Codex plugin:

```bash
codex plugin marketplace add /workspace/repos/jgwill/miadi-orchestration-kit/codex/miadi-storyweaver-orchestration-kit
```

Then ask Codex to use one of the included skills:

```text
Use storyweaver-session-bootstrap to create a workspace for this premise.
```

For session memory work:

```text
Use storyweaver-session-to-episode to turn this completed agent session into a Chronicle packet.
```

For export readiness:

```text
Use storyweaver-review-loop on .storyweaver/<slug>/chapters/chapter-01.md and route the result.
```

## Source Priority

Codex should follow this order:

1. `CODEX.md`
2. The invoked `skills/<skill>/SKILL.md`
3. Relevant `agents/*.md` reference files
4. `templates/`
5. `copilot/miadi-storyweaver-orchestration-kit/README.md`
6. `rispecs/miadi-storyweaver-orchestration-kit/`

The Copilot implementation remains the canonical design source. This Codex
plugin is the Codex-native runtime surface.

## Boundaries

- Do not fictionalize real infrastructure, session facts, paths, agents, or
  tool behavior inside source ledgers.
- Do not generate audio or images. Prepare voice files and visual prompt packets
  for later tools.
- Do not continue sensitive cultural, personal, sacred, private, or
  real-community material when route is `ask-human` or `do-not-proceed`.
- Do not package unresolved drafts as final unless state and export notes mark
  the risk.

## Validation

From the repository root:

```bash
python3 copilot/miadi-storyweaver-orchestration-kit/scripts/validate-storyweaver-kit.py
python3 /home/mia/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py codex/miadi-storyweaver-orchestration-kit
```

Both checks should pass before updating the PR.
