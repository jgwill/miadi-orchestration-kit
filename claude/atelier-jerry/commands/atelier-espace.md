---
description: Report storage on the Android studio device — recordings, composition rooms, movement captures — and print, without running, the cleanup it would suggest.
argument-hint: "[host] [--warn-percent 85] [--top 10]"
allowed-tools: Bash, Read
---

Report device storage for `$ARGUMENTS`, or for `ATELIER_DEVICE`.

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/atelier_espace.sh" $ARGUMENTS
```

## Why this exists

The studio lives on a phone. Recordings are the raw material of everything the atelier
makes, and they accumulate fast: a single afternoon produced dozens of clips, several
multi-megabyte renders, hours of movement capture at up to a hundred packets a second, and a
ten-minute assembled piece at fifteen megabytes. A full `/sdcard` stops the recorder, and the
recorder stopping is how a musician loses a take they cannot make twice.

## What it reports

- filesystem usage for `/sdcard` and the Termux home, with a warning above `--warn-percent`
- the size of every `Recordings-*` directory, per workspace
- the size of every `compositions-*` workspace, and per room inside it
- the largest files, with their room
- `~/movement-scores/`: capture count and total size

## What it does not do

**It never deletes.** It prints the commands it would suggest and stops. The recordings are
someone's voice and someone's body; which of them is disposable is not an agent's call, and
a take that looks redundant by size may be the one they were reaching for.

## Reading a failure

Two distinct failures, and the difference matters before you report anything:

- **connection refused** — `sshd` is not running inside Termux on that device. The phone is
  reachable; the door is shut.
- **timeout** — the network path itself is down. Check the tailnet before touching the phone.

Reporting the second as the first sends someone to the wrong room.
