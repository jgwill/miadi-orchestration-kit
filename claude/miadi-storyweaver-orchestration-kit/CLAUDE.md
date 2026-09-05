# CLAUDE.md: Miadi Storyweaver Portable Operator Contract

You are operating the Miadi Storyweaver workflow in Claude Code. Follow the Copilot kit as canonical source material, even though this companion is not itself a Copilot plugin.

## Source Priority

1. `copilot/miadi-storyweaver-orchestration-kit/README.md`
2. `copilot/miadi-storyweaver-orchestration-kit/.github/plugin/plugin.json`
3. Relevant `copilot/miadi-storyweaver-orchestration-kit/skills/*/SKILL.md`
4. Relevant `copilot/miadi-storyweaver-orchestration-kit/agents/*.md`
5. `rispecs/miadi-storyweaver-orchestration-kit/README.md`
6. `rispecs/miadi-storyweaver-orchestration-kit/09-source-ledger.md`
7. `rispecs/miadi-storyweaver-orchestration-kit/11-iris-requirements.spec.md`

Do not fork or re-author the canonical skill tree inside Claude companion files. Summarize only what is needed for routing, verification, and handoff.

## Pipeline

Use the same Storyweaver stages:

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

## Route Values

Use only these route values in `state.md` and review notes unless a specific canonical skill says otherwise:

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

## Source Ledger Discipline

Maintain source categories explicitly:

- `observed`: directly seen in the workspace, source file, transcript, session log, or command output.
- `quoted`: a short exact quotation from a source, with path or citation.
- `inferred`: a conclusion drawn from observed or quoted material.
- `operator-framing`: Iris/Hermes or assistant framing added to make the handoff usable.
- `open`: unresolved uncertainty, missing evidence, or a question needing human review.

Do not present inference, memory, or operator framing as observed fact.

## Audience Lanes

When a task names a lane, privilege that lens without dropping the others:

| Lane | Output emphasis |
| --- | --- |
| Academic and foundations | Source-led claims, citations, uncertainty, ethical cautions, and research-to-story bridges. |
| Operator and engineering | Paths, state files, validation commands, route values, reproducible handoff, and known caveats. |
| Chronicle and narrative | Episode shape, continuity, storyforms, voice packet preparation, visual prompt packets, and relational story context. |

## Non-Negotiables

- Separate operational instructions from creative prose.
- Preserve source facts, inference, and poetic framing as distinct categories.
- Do not fictionalize real infrastructure, workspace state, archives, tool behavior, agent sessions, or issue status.
- Do not erase uncertainty around Tushell, Miadi, or Chronicle canon boundaries.
- Do not generate audio or images. Prepare packets for later tools only.
- Do not require private Hermes paths. Mention them only as optional archive-shape inspiration.
- Do not edit files during read-only smoke tests.

