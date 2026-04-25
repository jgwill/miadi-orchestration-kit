---
name: stckin-orchestration-scaffold
description: 'Scaffold or refine a Miadi-native Copilot orchestration kit by adapting source plugin patterns to STCKin, deep-search, and artefacted session work.'
---

Use this skill when asked to create, reorganize, or strengthen a Copilot kit in `miadi-orchestration-kit/copilot/`.

Workflow:
1. Read `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/AGENTS.md`.
2. Inspect the target kit folder and any existing `.github/plugin/plugin.json`, `README.md`, `agents/`, and `skills/`.
3. Study representative patterns from `/workspace/repos/miadisabelle/mia-awesome-copilot`:
   - one plugin with agents,
   - one plugin with multiple skills,
   - one representative standalone agent.
4. Extract only the packaging and prompt conventions that help Miadi orchestration.
5. Create or update:
   - plugin manifest,
   - kit README,
   - Miadi-specific agents,
   - Miadi-specific skills.
6. Ensure launch instructions include `copilot --plugin-dir` and the required `--add-dir` surfaces.
7. Keep the kit focused on reusable orchestration behavior, not generic code generation.

Design constraints:
- prefer one strong first-wave kit over several shallow kits
- reference structural tension, STC hooks, and artefact folders when relevant
- avoid unrelated edits outside `miadi-orchestration-kit`
