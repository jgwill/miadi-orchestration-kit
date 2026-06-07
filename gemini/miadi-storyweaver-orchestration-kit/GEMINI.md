# GEMINI.md: Miadi Storyweaver Portable Operator Contract

You are operating the Miadi Storyweaver workflow in Gemini CLI. Follow the Copilot kit as source material, even though Gemini does not load the plugin format directly.

## Source Priority

1. `copilot/miadi-storyweaver-orchestration-kit/README.md`
2. `copilot/miadi-storyweaver-orchestration-kit/.github/plugin/plugin.json`
3. Relevant `copilot/miadi-storyweaver-orchestration-kit/skills/*/SKILL.md`
4. Relevant `copilot/miadi-storyweaver-orchestration-kit/agents/*.md`
5. `rispecs/miadi-storyweaver-orchestration-kit/README.md`
6. `rispecs/miadi-storyweaver-orchestration-kit/11-iris-requirements.spec.md`

## Pipeline

Use the same stages:

```text
storyweaver-session-bootstrap
  -> storyweaver-brief-intake
  -> storyweaver-story-bible
  -> storyweaver-foundations-bridge, optional
  -> storyweaver-outline-and-beats
  -> storyweaver-review-loop
  -> storyweaver-chapter-wave
  -> storyweaver-continuity-ledger
  -> storyweaver-review-loop
  -> storyweaver-export-packet
  -> storyweaver-session-to-episode, optional
  -> storyweaver-storyforms-and-beats, optional
  -> storyweaver-voice-episode-packet, optional
  -> storyweaver-visual-chronicle-seed, optional
```

## Agent Mapping

| Stage | Agent |
| --- | --- |
| Routing and state | Storyweaver Orchestration Architect |
| Brief intake | Creative Brief Archaeologist |
| Bible | World And Character Architect |
| Research | Narrative Research Weaver |
| Outline | Outline Architect |
| Draft | Scene Writer |
| Continuity | Continuity Keeper |
| Developmental review | Developmental Editor |
| Critique | Critique Reviewer |
| Revision | Revision Weaver |
| Line edit | Line Editor |
| Protocol | Cultural Protocol Steward |
| Export | Export Steward |
| Session episode | Chronicle Episode Steward |
| Voice packet | Voice Episode Producer |
| Visual prompt packet | Visual Chronicle Prompt Artist |
| StoryForms and beats | StoryForms And Beats Cartographer |
| Foundations bridge | Foundations Research Steward |

## Iris/Hermes Acceptance Signal

Before ending a Gemini turn, make sure a supervising operator can answer:

- What should launch next?
- Which agent owns the phase?
- Which skill writes the required artefacts?
- What files should exist after completion?
- When must work pause for review or consent?
- How does this package as story, Chronicle episode, voice packet, visual prompt packet, or foundations bridge?

## Route Values

Use only these route values in `state.md` and review notes:

- `continue`
- `revise`
- `pause`
- `ask-human`
- `closed`

Review agents may use:

- `accept`
- `revise`
- `pause`
- `ask-human`

Protocol agents may use:

- `continue`
- `continue-with-boundaries`
- `ask-human`
- `do-not-proceed`

## Non-Negotiables

- Separate operational instructions from creative prose.
- Preserve source facts, inference, and poetic framing as distinct categories.
- Do not fictionalize real infrastructure or agent sessions.
- Do not erase uncertainty around Tushell, Miadi, or Chronicle canon boundaries.
- Do not generate audio or images. Prepare packets for later tools.
- Do not require private Hermes paths. Mention them only as optional archive-shape inspiration.
