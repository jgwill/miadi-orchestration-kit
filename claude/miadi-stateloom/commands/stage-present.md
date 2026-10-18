---
description: Prepare a walkthrough of a design on the live stateloom canvas and play it for the person — a tour over the real drawings, each step a drawing, what to light, and one sentence.
argument-hint: "[what to explain, in the person's words] [--system <path.sysdf.json>] [--paused]"
allowed-tools: Read, Task
---

Load the `stateloom-stage` skill (and `stateloom-system` when a system is involved), then present:

Arguments: `$ARGUMENTS`

1. **Know what is on the person's screen.** `read_marks` — what the canvas shows and any marks
   waiting. A mark waiting is part of what to explain; answer it in the tour or in its thread.
2. **Find the drawings.** The system named, else the active document (`get_project_file`), else
   `find . -name '*.sysdf.json'` near the work. `get_notes` on it: the last session's words say why
   it exists.
3. **Draft the tour backstage**: 3 to 8 steps, in the order the person needs to follow it. Each step
   one drawing, one point — `focus` for one element, `spotlight` for several, `region` for an area —
   and `say` in one or two sentences a person can hear. Element names exactly as the drawings write
   them (`list_states`, `get_definition`, `summarize`), as `<kind>:<name>`.
4. **One pass of the `tour-editor` agent.** Send it only what was asked (the arguments, or the
   person's last words) and the drafted steps as JSON. Revise against each recommendation it returns.
5. **Write and play.** `write_tour` (name it after what it explains; `notes` say who asked and why),
   then `play_tour` — `autoplay: false` when `--paused` was given or the person is not watching.
6. Say in one line that the tour is playing (or waiting for ▶), how many steps, and where the file
   is. Do not repeat the captions in the terminal; the canvas carries them.

When the person answers by marking something during the tour, the marks arrive through
`read_marks` / `await_marks`; `/stage-listen` keeps listening for them.
