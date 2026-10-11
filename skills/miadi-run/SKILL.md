---
name: miadi-run
description: >
  Start a terminal mission from one pinned version of a miadiRun prompt
  (`miadiRun-<yyMMddHHmm>-<tmuxName>-<missionName>` in the tracing provider), in four
  verbs: resolve, prepare, launch, observe. Prepare pins the version, holds the prompt
  and its research trace on the episode and asks `tide companion open` for its plan,
  and never executes. Launch runs only on the person's explicit word. Every step adds
  a typed observation (research, preparation, execution, return) to the mission's
  trace. Triggers on "miadiRun", "miadi-run", "prepare the mission", "launch the
  mission", "start a session from that prompt", "start a session with that trace",
  a `miadiRun-…` prompt name, or a trace id given as the source of a mission.
metadata:
  type: skill
  version: 0.1.0
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
$R resolve <prompt-name | trace-id> [--domain ceremony|story|eng]
$R prepare --prompt <name> --version <N> --trace <trace-id> --episode <ref> [--seat mia] [--add-dir DIR]... [--dry-run]
$R launch  <mission> --authorized-by <who>
$R observe <mission> --kind research|return --summary "<text>" [--detail-file F]
$R observe --trace <trace-id> --kind research --summary "<text>"
$R show    <mission>
```

A mission is `<prompt-name>.v<N>`. Its record is `$MIADI_RUN_HOME/<mission>/mission.json`
(default `~/.miadi/missions/`), beside the pinned prompt text `prompt.md`, which is read-only.

## The four verbs

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
   compares the pinned text and the provider's version with the recorded sha256 and refuses on
   any difference. It then runs `tide companion open --run`, which primes the seat and asks it to
   read `prompt.md` first, and adds an `execution` observation with the seat's tmux session and
   tide session row. A mission launches once.

   tide runs only in controller mode from a terminal. When it refuses, the mission stays
   prepared and the script prints the command for the person to run themselves
   (`! node …/miadi-run.mjs launch …` or their own terminal).
4. **observe** adds `research` (discussion of the prompt, with or without a mission) or
   `return` (findings, commits, new questions, after a launch). Only prepare writes
   `preparation`, and only launch writes `execution`.

## What is never touched

- Earlier observations and the trace's name. Each observation is appended through
  `coaia fuse traces add-observation --parent-id <root>` under the trace's earliest root
  observation, without `--trace-name`. A parentless observation becomes another root, and
  Langfuse renames the trace after it. That was measured on 2026-10-11 on a scratch trace in the
  eng project. A trace with no root observation is refused before anything is written.
- Earlier prompt versions. This script never creates, updates or relabels a prompt. The person
  revises the prompt in the provider, which makes a new version.
- Keys. The domain's keys (`<DOMAIN>_LANGFUSE_*`, from the environment or one literal line of
  `$MIADI_ENV_FILE`, default `$MIADI_SRC/.env`) travel only in request headers and in coaia's
  environment, under the three names coaia reads. `MIADI_API_TOKEN_WRITER` travels only in the
  episode door's header. No key appears in an observation, the mission record or the output.

When `MIADI_API_URL` is unset, the relations are recorded as `pending`. Hold them with the
`chronicle_episode_tracing` MCP tool, using the `reference` and `relation` shown.

## Exit codes

`2` usage or a refused flag. `3` launch without authorization. `4` unknown prompt, trace or
mission, a mission already prepared or launched, or a return before a launch. `5` the pinned
version no longer matches. `6` tide could not plan. `7` tide did not open the seat. `8` the
record was written, but an observation or an episode relation was refused (stderr names which).
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
- The four observation kinds stay distinct.
- No key reaches a log, a record, a request body or the output.
