# 03 · Specifications

Each specification names its domain (Engineering, Ceremonial, Creative), the team that owns it,
the repository, and the element of `01-reverse-engineer.md` it answers. `session-exit-reasons`
is the sibling packet. Its S4 and S5 are this cycle applied to one scorer, `exit-reason`, and are
built as that. Its S2 (a reason given after the exit) and S3 (`exits`) feed the cycle.

## Build order (decided 2026-11-19 by the T1 seat)

Guillaume, 2026-11-19: deciding what is built first is the agents' coordination, not his. The
order follows what each part reads.

1. `session-exit-reasons` S3, `miadi-hooks-interpret exits` with the `model` and `end` fields.
   Every scorer reads sessions through it, and the session lookup guard has no command to name
   until it exists.
2. S8, the list of factory definitions, and S2, the scorers that read only the record and the
   capture (`exit-reason`, `left-uncommitted`, `handed-back-finish`), written by the nightly pass.
   This step does not wait on step 1. `wrong-model` follows step 1, which gives each session's
   models.
3. S3 patterns and S4 the investigation, run after the nightly pass.
4. S5 the proposal and S6 the ruling, through `closing-a-cycle`.
5. S1 the runs and S9 the dashboard, in the app.
6. S7 recurrence, once a first proposal has landed.
7. The wheel records, alongside 4 to 6.
8. S10 the episode, once one real cycle has gone through 1 to 6. The production team decides.

Step 1 is T8's. The T1 seat recommends starting the T8 seat for it now (Episode 579,
miadi-chronicle://579, attention item `h2-start-seats`). Steps 2 and 3 are T1's and do not wait
on it.

## S1 · Runs (Engineering, T8, jgwill/Miadi; answers E1, E2)

One list of sessions a person reads, newest first. Each row:

- the session's name and team, its state (the inventory record's `status`), when it ran
- where it came from: tmux by hand, a miadi-run mission, a connector request (`factory[]`), a
  phone take, a scheduled pass
- what it made: commits, pull requests, issues, Artifact pages, reviews, episodes (the
  publications index in its capture folder)
- who asked (the binding line's `account_person`, the record's `hook_capture.last_input`)
- its scores (S2) and its exit reason, when it has one

A row opens the session's page: the digest, the five links, the scores with their verdicts in
words, and the files it wrote. Reads the inventory and `miadi-hooks-interpret`, writes nothing.

## S2 · Scorers (Engineering, the Evaluation circle; T1 for the definitions and for the runner, which is the nightly pass; answers E3)

A scorer is a file in the kit, `scorers/<name>.md`, beside the plugins it judges:

```yaml
name: left-uncommitted
applies_to: { teams: [all], plugins: [] }
reads: [capture.files_written, exits.ended_at]
judge: count | jev | model:<name>   # count needs no model; jev is one Jev choice; model is an LLM judge
prompt: |                           # for jev and model only
  ...
pass_when: "no file the session wrote is uncommitted at its end"
threshold: 1.0
threshold_set_by: "<person>, <date>"
rule: "kit AGENTS.md, Agent ownership of repo state"
```

- Before writing a scorer, read the factory's existing scoring: `skills/proposal-visualization/scoring/`
  (classes, calibration from rulings, `set_by`), `claude/miadi-witness/scripts/score-lanes.mjs`, and
  Jev's ledgers in `~/.miadi/decisions/`. A scorer reuses their fields where they fit.
- The runner reads each ended session once through `miadi-hooks-interpret` and appends to the
  record's `scores[]`: `{scorer, version, result: pass | fail | unknown, score, verdict, at, by,
  cost}`. A verdict is one sentence. `unknown` is written when the evidence is not in the capture.
- The first four, each from a rule the factory already states and a failure seen in real sessions:

| scorer | judge | passes when | the rule it checks |
|---|---|---|---|
| `exit-reason` | count | the record has no `exit` block | the person's own feedback, `/inventory-exit-reason` |
| `wrong-model` | count | every reply came from the model the launch or the mission named | jgwill/Miadi#1060, jgwill/Miadi#1028 |
| `left-uncommitted` | count | nothing the session wrote is uncommitted at its end | the kit's `AGENTS.md`, "Agent ownership of repo state" |
| `handed-back-finish` | jev | the last reply does not ask permission for a reversible finish it was asked to do | `/etc/claude-code/CLAUDE.md`, "Infer the Trivial Non-Destructive Finish" |

- **Langfuse (Guillaume's question in the review, v8):** yes. A scorer maps onto a Langfuse score
  configuration (name, data type boolean or numeric, range), a session with a Langfuse trace gets
  the score on that trace, and a person's ruling or exit reason is a score with source annotation.
  The record stays the score of record: the nightly pass writes one for every session that ran
  since its last run (477 records on gaia on 2026-11-19), while only some sessions have a Langfuse
  trace. Jev stays the judge for one-choice scorers, as it already is at exit.

## S3 · Patterns (Engineering, T1, the kit; answers E5)

After the nightly pass, failures are grouped by scorer and by the condition the sessions share:
team, plugin, launch alias, model, cwd, the mission or request that started them. A group of three
or more sessions in fourteen days is a pattern. A pattern keeps its id across passes (`P1`, `P2`,
…) with its sessions and its count.

Each pass writes into its pass folder, `~/workspace/.mino/self-improvement/<yymmdd>/` in
miadisabelle/workspace, pushed as the inventory is: `patterns.json`, one `investigation-<P>.md` per
pattern investigated, and one `proposal-<id>.yaml` with its diff per proposal.

This is the cadence asked in Q2: the investigation runs when a pattern reaches its count, as
Warp's "37 failed runs" item is made from a count. The nightly pass checks the counts. The figures
(three, fourteen days) are this seat's starting values, and S7 shows whether they are adequate.

## S4 · The investigation (Engineering, T1, the kit; answers E6)

A seat reads the pattern's sessions (their digests and the scorer's verdicts) and the definitions
that govern them (from S8). For each session it writes one of:

- `missing`: no definition says what the session should have done
- `ambiguous`: a definition says it, in words a reader can take two ways (quote the line)
- `ignored`: a definition says it plainly and the session did not follow it (quote the line)
- `misplaced`: the rule exists, in a brief or a task rather than in the definition that governs the
  session (screenshot 05: "that rule lives in the benchmark task brief, not in the agent's
  instructions")
- `variance`: the session did it on another run of the same work

Only `missing`, `ambiguous` and `misplaced` lead to a proposal. `ignored` and `variance` are kept for model
routing and for the scorer's own history. The investigation is a file in the pass folder. It
changes no definition and opens nothing.

## S5 · The proposal (Engineering, T1 and the owning team; answers E7)

```yaml
id: SI-2611-01
pattern: P3
problem: what fails, in words, with its count
solution: what changes, in which definition
target: { definition: <S8 entry>, path: <file>, diff: <file in the pass folder> }
evidence: [session ids, each with its scorer verdict]
expected_effect: the scorer's rate for the pattern's condition, before and the expected after
experience: what the person or the next seat will be able to do once it lands
owner: the team that owns the target
```

`experience` is Guillaume's note on screenshot 01: the proposal says the experience it creates,
not only the failure it removes. A proposal without it is not offered.

The proposal is written in the pass folder with its diff, and as a node on the wheel
(jgwill/medicine-wheel#178). Nothing is pushed before the ruling (S6), because the Sunwise Law lets
WEST act only on what was consented to. On "makes sense" the seat pushes the branch and opens the
pull request, and the owning team merges it after its own checks.

## S6 · The ruling (Ceremonial; T7 teaches it in `closing-a-cycle`, T1 posts the turns, T8 builds the wheel records; answers E8)

Each proposal is one turn in the cycle's talking circle, as `closing-a-cycle` already does for
held decisions, posted with `circle-dialogue.mjs`. The turn is the only place a proposal is
ruled: it is not also a decision card, so one answer opens the PR. "Makes sense" opens the PR, and the owning team merges it after its own checks.
"Does not make sense" closes the proposal with the person's words kept. The cycle's approval rate
is approved over approved and rejected, with pending counted beside it. It is shown in S9.

## S7 · Recurrence (Engineering, T1; answers E11)

When a proposal's change has landed (its merge commit), the next windows compare the scorer's rate
for the pattern's condition with the window before it. The result is added to the proposal:
`held`, `partly`, `returned`. A pattern that returns goes back to S4 with the landed change in
view.

## S8 · The factory definitions (Engineering, T1, the kit; answers E9)

`factory/definitions.yaml` in the kit names every place a definition lives, its owning team, and
how a change lands there:

- the kit's root `AGENTS.md`, its `skills/`, its plugins (`claude/*`: skills, agents, commands,
  hooks), the other agent lanes (`codex/`, `copilot/`, `gemini/`, `pi/`, `hermes-agent/`), `teams/`
  and `scorers/`
- the seat launchers where a session's model is chosen: `mct` (`@miadi/chronicle-tui`) and `tide`
  (the `miadi-tide` package)
- `/etc/claude-code` (`CLAUDE.md` and its skills), jgwill/etc-claude-code
- the `llms-*` files, authored in jgwill/llms-txt and distributed by its sync
- stateloom system drawings (`.sysdf.json`) in the repositories that hold them

A proposal may target only an entry of this list. Its first version is written by hand from the
list above.

## S9 · The dashboard (Engineering, T8, jgwill/Miadi; answers E4, E10)

One page with three views, as Warp's:

- **Scorers:** each scorer's pass rate per day, per team.
- **Self-improvement:** the cycle's proposals, needs ruling and ruled, with the approval rate.
- **Spending:** cost per session and per landed proposal, spend by source with self-improvement
  as its own source. It reads what jgwill/Miadi#1019 makes.

## S10 · The pilot episode (Creative, the production team, jgwill/episodes)

One episode shows one full cycle on a real pattern: its sessions, their scores, the investigation,
the proposal with its experience line, Guillaume's ruling in the circle, and the next cycle's
count. It holds miadi-review:d47ef197-8fc2-4f81-be25-67d4e335d104 as its source. The request is
staged in `_staging_for_new_episodes/` (see `04-export.md`). The production team decides whether
and when to mint it.

## Data

### Score (an entry of a record's `scores[]`)
`scorer`, `version`, `result` (`pass` | `fail` | `unknown`), `score` (0 to 1), `verdict` (one
sentence), `at`, `by`, `cost` (or null)

### Pattern
`id`, `scorer`, `condition` (the fields the sessions share), `sessions[]`, `count`, `first_seen`,
`last_seen`, `investigation` (path), `proposal` (id or null)

### Proposal
as in S5, plus `ruling: {answer, by, at, words, turn}` and `recurrence: {result, windows[], at}`
