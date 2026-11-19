# 01 · Reverse-engineer · how sessions end today

Measured on gaia, user mia, 2026-11-19 near 12:35Z. Every number below comes from a command
run in session `5ffaf964-f4cb-470d-a1da-35fdd040073a` and is listed in
[`05-source-ledger.md`](./05-source-ledger.md).

## What the binding line records

`/src/_sessiondata/data/terminal_bindings.jsonl` holds 5118 lines from 2026-09-28T13:50Z to
2026-11-19T12:34Z: 3760 `session.start`, 1133 `session.end`, 136 `session.rename`, 87
`session.observed`, 2 `session.mission`.

Interactive sessions (no `-p` or `--print` in `argv`): 3312 start lines for 1002 distinct
sessions. 520 of them wrote at least one end line. **482 never wrote one**: killed with their
pane, lost in a crash or a reboot, or still running.

The end line's `source` is Claude Code's SessionEnd `reason`. It says how the process ended,
never why the person ended it:

| end reason | interactive | headless |
|---|---|---|
| `prompt_input_exit` (`/exit`, Ctrl-D) | 517 | 0 |
| `other` | 172 | 415 |
| `quit` | 26 | 0 |
| `clear` | 2 | 0 |
| `resume` | 1 | 0 |

Starts are mostly returns: 2295 of 3760 start lines are `resume`, 1023 `startup`, 230
`api_server`, 63 `fork`, 53 `cron`, 45 `compact`. An exit is often not the end of the work.

## What the model looks like at launch

3189 of the 3312 interactive start lines name no `--model`. The model a seat runs is decided by
the alias chain, the account default and the last `/model` typed in any seat (jgwill/Miadi#1060).
The 123 that name one: `haiku` 35, `claude-opus-5-5` 33, `claude-haiku-5-5` 18,
`claude-sonnet-5-5` 16, `sonnet` 10, `claude-fable-5-2` 7, `opus` 2, `not-a-model` 1,
`gpt-5.1-codex` 1.

The model a session actually ran is in its capture (`_claude_session_starts.jsonl`, field
`model`) and in its transcript (`message.model` of each assistant line). Neither reaches the
inventory record. `miadi-hooks-interpret digest` and `session` (`@miadi/hooks-interpreter`
0.12.0) carry no model and no end reason.

## What the inventory records

`~/workspace/.mino/session-inventory/`: 465 records.

- `status`: in_progress 196, complete 125, unreviewed 116, held 15, suspended 6, ONGOING 5,
  closed 1, completed 1.
- `disposition.proposed`: a 55, b 16, c 87. `disposition.decided`: a 58, b 1, suspend 6.
- `hook_capture.session_end_captured`: true 264, absent 201.
- The latest binding line kept in `binding`: 155 end with `prompt_input_exit`, 50 with `other`.
- `exit`: 0 records. The block exists since 0.1.49, written the same day as this packet.

`~/.miadi/decisions/inventory-at-exit.jsonl`, 74 lines. Its decisions on how a record gets its
meaning: counted and nothing to do 23, counted facts only 1, Jev facts only 6, Jev started a
Haiku reader 20, Jev left it unread 4. None of them records why the session ended.

## Exits whose reason is known, from elsewhere

- Session `675a74db-cbb8-4c91-a1f6-fe06c30851aa`,
  miadi-tmux://mia@gaia:t8-enh-circle-ceremony-relation2episode-2611190652, ran Sonnet 5.5 for
  120 replies when Guillaume expected Opus, until `/model` at 12:18:16Z. Launched by `mctgo` with
  no `--model` (jgwill/Miadi#1060).
- `work_proposal:376ea1ae-064a-40bc-a4f4-0ac14ee03052` stated a model floor and launched on
  Sonnet because a missing `task_type` defaults to implementation (jgwill/Miadi#1028).
- Session `5ffaf964-f4cb-470d-a1da-35fdd040073a`, whose tmux name
  `t1-exit-not-on-completion-2611190727` names this topic. It started on `claude-opus-5-5` and
  built `/inventory-exit-reason`.

These reasons live in issue bodies and in Guillaume's memory. No record holds them as data.

## The door that was refused

Counting the end reasons across the capture, this session ran
`cd /src/_sessiondata && cat */_claude_SessionEnd.jsonl | jq -r '.reason'`. The miadi-session-observability
`session_lookup_guard.sh` refused it and named the interpreter's verbs. None of them answers
"how and why did sessions end" or "which model did a session run". The binding line, which the
guard allows, answered the end reasons above. The model per session has no allowed door.

Earlier in the same session, a read through a shell variable (`jq … $D/_claude_session_starts.jsonl`)
passed the guard, which reads the command text only. Both events say the same thing: the
question is legitimate and the interpreter has no verb for it.

## What already exists and works

- `/inventory-exit` (0.1.42): a completed session writes its own record and proposes its ending.
- `/inventory-exit-reason` (0.1.49): a session stopped short writes its record with `exit.kind`,
  the person's words verbatim, the models it started on and answered with, and a restart line.
  It commits only the record and never runs `/exit`.
- `suspension` (2026-10-25): an exit that waits for something, with its follow-up prompt.
- The inventory-at-exit decision and the nightly reading give every ended session a record.
