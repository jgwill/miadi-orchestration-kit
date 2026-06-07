# Miadi Storyweaver Orchestration Kit

Copilot-compatible orchestration kit for building story workspaces from creative prompts, research sources, operational sessions, and Miadi Chronicle material. The kit is markdown-first: agents and skills create durable artefacts instead of depending on a runtime package.

This kit is sourced from `rispecs/miadi-storyweaver-orchestration-kit/`, the discovery surface at `.mia/miadi-storyweaver-discovery.html`, and the Iris/Hermes operator requirements in `rispecs/miadi-storyweaver-orchestration-kit/11-iris-requirements.spec.md`.

## What This Kit Does

The kit supports three audience layers at once:

| Audience | What the kit preserves |
| --- | --- |
| Academic readers | Concepts, claims, citations, cautions, protocol notes, and honest uncertainty. |
| Engineering readers | Workspace paths, source ledgers, state files, delegation hooks, and reproducible handoffs. |
| Narrative readers/listeners | Chronicle seeds, episode arcs, voice lines, visual motifs, continuity, and open promises. |

The standard Storyweaver loop is:

```text
bootstrap workspace
  -> separate operational instruction from creative brief
  -> build story bible and continuity ledger
  -> optionally bridge foundations/research into source ledger
  -> outline and beat map
  -> review and consent gate
  -> draft chapter or scene waves
  -> update continuity
  -> developmental and critique review
  -> revision weave and line edit
  -> export story packet
  -> optionally export episode, StoryForms, voice packet, and visual chronicle seed
```

## Launch

From any story or project workspace:

```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/copilot/miadi-storyweaver-orchestration-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs \
  --add-dir <story-workspace-or-project>
```

Add the main branch only as optional precedent context, never as a runtime dependency:

```bash
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit
```

## Smoke Test

```bash
tmpdir=$(mktemp -d)
cd "$tmpdir"
copilot --model gpt-5-mini --reasoning-effort high --yolo --no-ask-user \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/copilot/miadi-storyweaver-orchestration-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs \
  -p "Name the Storyweaver kit agents and skills, then say which skill starts a new story from a prompt and which skill turns a meaningful session into a Chronicle episode packet."
```

Expected answer should name the Storyweaver agent roster and identify `storyweaver-session-bootstrap` or `storyweaver-brief-intake` as the new-story start, plus `storyweaver-session-to-episode` for session-to-Chronicle work.

## Portable Companion Smoke Surfaces

Sibling companions provide read-only verification surfaces when Copilot plugin loading is not the active test path:

| Companion | Smoke command from repo root | Notes |
| --- | --- | --- |
| Gemini | `gemini -p "$(cat gemini/miadi-storyweaver-orchestration-kit/prompts/smoke-test.md)"` | Reads the Copilot kit as source material through `GEMINI.md`. |
| Claude Code | `claude -p "$(cat claude-code/miadi-storyweaver-orchestration-kit/prompts/smoke-test.md)" --add-dir /workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs` | Reads the Copilot kit and RISE specs as repository context through `--add-dir`. |
| Codex | `python3 /home/mia/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py codex/miadi-storyweaver-orchestration-kit` | Validates the Codex-native plugin metadata and skill surface before installation. |

Both smoke prompts are read-only. They should report the available agents, skills, route values, source-ledger labels, and packet-prep boundaries for Storyweaver voice, visual, foundations, StoryForms, and Chronicle episode work.

Deterministic file validation lives at:

```bash
python3 copilot/miadi-storyweaver-orchestration-kit/scripts/validate-storyweaver-kit.py
```

## Iris/Hermes Operator Map

This kit is designed so a future Iris/Hermes supervisor can delegate without rediscovering the workflow:

| Operator question | Fast answer |
| --- | --- |
| What launches first? | `storyweaver-session-bootstrap`, followed by `storyweaver-brief-intake` if no accepted brief exists. |
| Which agent owns routing? | `Storyweaver Orchestration Architect`. |
| Which file shows resume state? | `.storyweaver/<slug>/state.md`. |
| Which file shows produced artefacts? | `.storyweaver/<slug>/artefact-index.md`. |
| Which skill handles real sessions? | `storyweaver-session-to-episode`. |
| Which skill handles voice archives? | `storyweaver-voice-episode-packet`. |
| Which skill handles image prompt packets? | `storyweaver-visual-chronicle-seed`. |
| Which skill handles foundations research? | `storyweaver-foundations-bridge`. |
| When must work pause? | `ask-human`, `pause`, or `do-not-proceed` route in review, protocol, continuity, or canon-shaping decisions. |

Delegation rule: the orchestration architect names the next agent, the governing skill, required inputs, outputs to inspect, route status, and next handoff in `state.md` before the session advances.

## Agents

| Agent | Responsibility |
| --- | --- |
| `Storyweaver Orchestration Architect` | Coordinates full RISE-aligned story and Chronicle sessions, owns routing and `state.md`. |
| `Creative Brief Archaeologist` | Separates creative intent from operational instruction and writes the initial brief. |
| `World And Character Architect` | Builds the story bible, world rules, characters, arcs, relationships, and motifs. |
| `Narrative Research Weaver` | Synthesizes sources into research packs while separating sourced detail from invention. |
| `Outline Architect` | Creates outline, beat map, and chapter or scene contracts. |
| `Scene Writer` | Drafts bounded chapter, scene, or beat waves from accepted contracts. |
| `Continuity Keeper` | Maintains facts, character state, world rules, timelines, promises, and payoff obligations. |
| `Developmental Editor` | Reviews structure, pacing, stakes, scene purpose, and character movement. |
| `Critique Reviewer` | Applies skeptical pressure and produces route decisions. |
| `Revision Weaver` | Applies selected review guidance while preserving accepted intent and voice. |
| `Line Editor` | Polishes accepted prose after structural decisions are settled. |
| `Cultural Protocol Steward` | Creates consent-aware pause points for sensitive material. |
| `Export Steward` | Assembles final story packets, metadata, provenance, and closure notes. |
| `Chronicle Episode Steward` | Turns meaningful sessions into auditable episode packets without fictionalizing facts. |
| `Voice Episode Producer` | Prepares `script.md`, `narration.txt`, `revision-notes.md`, `episode.yaml`, and index guidance. |
| `Visual Chronicle Prompt Artist` | Prepares durable visual prompts and generation notes for later Hermes/xAI execution. |
| `StoryForms And Beats Cartographer` | Extracts StoryForms, StoryBeats, Story Setting, related work, and follow-up commissions. |
| `Foundations Research Steward` | Bridges academic or infrastructure research into story source ledgers and chronicle seeds. |

## Skills

| Skill | Use |
| --- | --- |
| `storyweaver-session-bootstrap` | Start or resume `.storyweaver/<slug>/` with charter, state, and index. |
| `storyweaver-brief-intake` | Preserve the original prompt and extract creative brief, constraints, and protocol notes. |
| `storyweaver-story-bible` | Build the story foundation, character arcs, relationship map, and first continuity ledger. |
| `storyweaver-outline-and-beats` | Create outline, beat map, chapter contracts, and outline review route. |
| `storyweaver-chapter-wave` | Draft chapter, scene, or beat waves and route through continuity and review. |
| `storyweaver-review-loop` | Run developmental, critique, and protocol review against an artefact. |
| `storyweaver-continuity-ledger` | Update story facts, timelines, promises, source-dependent details, and risks. |
| `storyweaver-cultural-protocol-check` | Pause or bound work involving Indigenous knowledge, living cultures, trauma, privacy, or consent-sensitive material. |
| `storyweaver-export-packet` | Assemble story manuscript, metadata, ledgers, reviews, revision dossier, and closure note. |
| `storyweaver-session-to-episode` | Convert meaningful sessions into source-led Chronicle episode packets. |
| `storyweaver-storyforms-and-beats` | Extract StoryForms, StoryBeats, Story Setting, related work, and follow-up commissions. |
| `storyweaver-voice-episode-packet` | Prepare a voice-episode archive packet inspired by `~/.hermes/voice-episodes/miadi-chronicle`. |
| `storyweaver-visual-chronicle-seed` | Create prompt packets and generation notes for Miadi Chronicle visuals. |
| `storyweaver-foundations-bridge` | Turn research foundations into source-led story and Chronicle seeds. |

## Workspace Shape

Default story workspace:

```text
.storyweaver/<story-slug>/
  session-charter.md
  state.md
  artefact-index.md
  inputs/original-prompt.md
  creative-brief.md
  constraints.md
  protocol-notes.md
  story-bible.md
  character-arcs.md
  relationship-map.md
  timeline.md
  continuity-ledger.md
  research/research-pack.md
  research/source-ledger.md
  outline.md
  beat-map.md
  chapter-contracts/
  chapters/
  scenes/
  reviews/
  revision-log.md
  exports/
    story.md
    story-metadata.json
    story-packet.md
    revision-dossier.md
    closure-note.md
```

Optional Chronicle branch:

```text
.storyweaver/<story-slug>/
  episodes/<session-id>/
    episode.md
    source-ledger.md
    story-setting.md
    storybeats.jsonl
    storyforms.md
    related-work.md
    followup-commissions.md
    voice/
      script.md
      narration.txt
      revision-notes.md
      episode.yaml
      index-update.md
    visuals/
      prompt-packet.md
      generation-notes.md
      reference-policy.md
```

## Chronicle And Voice Rules

- Session episodes are nonfiction memory artefacts. Keep source facts, inferences, and poetic framing separate.
- Voice packets follow the `~/.hermes/voice-episodes/miadi-chronicle` pattern as an export shape only: `script.md`, `narration.txt`, `revision-notes.md`, `episode.yaml`, source/context files, indexes, and split/recovery notes when long.
- Visual chronicle work creates prompt packets only. This kit does not generate images.
- For identity-sensitive image editing, preserve Miadi identity through reference-image discipline: keep stable facial identity, body continuity, clothing markers, lighting intent, and scene relation explicit.
- Visual prompts should normally include no visible text, no speech bubbles, no watermark, no captions unless a human explicitly requests otherwise.
- A research idea such as "Distributed Remote Presence" or "Peripheral Bridging" can be used as an example of infrastructure research becoming a daily Chronicle episode, but the kit does not hard-code current content.

## Hard Boundaries

- No dependency on `/src/Miadi`, `jgwill/storytelling`, LangGraph, FAISS, or any Python storytelling package.
- Do not present unsourced claims as research-backed.
- Do not fictionalize operational session facts inside source ledgers.
- Do not continue sensitive cultural, personal, sacred, private, or real-community material when the protocol route is `ask-human` or `do-not-proceed`.
- Do not package unresolved drafts as final unless `state.md` clearly marks the risk.
- Do not erase uncertainty around Tushell, Miadi, or Chronicle canon boundaries. Preserve productive tension and route canon-shaping moves through review gates.

## Portable Companions

A lightweight Gemini CLI companion lives at `gemini/miadi-storyweaver-orchestration-kit/`. It mirrors this pipeline as prompt guidance for free-model portability when Copilot plugins are unavailable.

A lightweight Claude Code companion lives at `claude-code/miadi-storyweaver-orchestration-kit/`. It uses `claude -p` plus `--add-dir` to read the Copilot kit and RISE specs as canonical context for smoke checks and session bootstrap handoffs.

A Codex-native plugin lives at `codex/miadi-storyweaver-orchestration-kit/`. It exposes the Storyweaver skill tree through Codex `SKILL.md` files, agent reference notes, templates, and `.codex-plugin/plugin.json`.
