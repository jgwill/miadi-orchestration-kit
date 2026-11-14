# 02 Intent

## The person's words

Guillaume, 2026-11-14, after a refused `git push` of the workspace on gaia:

> all of the maintenance of this workspace, my God, it should be completely automated. Like
> there should be some stuff that could be committed. It needs to be separated. There's a need
> for pushing, pulling, and also synchronizing with other systems. There's a lot of prompting
> sessions and all these things that depends on that.

## Desired outcome

Every commit an automated writer makes to a workspace reaches that workspace's remote at
the writer's own run, with every local commit kept and every uncommitted path untouched.
When the writer cannot finish, the reason is recorded in words a person reads once, and the
next run finishes it.

## Current reality

Two writers commit and push on their own, and neither integrates the upstream first. Any
push to the same remote from another host or seat makes the next push from this host
refused. The nightly pass, which was meant to catch up, is refused for the same reason and
hands the work to a person (`01-reverse-engineer.md`).

## Structural tension

The writers already do the half that is hard to get right: they commit only their own files.
What they lack is the integration step that every other writer to the same remote makes
necessary. Each run that integrates first makes the next run's push more likely to be
accepted, because the local branch no longer drifts from its upstream.

## Boundaries

1. Never force-push, and never rewrite a commit that is already on a remote.
2. Never stash, reset, check out or otherwise change a path with uncommitted changes. Those
   belong to people and to other sessions.
3. Never change a submodule's worktree. Integration records the gitlink the upstream holds and
   leaves the submodule checkout as it is.
4. Never resolve a conflict. A conflict stops integration with nothing changed and is recorded.
5. Never commit a path the writer did not write.
6. Copying to other hosts (S5) is not part of this slice.
