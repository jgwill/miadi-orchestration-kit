---
name: stckin-artefact-report
description: 'Write replayable findings and next-wave notes into the active Miadi deep-search artefact folder after an orchestration or STCKin work session.'
---

Use this skill near the end of a Copilot wave when the session must leave local artefacts that another wave can resume from.

Report contents:
1. source scan findings from `mia-awesome-copilot` and Miadi STC context,
2. files created or updated in `miadi-orchestration-kit`,
3. concrete launch commands using `copilot --plugin-dir` and `--add-dir`,
4. decisions taken during the wave,
5. deferred work and proposed next steps.

Rules:
- write into the current artefact folder, not into unrelated repos
- describe what actually changed with exact paths
- if remote GitHub actions were blocked, say so and leave a local proposal instead
- keep the report suitable for replay by a later Copilot session
