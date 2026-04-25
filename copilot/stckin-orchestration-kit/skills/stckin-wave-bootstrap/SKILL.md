---
name: stckin-wave-bootstrap
description: 'Bootstrap Miadi STCKin and orchestration-kit work by studying mia-awesome-copilot, Miadi STC hooks, and prior deep-search artefacts before editing.'
---

Use this skill when launching a Copilot session for Miadi STCKin or orchestration-kit work.

Process:
1. Read `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/AGENTS.md`.
2. Study `/workspace/repos/miadisabelle/mia-awesome-copilot/{agents,skills,plugins}` for plugin conventions.
3. Study `/src/Miadi/.github-hooks/stc*`, `/src/Miadi/scripts/mino-bimaadizi-daa-stc.sh`, and `/src/Miadi/rispecs/skills/mcp/06-stc.spec.md`.
4. Read deep-search context from the two prior artefact folders and the current session artefact folder.
5. Prefer small, focused edits that preserve unrelated work already present in `/src/Miadi`.
6. Expand or refine a reusable plugin kit under `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/`.
7. Leave replayable notes in the current artefact folder summarizing what you created, what you deferred, and how to relaunch the next wave.

Deliverables:
- a coherent plugin folder with `agents/`, `skills/`, and `.github/plugin/plugin.json`
- README guidance with `copilot --plugin-dir` and `--add-dir`
- artefact notes that list findings, created files, and next actions
