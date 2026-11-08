---
name: movement-scores
description: >
  Reading OSC body-capture streams as musical material — the mandatory dedupe that must
  precede every other measurement, what acceleration may drive, what rotation may drive
  including stillness as a section boundary, and why attitude is an absolute heading that
  wraps at 2 pi and must be unwrapped before it can drive pitch or harmonic colour. Load
  before touching any movement-score jsonl, before deriving tempo, onsets, density or form
  from a body, and whenever a capture is described by the rate that was requested rather
  than the rate that arrived. Triggers on "movement score", "movement capture", "OSC",
  "/wek/inputs", "jsonl take", "miadi.take.v1", "landbase", "accelerometer", "gyroscope",
  "attitude", "100 samples per second", "onsets from the body", "tempo from his movement",
  "the sensor", "unwrap the heading".
version: 0.1.0
---

# Movement scores as musical material

## What the data is

Captures live one set per timestamp identifier in `~/movement-scores/` on the capture
device:

```
<tlid>.jsonl             the stream, one JSON object per line: {"t": <seconds>, "values": [f x 9]}
<tlid>.summary.json      the studio's own summary
<tlid>.jsonl.take.json   schema miadi.take.v1, context.practice = ep083-landbase
```

The stream is OSC on the address `/wek/inputs`, **nine float channels**:

| channels | content |
|---|---|
| 0–2 | linear acceleration |
| 3–5 | gyroscope |
| 6–8 | attitude |

**Units are not declared.** The studio's own field ledger states that the channel semantic
map is absent, and its note says only what the map *would* read: acceleration g times
three, rotation rad/s times three, attitude rad times three. Therefore **write every number
bare, with no unit**, and say in the header why. The music does not depend on units,
because everything the atelier derives from these channels is a **ratio** — a value divided
by that take's own peak, or one duration against another.

This was paid for. Opus 017 wrote "2.96 m/s²" and "15.8 rad/s" as if the unit were known.
It was not known. Opus 018's header names the error rather than silently fixing it.

The one angle that may honestly be reported in degrees is a difference of an **unwrapped**
heading, because that is a ratio of angles and not a conversion out of an unknown unit.

**Sensor placement is prose, not a field.** The studio's honesty ledger says, in words,
"phone worn on the belly". Treat it as prose, quote it when it changes the reading — and it
does: it means the clock is his belly, not his step — and never promote it to a measured
fact.

---

## The first rule: dedupe, before anything else

**Drop every packet whose `values` array is identical to the previous packet's.** In code
this is the entire rule:

```python
N = [P[0]] + [P[i] for i in range(1, len(P)) if P[i]['values'] != P[i-1]['values']]
```

Nothing else in this skill may be computed on the raw stream.

### What the rate really is

He raised the capture rate and wrote:

> *"I've captured one more movement score right now, which is 260816171428 and sample rate
> was 100 sample per second which increased 10 times. Therefore it might give you something
> to create another variation."*

Measured on that file:

```
1627 packets over 16.6 s          98 Hz of packets — the rate is real
1232 of them repeat the previous value    76 %
395 new values                    23.8 Hz actual, median spacing 41 ms
```

**Multiplying the requested rate by ten multiplied the information by 2.4.** That is a real
gain — resolution moves from 100 ms to 41 ms, and it is what makes onset detection possible
at all — but it is not ten, and reporting it as ten would put a false number in the
provenance header.

The cause is in the studio's own GROUND layer, which said it before the atelier measured it:

> *"the conductor holding each channel's last value between beats is the OSC literature's
> standard mitigation for UDP's non-assured delivery"*

At 10 Hz his takes contained **zero** repeated values — the sensor kept up. At 100 Hz
requested it no longer does, and the conductor holds the last value. The held ratio is
stable across takes: a later 93.4 s capture gave 9150 raw packets and 2166 new values, 24 %.

### The failure the dedupe prevents

Onsets detected on the raw 1627 packets gave **28 onsets, spaced 120 to 133 ms apart**.
That regularity is the staircase of the held values — the conductor's repeat interval — and
not his body. A piece built on it would have been a rhythm transcription of the network
layer.

On the 395 new values: **15 onsets, spaced 153 to 1481 ms.** Two bursts separated by 1.5 s
of silence, and ten seconds of near-stillness before them. That is a musical form, and it
is his.

Every derived quantity inherits this. Any tempo, onset, density or boundary computed before
the dedupe is a measurement of the transport.

---

## Acceleration — density and dynamics

Take the magnitude of channels 0–2, averaged per second of the take. Then normalise against
that take's own peak and read the ratio through a step table. Both the step table and the
number of steps are choices; the curve is his.

Opus 019's table, for a voice that must appear, grow and pass:

```
r < 0.10   0 notes in the measure — he is not there yet
r < 0.25   1
r < 0.45   2
r < 0.70   4
else       8
```

Dynamics come from the same ratio through a parallel table of written marks, `!pp!` through
`!ff!`, emitted only when the mark changes.

Acceleration also detects **section boundaries the human does not have to announce**. In
the 93.4 s take his per-second acceleration reads:

```
 0–14 s   0.02–0.15   almost still — he is listening
15–41 s   0.17–0.52   it is rising
42–44 s   0.76–0.85   the step changes
45–56 s   1.16–1.84   the turn — his maximum, held twelve seconds
57–84 s   0.50–1.08   the groove, regular
85–93 s   0.61 → 0.19 he comes back down
```

He had asked: *"You'll clearly see when I'm starting to transition and express the beat."*
He was right, and it is at second 42, where the amplitude doubles and never returns. The
piece changes tempo there and the drums enter there, and the header says the boundary was
measured rather than chosen.

**Tempo from acceleration, honestly.** Autocorrelation of the per-second acceleration, by
section, on that take:

```
before  (0–42 s)    the peak lands on the search boundary — no period; he is not beating
turn    (42–57 s)   0.400 s → 150 BPM   (strength 0.58)
groove  (57–85 s)   0.440 s → 136 BPM   (strength 0.51)
end     (85–94 s)   0.440 s → 136 BPM   (strength 0.37)
```

His 98 onsets between 45 and 85 s have a median spacing of 0.399 s, also 150 BPM, with
clusters at 0.4 s (28), 0.3 (21), 0.2 (18), 0.5 (16).

**His body is not a metronome, and the report must not pretend otherwise.** He has a
preferred period between 0.40 and 0.44 s — 136 to 150 — not a lock. At 23 Hz of real values
the resolution is 43 ms, which is worth about ±7 BPM at that period: part of the 136/150
spread is the instrument, not him. 136 was retained because it is the period of the groove,
the longest and most stable section, and it is a plausible tempo for the genre he asked
for. All of that goes in the header, including the part that weakens the claim.

---

## Rotation — density, and stillness as a section boundary

Take the magnitude of channels 3–5, averaged per second. It drives density and dynamics the
same way acceleration does, through a step table.

**The most musical thing in the data is where rotation stops.** Opus 018 reads stillness as
`rotation < 0.5` and opens a new harmonic station at each rising edge into stillness: where
his body stops, the harmony changes. Nothing else in these nine channels segments a take as
convincingly, and nothing else needs so little interpretation — a still body is a still
body.

Two consequences worth carrying:

- The number of stations his body offers is whatever it offers. When six harmonic stations
  were wanted and the body gave four boundaries, the piece took **two passes** — and the
  second pass is not a repeat: the top voice falls silent during his stillnesses where the
  first pass held a whole note. That is a choice, declared as one.
- The default clock of the atelier is **one second of the body = one measure**. It is used
  in opus 017, 018, 019, 020 and 023. It is a choice and it is undone with a word.

---

## Attitude — a heading, not an intensity

Channel 9 never drops below 0 and rises to 6.28. **It is an absolute heading, in radians,
and it wraps at 2 pi.**

This was named before it was used: in a spoken lesson the atelier said attitude was the
next door to open and that it could not drive a volume, because it is not an intensity.
Measuring the eight takes confirmed it and made it usable.

**Raw use is not a subtle error, it is a catastrophic one.** Take 260816133652 jumps by
±2 pi **thirteen times**; take 260816030043 jumps four times. Driving anything from the raw
channel makes the music leap a full turn every time he passes north — a leap that
corresponds to **no movement of his at all**.

**Unwrap it: accumulate the successive deltas after folding each into (−pi, pi].**

```python
def unwrap(v):
    u = [v[0]]
    for i in range(1, len(v)):
        d = v[i] - v[i-1]
        while d >  math.pi: d -= 2*math.pi
        while d < -math.pi: d += 2*math.pi
        u.append(u[-1] + d)
    return u
```

Report how many wraps were removed before a note was written. Opus 020's header does.

### What attitude may drive

Once unwrapped it gives what neither acceleration nor rotation can give: **a direction. Not
a force — an orientation.** So it drives **pitch or harmonic colour**, and nothing that
means loudness or effort.

The realisation that works: **six harmonic stations mapped to six sextants of the compass.**
The chord is no longer chosen by a clock or by a threshold; it is chosen by where he is
facing. He turns, the harmony turns. And the chord does **not** change at the barline — it
changes on the eighth-note where his heading crosses a sextant boundary, so the music
follows his head rather than the metronome.

**That mapping was validated before a note was written.** Across five usable takes the
sextant segmentation produced between **6 and 32 chord changes per take** and always touched
**2 to 4 of the six stations** — neither frozen nor chopped. A mapping that yields one chord
for a whole take, or a change every eighth, is rejected at that stage rather than after
listening.

### Attitude may not drive intensity

It has no zero that means "nothing" and no maximum that means "everything". Mapping a
heading to a volume, a velocity or a density produces a piece that gets louder when he faces
north, which is not a fact about him.

---

## Reporting a take

Whatever the piece does, the header states, per take: the identifier, the raw packet count,
the new-value count and the resulting real rate, the duration, which channels were used,
how many wraps were removed if attitude was used, and the per-second curve that produced
the form. A movement piece whose header names only the requested rate is unfinished.

---

## Runtime floors, loading, canonical copy

**Required**: `python3` with the standard library only — `json`, `math`, `statistics`,
`collections` are the entire import list of every movement generator in this atelier. That
is deliberate and it is what makes these measurements runnable on the capture device itself.
`numpy` is used through a detected interpreter when present, never required.

**Fail loudly**: if the `.jsonl` cannot be parsed, or if a `values` array does not carry
nine floats, report the line number and stop. Do not pad, do not interpolate, do not assume
a channel order that the file does not show.

Paths resolve under `${CLAUDE_PLUGIN_ROOT}`, from an environment variable, or from an
argument. The capture directory is read from the environment or passed in; it is never
hardcoded. **Hooks load at session start and do not hot-swap.**

**Canonical copy**: nothing here is copied from `/etc/claude-code/skills/`. This file, at
`${CLAUDE_PLUGIN_ROOT}/skills/movement-scores/SKILL.md`, is the canonical text.
