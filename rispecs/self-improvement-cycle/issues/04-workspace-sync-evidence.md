## Context

The session inventory (`~/workspace/.mino/session-inventory/`, miadisabelle/workspace) is written by
two scripts in `claude/miadi-witness/scripts/`: `inventory-at-exit.mjs` at each session's exit, and
`nightly-inventory.sh` every night. Each commits its records by path, then runs one `git push`
(`inventory-at-exit.mjs` `commitRecord`, line 166; `nightly-inventory.sh` line 110). Neither
integrates origin first, so once the host's `main` is behind origin every push is refused, and
nothing picks the refused commit up afterwards. The nightly line records `rejected: … left for the
seat`, and no seat reads it.

Measured on 2026-11-19 by the T1 seat (session `5ffaf964-f4cb-470d-a1da-35fdd040073a`):

- gaia: `main` 53 commits ahead of origin and 28 behind. 52 of the 53 were inventory commits, the
  oldest from 2026-11-16 03:38. 75 changed or untracked files in the tree.
- eury: `main` 58 commits behind origin, nothing of its own, 38 changed files.
- One real conflict: record `675a74db-cbb8-4c91-a1f6-fe06c30851aa.json` was added on both sides.
  Both copies held the same `exit`, `work_completed`, `held_decisions` and `disposition`. The local
  one was later and held every observation of the other, so the local one was kept.

Done by hand that day: `git merge --no-edit origin/main` on gaia, push (miadisabelle/workspace@8280093);
`git merge --ff-only` on eury, which ran its post-merge hook. Both hosts are at 8280093.

Before the merge, single commits were landed on origin without touching the dirty tree: a
temporary index read from `origin/main`, the one file added to it, `git commit-tree -p origin/main`,
and a push of that commit (miadisabelle/workspace@6e5744c, @4476190, @bcba449). It never changes the
working tree, so it cannot clobber what another session is writing, and a later merge of the local
commit applies cleanly.

The specification already exists: `rispecs/workspace-sync/` (draft of 2026-11-14,
ceremony `miadi-ceremony:f5e3d1a3-c23b-486c-867b-b00faead7fe5`, Episode 290), with S2 `ws-sync`
specified as its first slice and gates G1 to G5. Its build waits on step A1 of
`chart_1794669489067`: whether the work divides into the five services. No issue held it until
this one.

Guillaume, 2026-11-19: "these commits for the inventory they should always be … committed … It's
supposed to have full synchronization also with mia@eury:/home/mia/workspace But I think that the
service that was started to be created for that is not completed yet anyway, so do it manually, but
you can fill out regarding that, so that we could finish the work in this synchronization."

## Desired State

Every inventory commit made on any host reaches origin the same day without a person, and every
host's workspace receives it. A refused push is integrated and retried, or held with its reason
where a seat reads it. eury and ilex keep the same inventory as gaia.

## Action Steps

- [ ] A1 of `chart_1794669489067` answered (Episode 579's attention item `w1-sync-services`)
- [ ] S2 `ws-sync` built as `rispecs/workspace-sync/` specifies, called by both writers in place of their single push, gates G1 to G5 passing
- [ ] When the tree's changed paths overlap what origin brings (G2), the writer lands its own commit on origin through a temporary index, as done by hand on 2026-11-19, so the record still reaches origin
- [ ] S5 `ws-mirror`: eury (and ilex) pull what gaia pushed. Guillaume named eury on 2026-11-19
- [ ] The nightly line's `rejected` state read by the witness seat each morning until S2 is built

## Structural Tension

The inventory is the factory's memory of every session, and on gaia it stopped reaching origin for
three days while each script reported its push as done or left it for a seat that never came. The
sync specification exists and only its first slice has to be built for the record to reach every
host by itself.

## Related

- Specification: `rispecs/workspace-sync/` (jgwill/miadi-orchestration-kit), ceremony `miadi-ceremony:f5e3d1a3-c23b-486c-867b-b00faead7fe5`, Episode 290 (miadi-chronicle://290)
- Episode 579 (miadi-chronicle://579), attention item `w1-sync-services`
- jgwill/miadi-orchestration-kit#160, jgwill/miadi-orchestration-kit#161 (the nightly pass that will also write scores)
- Seat of the specification: miadi-tmux://mia@gaia:t8-svc-draft-mia-workspace-sync-capability-2611140954
- jgwill/miadi-orchestration-kit#31 (repo hygiene anchor)
