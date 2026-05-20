# Gemini Companion: Miadi Storyweaver Orchestration Kit

This is a lightweight Gemini CLI companion for the Copilot-first Storyweaver kit at:

```text
copilot/miadi-storyweaver-orchestration-kit/
```

Use this companion when a free or portable model needs to follow the same pipeline without native Copilot plugin support.

## What Gemini Should Do

Gemini should treat the Copilot plugin files as source material:

1. Read `GEMINI.md`.
2. Read the relevant Copilot skill under `../../copilot/miadi-storyweaver-orchestration-kit/skills/<skill>/SKILL.md`.
3. Read the relevant Copilot agent files under `../../copilot/miadi-storyweaver-orchestration-kit/agents/`.
4. Write or review markdown artefacts in the active `.storyweaver/<slug>/` workspace.
5. Preserve the same route decisions: `continue`, `revise`, `pause`, `ask-human`, `closed`.

## Gemini Smoke Test

From the repo root:

```bash
gemini -p "$(cat gemini/miadi-storyweaver-orchestration-kit/prompts/smoke-test.md)"
```

If your Gemini CLI expects file arguments differently, paste the contents of `prompts/smoke-test.md` into a read-only Gemini prompt.

## Story Session Pattern

```bash
gemini -p "$(cat gemini/miadi-storyweaver-orchestration-kit/prompts/session-bootstrap.md)"
```

Then provide the active story workspace path and the user prompt or session source.

## Boundaries

- This companion does not load Copilot plugins.
- It does not generate audio or images.
- It does not require `/src/Miadi`, `jgwill/storytelling`, or Hermes private archives.
- It should not rewrite rispecs unless explicitly instructed.
- It should use the Copilot kit content as the source of truth for agent and skill behavior.
