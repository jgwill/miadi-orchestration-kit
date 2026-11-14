# 01 Reverse-engineer: what the two writers do today

Measured on gaia on 2026-11-14 against this kit at `c2ab159`.

## The writers

Two scripts of the `miadi-witness` plugin commit to the inventory's repository on their own.
On gaia that repository is the workspace `miadisabelle/workspace`.

| writer | when it runs | what it commits | how it pushes |
|---|---|---|---|
| inventory at exit (`claude/miadi-witness/scripts/inventory-at-exit.mjs`, `commitRecord`) | each time a Claude session exits | the session's one record, by path | `git push -q` once, right after its commit |
| nightly inventory (`claude/miadi-witness/scripts/nightly-inventory.sh`, step 4) | once a night, 03:39 local on gaia | the records written or read that night, by path | `git push -q origin HEAD` once |

Neither writer fetches or pulls. Neither takes a lock around its commit and push. The exit
writer retries `add` and `commit` once after a second when git's own index lock is held, and
does nothing more.

## What happens to a refused push

The exit writer's comment says a refused push "is kept for the nightly pass, which pushes
HEAD". The nightly pass does not pull either, so its push is refused for the same reason. It
then records `rejected: the remote holds work this host does not have; left for the seat`.
The work ends with a person. On 2026-11-14 Guillaume pasted that refusal and asked for the
maintenance to be automated.

## The state it left on gaia (2026-11-14)

- `main` 4 commits ahead of `origin/main` and 1 behind after a fetch.
- 31 tracked paths modified, 21 of them submodule gitlinks with new commits, and 43 paths
  untracked. These belong to people and other sessions, not to the two writers.
- The workspace's own maintenance scripts (`daily-workspace-maintenance.sh`,
  `update-submodules-safe.sh`, `update-workspace-submodules-qmd.sh`) pull submodules and
  rebuild the QMD index. None of them commits, pushes or classifies paths.
- The workspace history already integrates by merge (`Merge remote-tracking branch
  'origin/main'` commits on 2026-11-13).

## What works and must be kept

1. **Commit by path.** Each writer commits only the files it wrote and never sweeps the
   index. This is why the first slice needs no classification (S1).
2. **A refusal is recorded, not hidden.** The nightly line names the refusal. The new
   contract keeps that and adds the states that end without a person.
3. **The nightly pass is the catch-up.** A writer that cannot push now leaves its commit for
   a later run. The new contract keeps this hand-off and makes the later run able to finish it.
