---
name: register-law
description: >
  How to find the band a singer actually occupies and how to keep it empty — newest
  recording only, f0 by autocorrelation on 40 ms windows with 5-frame median smoothing,
  octave folding checked against the energy at f/4, held notes of at least 200 ms within
  one semitone, then a register plan whose void band is verified in the rendered MIDI
  rather than in the score. Load before choosing which MIDI range any voice occupies,
  before arranging anything a person will sing over, and whenever a piece is described as
  masking him or as sitting in the wrong place. Triggers on "which band do I leave empty",
  "register plan", "midi 45-53", "his voice", "he sang over it", "f0", "pitch tracking",
  "autocorrelation", "octave error", "does this mask him", "vocal band energy", "sa bande".
version: 0.1.0
---

# The register law

One sentence: **the singer's band is measured from his newest recording, and no instrument
the agent writes ever enters it.**

The band in force in this atelier is **MIDI 45–53** — nine semitones, A2 to F3. It is not a
constant. It is the output of a measurement that must be re-run whenever there is a newer
take, and it will move.

---

## The two failures that made this law

### One: a band chosen from a week-old take was four semitones wrong

The first bed left **MIDI 50–59** empty, because that is where his voice lived in the
previous piece — 81.5 % of his sung time in that earlier take. The reasoning was sound and
the source was stale.

He took that bed to the park, wrapped himself in his blanket, and sang over it for 4 min
31 s. The take was measured. **He sings lower.** The corrected band is 45–53, and the whole
register plan moved down four semitones.

The part that makes this the founding failure rather than a rounding error: **53.7 % of his
held time fell in MIDI 46–49** — the four semitones that separated the bass ceiling at 45
from the floor of the band that had been left for him at 50. He sang, for more than half
his held time, in the exact interstice the error had created. The band he had been given —
D3 to B3 — carried 16.4 %.

A stale band does not simply miss. It builds a corridor, and the singer walks into it.

**The rule that follows: measure the newest take, and only the newest take.** Prior
measurements are history, not input.

### Two: an octave error invented a note he never sang

The first report of that same take announced a B4 held 10 % of the time — a high note, and
a striking one. It does not exist.

The pitch tracker had detected 1301 frames near 494 Hz. Compared against the energy at
**f/4** — around his B2 — the lower partial is **5.33 times stronger, in 86 % of those
frames**. The tracker had locked two octaves above the fundamental. Corrected: his B2 is
his welcoming note, not a high one.

**The rule that follows: fold octaves, and never trust a detected f0 without comparing the
energy at f/2 and f/4 against the energy at f.** The check is cheap and it is the only
thing standing between a measurement and a fabricated musical fact about a person.

---

## The method

Run in this order. Each step exists because the step before it produces something
unusable without it.

1. **Newest recording only.** Take the studio's own listing, sort by creation time, use the
   top entry. If two takes are equally recent because he recorded a pair, use both in the
   order he recorded them and say so — he made them as a pair.

2. **f0 by autocorrelation**, windows of **40 ms**.

3. **Median smoothing over 5 frames.** Autocorrelation jumps octaves; a 5-frame median
   removes the isolated jumps without moving a real note.

4. **Octave folding, with the f/4 test.** For every candidate frequency, compare the energy
   at f/2 and f/4 against the energy at f. Fold down when the lower partial dominates. Report
   the ratio and the share of frames it held, as above: 5.33 times, 86 % of frames. A fold
   applied without a stated ratio is a guess.

5. **Held notes only: at least 200 ms without moving more than one semitone.** He talks
   through most of a recording. Without this filter the measurement is of his *speaking*
   voice. On the 271 s park take, held notes accounted for **74 s**.

6. **Check the result against the threshold settings.** The same take was re-measured at
   five settings — 160 to 300 ms of duration, ±60 to ±100 cents of tolerance — and the
   median stayed at C3/C#3 every time. A result that moves when the threshold moves is an
   artifact and is reported as one.

The park take, measured this way, folded to octaves:

```
B2  27.3 %   C3  22.2 %   C#3 17.4 %   D3  10.0 %   A#2 8.6 %
D#3  5.0 %   E3   3.7 %   F3   2.3 %   A2   1.9 %
94.1 % between A2 and E3 — eight semitones, nothing above.
B2 + C3 together = 49.5 % of his sung time.
```

That is not a melody. **He drones.** 129 held notes over 271 s, median duration 0.30 s, all
in the same place. A piece written for someone who drones is not a melody written at him —
it is what changes around his note. Opus 018 is built entirely on that reading: six
harmonic stations in D dorian in which his B2 and C3 never move and mean something
different at each one.

---

## The register plan

A register plan is a set of disjoint MIDI windows, one per voice, with the singer's band
among them and empty. The plan used across the atelier's eleven pieces:

| window | MIDI | role |
|---|---|---|
| bass | 33–44 | below him |
| **his voice** | **45–53** | **void, end to end** |
| pad / harp | 54–68 | above, without crossing him |
| high voice | 74–84 | well above |
| free corridor | 69–73 | left unused in most pieces; opus 019 spends it on one idea |

**A window that must hold an arbitrary pitch class needs a full twelve semitones.** Learned
twice. Opus 021 first used 59–67, nine semitones — the A and the G had no root available
inside it (A3 is 57, A4 is 69, neither is in the window) and two of six stations were
unplayable. It became 59–69. Opus 019 hit the same wall at 69–79, where G# had no
representative, and became 69–80. Enforce the window in code with an assertion, not by eye:
the helper that folds a pitch class into a window asserts that the result lies inside it,
so a window too narrow to hold the material fails at generation rather than at listening.

---

## Verify the void in the rendered MIDI, never in the score

The claim is "no instrument enters 45–53." The only artifact that can settle it is the
`.mid` that `abc2midi` produced.

Read every note-on of the rendered file, collect the pitches, and assert that the
intersection with the band is empty. Two mechanisms make a correct score render into the
band anyway:

- `clef=treble-8` **sounds an octave below what is written**. A part correctly notated at
  60–72 arrives at 48–60, straight through the void.
- Any transposition applied at render time, by an option or by a voice header, is invisible
  to a reader of the source.

`gen_ava2_v2` states the register table with the words "en numéros MIDI explicites et
vérifiés après rendu" — explicit MIDI numbers, verified after rendering. That phrase is the
standard.

---

## The spectral twin: staying out of his band is not only a MIDI question

An instrument can sit entirely above 53 in MIDI and still put energy in his Hz band and
mask him. So two numbers are measured on every candidate, and both must be good:

- **stridence** — share of spectral energy between 2 and 5 kHz across the whole rendered
  piece. Jerry's thresholds: above **13.12 %** rejected, at or below **5.98 %** accepted, at
  or below **3 %** soft.
- **vocal-band energy** — share of energy inside the singer's own Hz band.

The two do not agree, which is why both are measured. From the bed's six candidates:

```
horn at 84          14.62 % stridence   — above the 13.12 % rejection line
horn at 64          11.19 %
flute at 72          7.66 %
pad at 72            7.04 % stridence   5.50 % in his band  ← quietest, worst for him
voice "ooh" at 72    8.85 %
recorder at 72       7.47 % stridence   4.23 % in his band  ← retained
```

The pad is the least strident of the six and the worst of the six inside his band. Picking
by one number would have chosen the instrument that buries him. The same shape recurs in
opus 022's percussion candidates: the harp is the softest at 2.28 % stridence and the worst
in his band at 5.22 %; pizzicato strings at 5.55 % / 4.08 % were retained as the best of
both.

---

## What the law does not bind

**It binds what the agent writes. It never binds what he played.** When his own Songbird
take puts notes inside 45–53 — D3, D#3, E3, F3 in one of them — they are not moved, not
folded, not quietly transposed. They are his notes. The count and their positions are
printed at the end of the generated file so he knows where his voice will have room and
where it will not.

**The band is his, not a genre rule.** A different singer means a different measurement and
a different band. Re-run the method; do not carry 45–53 forward as a constant.

**Sometimes the band and the material agree without being forced, and that is worth
saying.** Opus 024 is built on his four eagle cries, which land on three notes — A7, B7, C8
at 3510–3575, 3898–3962 and 4102–4285 Hz. Transposed into bass and pad those become MIDI
33, 35, 36 and 57, 59, 60. None of the six is inside 45–53. The day's constraint and the
material of his cries fell into agreement with nothing bent, and the header says so rather
than taking credit.

**Leaving the band empty is also what makes a piece singable.** Opus 021 places his measured
cell an octave above where he sang it, for two reasons, and states which is the real one:
his band stays free, and — this is the real one — he can sing along in his own octave,
exactly where he found it. The piece is written to be doubled by his voice.

---

## Runtime floors, loading, canonical copy

**Required**: `python3` with the standard library, `ffmpeg`/`ffprobe` for decoding, and the
hand-rolled MIDI reader under `${CLAUDE_PLUGIN_ROOT}/scripts/`. `numpy` is used through a
detected interpreter when present and the autocorrelation falls back to pure Python when it
is not. `librosa` is absent on the host this was built for and must not be imported.

**Fail loudly**: if no audio decoder is available, report that and stop. A register band
guessed rather than measured is the exact failure this skill exists to end.

Paths resolve under `${CLAUDE_PLUGIN_ROOT}`, from an environment variable, or from an
argument. **Hooks load at session start and do not hot-swap** — a hook added mid-session
does nothing until restart.

**Canonical copy**: nothing here is copied from `/etc/claude-code/skills/`. This file, at
`${CLAUDE_PLUGIN_ROOT}/skills/register-law/SKILL.md`, is the canonical text.
