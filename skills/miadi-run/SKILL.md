---
name: miadi-run
description: >
  Start a terminal mission from one pinned version of a miadiRun prompt
  (`miadiRun-<yyMMddHHmm>-<tmuxName>-<missionName>` in the tracing provider), in six
  verbs: create, resolve, prepare, launch, prompt, observe. Create makes the person's text a
  new prompt version and opens its research trace. The launched seat reads its pinned version
  from the provider with `prompt` and starts the mission without waiting. Prepare pins the version, holds the prompt
  and its research trace on the episode and asks `tide companion open` for its plan,
  and never executes. Launch runs only on the person's explicit word. Every step adds
  a typed observation (research, preparation, execution, return) to the mission's
  trace. Triggers on "miadiRun", "miadi-run", "prepare the mission", "launch the
  mission", "start a session from that prompt", "start a session with that trace",
  a `miadiRun-…` prompt name (with or without the prompt text after it), or a trace id
  given as the source of a mission.
metadata:
  type: skill
  version: 0.4.0
  issue: jgwill/miadi-orchestration-kit#84
---

# miadi-run

Earned 2026-10-11. Trace `miadi-tracing:ceremony/trace/d87a4c119eb24fb4a718c29e130bd642`
(session `miadi-reciprocal-mission-261011`) defines the mission prompt name and two acts.
**Prepare** gets the terminal ready and attaches the prompt to its episode, with nothing
running. **Launch** is an explicit act that sends one prompt version. Revising a prompt never
launches an agent. This skill and `miadi-run.mjs` beside it carry that out. The script uses
existing doors only: the tracing provider, the episode door and `tide companion open`.

```bash
R="node $MIADI_ORCHESTRATION_KIT_ROOT/skills/miadi-run/miadi-run.mjs"
$R create  <prompt-name> --text-file F [--domain ceremony|story|eng] [--trace <trace-id>] [--session S]
$R resolve <prompt-name | trace-id> [--domain ceremony|story|eng]
$R prepare --prompt <name> --version <N> --trace <trace-id> --episode <ref> [--seat mia] [--add-dir DIR]... [--dry-run]
$R launch  <mission> --authorized-by <who>
$R prompt  <mission>
$R observe <mission> --kind research|return --summary "<text>" [--detail-file F]
$R observe --trace <trace-id> --kind research --summary "<text>"
$R show    <mission>
```

A mission is `<prompt-name>.v<N>`. Its record is `$MIADI_RUN_HOME/<mission>/mission.json`
(default `~/.miadi/missions/`), beside `brief.md`, the read-only brief tide asks the seat to read
first. The brief holds no prompt text. It names the pinned version and the `prompt` command that
reads it from the provider, tells the seat to begin the mission without waiting for a take, and
gives the `return` command. A seat therefore starts from the prompt in the provider, never from a
copy on disk (Guillaume, 2026-10-13). The first launch, that day, opened a seat that read a copy and
then only listened.

## The six verbs

0. **create** is for a person who gives the prompt name and its text together, for example
   `/miadi-run miadiRun-2610121041-pde-into-miadi-chronicle <the text>` (Guillaume,
   2026-10-13). Write the text after the name, exactly as given, to a file in your scratchpad,
   and pass it as `--text-file`. Create adds one version in the domain that already holds the
   name, else in `--domain` (default `ceremony`), and sets no label. It refuses a name outside
   the `miadiRun-` convention and a text equal to the latest version. It then records the version
   as `research` on the trace given with `--trace`, or opens a new trace (named after the prompt,
   session `--session`, default the prompt name) whose root observation is that version. It
   prints the `prepare` command to run next. Langfuse may take a minute to make a new trace
   readable; prepare refuses until it is.
1. **resolve** reads metadata only. For a prompt it returns the domain, versions and labels. For a
   trace it returns the domain, name, session and observation count. Use it to pick the version
   the person means.
2. **prepare** takes `--version` as a number, never a label. It reads that version's text and
   records its sha256, then makes three requests:
   - It asks the episode door to hold the prompt (`is-prompted-by`) and the trace (`is-traced-in`).
   - It asks `tide companion open --format json` for the seat's plan, without `--run`. That plan
     names the tmux session.
   - It adds a `preparation` observation to the trace.

   The same version prepares once. A revised prompt is a new version in the provider and a new
   mission here. Send `--dry-run` first. It asks the episode door with `dryRun: true`, prints the
   observation it would send and leaves no record.
3. **launch** needs `--authorized-by <who>`, the person's explicit word. Before it runs, it
   compares the provider's version with the recorded sha256 and refuses on any difference. It then
   runs `tide companion open --run`, which primes the seat and asks it to read `brief.md` first,
   and adds an `execution` observation with the seat's tmux session and
   tide session row. A mission launches once.

   tide types the brief's path only when its plan state is `create`, `archive-then-create` or
   `re-arm: launch in the existing shell`. When a seat is already listening, or is re-armed or
   resumed, the mission prompt never reaches it. So launch asks tide for the plan again and
   refuses in any other state (exit 7). Prepare records `delivers_brief` and warns (exit 8).
   Close the seat, or archive it on the person's word, then launch.

   tide runs only in controller mode from a terminal. When it refuses, the mission stays
   prepared and the script prints the command for the person to run themselves
   (`! node …/miadi-run.mjs launch …` or their own terminal).
4. **prompt** `<mission>` prints the pinned version, read from the provider, and refuses (exit 5)
   when the provider no longer holds the text that was prepared. It is the seat's first read.
5. **observe** adds `research` (discussion of the prompt, with or without a mission) or
   `return` (findings, commits, new questions, after a launch). Only prepare writes
   `preparation`, and only launch writes `execution`.

   `execution` (the pinned version given to a seat) and `return` (what the seat made of it) are
   written as generations linked to that prompt version (`--prompt-name`, `--prompt-version`), so
   the prompt's page in Langfuse lists every mission it started. `research` and `preparation`
   stay events. This needs coaia 0.5.3 or later (jgwill/coaiajs#14). An older coaia refuses the
   options, and the observation is reported as not written (exit 8).

## What is never touched

- Earlier observations and the trace's name. Each observation is appended through
  `coaia fuse traces add-observation --parent-id <root>` under the trace's earliest root
  observation, without `--trace-name`. A parentless observation becomes another root, and
  Langfuse renames the trace after it. That was measured on 2026-10-11 on a scratch trace in the
  eng project. A trace with no root observation is refused before anything is written.
- Earlier prompt versions. Only `create` writes a prompt, and only as a new version with no
  label, so no earlier version and no label moves. The person may also revise the prompt in the
  provider, which makes a new version the same way.
- Keys. The domain's keys (`<DOMAIN>_LANGFUSE_*`, from the environment or one literal line of
  `$MIADI_ENV_FILE`, default `$MIADI_SRC/.env`) travel only in request headers and in coaia's
  environment, under the three names coaia reads. `MIADI_API_TOKEN_WRITER` travels only in the
  episode door's header. No key appears in an observation, the mission record or the output.

When `MIADI_API_URL` is unset, the relations are recorded as `pending`. Hold them with the
`chronicle_episode_tracing` MCP tool, using the `reference` and `relation` shown.

## Exit codes

`2` usage or a refused flag. `3` launch without authorization. `4` unknown prompt, trace or
mission, a mission already prepared or launched, or a return before a launch. `5` the pinned
version no longer matches. `6` tide could not plan. `7` tide did not open the seat, or its plan
would not type the mission prompt. `8` the record was written, but an observation or an episode
relation was refused, or tide's plan would not type the mission prompt (stderr names which).
`9` the guard refused `--run` outside launch.

## Not yet

- **A session-fork lane.** `miadi-fork open` (`claude/miadi-session-observability`) opens a
  branch with no starting prompt, so it cannot deliver a pinned version. It needs a `--brief`
  option in that plugin first. Until then the companion seat is the only launcher.

## Test

```bash
node --test $MIADI_ORCHESTRATION_KIT_ROOT/skills/miadi-run/miadi-run.test.mjs
```

The test runs the script as a process. Stub `tide`, `coaia`, `tmux`, `claude` and
`miacompanionyolo` on PATH log every call, and a local server answers as Langfuse and as the
episode door. It proves these things:

- Prepare asks tide only for its plan and starts nothing.
- Every observation hangs under the root, never as a new root.
- Prepare refuses `--run`, `--launch` and `--authorized-by`.
- A version prepares once.
- Launch needs authorization and a matching sha256.
- The brief holds no prompt text, names the pinned version and starts the seat; `prompt` reads
  the provider and refuses a changed text.
- The four observation kinds stay distinct. Execution and return are generations linked to the
  pinned prompt version, and research and preparation are events.
- Create writes the text exactly as given, sets no label, refuses a repeated text, and opens a
  trace or appends under the given trace's root.
- No key reaches a log, a record, a request body or the output.
