# Iris Requirements for the Miadi Storyweaver Kit

## Purpose

This note gives the implementation agent explicit context about Iris/Hermes as a future operator of the Storyweaver kit. It should inform the kit's README, agent roster, skills, and smoke-test guidance without hardcoding private runtime paths as required dependencies.

## Who Iris Is In This Context

Iris is a Hermes Agent / orchestration operator who can supervise, delegate, and resume autonomous agent work across tools such as Codex, Copilot, Gemini CLI, Claude Code, tmux panes, local files, GitHub issues, and durable skill/episode archives.

The kit is partly being built for Iris: a future Iris/Hermes session should be able to use the kit to coordinate a high-quality Miadi Chronicle, story chapter, book section, or session-to-episode extraction without rediscovering the pipeline from scratch.

## Iris Operating Needs

The kit should make these things easy for a supervising agent:

1. Identify which agent to delegate next.
2. Know which skill to invoke for each pipeline stage.
3. See required inputs and outputs for every stage.
4. Preserve provenance: prompts, sources, session context, review notes, and human choices.
5. Separate operational instructions from story prose.
6. Support both story creation and session-to-episode chronicle extraction.
7. Produce durable packets that can move between Hermes, Copilot, Gemini CLI, and future Miadi runtime agents.
8. Avoid fictionalizing source facts when transforming real infrastructure or agent sessions into chronicle material.
9. Surface pause/consent gates before culturally sensitive, canon-shaping, or major revision moves.
10. Provide smoke-test commands and copy-pastable launch prompts.

## Chronicle-Specific Capabilities Iris Needs

The kit should include guidance for:

- Miadi Chronicle episode packets with `script.md`, `narration.txt`, `revision-notes.md`, `episode.yaml`, source/context notes, and index-update guidance.
- StoryForms and StoryBeats extraction from real sessions.
- Story Setting extraction that preserves actual places, tools, repos, and agents without turning them into unsupported lore.
- Follow-up commissions: concrete next creative, research, engineering, or visual tasks generated from a session.
- Visual chronicle prompt packets: prompts, exclusions, reference-image notes, generation-notes template, and archive placement guidance. The kit should prepare these packets; it should not require image-generation capability itself.
- Foundations bridge packets for academic/engineering/narrative audiences, modeled by the Distributed Remote Presence / Peripheral Bridging example.

## Portability Requirement

The Copilot plugin is the primary implementation target, but Iris also needs free/portable invocation patterns. The Gemini companion should therefore include:

- a concise GEMINI.md or equivalent prompt contract;
- the same pipeline stages and agent/skill mapping in Gemini-friendly language;
- instructions for using the Copilot plugin content as source material if Gemini CLI does not support the same plugin format;
- a read-only smoke-test prompt.

## Non-Goals

- Do not require `/src/Miadi`, `jgwill/storytelling`, or Hermes private archives at runtime.
- Do not bake the current Miadi Chronicle content into the kit as required data.
- Do not generate audio or images directly inside the plugin.
- Do not erase uncertainty around Tushell/Miadi canon boundaries; preserve productive tension and route it through review gates.

## Acceptance Signal

A future Iris/Hermes operator can open the kit and quickly answer:

- What should I launch first?
- Which agent owns this phase?
- Which skill writes the required artefacts?
- What files should exist after the phase completes?
- When must I stop for review or consent?
- How do I package this as story, chronicle episode, voice packet, visual prompt packet, or foundations bridge?
- How do I run a cheap/read-only smoke test with Copilot or Gemini CLI?
