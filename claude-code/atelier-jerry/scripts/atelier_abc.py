#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""atelier_abc.py -- ABC construction for the atelier.

Standard library only. No mido, no music21, no numpy. The machine this was
written for has none of them; a module that imports them fails exactly where it
was meant to serve.

This file invents nothing. It encodes SIX ABC TRAPS THAT WERE PAID FOR IN REAL
WORK on 2026-08-16, and that the plugin exists to make unrepeatable. Each one is
named at the place where it bites:

  1. AN EXPLICIT ACCIDENTAL ON EVERY NOTE, naturals included.   -> pitch()
     An accidental holds to the bar line for every later note of THE SAME
     LETTER. Reproduced here: `^F,, =G,, F,,` renders 42 43 42, where
     `^F,, =G,, =F,,` renders 42 43 41. That is the 42-instead-of-41 exactly.
  2. A WINDOW NARROWER THAN AN OCTAVE LEAVES PITCH CLASSES WITH
     NO REPRESENTATIVE.                                        -> in_window()
     Two of six harmonic stations were unplayable. The fix is a full octave, and
     the error message says so.
  3. `%%MIDI beat` DOES NOT REACH VOICE 1.                      -> dynamics()
     Measured: velocities 80-105 where 40-112 were asked for. WRITTEN marks
     (!pp! ... !fff!) do arrive, and appear in the score as well as the MIDI.
  4. A BARE `Q:` LINE IN A MULTI-VOICE BODY IS SILENTLY IGNORED. -> tempo_inline()
     Reproduced here: two voices, a change asked for at bar 3 -- the bare form
     yields tempo events [96.0], the inline form [96.0, 136.0], both exit 0.
     In a SINGLE-voice tune the bare form works, so it fails only once the piece
     grows a second voice. A mid-tune tempo must be inline.
  5. A 5-EIGHTH REST IN 4/4 CANNOT BE ONE `z5`.                 -> rest()
     abcm2ps answers "Note too much dotted" and exits 1. Measured on this host:
     5, 9, 10, 11 fail; 1, 2, 3, 4, 6, 7, 8, 12, 14, 16 pass.
  6. `clef=treble-8` SOUNDS AN OCTAVE BELOW WHAT IS WRITTEN.    -> header()

And one rule that is not a trap but a contract:

  7. A GENERATOR WITHOUT ITS PROVENANCE BLOCK IS NOT FINISHED.  -> provenance()
     MESURÉ · DONNÉ PAR LUI · CHOISI PAR MOI, ET QU'IL DÉFAIT D'UN MOT.
     Those three headings stay in his language. They are the atelier's own
     words, and translating them would quietly turn a commitment into a label.

Usage:
    import atelier_abc as A
    A.pitch(61, 2)                  -> '^C2'
    A.in_window(9, 59, 69)          -> 69
    A.rest(5)                       -> 'z4 z'
    A.drum_bar({**A.four_on_the_floor(), **A.offbeat_hat()})

CLI:
    python3 atelier_abc.py demo     -> a small valid tune on stdout exercising
                                       explicit accidentals, a drum bar, an
                                       inline tempo change and the provenance
                                       block.
"""

from __future__ import annotations

import argparse
import sys

__all__ = [
    "pitch", "in_window", "RegisterPlan", "dynamics", "dynamics_from_value",
    "tempo_inline", "drum_bar", "four_on_the_floor", "offbeat_hat", "rest",
    "tied_note", "header", "provenance", "is_legal_length", "split_length",
    "NOTE_LETTER", "GM_DRUMS", "DYNAMIC_MARKS", "LEGAL_LENGTHS",
    "WindowTooNarrow", "BandsOverlap", "BandNotEmpty", "IllegalLength",
    "ProvenanceMissing",
]


# ═════════════════════════════════════════════════════════════════════════
#  Errors -- each one carries its own fix in its text.
# ═════════════════════════════════════════════════════════════════════════

class WindowTooNarrow(ValueError):
    """A pitch class has no representative inside the requested window."""


class BandsOverlap(ValueError):
    """Two named bands of a RegisterPlan overlap."""


class BandNotEmpty(AssertionError):
    """A band that had to stay empty contains rendered notes."""


class IllegalLength(ValueError):
    """A duration abcm2ps refuses -- "Note too much dotted"."""


class ProvenanceMissing(ValueError):
    """The MESURÉ / DONNÉ / CHOISI block is incomplete."""


# ═════════════════════════════════════════════════════════════════════════
#  1. PITCHES -- an explicit accidental on every note
# ═════════════════════════════════════════════════════════════════════════

#: Pitch class -> its ABC letter WITH the accidental written out.
#: The natural sign `=` is not decoration: without it, a `^C` placed earlier in
#: the bar changes every later C in that same bar.
NOTE_LETTER = {
    0: "=C", 1: "^C", 2: "=D", 3: "^D", 4: "=E", 5: "=F",
    6: "^F", 7: "=G", 8: "^G", 9: "=A", 10: "^A", 11: "=B",
}

#: The whole-number durations abcm2ps accepts, in units of L: -- 2^k, 3*2^k,
#: 7*2^k (plain, dotted, double-dotted). Measured on abcm2ps-8.14.14: 5, 9, 10
#: and 11 exit with "Note too much dotted"; 7, 12, 14 and 16 pass.
LEGAL_LENGTHS = tuple(sorted(
    {2 ** k for k in range(0, 7)}
    | {3 * 2 ** k for k in range(0, 6)}
    | {7 * 2 ** k for k in range(0, 4)}
))


def is_legal_length(n):
    """True if `n` units of L: can be written as ONE figure.

    The counter-example that costs money is 5. See rest() and tied_note().
    """
    return int(n) in LEGAL_LENGTHS


def split_length(n):
    """Split `n` units into legal figures, longest first.

    >>> split_length(5)
    [4, 1]
    >>> split_length(11)
    [8, 3]
    """
    n = int(n)
    if n <= 0:
        raise IllegalLength("a duration must be strictly positive, got %r" % n)
    out = []
    remaining = n
    while remaining > 0:
        take = max(x for x in LEGAL_LENGTHS if x <= remaining)
        out.append(take)
        remaining -= take
    return out


def _length_token(length):
    """The duration suffix of an ABC token.

    `None` and 1 are not written; a string ("3/2", "/2") passes through on the
    caller's responsibility; an integer is checked against LEGAL_LENGTHS.
    """
    if length is None:
        return ""
    if isinstance(length, str):
        return length
    n = int(length)
    if n == 1:
        return ""
    if not is_legal_length(n):
        raise IllegalLength(
            "length %d is illegal: abcm2ps answers \"Note too much dotted\" and "
            "exits 1. The writable figures are %s. For a note use "
            "tied_note(midi, %d); for a rest use rest(%d)."
            % (n, ", ".join(str(x) for x in LEGAL_LENGTHS if x <= 32), n, n)
        )
    return str(n)


def pitch(midi, length=None):
    """A MIDI note -> its ABC token, EXPLICIT ACCIDENTAL INCLUDED.

    C4 = midi 60 = `=C`. Octaves go lowercase then apostrophes upward, commas
    downward.

        pitch(60)      -> '=C'      pitch(61)      -> '^C'
        pitch(48)      -> '=C,'     pitch(36)      -> '=C,,'
        pitch(72)      -> '=c'      pitch(84)      -> "=c'"
        pitch(67, 2)   -> '=G2'

    WHY THE NATURAL IS ALWAYS WRITTEN
        In ABC an accidental holds until the bar line, for every later note of
        THE SAME LETTER. Writing `^F ... F` inside one bar does not give F sharp
        then F natural: it gives TWO F sharps.

        Reproduced on this host with abc2midi 4.88, one bar, same intent:

            ^F,, =G,,  F,, =G,, ^F,, =G,,  F,, =G,,  -> 42 43 42 43 42 43 42 43
            ^F,, =G,, =F,, =G,, ^F,, =G,, =F,, =G,,  -> 42 43 41 43 42 43 41 43
                                                                  ^^          ^^
        That is the "42 instead of 41" the atelier paid for, exactly. The
        condition is a letter RECURRING in a bar after an accidental -- which is
        why a chromatic or modal line is where it bites, and why a run that
        happens never to repeat a letter renders fine and teaches you nothing.

        The cost of the systematic natural is one character. The cost of leaving
        it out is a wrong pitch that no reading of the source reveals -- it only
        shows up in the rendered MIDI.

    `length` is in units of L:. An integer is checked here, so 5 raises
    IllegalLength instead of letting abcm2ps refuse the score much later.
    """
    n = int(midi)
    if not 0 <= n <= 127:
        raise ValueError("MIDI pitch outside 0-127: %r" % midi)
    s = NOTE_LETTER[n % 12]
    octave = n // 12 - 5              # 0 = the octave of C4
    if octave >= 1:
        s = s[:-1] + s[-1].lower() + "'" * (octave - 1)
    elif octave < 0:
        s += "," * (-octave)
    return s + _length_token(length)


def tied_note(midi, eighths):
    """A note of an illegal duration, written as tied legal figures.

    >>> tied_note(60, 5)
    '=C4-=C'

    This is the only honest way to hold five eighths on one pitch: `=C5` does
    not exist for abcm2ps.
    """
    parts = split_length(eighths)
    return "-".join(pitch(midi, p) for p in parts)


# ═════════════════════════════════════════════════════════════════════════
#  2. WINDOWS -- a full octave, or a pitch class has nowhere to live
# ═════════════════════════════════════════════════════════════════════════

def in_window(pitch_class, lo, hi):
    """The pitch of `pitch_class` that lives inside the MIDI window [lo, hi].

    Returns the HIGHEST representative of the class that still fits under `hi`.

        in_window(9, 59, 69)  -> 69        (the A of the window 59-69)
        in_window(2, 33, 44)  -> 38

    THE TRAP, AND IT BROKE TWO STATIONS OUT OF SIX
        A window of fewer than twelve semitones does not contain all twelve
        classes. Written 59-67 it has no A at all (57 is below, 69 is above),
        and two of six harmonic stations became unplayable with nothing saying
        so before the render. The original generator hid the problem behind a
        `while n < lo: n += 12` that pushed the note ABOVE `hi`, followed by a
        bare `assert`.

        THE FIX IS A FULL-OCTAVE WINDOW: hi - lo >= 11.
        Here the error says that in words rather than failing on an assert with
        no text.
    """
    pc = int(pitch_class) % 12
    lo, hi = int(lo), int(hi)
    if hi < lo:
        raise ValueError("inverted window: lo=%d > hi=%d" % (lo, hi))
    n = pc + 12 * ((hi - pc) // 12)          # highest one at or below hi
    if n < lo:
        span = hi - lo + 1
        raise WindowTooNarrow(
            "pitch class %d (%s) has no representative in the MIDI window %d-%d: "
            "the window is only %d semitone%s wide. A WINDOW NARROWER THAN AN "
            "OCTAVE leaves pitch classes with nowhere to live, and that is the "
            "bug that made two of six harmonic stations unplayable. THE FIX IS A "
            "FULL OCTAVE: hi - lo >= 11, for instance %d-%d."
            % (pc, NOTE_LETTER[pc], lo, hi, span, "s" if span > 1 else "",
               lo, max(hi, lo + 11))
        )
    return n


# ═════════════════════════════════════════════════════════════════════════
#  3. THE REGISTER PLAN -- and the band that must stay empty
# ═════════════════════════════════════════════════════════════════════════

class RegisterPlan:
    """Named MIDI bands that do not overlap, and one that gets verified.

    The four default names are the ones held all through 2026-08-16:

        bass   33-44    below him
        void   45-53    HIS VOICE -- 94.1 % of his drone sits between A2 and E3;
                        no instrument enters it, in any piece
        pad    54-68    above, without crossing him
        high   74-84    well above

    `void` is not a decorative interval: it is a consent made measurable. The
    check does not read the generator's source, it reads the notes of the
    RENDERED MIDI -- a count that comes out right in the source is not proof.

        plan = RegisterPlan()
        plan.place(9, "pad")               # an A somewhere in the pad
        plan.assert_empty(rendered_notes, "void")
    """

    DEFAULT_BANDS = {
        "bass": (33, 44),
        "void": (45, 53),
        "pad":  (54, 68),
        "high": (74, 84),
    }

    def __init__(self, bands=None, **kwargs):
        merged = dict(self.DEFAULT_BANDS if bands is None else bands)
        merged.update(kwargs)
        self.bands = {}
        for name, span in merged.items():
            lo, hi = int(span[0]), int(span[1])
            if hi < lo:
                raise ValueError("band \"%s\" is inverted: %d-%d" % (name, lo, hi))
            if not (0 <= lo <= 127 and 0 <= hi <= 127):
                raise ValueError("band \"%s\" outside 0-127: %d-%d" % (name, lo, hi))
            self.bands[name] = (lo, hi)
        self._check_no_overlap()

    # ── validation ───────────────────────────────────────────────────────
    def _check_no_overlap(self):
        items = sorted(self.bands.items(), key=lambda kv: kv[1])
        for (na, (la, ha)), (nb, (lb, hb)) in zip(items, items[1:]):
            if lb <= ha:
                raise BandsOverlap(
                    "bands \"%s\" (%d-%d) and \"%s\" (%d-%d) overlap on %d-%d. "
                    "Two crossing bands make assert_empty() useless: the empty "
                    "band is no longer verifiable."
                    % (na, la, ha, nb, lb, hb, lb, min(ha, hb))
                )

    def narrow_bands(self):
        """Bands narrower than an octave -- the ones where in_window() may
        legitimately refuse a class. Read this BEFORE generating, not after."""
        return [n for n, (lo, hi) in sorted(self.bands.items()) if hi - lo < 11]

    # ── use ──────────────────────────────────────────────────────────────
    def band(self, name):
        try:
            return self.bands[name]
        except KeyError:
            raise KeyError("unknown band \"%s\"; known: %s"
                           % (name, ", ".join(sorted(self.bands)))) from None

    def place(self, pitch_class, name):
        """The pitch of that class which lives inside the named band."""
        lo, hi = self.band(name)
        try:
            return in_window(pitch_class, lo, hi)
        except WindowTooNarrow as exc:
            raise WindowTooNarrow("band \"%s\": %s" % (name, exc)) from None

    def contains(self, midi, name):
        lo, hi = self.band(name)
        return lo <= int(midi) <= hi

    def assert_empty(self, notes, band):
        """Verify that NO rendered note falls inside the named band.

        `notes` is a sequence of MIDI pitches read from the RENDERED ARTIFACT
        (the produced .mid), never from the source. This is the "verification"
        state of the atelier's loop, and it re-reads what was built.

        ⚠️ EXCLUDE CHANNEL 10 BEFORE CALLING. On channel 10 a "46" is not a
        B-flat 2: it is an open hi-hat. A perfectly placed drum kit would raise
        a false alarm here -- kick 36, clap 39 and closed hat 42 land in the
        bass band, and open hat 46 lands squarely inside the voice band. Filter
        by channel first, then verify.

        Returns the number of notes examined. Raises BandNotEmpty naming the
        intruders and their count.
        """
        lo, hi = self.band(band)
        seen = [int(n) for n in notes]
        offenders = sorted({n for n in seen if lo <= n <= hi})
        if offenders:
            raise BandNotEmpty(
                "band \"%s\" (MIDI %d-%d) had to stay EMPTY: %d distinct pitch%s "
                "occupy it -- %s -- out of %d rendered notes examined."
                % (band, lo, hi, len(offenders),
                   "es" if len(offenders) > 1 else "",
                   " ".join("%d(%s)" % (n, pitch(n)) for n in offenders), len(seen))
            )
        return len(seen)

    def describe(self, prefix="  "):
        """The bands as plain lines, for an ABC header comment."""
        out = []
        for name, (lo, hi) in sorted(self.bands.items(), key=lambda kv: kv[1]):
            tail = "   <- stays EMPTY end to end" if name == "void" else ""
            out.append("%s%-8s MIDI %3d-%-3d (%s-%s)%s"
                       % (prefix, name, lo, hi, pitch(lo), pitch(hi), tail))
        return "\n".join(out)

    def __repr__(self):
        return "RegisterPlan(%s)" % ", ".join(
            "%s=%d-%d" % (n, lo, hi)
            for n, (lo, hi) in sorted(self.bands.items(), key=lambda kv: kv[1]))


# ═════════════════════════════════════════════════════════════════════════
#  4. DYNAMICS -- written, because %%MIDI beat does not arrive
# ═════════════════════════════════════════════════════════════════════════

#: The ladder, softest to loudest.
DYNAMIC_MARKS = ("pp", "p", "mp", "mf", "f", "ff", "fff")

#: The amplitude steps held in the day's generators: a measured value
#: (acceleration, rotation) -> the dynamic mark. The last threshold is an open
#: ceiling.
DEFAULT_LADDER = ((0.20, "pp"), (0.45, "p"), (0.90, "mp"), (1.35, "mf"),
                  (1.80, "f"), (2.20, "ff"), (float("inf"), "fff"))


def dynamics(level):
    """A WRITTEN dynamic mark: `!pp!` ... `!fff!`.

        dynamics("mf") -> '!mf!'      dynamics(3) -> '!mf!'

    WHY WRITTEN, AND NOT `%%MIDI beat`
        `%%MIDI beat` was measured NOT REACHING VOICE 1. The rendered MIDI
        carried velocities 80-105 where 40-112 had been asked for: the directive
        looked like it was working and was not. Nothing in the source showed it;
        only re-reading the .mid did.

        A written mark arrives TWICE instead: abc2midi turns it into velocity,
        and abcm2ps engraves it in the score. So it is both heard and checkable
        by eye -- which is exactly what a decision a human must be able to undo
        should be.

    Only re-emit a mark when it CHANGES: repeated every bar it clutters the
    score without adding anything to the MIDI.
    """
    if isinstance(level, str):
        mark = level.strip().strip("!").lower()
        if mark not in DYNAMIC_MARKS:
            raise ValueError("unknown dynamic \"%s\"; the ladder is %s"
                             % (level, " ".join(DYNAMIC_MARKS)))
        return "!%s!" % mark
    i = int(level)
    if not 0 <= i < len(DYNAMIC_MARKS):
        raise ValueError("dynamic step %d outside 0-%d (%s)"
                         % (i, len(DYNAMIC_MARKS) - 1, " ".join(DYNAMIC_MARKS)))
    return "!%s!" % DYNAMIC_MARKS[i]


def dynamics_from_value(value, ladder=DEFAULT_LADDER):
    """A measured value -> the written mark of the step it falls in.

    First threshold strictly above the value wins. The numbers passed here are
    deliberately UNITLESS: the atelier's movement captures do not declare their
    units, and the music comes only from ratios.
    """
    for threshold, mark in ladder:
        if value < threshold:
            return dynamics(mark)
    return dynamics(ladder[-1][1])


# ═════════════════════════════════════════════════════════════════════════
#  5. MID-TUNE TEMPO -- inline, or it does not exist
# ═════════════════════════════════════════════════════════════════════════

def tempo_inline(bpm, unit="1/4"):
    """A tempo change in the middle of a piece: `[Q:1/4=136]`.

        tempo_inline(136)            -> '[Q:1/4=136]'
        tempo_inline(240, "1/8")     -> '[Q:1/8=240]'

    Paste it AT THE HEAD OF THE BAR, INSIDE A VOICE:

        [V:1] [Q:1/4=136]=E2 =G =B |

    THE TRAP
        A `Q:` field sitting alone on its own line in the body of a MULTI-VOICE
        tune -- one with interleaved `[V:n]` lines, which is every piece this
        atelier writes -- is SILENTLY IGNORED by abc2midi. No warning, no error,
        exit status 0.

        Reproduced on this host with abc2midi 4.88, four bars, two voices, the
        change asked for at bar 3:

            bare `Q:1/4=136` on its own line  -> tempo events [96.0]
            inline `[Q:1/4=136]` in the voice -> tempo events [96.0, 136.0]

        And the nastiest part, also measured: in a SINGLE-voice tune the bare
        form does work. So it works while you are prototyping and stops working
        the moment the piece grows a second voice, with nothing announcing the
        change. A 120 -> 136 shift measured on somebody's body ended up existing
        only in the comments.

        Always verify by RE-READING the tempo events of the rendered .mid, not
        the source.
    """
    n = int(bpm)
    if n <= 0:
        raise ValueError("non-positive tempo: %r" % bpm)
    return "[Q:%s=%d]" % (unit, n)


# ═════════════════════════════════════════════════════════════════════════
#  6. DRUMS -- channel 10
# ═════════════════════════════════════════════════════════════════════════

#: The GM percussion map the atelier uses. The voice carrying them declares
#: `%%MIDI channel 10` and `clef=perc`; the written pitches are then read as
#: percussion numbers, not as notes.
GM_DRUMS = {
    "kick":       36,   # bass drum      C,,
    "snare":      38,   # snare          D,,
    "clap":       39,   # hand clap      ^D,,
    "hat_closed": 42,   # closed hi-hat  ^F,,
    "hat_open":   46,   # open hi-hat    ^A,,
}
#: Common aliases.
GM_DRUMS["hat"] = GM_DRUMS["hat_closed"]
GM_DRUMS["hh"] = GM_DRUMS["hat_closed"]
GM_DRUMS["bd"] = GM_DRUMS["kick"]
GM_DRUMS["sd"] = GM_DRUMS["snare"]


def _positions(spec, eighths):
    """A hit specification -> the set of eighths struck.

    Two forms accepted:
      * a sequence of indices   [0, 2, 4, 6]
      * a character grid        'x.x.x.x.'  (anything other than '.', '-' or '_'
        is a hit; spaces and bar lines are ignored)
    """
    if isinstance(spec, str):
        grid = [c for c in spec if c not in " |"]
        if len(grid) != eighths:
            raise ValueError("grid of %d cells for a bar of %d eighths: \"%s\""
                             % (len(grid), eighths, spec))
        return {i for i, c in enumerate(grid) if c not in ".-_"}
    return {int(i) for i in spec}


def drum_bar(pattern, eighths=8):
    """One bar of drums, channel 10, written in eighths.

        drum_bar({"kick": [0, 2, 4, 6], "hat_closed": ".x.x.x.x"})
        -> '=C,, ^F,, [=C,,^F,,] ^F,, ...'

    `pattern` maps a GM_DRUMS name (or a raw MIDI number) to its hits. Empty
    eighths become rests; simultaneous hits group into an `[...]` chord, which
    abc2midi reads as simultaneous percussion.

    The voice receiving this text must have been declared with `channel=10` in
    header() -- otherwise the pitches come out as bass notes and the piece is
    wrong without any tool complaining.
    """
    if eighths <= 0:
        raise ValueError("a bar of %r eighths" % eighths)
    slots = [[] for _ in range(eighths)]
    for name, spec in pattern.items():
        note = GM_DRUMS.get(name, name)
        try:
            note = int(note)
        except (TypeError, ValueError):
            raise KeyError("unknown percussion \"%s\"; known: %s (or a raw MIDI "
                           "number)" % (name, ", ".join(sorted(GM_DRUMS)))) from None
        for i in sorted(_positions(spec, eighths)):
            if not 0 <= i < eighths:
                raise ValueError("hit outside the bar: eighth %d in a bar of %d"
                                 % (i, eighths))
            slots[i].append(note)
    out = []
    for hits in slots:
        uniq = sorted(set(hits))
        if not uniq:
            out.append("z")
        elif len(uniq) == 1:
            out.append(pitch(uniq[0]))
        else:
            out.append("[%s]" % "".join(pitch(n) for n in uniq))
    return " ".join(out)


def four_on_the_floor(eighths=8, drum="kick"):
    """Four on the floor: one kick on every beat."""
    return {drum: list(range(0, eighths, 2))}


def offbeat_hat(eighths=8, drum="hat_closed"):
    """The offbeat hat: one closed hi-hat on every off-eighth."""
    return {drum: list(range(1, eighths, 2))}


# ═════════════════════════════════════════════════════════════════════════
#  7. RESTS -- legal for abcm2ps
# ═════════════════════════════════════════════════════════════════════════

def rest(eighths):
    """A rest of `eighths` units of L:, written as LEGAL figures.

        rest(8)  -> 'z8'         rest(5)  -> 'z4 z'
        rest(1)  -> 'z'          rest(11) -> 'z8 z3'

    THE TRAP
        `z5` is not a five-eighth rest: it is an error. abcm2ps answers
        "Note too much dotted" and exits 1 -- the score does not exist.
        Measured on abcm2ps-8.14.14: 5, 9, 10 and 11 fail; 1, 2, 3, 4, 6, 7, 8,
        12, 14 and 16 pass. A figure only exists plain, dotted or double-dotted:
        2^k, 3*2^k, 7*2^k. A five-eighth rest in 4/4 is therefore TWO signs, not
        one.
    """
    return " ".join("z" + _length_token(p if p != 1 else None)
                    for p in split_length(eighths))


# ═════════════════════════════════════════════════════════════════════════
#  8. THE HEADER
# ═════════════════════════════════════════════════════════════════════════

def header(title, voices, index=1, subtitle=None, composer=None,
           meter="4/4", unit_length="1/8", tempo=None, tempo_unit="1/4",
           key="C", score=None, preamble=None, directives=()):
    """A complete tune header: X/T/C/M/L/Q, %%score, K, then the voices.

    `voices` is a sequence of dictionaries:

        {"id": 1, "name": "His cell", "sname": "Ce", "clef": "treble",
         "program": 74, "volume": 96}
        {"id": 3, "name": "Drums", "sname": "Dr", "clef": "perc",
         "channel": 10, "volume": 100}

    Each voice gets `%%MIDI gchordoff` (unless `gchord=True`), then
    `%%MIDI channel` if asked, then `%%MIDI program` and `%%MIDI control 7`.
    A drum voice declares `channel: 10` and OMITS `program`: on channel 10 the
    program does not choose the instrument, the pitch does. Passing both raises.

    `preamble` is pasted verbatim BEFORE the `X:` -- that is where the block
    rendered by provenance() goes.

    ⚠️ WARNING ABOUT CLEFS
        `clef=treble-8` SOUNDS AN OCTAVE BELOW WHAT IS WRITTEN. It is a tenor /
        guitar clef: the score shows C4, the instrument plays C3. If you are
        writing measured pitches -- somebody's band, the note he holds -- that
        clef moves all of them by an octave without saying so, and the register
        check then passes while the render is wrong. Use `treble` and write the
        real pitches; use `-8` only when the score is meant for a transposing
        instrument, and say so in the provenance.
    """
    voices = list(voices)
    if not voices:
        raise ValueError("a tune with no voice; header() wants at least one")

    lines = []
    if preamble:
        lines.append(preamble.rstrip("\n"))
        lines.append("%")
    lines.append("X:%d" % int(index))
    lines.append("T:%s" % title)
    if subtitle:
        lines.append("T:%s" % subtitle)
    if composer:
        lines.append("C:%s" % composer)
    lines.append("M:%s" % meter)
    lines.append("L:%s" % unit_length)
    if tempo is not None:
        lines.append("Q:%s=%d" % (tempo_unit, int(tempo)))
    for d in directives:
        lines.append(d if d.startswith("%%") else "%%" + d)
    if score is None:
        score = "[%s]" % " | ".join(str(v.get("id", i + 1))
                                    for i, v in enumerate(voices))
    lines.append("%%score " + score)
    lines.append("K:%s" % key)

    for i, v in enumerate(voices):
        vid = v.get("id", i + 1)
        bits = ["V:%s" % vid]
        if v.get("name"):
            bits.append('name="%s"' % v["name"])
        if v.get("sname"):
            bits.append('sname="%s"' % v["sname"])
        clef = v.get("clef")
        if clef:
            bits.append("clef=%s" % clef)
        lines.append(" ".join(bits))
        if clef and str(clef).endswith("-8"):
            lines.append("% WARNING clef=" + str(clef) + " SOUNDS AN OCTAVE BELOW "
                         "what is written -- intended? say so in the provenance.")
        if not v.get("gchord"):
            lines.append("%%MIDI gchordoff")
        if v.get("channel") is not None:
            lines.append("%%MIDI channel " + str(int(v["channel"])))
        if v.get("program") is not None:
            if int(v.get("channel", 0)) == 10:
                raise ValueError(
                    "voice %s is on channel 10 AND carries program %s: on channel "
                    "10 the PITCH chooses the percussion, not the program. Drop "
                    "\"program\"." % (vid, v["program"]))
            lines.append("%%MIDI program " + str(int(v["program"])))
        if v.get("volume") is not None:
            lines.append("%%MIDI control 7 " + str(int(v["volume"])))
    lines.append("%")
    return "\n".join(lines)


# ═════════════════════════════════════════════════════════════════════════
#  9. PROVENANCE -- the block without which a generator is not finished
# ═════════════════════════════════════════════════════════════════════════

_RULE = "% " + "═" * 71
_HEADINGS = (
    ("MESURÉ", "measured"),
    ("DONNÉ PAR LUI", "given"),
    ("CHOISI PAR MOI, ET QU'IL DÉFAIT D'UN MOT", "chosen"),
)


def _as_lines(value, label):
    if value is None:
        items = []
    elif isinstance(value, str):
        items = [l for l in value.splitlines() if l.strip()]
    else:
        items = [str(x) for x in value if str(x).strip()]
    if not items:
        raise ProvenanceMissing(
            "section \"%s\" of the provenance block is empty. All three sections "
            "are mandatory: MESURÉ (what the numbers say, with the numbers), "
            "DONNÉ PAR LUI (his material, his words, quoted), CHOISI PAR MOI, ET "
            "QU'IL DÉFAIT D'UN MOT (what is mine, written so he can refuse it). "
            "A generator without this block is not finished." % label)
    return items


def provenance(measured, given, chosen, title=None, note=None, width=73):
    """The comment block EVERY generator of this atelier must carry.

        print(provenance(
            measured=["119 notes read from his MIDI, F2 -> F5",
                      "31.7 s of capture, 316 packets at 9.9 Hz"],
            given=["the pitches, in his order, untransposed",
                   "\"it would basically start exactly like Opus 22\""],
            chosen=["3/4 at 84: a walk, not a run",
                    "the five density steps"]))

    Three sections, and none of them optional. The headings stay in his
    language, verbatim:

      MESURÉ                        what the numbers say, WITH the numbers. Not
                                    "his tempo" but "0.440 s -> 136 BPM,
                                    strength 0.51".
      DONNÉ PAR LUI                 his material and his words. Quoted, not
                                    summarised.
      CHOISI PAR MOI, ET QU'IL      what is mine. Written to be refused -- that
      DÉFAIT D'UN MOT               is the whole point of the phrase.

    Provenance is not a courtesy appended at the end: it is the deliverable. A
    piece whose measured part can no longer be told from its decided part cannot
    be handed back to the person it came from. That is why ProvenanceMissing is
    an error and not a warning.
    """
    values = {"measured": measured, "given": given, "chosen": chosen}
    out = [_RULE]
    if title:
        for line in str(title).splitlines():
            out.append("% " + line.rstrip())
        out.append("%")
    for label, key in _HEADINGS:
        head = "%% ─── %s " % label
        out.append(head + "─" * max(3, width - len(head) + 1))
        for item in _as_lines(values[key], label):
            out.append("%   " + item.rstrip())
        out.append("%")
    if note:
        for line in str(note).splitlines():
            out.append("% " + line.rstrip())
        out.append("%")
    if out[-1] == "%":
        out.pop()
    out.append(_RULE)
    return "\n".join(out)


# ═════════════════════════════════════════════════════════════════════════
#  CLI -- `demo`
# ═════════════════════════════════════════════════════════════════════════

def build_demo():
    """A tiny but VALID tune that exercises the four traps.

    Four bars of 4/4, three voices. Bar 1: a chromatic climb that only exists
    because of the explicit accidentals. Bar 2: a five-eighth rest that only
    exists split. Bar 3: the tempo change, inline. Bar 4: the full kit on
    channel 10, and a five-eighth hold written as tied figures.
    """
    plan = RegisterPlan()

    preamble = provenance(
        title=("ATELIER -- demonstration tune\n"
               "atelier_abc.py demo · four bars, three voices"),
        measured=[
            "the four ABC traps, measured on this host:",
            "  · an accidental holds to the bar line for the SAME letter:",
            "    '^F,, =G,, F,,' renders 42 43 42; '^F,, =G,, =F,,' renders 42 43 41",
            "  · %%MIDI beat does not reach voice 1 (velocities 80-105 for 40-112 asked)",
            "  · a bare Q: in a MULTI-VOICE body is ignored (1 tempo event, not 2),",
            "    exit status 0; inline [Q:1/4=136] gives both",
            "  · z5 -> abcm2ps \"Note too much dotted\", exit 1",
            "band left empty: MIDI %d-%d, checkable in the rendered .mid" % plan.band("void"),
            "channel 10 excluded from that check: a \"46\" there is an open hi-hat, "
            "not a B-flat 2",
        ],
        given=[
            "nothing: this is a demonstration, no one's material enters it.",
            "A real generator names HIS material here and quotes HIS words.",
        ],
        chosen=[
            "C major, 4/4 at 96, four bars, the three timbres",
            "the shift to 136 in bar 3, so the change is legible in the .mid",
        ],
        note="The registers:\n" + plan.describe(prefix="  "),
    )

    voices = [
        {"id": 1, "name": "Line", "sname": "Li", "clef": "treble",
         "program": 74, "volume": 96},
        {"id": 2, "name": "Bass", "sname": "Bs", "clef": "bass",
         "program": 32, "volume": 90},
        {"id": 3, "name": "Drums", "sname": "Dr", "clef": "perc",
         "channel": 10, "volume": 100},
    ]
    tune = [header(
        title="Demonstration -- atelier_abc",
        subtitle="explicit accidentals · split rest · inline tempo · channel 10",
        composer="atelier-jerry",
        meter="4/4", unit_length="1/8", tempo=96, key="C",
        voices=voices, preamble=preamble)]

    dry_kit = {**four_on_the_floor(), **offbeat_hat()}
    full_kit = {**dry_kit, "clap": [4], "hat_open": [7]}

    # ── bar 1: the chromatic climb. Without explicit naturals the C, D, F and G
    #    of this bar would come out sharp -- their neighbour's accidental.
    climb = " ".join(pitch(n) for n in range(60, 68))
    tune.append("% bar 1 · chromatic climb C4 -> G4, an accidental on EVERY note")
    tune.append("[V:1] %s%s |" % (dynamics("mp"), climb))
    tune.append("[V:2] %s |" % pitch(plan.place(0, "bass"), 8))
    tune.append("[V:3] %s |" % rest(8))
    tune.append("%")

    # ── bar 2: five eighths of rest, then three notes.
    tune.append("% bar 2 · a FIVE-eighth rest -- two signs, never \"z5\"")
    tune.append("[V:1] %s %s |" % (rest(5), " ".join(pitch(n) for n in (69, 70, 71))))
    tune.append("[V:2] %s |" % pitch(plan.place(9, "bass"), 8))
    tune.append("[V:3] %s |" % drum_bar(dry_kit))
    tune.append("%")

    # ── bar 3: the tempo change, INLINE, inside the voice.
    tune.append("% bar 3 · tempo goes 96 -> 136 · inline, or it does not exist")
    tune.append("[V:1] %s%s%s %s |"
                % (tempo_inline(136), dynamics("f"),
                   " ".join(pitch(n, 2) for n in (72, 71, 69)), pitch(67, 2)))
    tune.append("[V:2] %s |" % pitch(plan.place(7, "bass"), 8))
    tune.append("[V:3] %s |" % drum_bar(dry_kit))
    tune.append("%")

    # ── bar 4: the full kit, and a five-eighth hold written as tied figures.
    tune.append("% bar 4 · full kit (channel 10) and a 5-eighth hold, tied")
    tune.append("[V:1] %s%s %s |]"
                % (dynamics("ff"), tied_note(72, 5),
                   " ".join(pitch(n) for n in (71, 69, 72))))
    tune.append("[V:2] %s |]" % pitch(plan.place(0, "bass"), 8))
    tune.append("[V:3] %s |]" % drum_bar(full_kit))
    return "\n".join(tune) + "\n"


def main(argv=None):
    p = argparse.ArgumentParser(
        prog="atelier_abc.py",
        description="ABC construction for the atelier -- standard library only. "
                    "Import this file as a module; the CLI exists for the demo "
                    "tune and for a health check.",
        epilog="The traps encoded here were paid for in real work: an explicit "
               "accidental on every note, a full-octave window, written dynamics "
               "rather than the MIDI beat directive (which does not reach voice "
               "1), an inline tempo change, split rests. See the module docstring.")
    sub = p.add_subparsers(dest="cmd")
    sub.add_parser("demo", help="write a small valid tune to stdout")
    args = p.parse_args(argv)
    if args.cmd != "demo":
        p.print_help()
        return 2
    sys.stdout.write(build_demo())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
