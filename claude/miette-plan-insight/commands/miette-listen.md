---
description: In a Miette seat, wait for the next version of the plan this seat reads
argument-hint: "[status | stop]"
---

Run the miette-plan-insight listener for this seat. Arguments: `$ARGUMENTS`

1. `status`: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/miette-plan-insight.mjs" status` and report it in one or two lines.
2. `stop`: stop the running background `miette-plan-insight.mjs listen` task with TaskStop, then say so.
3. No argument: start the listener with Bash `run_in_background: true`:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/miette-plan-insight.mjs" listen
   ```

   Exit 5 means another listener already waits for this seat: say which one. Exit 3 means this
   pane is not a Miette seat: say so.

When the background task exits with a `MIETTE WAKE`, follow the miette-plan-insight skill's turn
for a new plan version, then re-arm with `/miette-listen`. The listener has no
deadline, so it ends only when a plan version arrives. Exit 4 comes only from a `--timeout`
someone gave it: re-arm without writing to William, and without `--timeout`.
