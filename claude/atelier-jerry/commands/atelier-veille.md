---
description: Watch one or more studios for what the musician deposits — recordings, and the room changes that never appear in the recordings list — and report only what is theirs.
argument-hint: "[--once] [--interval 75] [aureon=https://host:8768 jamai=https://host:4768]"
allowed-tools: Bash, Read
---

Start or run the watch over `$ARGUMENTS`, or over `ATELIER_STUDIOS` if no pair is given.

```bash
"${CLAUDE_PLUGIN_ROOT}/scripts/atelier_veille.sh" $ARGUMENTS
```

Run it in the background for a session-long watch; `--once` for a single pass.

## What the watch has to get right, and why each rule exists

**Poll the rooms, not only the recordings.** A photograph, a text, a note edit and a
transcription never appear in `/recordings`. A watch that reads only that list reports an
empty studio while the musician is filling it, and says so with confidence. That happened,
and the correction was heard as *"it's empty — it means you're not looking in the right
place."*

**Wait for the size to stop moving.** An `.m4a` still being written has no index yet and
cannot be read. Report a file only once its size is unchanged between two polls.

**Never report your own voice back to yourself.** Everything the agent publishes goes into
the self-echo ledger, and the watch skips it. Without that, an agent's own import arrives as
a deposit and gets answered as though the musician had spoken.

**Unreachable and empty are different findings.** Say which. An empty answer that cannot be
distinguished from a wrong query will always return the reading that lets you keep moving.

## Reading what it emits

| event | what it means |
|---|---|
| `DÉPÔT <studio> — <file>` | they put something in, and it is stable enough to read |
| `SALLE <studio> — <slug> : a → b` | the room changed: a clip, a text, an image or the note |
| `INJOIGNABLE <studio>` | no answer — check the path before concluding anything about the studio |
| `REVENU <studio>` | it answers again |

A phone walking between networks produces `INJOIGNABLE` followed by `REVENU` a cycle later.
That is not an outage; verify before reporting one.

## What the watch is for

Not surveillance. The musician records away from a screen, and the watch is what lets an
answer arrive in the room rather than in a terminal they will never read. When something
lands, measure it before responding to it.
