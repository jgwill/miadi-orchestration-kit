# 04 Export: where it lands and how it is checked

## Where it lands

In this kit, beside the two writers in `claude/miadi-witness/scripts/`:

- one shared integrate-before-push helper that both writers call after their commit, usable
  from the shell script and from the Node module;
- `nightly-inventory.sh` step 4 and `inventory-at-exit.mjs` `commitRecord` calling it in place
  of their single `git push`;
- the `integration` object added to the lines both already write.

The comment in `commitRecord` that says a refused push "is kept for the nightly pass" is
rewritten to say what the nightly pass now does with it.

## Who may release it

Building it is a normal change to this kit, committed and pushed by the seat that builds it.
The build waits for Guillaume's answer to step A1 of `chart_1794669489067` (whether the work
divides into the five services), given in ceremony
`miadi-ceremony:f5e3d1a3-c23b-486c-867b-b00faead7fe5`. S5, copying to other hosts, is released
by Guillaume only and is not part of this slice.

## Running work on the same ground

- Mia on eury writes in this kit's `rispecs/agent-phone-line/` (commits of 2026-11-14). This
  packet touches no file there.
- The witness seat reads the nightly line every morning. The new `integration` object is
  added beside the existing fields, and no field changes its meaning.

## Validation gates

| gate | how | passes when |
|---|---|---|
| G1 integrate | a scratch bare repository and two clones. Clone B pushes, then clone A's writer commits and runs | A's line reads `pushed`, the remote holds both commits, A's commit is unchanged |
| G2 dirty overlap | as G1, with the path B changed left dirty in A | A's line reads `held-dirty-overlap` with that path, and A's worktree is byte for byte as before |
| G3 conflict | as G1, with a conflicting committed change in A | `held-conflict`, the branch at the same commit as before, no merge in progress |
| G4 lock | two writers started together in A | one `pushed`, the other `pushed` after it or `deferred-lock`, never two pushes racing |
| G5 gaia | the next exit on gaia after the build, against the workspace of 2026-11-14 | `origin/main` holds `be3157f`, and no untracked or dirty path changed |

## Recorded in the episode

This packet is listed under `rispecs:` in Episode 290's `episode.yaml`
(`2026-07-20-episode-290-gaia-and-eury`), the episode whose circle holds the ceremony.
