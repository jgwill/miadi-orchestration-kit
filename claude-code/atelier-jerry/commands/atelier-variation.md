---
description: Build a variation from a person's own take — their pitches, their timing, their body — writing a generator whose header separates what was measured from what was chosen.
argument-hint: "<source.mid|take.jsonl> [--kind split|mirror|conduct|cell|drone|assemble] [--out DIR]"
allowed-tools: Bash, Read, Write, Glob, Task
---

Build a variation from `$ARGUMENTS`. The material is theirs; the arrangement is yours and
can be undone with a word.

## First, measure

Run `/atelier-mesure` on the source and do not proceed without the figures. In particular
you need the void band — the register the person sings in, from their **newest** recording.
Inheriting it from an older take put it four semitones wrong once, and they went and sang in
the exact space the error left open.

## Choose a transformation that is a form, not a texture

`--kind` names the shape. Each of these was built and shipped; each keeps 100 % of the
person's pitches:

| kind | what it does | what it makes audible |
|---|---|---|
| `split` | separate one line by register into two voices, timing untouched | an alternation that was already there becomes a dialogue |
| `mirror` | the same line retrograde, durations following their note | a line that climbs becomes one that settles |
| `conduct` | their body's per-second amplitude sets note density and dynamics | the piece takes the time of their movement, not a metronome's |
| `cell` | a measured recurring cell carried through harmonic stations | their own motif, recoloured, still theirs |
| `drone` | their held note left untouched while the harmony moves under it | one note means six different things |
| `assemble` | several finished pieces joined, level-matched, crossfaded | the parts become one arc |

Reusing a transformation on new material is fine. Reusing the *same* transformation and
calling it a new piece is not — that is transposition wearing a new title, and it was named
as such by the musician the first time it happened.

## Write a generator, not a file

The deliverable is a Python generator that emits ABC, using
`${CLAUDE_PLUGIN_ROOT}/scripts/atelier_abc.py`. Its header block is the specification, and
`atelier_abc.py provenance` renders it:

- **MESURÉ** — every figure, with its method
- **DONNÉ PAR LUI / PAR ELLE** — the pitches, the timing, the form that came from the person
- **CHOISI PAR MOI, et qu'il défait d'un mot** — tempo, timbre, order, register windows
- **CORRIGÉ APRÈS MESURE** — anything you got wrong on the way, written in the past tense

A generator without that header is not finished.

## Then render, then verify, then stop

`${CLAUDE_PLUGIN_ROOT}/scripts/atelier_render.sh` for the audio and the score, then the
`verificateur` agent on the **rendered** file. If verification finds a divergence, that is a
stop: correct the generator, re-render, re-verify.

Publishing is a separate command, and it is separate on purpose.
