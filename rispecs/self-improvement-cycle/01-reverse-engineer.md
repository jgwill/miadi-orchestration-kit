# 01 · Reverse engineering: Warp's loop, and what the Miadi Factory has today

Three kinds of statement are kept apart here:

- **Observed:** on a screenshot or in the review's text.
- **Hypothesis:** what we infer about how Warp works behind the screen.
- **Ours:** what the Miadi Factory has today, checked on gaia on 2026-11-19.

## The loop as one chain

Observed, in the order of the loop. The talk shows them in another order: spending at 07:56, runs
at 09:04, the definitions at 10:53, scores at 11:52, the loop at 12:53, and the 37 failures with
their PR at 13:49 (the review's stored transcript).

1. Every run is listed with where it came from, what it made, who asked and its state (13).
2. Scorers judge each run: pass or fail, a score, a verdict in words, its cost (07). They are
   counted per day and per agent (08).
3. Failures are grouped into one item with its count, "37 failed runs" (04).
4. A self-improvement run, by the Foreman, investigates the group and gives a verdict per kind of
   failure: an instruction that exists and was ignored, model variance, a misjudged exemption, a
   rule kept in the benchmark brief rather than in the agent's instructions, one-off lapses, and
   the part a repo-skill edit covers (05).
5. A proposal: Problem, Solution, Evidence with the judged run ids, Expected effect (01, 03),
   opened as a draft PR against the factory's definitions, one line of `agent.md` (14).
6. A person approves or rejects it in the inbox. The approval rate is shown: 13 of 51, 25% (06).
7. The definitions are code in one repository (09 to 11). The platform shows them read-only.
8. Cost per PR and spend by source sit beside it (12). Self-improvement is one of the sources.

Zach Lloyd at 20:50: every score in the system is an LLM judge. Human grading "makes total sense.
We just haven't added that yet." The Miadi Factory's rulings in a talking circle are that human
grading.

Hypothesis:

- Only what the investigation finds missing from the definitions becomes a proposal. Screenshot 05
  sends the other verdicts nowhere, and its run says the repo-skill edit covers only the part that
  was really missing.
- The trigger for step 4 is a count of failures per scorer and agent over a window. The talk
  shows the count, not the rule.
- The judge is a model reading each run's trace with the scorer's prompt, and a threshold is
  applied in code (the review's "the deciding model scores, code applies thresholds").
- Model variance is kept as data for model routing and benchmarks
  (11, `benchmarkRepoSubstitutions`), not as a PR.

## Element by element

| # | Warp element (observed) | Ours today | What is missing |
|---|---|---|---|
| E1 | Runs list with sources, artifacts, person, state (13) | Each Claude session has a binding line (`terminal_bindings.jsonl`), an inventory record for each session the nightly pass has seen (`~/workspace/.mino/session-inventory/`, 477 records on 2026-11-19, against 1002 interactive sessions since 2026-09-28) and, in its capture folder, a publications index (`_claude_publications.jsonl`). Missions are listed on `/missions` (jgwill/Miadi `app/missions`, :3335). The connector lists sessions (`list_sessions`, `get_session`) | One list a person reads. The sources (tmux, connector request, miadi-run mission, phone take) are in different files |
| E2 | A run's page with Scores, Artifacts and Metadata (05) | `miadi-hooks-interpret digest <id>` and the inventory record's five links (question, trace, evidence, criteria, judgment) | Scores: no record carries one |
| E3 | Scorers: a prompt per failure pattern, run over every trace, pass or fail with a score and a verdict (07) | Jev decides one choice per session at exit, with a bar of 0.6 (`miadi-witness` `inventory-at-exit.mjs`, Episode 564, miadi-chronicle://564). `tide drafts judge` asks Jev whether a flagged draft should run now, at a bar of 0.8 (jgwill/Miadi#1025, seat `t8-judged-drafts-scheduler-2611150620`). Proposals are scored by `skills/proposal-visualization/scoring/` (`policy.json` with its classes, calibration from rulings and `set_by`; `score-proposal.mjs`), lanes by `claude/miadi-witness/scripts/score-lanes.mjs`, and Jev's decisions are kept in `~/.miadi/decisions/` (`proposal-score.jsonl` held 2443 lines on 2026-11-19, beside `draft-judge`, `lane-check`, `advance-gate`, `episode-birth`, `inventory-at-exit`). People's assessments are recorded with the connector's `record_evaluation`. The tracing provider is Langfuse (`@miadi/tracing-langfuse`), whose reads are moving off the v2 API (seat `t8-langfuse-needs-upgrade-still-using-v2-261112`) | A scorer over a session as a run: the existing scorers judge proposals, drafts, lanes and exits, not a session's work. Guillaume's question in the review (v8, "Our contribution"): can Langfuse score configurations, including custom ones, score session runs from all captured hooks, with human feedback |
| E4 | Scorers dashboard, pass rate per day and per agent (08) | The ledgers in `~/.miadi/decisions/` hold the rows. No page shows them over time | The view |
| E5 | Failures grouped with a count (04) | Specified, not built: `session-exit-reasons` S4 groups exit reasons into patterns | A pattern made of scorer failures, not only exit reasons |
| E6 | The investigation, a verdict per kind of failure (05) | Not specified | The verdicts, and which of them lead to a proposal |
| E7 | The proposal: Problem, Solution, Evidence, Expected effect, as a draft PR (01, 03, 14) | Requests are recorded as `awaiting_approval` with the connector's `propose_work`, shown as a card by `show_decisions`. The kit's PRs and commits are made by seats | A proposal whose target is a factory definition, with its evidence as session ids, and the experience it creates (Guillaume's note on 01) |
| E8 | Approve or reject, approval rate (06) | `closing-a-cycle` (miadi-operator-desk): each item is a turn in a talking circle, answered "makes sense" or "does not make sense" (Episode 573, miadi-chronicle://573) | The count of approved, rejected and pending proposals per cycle |
| E9 | Definitions as code: agents, automations, benchmarks, runners, scorers, skills, webhooks (09 to 11) | The kit's plugins (`claude/*`: skills, agents, commands, hooks), `teams/README.md` and `teams/teams.json`, `/etc/claude-code` (CLAUDE.md and its skills), jgwill/llms-txt, stateloom system drawings (`.sysdf.json`) | One list naming every place a definition lives, so a proposal knows what it may change. No scorer or benchmark folder |
| E10 | Cost per PR, spend by source (12) | `/token-usage` (jgwill/Miadi `app/token-usage`) from `_sessiondata/scripts/token_counter.py`. jgwill/Miadi#1019 asks for verified cost per session and mission | Cost per proposal, and self-improvement as its own source |
| E11 | Recurrence: the loop sees whether a fix held (implied by 08's daily rates) | Specified, not built: `session-exit-reasons` S5 | The pass rate of the scorer before and after a definition changed |

## Where Guillaume's note changes the design

On 01 he wrote that the cycle closes when the agent supplies a PR "not just to solve the problem but
innovates so that we have the experience that we want". Warp's proposal names a failure and its
removal (Expected effect). Ours also names what the person will be able to do once it lands, so it
is judged against the experience it creates and not only against the failure count. That line is
`experience` in S5 of `03-specify.md`.

## Earlier work this stands on

- `_staging_for_new_episodes/what-bengio-implied-261006/` and its talking circle
  miadi-ceremony://f6e872e6-8457-47b4-b658-4b404563cd10: the agent that judges another agent's work.
- Episode 548 (miadi-chronicle://548) `feed/iggy-feed-generation-levels-261116.md` and
  miadi-review:1517f6ed-4af1-4ce3-85d2-858ee31a84eb (screenwalk 001A, the adequate relational feed):
  the feed as the visible face of the loop, and a feed's definition as a record held as code.
- Guillaume's planning prompt 2611180617 (`scratchpads/SCRATCHPAD-261113.md`): the stateloom system
  drawings are part of the factory definitions a PR proposes to change, and the morning companion
  presents the last cycle on them.
