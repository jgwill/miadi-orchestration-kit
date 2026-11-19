# Brief: T8, the factory's side of the self-improvement cycle

Written 2026-11-19T13:21Z by the T1 seat (Claude Opus 5.5,
miadi-tmux://mia@gaia:t1-exit-not-on-completion-2611190727). Every fact below was checked in that
turn. Started only when Guillaume says the cycle is ready for T8.

## Your task

Build jgwill/Miadi#1062 first: `miadi-hooks-interpret exits`, with `model` and `end` in `digest`.
It is step 1 of the build order in `rispecs/self-improvement-cycle/03-specify.md`
(jgwill/miadi-orchestration-kit), because every scorer reads sessions through it. Then
jgwill/Miadi#1063, the app's Runs, run page, Self-improvement and Dashboard views, once the kit's
pass writes scores (jgwill/miadi-orchestration-kit#161).

## Where things are

- The code: the jgwill/Miadi checkout at `/a/src/Miadi-18` (`/a/src/Miadi` links to it),
  `packages/hooks-interpreter`, `packages/connector`, `packages/tracing-langfuse`, `app/missions`,
  `app/token-usage`.
- The specification: `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/self-improvement-cycle/`
  and `rispecs/session-exit-reasons/` (S3 is your step 1).
- The parent: jgwill/miadi-orchestration-kit#160.

## Neighbours to read before you start, by their inventory records

- `t8-judged-drafts-scheduler-2611150620` (session 9d7a130e-de15-45bb-aaff-53bea94711df):
  `tide drafts judge`, a judge already in the factory (jgwill/Miadi#1025).
- `t8-langfuse-needs-upgrade-still-using-v2-261112` (session 2f0484b9-eaab-41f0-a17a-b39494147b54):
  tracing reads moving off Langfuse v2, which S2's Langfuse scores depend on.
- jgwill/Miadi#1019 for cost per session, which the Spending view reads.

## Not yours

- The scorers, patterns, investigation and proposals: jgwill/miadi-orchestration-kit#161 (T1).
- The wheel's records: jgwill/medicine-wheel#178.
- The episode: the production team's, staged at
  `_staging_for_new_episodes/a-review-inspires-the-factory-to-evolve-261119/`.
- No release, deploy or install on another host without its owner's word.

## Done when

- jgwill/Miadi#1062: `miadi-hooks-interpret exits --json` answers on gaia for the sessions since
  2026-09-28, with its tests, committed and pushed, and the issue says which version holds it.
- jgwill/Miadi#1063: each view checked on gaia against one real day of records, with the commit
  named on the issue.
