# 03 Specify: integrate before push

The first slice of S2 (ws-sync). Codebase-agnostic: another agent can build it from this
file alone. The two writers of `01-reverse-engineer.md` are its first users. Any later writer
to the same repository (S2's timer, a seat) uses the same contract.

## Terms

- **writer**: a process that commits files it wrote to a repository and pushes them.
- **upstream**: the remote branch the repository's current branch tracks.
- **dirty path**: a tracked path with uncommitted changes, or a submodule whose checkout
  differs from its gitlink.
- **the lock**: one lock per repository, named from the repository's top-level path, shared
  by every writer to that repository on that host.

## The sequence

1. **Commit.** The writer commits its own files by path, as it does today. This step takes
   no lock beyond git's own index lock.
2. **Take the lock.** The writer waits for the lock for a bounded time: 30 seconds for a
   writer that runs at session exit, 5 minutes for the nightly pass. When the time runs out,
   it records `deferred-lock` with the holder's name and stops. Its commit stays local for the
   next run.
3. **Fetch** the upstream. When the fetch fails (no network, remote down), record `offline`,
   release the lock and stop.
4. **Compare.** Count the commits the local branch has that the upstream lacks (ahead) and the
   reverse (behind).
   - behind 0, ahead 0: record `up-to-date`, release, stop.
   - behind 0, ahead above 0: go to step 6.
   - behind above 0: go to step 5.
5. **Integrate.** Bring the upstream into the local branch.
   - With no local commits of its own (ahead 0), move the branch forward to the upstream.
   - With local commits, make one merge commit whose message names the writer and the counts.
     Local commits are never rewritten.
   - When an incoming change touches a dirty path, integration does not start. Record
     `held-dirty-overlap` with the overlapping paths, release, stop. Nothing on disk changes.
   - When the merge conflicts, abort it so the branch and every file are exactly as before.
     Record `held-conflict` with the conflicting paths, release, stop.
   - Integration never updates a submodule's checkout.
6. **Push** the branch to its upstream. When accepted, record `pushed` with the counts.
   When refused because the upstream moved during these steps, return to step 3 once. A second
   refusal records `rejected-after-retry`.
7. **Release the lock.** The lock is released on every path out of steps 3 to 6, including a
   crash of the writer (the lock expires with the process that holds it).

## The record

Each run adds one `integration` object to the line the writer already writes (the nightly
line's `commit` field, the exit writer's ledger line):

```
integration: { state, ahead, behind, paths?, holder?, at }
```

`state` is one of `up-to-date`, `pushed`, `deferred-lock`, `offline`, `held-dirty-overlap`,
`held-conflict`, `rejected-after-retry`. `paths` is present for the two `held-` states,
`holder` for `deferred-lock`. Only the two `held-` states and `rejected-after-retry` need a
person, and the witness seat's morning line names them.

## Creative Advancement Scenarios

**Creative Advancement Scenario**: A record from eury, a session exits on gaia

**User Intent**: Guillaume wants every session's record on the remote without pushing by hand.
**Current Reality**: Mia on eury pushed an inventory record at 08:00. A session on gaia exits at 08:15.
**Natural Progression Steps**:
  1. The exit writer commits the session's record by path.
  2. It takes the lock, fetches, and finds the gaia branch 1 behind and 1 ahead.
  3. It makes one merge commit naming itself and pushes. The push is accepted.
**Achieved Outcome**: Both records are on the remote. The line reads `pushed`, ahead 2, behind 0.
**Supporting Features**: the shared lock, the merge that keeps local commits, the integration record.

**Creative Advancement Scenario**: The incoming change touches Guillaume's open note

**User Intent**: Guillaume keeps editing his scratchpad while the writers run.
**Current Reality**: Another host pushed a change to the scratchpad that is dirty on gaia.
**Natural Progression Steps**:
  1. The writer commits its record, takes the lock, fetches and finds the branch behind.
  2. It sees the incoming change touches a dirty path and does not start the merge.
  3. It records `held-dirty-overlap` with the scratchpad's path and releases the lock.
**Achieved Outcome**: Guillaume's file is byte for byte as he left it. The morning line names the one path to settle, and every later run that does not overlap pushes again.
**Supporting Features**: the dirty-path check before integration, the `held-` states, the witness seat's morning line.

**Creative Advancement Scenario**: The nightly pass and a session exit at the same moment

**User Intent**: Writers never race each other.
**Current Reality**: The nightly pass is pushing at 03:39 when a session exits.
**Natural Progression Steps**:
  1. The exit writer commits its record and waits for the lock.
  2. The nightly pass pushes and releases the lock within the 30 seconds.
  3. The exit writer takes the lock, fetches, finds itself 1 ahead and pushes.
**Achieved Outcome**: Both commits are on the remote, one after the other.
**Supporting Features**: the shared lock and its bounded wait.
