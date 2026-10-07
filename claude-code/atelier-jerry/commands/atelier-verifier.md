---
description: Read a rendered piece against every claim made about it and report claimed versus found — the gate that stands between a render and a publish.
argument-hint: "<file.mid|file.abc> [--source original.mid] [--empty 45-53] [--mode ddorian] [--expect-tempo 120,136]"
allowed-tools: Bash, Read, Grep, Task
---

Verify `$ARGUMENTS`. Nothing publishes until this passes.

## The rule

**Read the rendered artefact, never the source.** A generator's header states an intention.
Three tools sit between that intention and the file, and each has silently changed something
at least once: an accidental contaminated its bar and moved a note a semitone; a bare `Q:`
line in the body was ignored and a tempo change existed only in the comments; a container
refused a codec and wrote zero bytes while reporting success.

**A count that comes out right is not proof.** The right number of drum hits can land off
the beat. Read placement, not totals.

## What is checked

Run `${CLAUDE_PLUGIN_ROOT}/scripts/atelier_midi.py verify` and read the output yourself.

1. Register window per voice — actual min and max, not a verdict
2. **Void band empty** — zero notes in the declared range
3. Mode purity against the declared pitch-class set
4. Pitch preservation against `--source`, note-for-note **and** as a multiset
5. Tempo and meter events present at the tick they were claimed for
6. Drum placement — position within the bar, per drum
7. Duration, against the claim and against the audible content
8. Any stridence or vocal-band figure quoted in a label, re-measured on the shipping file
9. Seams on an assembled piece — RMS either side of every crossfade

## Report

Two columns, **claimed** and **found**, with figures on both sides. Then, explicitly, the
list of things that were **not** checked. A verification that implies more coverage than it
ran is worse than the bug it missed, because the next agent will trust it.

## On divergence

Stop. Do not publish, do not adjust the claim to match the file. Correct the generator,
re-render, re-verify. The claim was the specification; the file is what has to move.

Delegate to the `verificateur` agent when the piece is long or when several claims must be
broken at once — its whole job is to try to fail this.
