# 03 · Specifications

Each specification names its domain (Engineering, Ceremonial, Creative), the team that owns it,
the repository, and the element of `01-reverse-engineer.md` it answers. `session-exit-reasons`
is the sibling packet. Its S2 to S5 are this cycle applied to one scorer, `exit-reason`, and are
built as that.

## Build order (decided 2026-11-19 by the T1 seat)

Guillaume, 2026-11-19: deciding what is built first is the agents' coordination, not his. The
order follows what each part reads.

1. `session-exit-reasons` S3, `miadi-hooks-interpret exits` with the `model` and `end` fields.
   Every scorer reads sessions through it, and the session lookup guard has no command to name
   until it exists.
2. S8, the list of factory definitions, and S2, the first four scorers, written to the inventory
   records by the nightly pass.
3. S3 patterns and S4 the investigation, run after the nightly pass.
4. S5 the proposal and S6 the ruling, through `closing-a-cycle`.
5. S1 the runs and S9 the dashboard, in the app.
6. S7 recurrence, once a first proposal has landed.
7. The wheel records, alongside 4 to 6.
8. S10 the episode, once one real cycle has gone through 1 to 6. The production team decides.

## S1 · Runs (Engineering, T8, jgwill/Miadi; answers E1, E2)

One list of sessions a person reads, newest first. Each row:

- the session's name and team, its state (the inventory record's `status`), when it ran
- where it came from: tmux by hand, a miadi-run mission, a connector request (`factory[]`), a
  phone take, a scheduled pass
- what it made: commits, pull requests, issues, Artifact pages, reviews, episodes (the
  publications index)
- who asked (`account_person`, `last_input`)
- its scores (S2) and its exit reason, when it has one

A row opens the session's page: the digest, the five links, the scores with their verdicts in
words, and the files it wrote. Reads the inventory and `miadi-hooks-interpret`, writes nothing.

## S2 · Scorers (Engineering and Evaluation, T1 for the definitions, T8 for the runner; answers E3)

A scorer is a file in the kit, `scorers/<name>.md`, beside the plugins it judges:

```yaml
name: left-uncommitted
applies_to: { teams: [all], plugins: [] }
reads: [digest.files_written, digest.end, exits.end]
judge: count | jev | model:<name>   # count needs no model; jev is one Jev choice; model is an LLM judge
prompt: |                           # for jev and model only
  ...
pass_when: "no file the session wrote is uncommitted at its end"
threshold: 1.0
threshold_set_by: "<person>, <date>"
rule: "kit AGENTS.md, Agent ownership of repo state"
```

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
  The record stays the score of record, because every session has one and not every session has
  a trace. Jev stays the judge for one-choice scorers, as it already is at exit.

## S3 · Patterns (Engineering, T1, the kit; answers E5)

After the nightly pass, failures are grouped by scorer and by the condition the sessions share:
team, plugin, launch alias, model, cwd, the mission or request that started them. A group of three
or more sessions in fourteen days is a pattern. A pattern keeps its id across passes (`P1`, `P2`,
…) with its sessions and its count.

This is the cadence asked in Q2: the investigation runs when a pattern reaches its count, as
Warp's "37 failed runs" item is made from a count. The nightly pass checks the counts. The figures
(three, fourteen days) are this seat's starting values, and S7 shows whether they are adequate.

## S4 · The investigation (Engineering, T1, the kit; answers E6)

A seat reads the pattern's sessions (their digests and the scorer's verdicts) and the definitions
that govern them (from S8). For each session it writes one of:

- `missing`: no definition says what the session should have done
- `ambiguous`: a definition says it, in words a reader can take two ways (quote the line)
- `ignored`: a definition says it plainly and the session did not follow it (quote the line)
- `variance`: the session did it on another run of the same work

Only `missing` and `ambiguous` lead to a proposal. `ignored` and `variance` are kept for model
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

The proposal is recorded with the connector's `propose_work` and shown as a card. The change is
pushed on a branch of the target's repository. The pull request is opened after the ruling (S6),
because opening one reaches people.

## S6 · The ruling (Ceremonial, T7 teaches it, the owning team acts; answers E8)

Each proposal is one turn in the cycle's talking circle, as `closing-a-cycle` already does for
held decisions. "Makes sense" opens the PR, and the owning team merges it after its own checks.
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

- the kit's plugins (`claude/*`: skills, agents, commands, hooks), `teams/`, and `scorers/`
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
