# Claude Code Companion: Miadi Storyweaver Orchestration Kit

This is a lightweight Claude Code companion for the Copilot-first Storyweaver kit at:

```text
copilot/miadi-storyweaver-orchestration-kit/
```

Use this companion when Claude Code needs to verify, route, or prepare Storyweaver artefacts from the same canonical Copilot skill tree and RISE specs. It is a prompt and context wrapper, not a fork of the kit.

## Source Contract

Claude Code should treat the Copilot kit and rispecs as source material:

1. Read `CLAUDE.md`.
2. Read `copilot/miadi-storyweaver-orchestration-kit/README.md`.
3. Read `copilot/miadi-storyweaver-orchestration-kit/.github/plugin/plugin.json`.
4. Read the relevant `copilot/miadi-storyweaver-orchestration-kit/skills/<skill>/SKILL.md`.
5. Read the relevant `copilot/miadi-storyweaver-orchestration-kit/agents/*.md`.
6. Use `rispecs/miadi-storyweaver-orchestration-kit/` for RISE intent, quality gates, source ledger, and Iris/Hermes operator requirements.

## Launch

From the repo root, run a read-only smoke check:

```bash
claude -p "$(cat claude-code/miadi-storyweaver-orchestration-kit/prompts/smoke-test.md)" \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs
```

For a story session bootstrap:

```bash
claude -p "$(cat claude-code/miadi-storyweaver-orchestration-kit/prompts/session-bootstrap.md)" \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs \
  --add-dir <story-workspace-or-project>
```

No Claude plugin directory is required for this companion. Claude Code consumes the Copilot plugin files as repository context through `--add-dir`.

## Claude Smoke Test

The smoke prompt is read-only. It asks Claude Code to:

1. Name the Storyweaver agents.
2. Name the Storyweaver skills.
3. Identify which skill starts a new story from a prompt.
4. Identify which skill turns a meaningful session into a Chronicle episode packet.
5. Identify the voice, visual, foundations, and StoryForms packet skills.
6. List accepted route values.
7. State whether the companion is enough for an Iris/Hermes operator smoke test.

## Boundaries

- Do not fictionalize real infrastructure, workspace state, session facts, agents, archives, or tool behavior.
- Do not duplicate large sections of the Copilot skills into this companion. Link back to the canonical skill files.
- Do not require private Hermes archive paths. Private paths may be mentioned only as optional archive-shape inspiration.
- Voice and image work are packet-prep only. Prepare scripts, narration text, prompt packets, reference policies, and generation notes; do not claim to generate audio or images.
- Preserve source ledger discipline: `observed`, `quoted`, `inferred`, `operator-framing`, and `open`.

## Audience Lanes

| Lane | Claude Code focus |
| --- | --- |
| Academic and foundations | Keep claims source-led, mark uncertainty, bridge research into source ledgers, and avoid turning inference into citation. |
| Operator and engineering | Preserve paths, route values, state files, validation commands, handoff notes, and reproducible verification. |
| Chronicle and narrative | Shape episode, voice, visual, StoryForms, and story artefacts while separating nonfiction session memory from poetic framing. |

