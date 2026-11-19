# 03 · Specify

Five parts, each usable alone, in the order the loop runs them. S1 exists. S2 to S5 are specified,
not built.

## S1 · The reason at exit (built, 0.1.49)

`/inventory-exit-reason [reason]` in a session the person is closing short.

- **Behavior:** writes the record's facts, then the meaning, then an `exit` block
  `{kind, reason, given_by, given_at, models: {started, answered}, restart}`. `kind` is one of
  `aborted`, `wrong_model`, `wrong_setup`, `superseded`, `other`. `reason` is the person's text
  verbatim. With no text it asks once, with the four kinds as options and free text kept
  verbatim. `status` becomes `aborted`. Uncommitted files go to `artifacts[]` with a held
  decision. Only the record is committed. The person types `/exit`.
- The kinds are a closed list on purpose: a pass counts by kind, and the words carry the detail.
  A new kind is added to SCHEMA.md when a pass shows `other` holding a recurring reason.

## S2 · The reason after exit

Most exits happen without the command: 482 sessions have no end line, and a person often says
why only later ("I killed that one, it was in the wrong folder").

`inventory.mjs exit --session <id> --kind <kind> --reason "<words>" --by "<person>[, via <seat>]" [--at <ISO>]`

- **Behavior:** adds the `exit` block to the record when it has none, with `source: "after"` and
  `given_at` as the time the person said it, not the time the session ended. `models` is filled
  from the interpreter (S3) when it can be. `status` becomes `aborted` when it was `unreviewed`
  or `in_progress`, and stays as it was otherwise.
- When the record already has an `exit` block, the words go to `exit.later[]`
  `{reason, given_by, given_at}`. `reason`, `kind` and `given_by` from the exit stay as written.
- One `observations[]` line names who gave the reason and through which seat.
- It refuses a call with no `--reason`. A seat relaying the person uses their words, not a
  summary.
- The record is committed by path, as S1 does.

## S3 · One view of exits: `miadi-hooks-interpret exits`

The interpreter is the door the lookup guard names, so the question "how and why did sessions
end" gets a verb there.

`miadi-hooks-interpret exits [--since <date>] [--until <date>] [--headless | --all] [--json]`

- **Behavior:** one row per session that ended in the window, interactive by default. A row
  holds the fields of `ExitEvent` below. Sources, all read-only: the binding line for ends,
  starts and resumes, each session's start capture for the model it started on, its transcript
  for the models that answered (bounded by `--max-bytes`), and its inventory record as a dated
  snapshot, as `join` reads it.
- A session with start lines and no end line is listed with `end_reason: null` and
  `last_seen`, so a crash or a killed pane is visible, not dropped.
- **Summary** (printed after the rows, and as `summary` in `--json`): counts by end reason, by
  `exit.kind`, sessions with no end line, sessions whose started model differs from the model
  named at launch or from the one most replies came from, sessions resumed after an exit.
- `digest <id>` gains `model: {launch, started, answered}` and
  `end: {at, reason, captured, exit_kind}`, so a single session answers the same question.
- **The guard:** `session_lookup_guard.sh` lists `exits` and the new `digest` fields in its
  refusal text, under "how and why sessions ended, and which model ran".

## S4 · The investigation pass

A seat (the witness seat by default) reads exits and writes patterns. It runs after the nightly pass
(D2 in STATUS), and is built as `../self-improvement-cycle/` S3 and S4 for the scorer `exit-reason`.

- **Behavior:**
  1. Reads `exits --since <last pass> --json`.
  2. Groups exits with a given reason by `exit.kind`, then by the condition they share: launch
     alias, `mct` team or launcher, model named at launch, cwd, account, the mission or request
     that started the seat. A group of three or more sessions sharing a condition within fourteen days is a pattern (D2).
  3. For exits with no reason, it may propose `inferred_kind` when the evidence is in the row
     (a started model that differs from the launch, a resume into another cwd). These are
     listed apart and never join a pattern's count until a person confirms one.
  4. Matches each pattern to the patterns of earlier passes and to open issues that already name
     its condition (for `wrong_model`: jgwill/Miadi#1060, jgwill/Miadi#1028,
     jgwill/Miadi#1008).
  5. For a new pattern with no issue, drafts an issue body in the five sections and holds it.
     For a pattern whose issue exists, adds its sessions as evidence in the pass file only.
  6. Writes the pass file. It changes no record, opens no issue, and touches no session.
- **Report to the person:** at most five lines. New patterns with their counts, recurring ones,
  displaced ones, and the drafts waiting for a decision.

## S5 · Recurrence

When a pattern's change lands, its `landed` field is filled (by the person or by the seat that
merged it, with the commit or release). Every later pass reports, for that pattern:

- exits matching it since `landed`, and the same count for the same span before it.
- `held` when no matching exit occurred over the next window, `partly` when fewer did, `returned`
  when as many or more did, as `../self-improvement-cycle/` S7 names them. A pattern sharing its
  condition that rose over the same span is reported beside it.

A returned pattern goes back to S4 step 5 with its new sessions. A held one stays listed with its
last count, so it can be reopened.

## Data

### ExitEvent (a row of `exits`)
- `session_id`, `tmux`, `launch_alias`, `cwd`, `account_person`, `team`
- `headless`: true for a `claude -p` child
- `started_at`, `ended_at` (null when no end line), `last_seen`
- `end_reason`: Claude Code's SessionEnd reason, or null
- `model`: `{launch, started, answered: {<model>: <replies>}}`
- `resumed_after`: `{count, first_at}` of starts with source `resume` after this end
- `inventory`: `{file, status, disposition_decided}` as read
- `exit`: the record's `exit` block when present, with `source: "command" | "after"`

### ExitPattern
- `id`: `P1`, `P2`, … kept across passes, shared with `../self-improvement-cycle/`
- `kind`, `title` (the condition in plain words), `condition` (the fields the sessions share)
- `sessions[]`, `count`, `first_seen`, `last_seen`
- `issue`: `owner/repo#n` or the path of a drafted body
- `decided`: `{by, at, choice}` or null
- `landed`: `{at, ref}` or null
- `recurrence`: `{since_landed, before_landed, state: held | partly | returned}` or null

### InvestigationPass
- `at`, `by`, `window: {since, until}`, `exits_read`, `with_reason`, `inferred[]`
- `patterns[]`: ExitPattern
- Kept as `~/workspace/.mino/exit-investigations/<yyMMddHHmm>.json` with a `.md` beside it,
  committed by path in the workspace repository.

## Creative Advancement Scenarios

**Creative Advancement Scenario**: A seat on the wrong model

**User Intent**: Guillaume wants the work done on the model it needs and the cause counted.
**Current Reality**: A seat launched by `mctgo` answers on Sonnet. He expected Opus.
**Natural Progression Steps**:
  1. He types `/inventory-exit-reason wrong model, this needed Opus`.
  2. The record gets `exit.kind: wrong_model`, `models.started: claude-sonnet-5-5` and a restart
     line with `--model claude-opus-5-5`. He types `/exit` and runs the restart line.
  3. The next pass finds three `wrong_model` exits that week, all launched by `mct new` with no
     `--model`, and matches them to jgwill/Miadi#1060.
  4. When the `mct new` change lands, the pass after counts `wrong_model` exits from `mct`
     launches since then.
**Achieved Outcome**: The fix for #1060 is judged by the exits after it, not by memory.
**Supporting Features**: S1, S3, S4, S5.

**Creative Advancement Scenario**: A reason given the next day

**User Intent**: Guillaume wants a session he killed yesterday to say why.
**Current Reality**: The session has no end line and its record is `unreviewed`.
**Natural Progression Steps**:
  1. He tells the witness seat "I killed that one, it was in the wrong folder".
  2. The seat runs `inventory.mjs exit --kind wrong_setup --reason "I killed that one, it was in
     the wrong folder" --by "Guillaume, via the witness seat"`.
  3. `exits` now lists the session with its reason and `source: after`.
**Achieved Outcome**: The reason joins the next pass with the same weight as one given at exit.
**Supporting Features**: S2, S3.

**Creative Advancement Scenario**: The weekly reading

**User Intent**: Guillaume wants to know, in five lines, why seats ended short this week and
what to decide.
**Current Reality**: Reasons are in records, unread together.
**Natural Progression Steps**:
  1. The witness seat runs S4 over the week.
  2. It reports two new patterns with drafted issues, one recurring, one held.
  3. He decides each draft. The seat opens the ones he approves.
**Achieved Outcome**: Each decision is made from counted sessions and leaves a pattern whose
recurrence the next pass reports.
**Supporting Features**: S3, S4, S5.
