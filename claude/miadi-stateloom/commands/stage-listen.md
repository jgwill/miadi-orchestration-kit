---
description: Listen for the person's marks on the stateloom canvas — what they point at and say on any drawing — and answer each in its thread, showing what you mean.
argument-hint: "[status | stop | <path to a drawing or .sysdf.json>]"
allowed-tools: Bash, Read, TaskStop
---

Load the `stateloom-stage` skill. The listener is `smcx marks await` (from `@miadi/stateloom-cli`),
run as a background task; its exit wakes this session with what the person marked, what their
canvas shows, and the exact commands to answer and to listen again — the episode companion's
`mia-listen await` pattern, for marks instead of spoken takes.

Arguments: `$ARGUMENTS`

1. `status`: run `npx -y -p @miadi/stateloom-cli smcx --doc "<doc>" marks` and report in one line
   how many marks wait and what the canvas shows.
2. `stop`: stop the running background `marks await` task with TaskStop, then say so.
3. No argument, or a path: the scope is that path, else `STATELOOM_PROJECT_FILE`, else the active
   document (`get_project_file`). A `.sysdf.json` covers every member. Start the listener with Bash
   `run_in_background: true`:

   ```bash
   npx -y -p @miadi/stateloom-cli smcx --doc "<abs path>" marks await --timeout 3600
   ```

   Tell the person in one line that you are listening on that drawing or system.

When the task exits 0 with `NEW MARK FROM …`:

1. Read the wake: what they marked (`elements`, an area), their words, what is on their screen.
   A mark is about those elements — answer that, not something near it.
2. Answer in the thread: `answer_mark {id, text, show: true}` (the canvas lights the marked
   elements with your words as the caption), or the `smcx … marks reply` command the wake prints.
   One or two sentences on the canvas; anything longer goes in your reply to the person.
3. If the answer needs a walk through several drawings, `show_step` them in order, or `/stage-present`.
4. Re-arm with the command the wake printed (background again). Exit 4 is a timeout: re-arm
   silently.

Never edit a `.marks.json` by hand: the tools keep the thread's status right and tell the canvas.
