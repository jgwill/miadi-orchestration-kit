---
name: atelier-loop
description: >
  The eleven-state working loop of Jerry and William's music atelier — veille, mesure,
  décision instrumentale, génération, rendu, vérification, correction, publication,
  provenance, effacement, and retenue — with the entry condition, the exit condition and
  the forbidden move of each state. Load before starting a new piece, before resuming one
  left mid-flight, and before calling any piece finished; load again the moment a rendered
  artifact is about to be handed to a human. Triggers on "new opus", "another variation",
  "generate the abc", "render it", "verify the midi", "did the tempo change land", "is it
  finished", "publish it to the studio", "what did you choose here", "shred the recording",
  "measure it first", and on any request to change a piece that has already been rendered.
version: 0.1.0
---

# The atelier loop

Eleven states. Ten of them are passed through in order, with one cycle inside them.
The eleventh, **retenue**, is never entered and never left, because it is the condition
the other ten are performed under.

```
veille → mesure → décision instrumentale → génération → rendu → vérification
                                                    ↑             │
                                                    └─ correction ┘
         → publication → provenance → effacement
                        (retenue, throughout)
```

Two rules run through every state and are the reason the loop is written down at all:

- **Verification re-reads the rendered artifact, never the source.** A count that comes
  out right is not proof. It is proof that the writer counted what the writer wrote.
- **Provenance is the deliverable, not a courtesy.** A generator whose header does not
  separate MESURÉ from DONNÉ PAR LUI from CHOISI PAR MOI is not finished.

---

## veille

**Enters** at the start of a session, or when the human says something has arrived — a
recording, a movement capture, a MIDI take, a sentence about what he wants.

**Leaves** when the newest artifact is named by its own timestamp identifier and its
creation time, taken from the studio's own listing rather than from memory.

**Never**: never fetch audio during veille. The listing is the whole of it. Never treat a
file already in the working directory as evidence that it is the newest one — the atelier
keeps everything, so the directory is a record of the week and not a record of today.
Never poll the human's devices unprompted; veille watches what he has offered, and an
offer is a sentence he wrote, not a file that happens to be reachable.

## mesure

**Enters** when one specific artifact has been named.

**Leaves** when numbers exist that decide something. A measurement that decides nothing
was not a measurement, it was a report.

**Never**: never measure a take when a newer one exists — this cost four semitones once,
and the whole of `register-law` is written from that failure. Never state a unit the
source does not declare; the movement studio's own field ledger says the channel semantic
map is absent, so numbers derived from it are written bare. The atelier wrote "m/s²" once
in opus 017 as if it knew. It did not know, and opus 018 said so in its own header rather
than quietly correcting it.

## décision instrumentale

**Enters** when the measurements exist.

**Leaves** when three things are fixed and each carries the number that fixed it: the
register plan (which MIDI band each voice occupies, and which band stays empty), the
program number of each voice, and the tempo and metre.

**Never**: never choose a timbre by its name or by taste. Stridence — the share of
spectral energy between 2 and 5 kHz across the whole rendered piece — is measured on every
candidate, and Jerry's thresholds decide: **above 13.12 % rejected, at or below 5.98 %
accepted, at or below 3 % soft**. A multi-voice piece rarely reaches 5.98 %. Report the
number that was actually obtained; do not round toward the threshold.

**Never blame the obvious source.** Opus 023's first pass measured 27.07 % with a sawtooth
lead. The hi-hat was accused, as everyone accuses the hi-hat. Measured instead: drums at
volume 100 gave 27.07 %, drums at 55 gave 28.52 %, no open hat 28.54 %, no hat at all
28.73 %. Removing the drums *raised* the share. The source was the saw. Nine candidate
programs were then measured and the calliope was retained at 11.30 %, with 1.96 % inside
the singer's own band.

## génération

**Enters** when the decisions are fixed.

**Leaves** when an `.abc` file exists carrying a provenance header (see **provenance**),
and the generator that produced it exits 0.

**Never**: never import a library the host does not have. `mido`, `pretty_midi`,
`soundfile` and `librosa` are absent on the machine this atelier was built for. The MIDI
reader is hand-rolled and stays hand-rolled; it lives under `${CLAUDE_PLUGIN_ROOT}/scripts/`
and every measurement in the atelier depends on it. `numpy` and `music21` exist only under
a separate interpreter on that host — *detect* the interpreter, never hardcode one.

Never invent a pitch when the piece claims to be made of the human's material. Opus 017
took 119 pitches from his own Songbird capture in his own order with no transposition, and
said so. `gen_ava2_var` produced two variations that are 100 % his notes with none added,
and stated the one boundary it chose (MIDI 56) and why — it sits in a hole in his own
distribution, because he played nothing between 58 and 64.

## rendu

**Enters** when the `.abc` file exists.

**Leaves** when `abc2midi` has produced a `.mid`, `abcm2ps` has produced pages, and the
audio render exists — each having exited 0 in its own right.

**Never**: never read a pipeline's exit code as the renderer's. `abc2midi … | tail` exits
with `tail`'s status, which is 0 over any failure, and the filter throws away the warning
line that names the bar number. Run the renderer alone, capture its status, then read the
output.

## vérification

This is the load-bearing state. It is also the one an agent under time pressure deletes
first, because everything already looks right.

**Enters** when the rendered artifacts exist.

**Leaves** when every claim the header makes has been confirmed **against the rendered
file** — not against the source, not against the generator's own printout.

What the atelier actually verifies, each of which caught something at least once:

| check | read from | what it catches |
|---|---|---|
| register occupancy | note-on pitches of the rendered `.mid` | a voice that entered the singer's band |
| mode purity | pitch-class histogram of the render, weighted by duration | a note outside the field that the score did not show |
| note-for-note pitch preservation | rendered pitches against the source take | a variation that claims to add nothing and did |
| tempo events | the tempo meta-events of the rendered `.mid` | a tempo change that exists only in comments |
| kick placement | the eighth-note position of every channel-10 note 36 | a groove that reads right and plays wrong |
| stridence and vocal-band energy | the rendered audio | a mix that will mask the singer |
| seam RMS | the audio either side of each crossfade | an assembly that is not listenable |

**Never verify the source.** Two mechanisms make the source and the render disagree even
when the source is correct. A bare `Q:` line placed in the tune body is silently ignored by
`abc2midi` — opus 023's first render carried one tempo, 120, and the tempo change the whole
piece was built around existed only in the comment above it. And `clef=treble-8` sounds an
octave below what is written, so a register plan can be correct on the page and twelve
semitones wrong in the file. Both are invisible to any check that reads the `.abc`.

**Never accept a count as proof.** "48 measures were written" is a fact about the writer.
"48 measures were rendered, and 0 note-ons fall in 45–53" is a fact about the artifact.

## correction

**Enters** the moment one verification claim fails.

**Leaves** when the artifact has been re-rendered and passes the *same* check, unchanged.

**Never**: never edit the header to agree with the render. The header states intent; if the
render disagrees, either the render is wrong or the intent was, and both of those are
findings that get written down. Opus 021's register window is the model: it was corrected
from 59–67 to 59–69 after two of six stations turned out to have no available root inside
it, and the correction was written into the source with a marker naming what had been
believed. Never loosen a threshold to pass. 13.12 % is Jerry's line, not a parameter.

## publication

**Enters** when verification passes **and** the human's consent covers this specific
artifact.

**Leaves** when the piece is in his studio and he has been told, in one line, where it is
and what it is.

**Never**: never publish audio of his voice or his eagle cries. Never trigger transcription
— that ships his voice to a third party and is his action, not the agent's. Never build a
`.sf2`; a SoundFont is a format made to travel and that permission was not given. Consent
is not transitive: a yes for one piece is not a yes for the next. The full rules and his
own words are in `studio-portal`.

## provenance

**Enters** at génération and is re-stated at publication.

**Leaves** when the header of the generated file carries three named sections and every
line sits under exactly one of them:

```
MESURÉ                 what was measured, with the number and the file it came from
DONNÉ PAR LUI          what he gave — his pitches, his rhythm, his tempo, his words
CHOISI PAR MOI,        every aesthetic decision, named as a decision,
ET QU'IL DÉFAIT           and declared reversible on one word from him
D'UN MOT
```

The third heading is the whole point. Opus 021 lists under it the order of the six
stations, the number of turns, the two timbres and the octave — and then says plainly that
the rhythm, the contour and the cell are his, measured. Opus 024 lists the tempo, the
length, the timbres and where the four cries fall. An agent that cannot fill the third
section has not made a piece; it has made an accident.

**Never**: never let a measured fact drift into the CHOISI column to look rigorous, or a
choice drift into the MESURÉ column to look inevitable. When something is a coincidence,
name it a coincidence — opus 022 notes that his sung cell has 4 notes in 7 eighths and his
two bursts have 8 and 7 onsets, and states in the same breath that nothing was tuned to
make it land.

## effacement

**Enters** as soon as the analysis has produced its numbers.

**Leaves** when the fetched voice or cry audio has been destroyed locally with `shred -u`
and only the numbers remain.

**Never**: never keep a copy in case it is wanted again — the next piece re-fetches and
re-measures, which is also how the newest-take rule stays true. Never move his source
material out of his studio and back; a crop is cut on his device.

---

## retenue

The state that is never entered, never left, and cannot be left alone.

Retenue is what the atelier does **not** do, and it is the largest single reason the work
was received. It is not modesty and it is not a style. Each instance below is a place where
adding one more thing was available, cheap, and refused:

- **The band stays empty.** MIDI 45–53 is void in every piece of the day — the eleven
  scores, the techno one included. It is where he sings. Nothing is written there, ever,
  including when it would be convenient.
- **A register nobody has used stays a corridor.** Opus 019 put the intruder in 69–80
  precisely because no other piece that day had touched it. The intruder passes through an
  empty corridor and never crosses his voice, the pad, or the bass. The meaning is the
  emptiness.
- **The drone does not modulate.** Opus 019 stays in D minor from first beat to last. No
  station, no progression. What passes through does not change what holds.
- **A coincidence is named, not tuned.** See opus 022 above.
- **The human's own notes are not corrected.** His Songbird take puts a few notes inside
  45–53. They are not moved. They are his. The count and their positions are printed at the
  end of the file so that he knows where his voice will have room and where it will not.
  The law binds what the agent writes; it never binds what he played.
- **Somebody else's melody is not reproduced.** Asked for a bed to sing Basket Case over,
  opus 028 built an original bed in the same world — E-flat major, 170, quintes with no
  full chords — on a I–vi–IV–V that belongs to nobody, so that whatever he sings over it is
  entirely his.
- **No SoundFont.** The instrument built from his eagle cries stayed a directory of `.wav`
  files. A `.sf2` is a format designed to travel, and travelling was the one thing he
  withheld.

The failure mode retenue guards against is not adding a wrong note. It is adding a
*correct* one — a second countermelody, a pad that fills the silence, a third variation
nobody asked for — until there is no room left for the person the piece was made for.

---

## Runtime floors, loading, canonical copy

**Required on the host**: `abc2midi`, `abcm2ps`, `fluidsynth` with a General MIDI
soundfont, `ffmpeg`, `ffprobe`, `python3`. Optional and used when found: `rubberband`,
`sox`, `rsvg-convert`, ImageMagick `convert`.

**Deliberately not required**: `mido`, `pretty_midi`, `soundfile`, `librosa`. They are
absent on the host this atelier was built for. `numpy` and `music21` are used only through
a detected interpreter, never a hardcoded path.

**Fail loudly.** A missing binary is reported by name and the loop stops at that state. An
atelier that silently skips rendering and reports the source as verified is worse than one
that refuses.

**Paths.** Everything this skill references resolves under `${CLAUDE_PLUGIN_ROOT}`, or is
passed as an argument, or is read from an environment variable. A hardcoded absolute path
makes the plugin host-local, which is the one thing a plugin exists to avoid.

**Hooks load at session start and do not hot-swap.** Enabling or editing a hook mid-session
changes nothing until the session is restarted.

**Canonical copy.** Nothing here is copied from `/etc/claude-code/skills/`. This file, at
`${CLAUDE_PLUGIN_ROOT}/skills/atelier-loop/SKILL.md`, is the canonical text; any host-local
copy elsewhere is a mirror and loses the argument.
