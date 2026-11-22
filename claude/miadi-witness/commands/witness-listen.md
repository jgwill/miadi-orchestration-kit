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

`--classify` (off by default) adds Jev's reading under each idle event (J7,
`scripts/wake-classify.mjs`): done, holds_question, idle_no_marks or running, with the move
and the bar. Only a `holds_question` at or above the bar is for William; below the bar, read
the thread yourself. One paid call per idle event; `--classify-dry` sends nothing.

Watch with `--quiet` by default (it implies `--classify`). An idle event Jev reads above its bar
as `running` or `idle_no_marks`, a thread going on by itself or stopping with nothing to report,
is absorbed and the listener keeps waiting. Everything else still wakes the seat. If a wake
still turns out to hold nothing for William, re-arm and write nothing to him: no "nothing new"
line, and no line repeating what has not changed. Guillaume, 2026-11-13: "we don't need an
output if nothing happens from your watchers."

When the background task exits with a `WITNESS WAKE`, follow the turn budget it carries:
hear from the wake, decide for each event, draft, run the `witness-editor` agent once with
the draft and the open asks, revise against every span it returns, reply, then re-arm with
the command the wake prints. Exit 4 is a timeout with nothing to answer. Re-arm without
writing to William.

When a subagent of this seat reports back (the witness-editor included), William may have
talked to it in the agent view. Read his words before replying:
`node "$MIADI_ORCHESTRATION_KIT_ROOT/claude/miadi-session-observability/scripts/agent-talk.mjs" person <this session id>`.
Each new message is an ask of this seat.

## A watch you were given does not stop

Written 2026-11-21 at Guillaume's word, after the seat ended a watch on a remote session that
had been quiet for six hours, and before that sent a "nothing changed" line at every 50-minute
restart: "it's possible that it's going to move in 2 days. Therefore, please don't tell me. And
we need to keep monitoring ... I give you a task to witness another session, you don't stop."

- A session someone asked you to witness is watched until that person says stop, or the session
  closes. Quiet is not an end. A session can move again in two days.
- The watch exits only on a change. It has no timeout that wakes the seat to say nothing. For a
  session `witness-listen.mjs` cannot see, such as a tmux session on another host, run
  `scripts/pane-turn-watch.sh --target <session[:window]> [--ssh <user@host>]` in the
  background. It prints nothing while the pane is quiet and exits when the pane finishes a turn.
- On a wake, read the change, write only what changed for the person (a beat, a chart move, a
  line to them if they would act on it), then re-arm the same command in the same turn.
- A quiet stretch is never reported, not even once. If nothing changed for the person, the turn
  writes nothing to them.
