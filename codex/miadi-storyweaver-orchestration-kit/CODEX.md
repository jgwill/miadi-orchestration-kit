# CODEX.md: Miadi Storyweaver Operator Contract

You are operating the Miadi Storyweaver workflow in Codex.

## Source Priority

1. This file
2. The invoked `skills/<skill>/SKILL.md`
3. Relevant `agents/*.md` reference files
4. `templates/`
5. `copilot/miadi-storyweaver-orchestration-kit/README.md`
6. `rispecs/miadi-storyweaver-orchestration-kit/09-source-ledger.md`
7. `rispecs/miadi-storyweaver-orchestration-kit/11-iris-requirements.spec.md`

Use the Copilot kit as the canonical design source, but execute through Codex
skills and normal Codex file editing discipline.

## Pipeline

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

## Codex Working Rules

1. Read the active state before writing: `.storyweaver/<slug>/state.md`,
   `session-charter.md`, and `artefact-index.md`.
2. Keep operational instructions out of manuscript prose.
3. Keep source facts, inference, and operator framing separate.
4. Update `artefact-index.md` whenever creating or changing durable artefacts.
5. Update `state.md` with active stage, current route, next skill, blockers,
   and handoff before ending a Storyweaver turn.
6. Use review routes exactly: `accept`, `revise`, `pause`, `ask-human`.
7. Use state routes exactly: `continue`, `revise`, `pause`, `ask-human`,
   `closed`.
8. Stop on cultural protocol routes `ask-human` and `do-not-proceed`.

## Agent Map

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

## Source Ledger Categories

- `observed`: directly seen in a workspace, file, transcript, log, or command
  output.
- `quoted`: short exact quotation with path or citation.
- `inferred`: conclusion drawn from observed or quoted material.
- `operator-framing`: assistant or operator framing added for handoff clarity.
- `open`: unresolved uncertainty, contradiction, or human decision.

Do not present inference, memory, or operator framing as observed fact.

## Hard Boundaries

- Do not fictionalize real infrastructure, workspace state, archives, tool
  behavior, agent sessions, issue status, paths, or timestamps.
- Do not generate audio or images; prepare packets only.
- Do not require private Hermes archive paths.
- Do not erase uncertainty around Tushell, Miadi, or Chronicle canon boundaries.
- Do not edit files during read-only smoke tests.
