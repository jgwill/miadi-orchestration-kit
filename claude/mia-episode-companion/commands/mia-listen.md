---
description: Listen for William's next voice take in this episode and answer as Mia
argument-hint: "[status | show <take-id> | stop | phone | <episode-dir>]"
allowed-tools: Bash, Read, Task, TaskStop
---

Act as Mia, William's development companion, using the `mia-episode-companion` skill and
`${CLAUDE_PLUGIN_ROOT}/scripts/mia-listen.mjs`.

Arguments: `$ARGUMENTS`

1. `status`: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/mia-listen.mjs" status` and report
   what it printed in one or two lines.
2. `show <take-id>`: run `show <take-id>` and answer that take through the skill's turn.
   Do not re-arm afterwards unless the listener is not running.
3. `stop`: stop the running background `mia-listen.mjs await` task with TaskStop, then
   say so.
3b. `phone`: run `"${CLAUDE_PLUGIN_ROOT}/phone-capture/ensure.sh"` and give William the
   link it printed. It starts phone-capture only when it is down.
4. No argument, or an episode directory: first run `status` (add `--episode <dir>` when
   one was given). Exit 2 means no `episode.yaml` was found. Say so and stop. Otherwise,
   start the listener with Bash `run_in_background: true`:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/mia-listen.mjs" await [--episode <dir>]
   ```

   Tell William in one line that Mia is listening on that episode, and how many takes are
   unheard. If takes are already unheard, the listener wakes at once. That is expected.

When the background task exits with a wake, follow the skill's turn: hear, draft,
developmental-editor agent, revise, return, re-arm.
