## Context

On 2026-11-19, session `5ffaf964-f4cb-470d-a1da-35fdd040073a`
(miadi-tmux://mia@gaia:t1-exit-not-on-completion-2611190727) was measuring why sessions end, for
the specification rispecs/session-exit-reasons/ in jgwill/miadi-orchestration-kit.

- `cd /src/_sessiondata && cat */_claude_SessionEnd.jsonl | jq -r '.reason'` was refused by
  miadi-session-observability's `session_lookup_guard.sh`. The refusal named the interpreter's
  verbs: `join`, `digest`, `fleet`, `search`. None answers how or why sessions ended.
- `digest <id> --json` and `session <id> --json` (`@miadi/hooks-interpreter` 0.12.0) carry no
  model and no end reason. Their keys: `binding, commits, creations, cwd, files_written,
  last_reply, memories, mission, plans, prompts, prs, published, pushes, session_dir,
  session_id, state, subagent_replies, tool_counts, transcript_path, typed_last, window` for
  `digest`.
- `fleet --json` projects 25 sessions by default and carries no end reason or model either.
- The end reasons were counted from the binding line, which the guard allows. The model each
  session ran (`_claude_session_starts.jsonl` field `model`, transcript `message.model`) has no
  allowed door.
- Earlier in the same session, a read through a shell variable
  (`jq … $D/_claude_session_starts.jsonl`) passed the guard, which reads command text only.
- jgwill/Miadi#1060 had to read a transcript by hand to show that session `675a74db` ran Sonnet.

## Desired State

`miadi-hooks-interpret exits [--since] [--until] [--headless | --all] [--json]` lists one row per
ended session with its end reason, the model named at launch, started on and answered with,
whether it was resumed after, its inventory status and its `exit` block when present, and sessions
with no end line with their last activity. `digest <id>` carries `model` and `end`. An agent
answers "how and why did sessions end" and "which model did it run" without reading the raw
capture, and the guard names the verb.

## Action Steps

- [ ] `exits` with the `ExitEvent` row of rispecs/session-exit-reasons/03-specify.md S3, interactive by default
- [ ] The summary: counts by end reason and by `exit.kind`, no end line, model differing from launch, resumed after an exit
- [ ] `digest` gains `model: {launch, started, answered}` and `end: {at, reason, captured, exit_kind}`
- [ ] Gates G1 to G3 of rispecs/session-exit-reasons/04-export.md on gaia
- [ ] Release, then the guard's refusal text in jgwill/miadi-orchestration-kit names `exits` (G8)

## Structural Tension

The guard sends agents to the interpreter for questions about sessions, and the interpreter has
no verb for how a session ended or which model it ran. So the legitimate question is either
refused or answered by going around the guard. The verb in the interpreter is what lets the
guard stay on and the question be answered.

## Related

- Parent: jgwill/miadi-orchestration-kit#160, the self-improvement cycle. This is step 1 of its build order (rispecs/self-improvement-cycle/03-specify.md): every scorer reads sessions through `exits`.
- jgwill/miadi-orchestration-kit rispecs/session-exit-reasons/ (S3)
- jgwill/miadi-orchestration-kit#56 (the capture plugin and its lookup guard)
- jgwill/Miadi#1060, jgwill/Miadi#1028 (wrong-model cases read by hand)
- The kit's exit-reasons issue: jgwill/miadi-orchestration-kit#162
