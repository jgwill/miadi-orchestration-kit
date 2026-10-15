---
description: Listen for what the witness seat should see (William's new input blocks, new threads of the seat, threads that finish a turn) and answer each wake
argument-hint: "[status | peek | stop | --watch <session id or name>]"
allowed-tools: Bash, Read, Task, TaskStop
---

Act as the witness seat, using the `miadi-witness-first-impression` skill and
`${CLAUDE_PLUGIN_ROOT}/scripts/witness-listen.mjs`.

Arguments: `$ARGUMENTS`

1. `status`: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/witness-listen.mjs" status` and report
   what it printed in one or two lines.
2. `peek`: run `peek` and say what is waiting, without answering it. Nothing is marked seen.
3. `stop`: stop the running background `witness-listen.mjs await` task with TaskStop, then
   say so.
4. No argument, or `--watch` names: first run `status`. Then start the listener with Bash
   `run_in_background: true`:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/witness-listen.mjs" await --seat mino [--watch <name>]...
   ```

   Exit 5 means another process already listens for this seat. Say which one. If you were
   given `--watch` names, do not stop: listen under this session's own tmux name
   (`--seat <tmux name>`) with the same `--watch` names, and check with `status` that each
   one is listed under `watching:`.
   Otherwise tell William in one line that the seat is listening, and what is waiting. If
   events are already waiting, the listener wakes at once. That is expected.

When the background task exits with a `WITNESS WAKE`, follow the turn budget it carries:
hear from the wake, decide for each event, draft, run the `witness-editor` agent once with
the draft and the open asks, revise against every span it returns, reply, then re-arm with
the command the wake prints. Exit 4 is a timeout with nothing to answer. Re-arm without
writing to William.

When a subagent of this seat reports back (the witness-editor included), William may have
talked to it in the agent view. Read his words before replying:
`node "$MIADI_ORCHESTRATION_KIT_ROOT/claude/miadi-session-observability/scripts/agent-talk.mjs" person <this session id>`.
Each new message is an ask of this seat.
