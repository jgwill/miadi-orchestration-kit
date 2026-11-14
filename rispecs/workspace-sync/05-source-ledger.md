# 05 Source ledger

| source | what it supports | claim | confidence |
|---|---|---|---|
| Guillaume's message of 2026-11-14 in session `t8-svc-draft-mia-workspace-sync-capability-2611140954` | the request, quoted in `02-intent.md` | observed | verbatim |
| `claude/miadi-witness/scripts/inventory-at-exit.mjs`, `commitRecord`, at `c2ab159` | commit by path, one push, no fetch, retry on index lock | observed | read in full |
| `claude/miadi-witness/scripts/nightly-inventory.sh`, step 4, at `c2ab159` | commit by path, push of HEAD, the `rejected … left for the seat` record | observed | read in full |
| `grep` for `flock`, `lockfile`, `.lock` in both writers | no lock around commit and push | observed | 0 matches in each |
| `git rev-list --left-right --count main...origin/main` in `/home/mia/workspace` on gaia | 4 ahead, 1 behind | observed | measured 2026-11-14 |
| `git status --porcelain` in the same checkout | 31 modified, 43 untracked | observed | measured 2026-11-14 |
| `git log` of the workspace, 2026-11-13 | the workspace already integrates by merge | observed | two merge commits that day |
| Episode 564's mission standard (`mission-draft-review-261105/standard-v2.json`) | the six questions each chart step answers | observed | read |
| `chart_1794669489067`, ceremony `f5e3d1a3-c23b-486c-867b-b00faead7fe5` | where the work is held and decided | observed | created 2026-11-14 |
| The five services S1 to S5 | the division of the work | hypothesis | Mia's draft, awaiting Guillaume's answer to A1 |
| Lock wait times (30 s at exit, 5 min nightly) | step 2 of the sequence | hypothesis | chosen for the draft, to measure under G4 |
