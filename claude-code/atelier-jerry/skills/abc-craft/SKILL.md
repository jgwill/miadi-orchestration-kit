---
name: abc-craft
description: >
  Every ABC, abc2midi and abcm2ps trap this atelier paid for, each written as the symptom
  an agent will actually see, the cause, and the fix — implicit accidentals contaminating a
  bar, a bare Q line silently ignored in the tune body, %%MIDI beat not reaching a voice,
  abcm2ps overflowing on long single-staff scores, clef=treble-8 sounding an octave below
  what is written, the channel-10 drum map, and rests that cannot be written as one figure.
  Also carries the provenance-header discipline every generated score must satisfy. Load
  before writing or editing any .abc file and before diagnosing any render that came out
  different from the score. Triggers on "abc2midi", "abcm2ps", "the tempo change did not
  render", "Note too much dotted", "the note came out a semitone off", "%%MIDI", "channel
  10", "clef=treble-8", "which program number", "stridence", "provenance header".
version: 0.1.0
---

# ABC craft

Every entry below was paid for once. Each is written as **symptom, cause, fix**, because
the symptom is what an agent meets first and it rarely looks like its cause.

---

## The bare `Q:` in the tune body is ignored

**Symptom.** The rendered `.mid` carries a single tempo. The tempo change the piece was
built around is present in the `.abc` source and present in the comments and absent from the
music. Every count and every measure number is correct, so nothing looks wrong until the
file is played or its tempo meta-events are read.

**Cause.** A `Q:` line placed on its own inside the tune body is not honoured by `abc2midi`.
Only the header `Q:` took effect.

**Fix.** Write the tempo change as an **inline field inside the voice line**:

```abc
[V:1] [Q:1/4=136]=E2 =G =B =E2 z =G |
```

Opus 023's first render carried 120 from first bar to last, and the turn at bar 43 — the
whole subject of the piece, measured from his body — existed only as a comment. This is
also the cleanest example of why verification reads the render: no inspection of the source
would have caught it.

---

## An accidental contaminates the rest of its bar

**Symptom.** A pitch in the rendered MIDI is one semitone away from what the score means.
Verified case: a low note rendered as **42 instead of 41**.

**Cause.** In ABC an accidental applies to that pitch letter for the remainder of the bar,
exactly as in staff notation. A chromatic line written with implicit naturals inherits an
accidental from three notes earlier.

**Fix.** **Write an explicit accidental on every note, naturals included.** Every generator
in this atelier renders pitch classes through the same table, and every entry carries a
sign:

```python
LET = {0:'=C',1:'^C',2:'=D',3:'^D',4:'=E',5:'=F',6:'^F',
       7:'=G',8:'^G',9:'=A',10:'^A',11:'=B'}
```

The generated score becomes slightly noisier to read and stops being wrong. That trade is
not negotiable when the pitches are somebody's measured voice.

---

## `%%MIDI beat` did not reach voice 1

**Symptom.** Dynamics set with `%%MIDI beat` produce no velocity difference in the rendered
MIDI for that voice.

**Cause.** The directive did not apply to the voice it was written near. This was observed,
not diagnosed further.

**Fix.** Use **written dynamics** — `!pp!` `!p!` `!mp!` `!mf!` `!f!` `!ff!` `!fff!` — placed
before the note. They reach the MIDI, and unlike `%%MIDI beat` they are also visible in the
engraved score, so the human can see the shape the numbers produced.

Emit a mark only when it changes from the previous one. Every generator here keeps a
`nu_prec` variable for exactly that, which keeps the score readable and the diff small.

---

## `abcm2ps` overflows on long single-staff pieces

**Symptom.** `abcm2ps` fails or truncates on a long score.

**Fix.** `abcm2ps -k 8192`.

---

## `clef=treble-8` sounds an octave below what is written

**Symptom.** The register check fails against the rendered `.mid` while the source is
plainly correct. Every pitch in the file is 12 lower than the pitch in the score.

**Cause.** `clef=treble-8` is an octave-transposing clef and `abc2midi` honours it.

**Fix.** Know it, and let it be a deliberate choice rather than a surprise. This is the
second of the two mechanisms — the bare `Q:` is the first — that make a correct source
render into a wrong file, and together they are the argument for reading the render.

---

## A five-eighth rest cannot be written as one figure

**Symptom.** `abcm2ps` errors with **"Note too much dotted"**.

**Cause.** In 4/4 with `L:1/8`, `z5` asks for a duration that has no notated form.

**Fix.** Split it: `z4 z`. Any rest length that is not reachable by dots on a single figure
must be written as a sum.

---

## Drums

A percussion voice, verified in use:

```abc
V:3 name="Batterie" sname="Bt" clef=perc
%%MIDI channel 10
%%MIDI control 7 100
```

| written | MIDI | instrument |
|---|---|---|
| `C,,` | 36 | kick |
| `D,,` | 38 | snare |
| `^D,,` | 39 | clap |
| `^F,,` | 42 | closed hi-hat |
| `^A,,` | 46 | open hi-hat |

Simultaneous hits are a bracketed chord: `[C,,^F,,]`.

**Verify the placement in the render, not in the source.** The atelier's check is the actual
eighth-note position of every note 36 in the rendered file. A four-on-the-floor written as
`C,, z C,, z C,, z C,, z` is easy to write and easy to shift by one eighth without noticing.

---

## The voice header form

Every generator writes the same shape, and each line does work:

```abc
%%score [1 | 2 | 3]
K:Ddor
V:1 name="Flûte à bec" sname="Fb" clef=treble
%%MIDI gchordoff
%%MIDI program 74
%%MIDI control 7 68
```

- `%%MIDI gchordoff` stops `abc2midi` from generating an accompaniment track from the
  `"Dm"` chord symbols. The symbols are in the score for the human's eyes; without
  `gchordoff` they also become notes, in registers nobody planned — including the singer's
  band. Read from every generator in this atelier, which sets it on every voice.
- `%%MIDI program n` is the timbre, and it is chosen by measurement, not by name — see
  below.
- `%%MIDI control 7 n` is the per-voice volume, and it is the balance knob. Note that
  lowering it does **not** reliably lower stridence; see the drum measurement below.
- `L:1/8` or `L:1/16` sets the reading grain. Opus 022 reads 4/4 in sixteenths because his
  median onset spacing was 231 ms, which is two sixteenths at quarter = 120. **The grid is
  chosen for the gesture, not the gesture quantised to a habitual grid.**

---

## The program number is a measurement, not a taste

**Stridence** — share of spectral energy between 2 and 5 kHz across the whole *rendered*
piece. Jerry's thresholds: **above 13.12 % rejected, at or below 5.98 % accepted, at or
below 3 % soft.** A multi-voice piece rarely reaches 5.98 %; report the number obtained.

**Do not blame the obvious instrument.** Opus 023's first pass used a sawtooth lead
(program 81) and measured 27.07 %, more than double the rejection line. The hi-hat was
accused, as the hi-hat always is. Then it was measured:

```
drums at volume 100   27.07 %
drums at volume 55    28.52 %   ← it goes UP
without open hat      28.54 %
without any hat       28.73 %
```

Lowering or removing the drums *raised* the share. They were not the source. The saw was.
The candidate sweep that followed:

```
saw lead (81)     27.07 %      square lead (80)   21.61 %
vibraphone (11)   20.68 %      brass (62)         17.36 %
new age pad (88)  15.21 %      FM piano (5)       13.47 %
recorder (74)     12.15 %      electric piano     12.08 %
CALLIOPE (82)     11.30 %   ← retained, and 1.96 % inside his own band
```

The calliope is the only candidate under the line that still sounds electronic. A techno
piece stays brighter than the day's other pieces, which sat at 4 to 8 % — a hi-hat *is*
bright, that is the genre — but 11.30 % is under Jerry's line and 27 % was not. Say both
numbers.

**Measure two things, not one.** Stridence alone picks the instrument that buries the
singer. See `register-law` for the vocal-band energy measure and the two candidate tables
where the quietest option was the worst one.

---

## The provenance header

The header is written as ABC comment lines above `X:1`, so the provenance travels **inside
the score file** and survives being handed to anyone. It is not a README and it is not a
commit message; it is part of the piece.

Three sections, and every line of the header sits under exactly one:

```abc
% ═══════════════════════════════════════════════════════════════════════
% OPUS 021 — TA CELLULE, SIX FOIS
% William (la cellule, le rythme, le contour, le tempo) · JamAI (mise en
% partition) · 2026-08-16
%
% ─── MESURÉ ─────────────────────────────────────────────────────────────
%   mi3 → sol3 → si2 → mi3, intervalles +3 -8 +5, chanté trois fois dans la
%   prise 260816165840 à 92,6 s, 96,7 s et 98,1 s.
%   Durées médianes 0,46 · 0,52 · 0,26 · 0,50 s — total 1,74 s. Sept croches.
%
% ─── DONNÉ PAR LUI ──────────────────────────────────────────────────────
%   Le rythme, le contour, la cellule, et le tempo : 7/8, croche = 240.
%   C'EST SON TEMPO, PAS LE MIEN.
%
% ─── CHOISI PAR MOI, ET QU'IL DÉFAIT D'UN MOT ───────────────────────────
%   L'ordre des six stations, les quatre tours, les deux timbres, l'octave.
% ═══════════════════════════════════════════════════════════════════════
```

**MESURÉ** carries the number and the file it came from. Seven eighths at 0.25 s is 1.75 s;
his three sung occurrences measured 1.74 s. Ten milliseconds of difference, on three
occurrences sung in a park. That is what a measured claim looks like — the number and its
error, not an adjective.

**DONNÉ PAR LUI** is what is his. His pitches, his rhythm, his tempo, his words quoted
verbatim when the piece exists because he asked for it.

**CHOISI PAR MOI, ET QU'IL DÉFAIT D'UN MOT** is the section that makes the other two
trustworthy. Every aesthetic decision is listed there and declared reversible on one word
from him. Opus 021 lists the station order, the number of turns, the two timbres and the
octave. Opus 024 lists the tempo, the 48 bars, the timbres, and where his four cries fall.
Opus 023 lists the drum patterns, the bass line, the timbres, and the decision to keep his
cell as the riff instead of writing a new theme.

Three ways this header goes wrong:

- **A measured fact moved into CHOISI** to look rigorous, or a choice moved into MESURÉ to
  look inevitable. Both are lies about who made the piece.
- **A coincidence presented as a correspondence.** Opus 022 notes that his sung cell has 4
  notes in 7 eighths and his two bursts have 8 and 7 onsets — and says in the same sentence
  that it is a coincidence and that nothing was tuned to make it land.
- **An empty third section.** An agent that cannot name what it chose has not made a piece.

**A generator without this header is not finished**, regardless of how the music sounds.

---

## Runtime floors, loading, canonical copy

**Required**: `abc2midi`, `abcm2ps`, `fluidsynth` with a General MIDI soundfont, `ffmpeg`
and `ffprobe` for the spectral measures, `python3`. Optional and used when found:
`rsvg-convert` and ImageMagick `convert` for turning engraved pages into images.

**Fail loudly**: a missing renderer is named and the work stops. Never fall back to
reporting the source as verified.

**Never read a renderer's success from a pipeline.** `abc2midi … | tail` exits with `tail`'s
status, which is 0 over any failure, and the filter discards the warning line that names the
bar. Run the renderer alone, capture its status, then read what it wrote.

Paths resolve under `${CLAUDE_PLUGIN_ROOT}`, from an environment variable, or from an
argument. **Hooks load at session start and do not hot-swap.**

**Canonical copy**: nothing here is copied from `/etc/claude-code/skills/`. This file, at
`${CLAUDE_PLUGIN_ROOT}/skills/abc-craft/SKILL.md`, is the canonical text.
