# workspace-sync

> Draft, 2026-11-14. Specified, not built. Written by Mia on gaia from a conversation with
> Guillaume (session `f1-t8-svc-draft-mia-workspace-sync-capability-2611140954`), held in
> ceremony `miadi-ceremony:f5e3d1a3-c23b-486c-867b-b00faead7fe5` (Episode 290, Gaia and Eury)
> and charted as `chart_1794669489067` in the Mia seat chart store.

## Desired outcome

A workspace repository that agents and people write to on several hosts (gaia, eury, ilex)
stays committed, integrated and pushed without a person sorting it. Machine state commits
itself, a person's notes wait for that person, and no session starts on a push that was
refused.

## The five services

| code | service | what it does | state |
|---|---|---|---|
| S1 | ws-sort | classifies changed paths into machine state and human-held | named, not specified |
| S2 | ws-sync | integrates the upstream before every push, under one lock | **first slice specified here** |
| S3 | ws-pointers | advances a submodule gitlink only when its commit is on that submodule's remote | named, not specified |
| S4 | ws-lease | lets a session claim the paths it writes, so S2 never collides with it | named, not specified |
| S5 | ws-mirror | carries the pushed state to the other hosts | named, not specified, released by Guillaume only |

The five names are Mia's draft. Guillaume asked for separation of what gets committed,
pushing, pulling and syncing with other systems (`02-intent.md`). Whether the work divides
into these five is step A1 of the chart and is answered in the ceremony.

## The first slice: integrate before push

The two writers that already commit and push on their own, the nightly inventory pass and
the inventory at exit, integrate the upstream before they push, under one lock they share.
This ends the refused push for every session without S1, because both writers already commit
only their own files.

## Files

| file | phase | holds |
|---|---|---|
| `01-reverse-engineer.md` | R | what the two writers do today, measured |
| `02-intent.md` | I | desired outcome, current reality, structural tension, boundaries |
| `03-specify.md` | S | the integrate-before-push contract and its scenarios |
| `04-export.md` | E | where it lands in the kit and the validation gates |
| `05-source-ledger.md` | | sources, claim categories, confidence |

## Acceptance criteria

1. On gaia, the workspace that was 4 commits ahead and 1 behind its remote on 2026-11-14
   reaches its remote at the next writer run, with every local commit kept.
2. A change arriving from another host that touches a path a person is editing changes
   nothing on disk and is recorded as held, with the paths.
3. Two writers running at the same moment never both push. One pushes, the other waits or
   records that it deferred.
4. No writer ever force-pushes, rewrites a pushed commit, stashes or commits a path it did
   not write.
