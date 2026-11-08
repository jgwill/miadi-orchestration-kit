#!/usr/bin/env python3
"""atelier_midi.py — read a *rendered* MIDI file and prove what is inside it.

Standard library only. This module never imports mido, pretty_midi or music21:
none of them exist on the host this atelier runs on, and a plugin that assumes
them fails on the only machine it was built for. The reader is hand-rolled and
must stay hand-rolled.

WHAT THIS MODULE IS FOR
  Verification re-reads the rendered artifact, never the source. A note count
  that comes out right in the generator is not proof; the same count read back
  out of the .mid that abc2midi produced is. Every function here answers one
  question that decided something in the atelier:

    registers()        did any voice land in a register it was told to avoid
    band_occupancy()   is the singer's band empty  (the 45-53 rule)
    pitch_classes()    what mode does the rendered piece actually sit in
    mode_purity()      how much of it stays inside the field
    same_pitches()     were his notes changed anywhere between source and render
    drum_positions()   is the kick really on the floor, eighth by eighth
    tempos             did the mid-tune tempo change survive  (a bare Q: does not)

UNITS
  Tick durations are musical durations. Pitch-class and purity shares are
  weighted in ticks on purpose: they describe the written field, and a tempo
  change must not reweight it. Anything reported in seconds says so.

CLI
    python3 atelier_midi.py verify FILE.mid --empty 45-53 --mode ddorian --expect-notes 24
    python3 atelier_midi.py registers FILE.mid
    python3 atelier_midi.py drums FILE.mid
    python3 atelier_midi.py same A.mid B.mid
  Exits non-zero on any failed expectation.
"""

from __future__ import annotations

import argparse
import collections
import json
import struct
import sys
from typing import Iterable, NamedTuple, Sequence

__all__ = [
    "Note",
    "MidiRead",
    "read",
    "registers",
    "band_occupancy",
    "pitch_classes",
    "mode_purity",
    "same_pitches",
    "drum_positions",
    "parse_mode",
    "ticks_per_beat",
    "tick_to_seconds",
]

DRUM_CHANNEL = 9  # "channel 10" in ABC and in every manual is channel index 9

GM_DRUM_NAMES = {
    35: "kick 2", 36: "kick", 37: "side stick", 38: "snare", 39: "clap",
    40: "snare 2", 41: "low tom", 42: "hat closed", 43: "low tom 2",
    44: "hat pedal", 45: "mid tom", 46: "hat open", 47: "mid tom 2",
    48: "high tom", 49: "crash", 50: "high tom 2", 51: "ride",
    54: "tambourine", 56: "cowbell", 57: "crash 2", 59: "ride 2",
}


# ── the read ──────────────────────────────────────────────────────────────


class Note(NamedTuple):
    """One paired note-on/note-off. Ticks are absolute within its own track."""

    start_tick: int
    end_tick: int
    pitch: int
    velocity: int
    channel: int
    track: int

    @property
    def duration(self) -> int:
        return self.end_tick - self.start_tick


class Tempo(NamedTuple):
    tick: int
    usec_per_quarter: int
    bpm: float
    track: int


class TimeSignature(NamedTuple):
    tick: int
    numerator: int
    denominator: int
    clocks_per_click: int
    notated_32nd_per_quarter: int
    track: int


class MidiRead(NamedTuple):
    """Everything read out of one file. Unpacks as (notes, division, tempos, time_signatures, ...)."""

    notes: list
    division: int
    tempos: list
    time_signatures: list
    format: int
    n_tracks: int
    track_names: dict
    unclosed: int
    path: str


def _varlen(data: bytes, p: int):
    """MIDI variable-length quantity. Returns (value, new position)."""
    v = 0
    while True:
        b = data[p]
        p += 1
        v = (v << 7) | (b & 0x7F)
        if not b & 0x80:
            return v, p


def read(path) -> MidiRead:
    """Read a Standard MIDI File into paired notes. This is the only door in.

    Handles: format 0 and 1 (and 2, read as independent tracks), running
    status, meta events, sysex (0xF0 and the 0xF7 escape form), tempo and
    time-signature maps, unknown chunk types (skipped by declared length),
    and note-on-with-velocity-0 as note-off.

    Note-offs are paired FIFO per (track, channel, pitch) — pairing on pitch
    alone silently merges two voices that share a pitch on different channels.
    Notes left hanging at end of track are closed at the last tick seen and
    counted in `unclosed`; a non-zero count means the file is malformed and
    every duration-weighted measure below it is approximate.
    """
    path = str(path)
    with open(path, "rb") as fh:
        d = fh.read()
    if len(d) < 14 or d[0:4] != b"MThd":
        raise ValueError(f"{path}: not a Standard MIDI File (no MThd header)")
    hdr_len = struct.unpack(">I", d[4:8])[0]
    fmt, ntrk, division = struct.unpack(">HHH", d[8:14])
    p = 8 + hdr_len

    notes: list = []
    tempos: list = []
    tsigs: list = []
    names: dict = {}
    unclosed = 0
    track = -1

    while p + 8 <= len(d):
        cid = d[p : p + 4]
        clen = struct.unpack(">I", d[p + 4 : p + 8])[0]
        p += 8
        end = min(p + clen, len(d))
        if cid != b"MTrk":  # alien chunk: the spec says skip it by length
            p = end
            continue
        track += 1
        t = 0
        run = None
        on = collections.defaultdict(list)
        while p < end:
            delta, p = _varlen(d, p)
            t += delta
            if p >= end:
                break
            st = d[p]
            if st & 0x80:
                run = st
                p += 1
            else:
                st = run
                if st is None:
                    raise ValueError(f"{path}: running status with no preceding status byte")
            if st == 0xFF:
                mtype = d[p]
                p += 1
                ln, p = _varlen(d, p)
                payload = d[p : p + ln]
                p += ln
                if mtype == 0x51 and ln == 3:
                    us = (payload[0] << 16) | (payload[1] << 8) | payload[2]
                    tempos.append(Tempo(t, us, 60_000_000.0 / us if us else 0.0, track))
                elif mtype == 0x58 and ln >= 4:
                    tsigs.append(
                        TimeSignature(t, payload[0], 1 << payload[1], payload[2], payload[3], track)
                    )
                elif mtype == 0x03:
                    names[track] = payload.decode("utf-8", "replace")
                elif mtype == 0x2F:
                    break
            elif st in (0xF0, 0xF7):
                ln, p = _varlen(d, p)
                p += ln
            else:
                hi = st & 0xF0
                ch = st & 0x0F
                nb = 1 if hi in (0xC0, 0xD0) else 2
                a = d[p]
                b2 = d[p + 1] if nb == 2 and p + 1 < len(d) else 0
                p += nb
                if hi == 0x90 and b2 > 0:
                    on[(ch, a)].append((t, b2))
                elif hi == 0x80 or (hi == 0x90 and b2 == 0):
                    q = on.get((ch, a))
                    if q:
                        s, vel = q.pop(0)
                        notes.append(Note(s, t, a, vel, ch, track))
        for (ch, pitch), q in on.items():
            for s, vel in q:
                unclosed += 1
                notes.append(Note(s, max(s + 1, t), pitch, vel, ch, track))
        p = end

    notes.sort(key=lambda n: (n.start_tick, n.track, n.channel, n.pitch))
    tempos.sort(key=lambda x: x.tick)
    tsigs.sort(key=lambda x: x.tick)
    return MidiRead(notes, division, tempos, tsigs, fmt, ntrk, names, unclosed, path)


def ticks_per_beat(division: int):
    """Ticks per quarter note, or None when the file uses SMPTE timing.

    A SMPTE division carries no beat grid, so every bar-relative measure
    (drum_positions) must refuse rather than guess.
    """
    if division & 0x8000:
        return None
    return division


def tick_to_seconds(tick: int, division: int, tempos: Sequence) -> float:
    """Absolute seconds for a tick, walking the tempo map. Reporting only.

    Used to say *when* something happened out loud. No musical decision is
    taken on seconds: they drift with every tempo event, tick durations do not.
    """
    tpb = ticks_per_beat(division)
    if tpb is None:
        frames = 256 - ((division >> 8) & 0xFF)
        per_frame = division & 0xFF
        return tick / float(frames * per_frame or 1)
    if not tempos:
        return tick * 0.5 / tpb  # SMF default: 120 bpm
    sec = 0.0
    prev_tick = 0
    us = 500000
    for tp in tempos:
        if tp.tick >= tick:
            break
        sec += (tp.tick - prev_tick) * us / 1e6 / tpb
        prev_tick, us = tp.tick, tp.usec_per_quarter
    return sec + (tick - prev_tick) * us / 1e6 / tpb


# ── the measurements ──────────────────────────────────────────────────────


def registers(notes: Iterable[Note]) -> dict:
    """Per-track pitch extent and count, plus the overlap between every pair.

    Decides: whether a voice went where it was told not to go, and whether two
    voices that were meant to stay out of each other's way in fact cross. The
    atelier reads this before publishing, on the rendered file — an ABC window
    that looks disjoint on paper can still collide once abc2midi has chosen an
    octave (clef=treble-8 sounds an octave below what is written).
    """
    per = {}
    for n in notes:
        e = per.setdefault(n.track, {"min": n.pitch, "max": n.pitch, "count": 0,
                                     "channels": set(), "pitches": set()})
        e["min"] = min(e["min"], n.pitch)
        e["max"] = max(e["max"], n.pitch)
        e["count"] += 1
        e["channels"].add(n.channel)
        e["pitches"].add(n.pitch)
    for e in per.values():
        e["channels"] = sorted(e["channels"])
        e["span"] = e["max"] - e["min"]
        e["pitches"] = sorted(e["pitches"])
    overlaps = {}
    keys = sorted(per)
    for i, a in enumerate(keys):
        for b in keys[i + 1 :]:
            lo = max(per[a]["min"], per[b]["min"])
            hi = min(per[a]["max"], per[b]["max"])
            overlaps[(a, b)] = {
                "low": lo, "high": hi,
                "semitones": (hi - lo + 1) if hi >= lo else 0,
                "shared_pitches": sorted(set(per[a]["pitches"]) & set(per[b]["pitches"])),
            }
    return {"tracks": per, "overlaps": overlaps}


def band_occupancy(notes: Iterable[Note], lo: int, hi: int) -> dict:
    """How many notes fall inside a MIDI range, inclusive.

    This is how "the singer's band is empty" is proven, and it is the only
    check in the atelier that is pass/fail rather than a number. His band was
    measured on the day: 94.1 % of the park drone lives in MIDI 45-53, so
    45-53 stays empty in every piece written for him to sing over.

    Returns count, share of all notes, the offending notes, and which tracks
    they came from — naming the track is what makes the correction one edit.
    """
    notes = list(notes)
    total = len(notes)
    inside = [n for n in notes if lo <= n.pitch <= hi]
    by_track = collections.Counter(n.track for n in inside)
    return {
        "low": lo,
        "high": hi,
        "count": len(inside),
        "total": total,
        "share": (len(inside) / total) if total else 0.0,
        "empty": not inside,
        "by_track": dict(by_track),
        "notes": inside,
        "pitches": sorted({n.pitch for n in inside}),
    }


def pitch_classes(notes: Iterable[Note]) -> dict:
    """Pitch-class histogram weighted by sounding duration, in ticks.

    Decides the mode. Counting note *events* lies: a drone struck once and held
    thirty seconds counts as one, and the piece reads as whatever the busy
    voice happens to be doing. Weighting by duration is what found MI PHRYGIEN
    in his Songbird take — the mi2/re#2 beat held thirty seconds was the piece.

    Returns per pitch class: ticks, share, and event count. Drum channel is
    excluded: a kick is not a pitch class.
    """
    notes = [n for n in notes if n.channel != DRUM_CHANNEL]
    ticks = collections.Counter()
    events = collections.Counter()
    for n in notes:
        ticks[n.pitch % 12] += max(0, n.duration)
        events[n.pitch % 12] += 1
    total = sum(ticks.values())
    return {
        "total_ticks": total,
        "by_pc": {
            pc: {
                "ticks": ticks.get(pc, 0),
                "share": (ticks.get(pc, 0) / total) if total else 0.0,
                "events": events.get(pc, 0),
            }
            for pc in range(12)
        },
        "ranked": sorted(range(12), key=lambda pc: -ticks.get(pc, 0)),
    }


def mode_purity(notes: Iterable[Note], allowed_pcs: Iterable[int]) -> dict:
    """Share of sounding duration that sits inside a given pitch-class set.

    Decides whether a take stays in the field, and names what leaves it. The
    number is not a verdict on its own: 21 % outside the white field of the bed
    was not an error in his Songbird — it was the material the intruder in
    opus 019 is made of. Report the share, name the strays, let the human read.
    """
    allowed = {int(p) % 12 for p in allowed_pcs}
    h = pitch_classes(notes)
    inside = sum(v["ticks"] for pc, v in h["by_pc"].items() if pc in allowed)
    total = h["total_ticks"]
    strays = {
        pc: v["share"] for pc, v in h["by_pc"].items() if pc not in allowed and v["ticks"]
    }
    return {
        "allowed": sorted(allowed),
        "purity": (inside / total) if total else 0.0,
        "inside_ticks": inside,
        "total_ticks": total,
        "outside": dict(sorted(strays.items(), key=lambda kv: -kv[1])),
    }


def same_pitches(a, b) -> dict:
    """Compare two files (or two note lists) note-for-note and as a multiset.

    This is what proves "his notes are unchanged". Two answers, and they are
    not the same answer:
      note_for_note  same pitches in the same order — a variation that keeps
                     his order (register split, re-voicing) passes this
      multiset       same pitches in any order — a mirror or a re-ordering
                     passes only this, and that is the honest claim to make
    On divergence, `first_divergence` gives the index and both pitches, which
    is where to look and nowhere else.
    """
    na = read(a).notes if isinstance(a, (str, bytes)) or hasattr(a, "__fspath__") else list(a)
    nb = read(b).notes if isinstance(b, (str, bytes)) or hasattr(b, "__fspath__") else list(b)
    pa = [n.pitch for n in sorted(na, key=lambda n: (n.start_tick, n.pitch))]
    pb = [n.pitch for n in sorted(nb, key=lambda n: (n.start_tick, n.pitch))]
    ca, cb = collections.Counter(pa), collections.Counter(pb)
    first = None
    for i, (x, y) in enumerate(zip(pa, pb)):
        if x != y:
            first = {"index": i, "a": x, "b": y}
            break
    if first is None and len(pa) != len(pb):
        first = {"index": min(len(pa), len(pb)), "a": None, "b": None}
    diff = {p: cb.get(p, 0) - ca.get(p, 0) for p in set(ca) | set(cb) if ca.get(p, 0) != cb.get(p, 0)}
    return {
        "count_a": len(pa),
        "count_b": len(pb),
        "note_for_note": pa == pb,
        "multiset": ca == cb,
        "first_divergence": first,
        "multiset_delta": dict(sorted(diff.items())),
    }


def drum_positions(notes: Iterable[Note], division: int, time_signatures: Sequence = ()) -> dict:
    """For channel 10, the eighth-note position of every drum note in its bar.

    This is what proved four-on-the-floor: the kick reads 0, 2, 4, 6 and
    nothing else. Reading the ABC would only prove what was written; the grid
    that actually reaches the ear is the one in the rendered file.

    Bar length follows the time-signature map (numerator x 4/denominator
    quarters), 4/4 assumed when the file declares nothing. `exact` is the
    unrounded position — a drum that lands on 1.97 instead of 2 is a rounding
    artefact of the writer, and you want to see that rather than have it
    quantised away. Refuses on SMPTE division, which carries no beat grid.
    """
    tpb = ticks_per_beat(division)
    if tpb is None:
        raise ValueError("SMPTE division carries no beat grid; bar positions are undefined")
    eighth = tpb / 2.0
    segs = [(ts.tick, ts.numerator, ts.denominator) for ts in time_signatures] or [(0, 4, 4)]
    if segs[0][0] != 0:
        segs.insert(0, (0, 4, 4))

    def bar_of(tick: int):
        seg_i = 0
        for i, (st, _, _) in enumerate(segs):
            if st <= tick:
                seg_i = i
            else:
                break
        st, num, den = segs[seg_i]
        bar_ticks = num * (4.0 / den) * tpb
        off = tick - st
        bars_before = sum(
            max(0, (segs[k + 1][0] - segs[k][0]))
            / (segs[k][1] * (4.0 / segs[k][2]) * tpb)
            for k in range(seg_i)
        )
        return int(bars_before + off // bar_ticks), (off % bar_ticks), bar_ticks, num, den

    hits = []
    for n in notes:
        if n.channel != DRUM_CHANNEL:
            continue
        bar, within, bar_ticks, num, den = bar_of(n.start_tick)
        exact = within / eighth
        hits.append(
            {
                "pitch": n.pitch,
                "name": GM_DRUM_NAMES.get(n.pitch, f"midi {n.pitch}"),
                "tick": n.start_tick,
                "bar": bar,
                "eighth": int(round(exact)) % max(1, int(round(bar_ticks / eighth))),
                "exact": exact,
                "eighths_per_bar": bar_ticks / eighth,
                "meter": f"{num}/{den}",
                "track": n.track,
            }
        )
    per_pitch = collections.defaultdict(collections.Counter)
    for h in hits:
        per_pitch[h["pitch"]][h["eighth"]] += 1
    four_on_floor = {}
    for pitch in (35, 36):
        c = per_pitch.get(pitch)
        if c:
            four_on_floor[pitch] = set(c) == {0, 2, 4, 6}
    return {
        "hits": hits,
        "count": len(hits),
        "by_pitch": {p: dict(sorted(c.items())) for p, c in sorted(per_pitch.items())},
        "names": {p: GM_DRUM_NAMES.get(p, f"midi {p}") for p in per_pitch},
        "four_on_the_floor": four_on_floor,
    }


# ── modes ─────────────────────────────────────────────────────────────────

_SCALES = {
    "major": (0, 2, 4, 5, 7, 9, 11),
    "ionian": (0, 2, 4, 5, 7, 9, 11),
    "dorian": (0, 2, 3, 5, 7, 9, 10),
    "phrygian": (0, 1, 3, 5, 7, 8, 10),
    "lydian": (0, 2, 4, 6, 7, 9, 11),
    "mixolydian": (0, 2, 4, 5, 7, 9, 10),
    "minor": (0, 2, 3, 5, 7, 8, 10),
    "aeolian": (0, 2, 3, 5, 7, 8, 10),
    "locrian": (0, 1, 3, 5, 6, 8, 10),
    "harmonicminor": (0, 2, 3, 5, 7, 8, 11),
    "melodicminor": (0, 2, 3, 5, 7, 9, 11),
    "pentatonicmajor": (0, 2, 4, 7, 9),
    "pentatonicminor": (0, 3, 5, 7, 10),
    "chromatic": tuple(range(12)),
}
_ROOTS = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}


def parse_mode(spec: str):
    """'ddorian' | 'e phrygian' | 'Bb-major' | '0,2,4,5,7,9,11' -> a pitch-class set.

    Accepting a bare pitch-class list matters: some fields in the atelier are
    not a named mode (his four eagle cries land on la/si/do and nothing else),
    and forcing a name on them would be an invention.
    """
    s = spec.strip().lower().replace(" ", "").replace("-", "").replace("_", "")
    if not s:
        raise ValueError("empty mode")
    if s[0].isdigit():
        return sorted({int(x) % 12 for x in s.split(",") if x != ""}), spec
    if s[0] not in _ROOTS:
        raise ValueError(f"unknown mode root in {spec!r}")
    root = _ROOTS[s[0]]
    rest = s[1:]
    if rest[:1] in ("#", "s"):
        root, rest = (root + 1) % 12, rest[1:]
    elif rest[:1] == "b" and rest[1:] in _SCALES:
        root, rest = (root - 1) % 12, rest[1:]
    if rest not in _SCALES:
        raise ValueError(f"unknown scale {rest!r} in {spec!r}; known: {', '.join(sorted(_SCALES))}")
    return sorted({(root + i) % 12 for i in _SCALES[rest]}), spec


PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def pitch_name(p: int) -> str:
    return f"{PC_NAMES[p % 12]}{p // 12 - 1}"


# ── CLI ───────────────────────────────────────────────────────────────────


def _range(text: str):
    lo, _, hi = text.partition("-")
    if not hi:
        raise argparse.ArgumentTypeError(f"expected LO-HI, got {text!r}")
    return int(lo), int(hi)


def _print_read(m: MidiRead) -> None:
    tpb = ticks_per_beat(m.division)
    print(f"file        {m.path}")
    print(f"format {m.format} · {m.n_tracks} track(s) declared · division {m.division}"
          f"{f' ({tpb} ticks/beat)' if tpb else ' (SMPTE)'}")
    print(f"notes       {len(m.notes)}"
          + (f"   ⚠ {m.unclosed} note(s) never closed" if m.unclosed else ""))
    if m.notes:
        last = max(n.end_tick for n in m.notes)
        print(f"length      {last} ticks · {tick_to_seconds(last, m.division, m.tempos):.2f} s")
    if m.tempos:
        print("tempo       " + " · ".join(
            f"tick {t.tick} = {t.bpm:.2f} bpm" for t in m.tempos))
    else:
        print("tempo       (none written — the file plays at the SMF default 120)")
    if m.time_signatures:
        print("meter       " + " · ".join(
            f"tick {t.tick} = {t.numerator}/{t.denominator}" for t in m.time_signatures))


def _print_registers(m: MidiRead) -> None:
    r = registers(m.notes)
    print("\nregisters (per track, read from the rendered file)")
    for trk, e in sorted(r["tracks"].items()):
        nm = m.track_names.get(trk, "")
        print(f"  track {trk:<2} {pitch_name(e['min']):>5}-{pitch_name(e['max']):<5} "
              f"midi {e['min']:>3}-{e['max']:<3} span {e['span']:>2} · "
              f"{e['count']:>4} notes · ch {e['channels']}" + (f" · {nm}" if nm else ""))
    if r["overlaps"]:
        print("  overlap")
        for (a, b), o in sorted(r["overlaps"].items()):
            if o["semitones"]:
                print(f"    track {a} ∩ {b}: midi {o['low']}-{o['high']} "
                      f"({o['semitones']} semitones, {len(o['shared_pitches'])} shared pitches)")
            else:
                print(f"    track {a} ∩ {b}: none")


def cmd_verify(args) -> int:
    m = read(args.file)
    failures = []
    _print_read(m)
    _print_registers(m)

    for lo, hi in args.empty or []:
        b = band_occupancy(m.notes, lo, hi)
        if b["empty"]:
            print(f"\nband {lo}-{hi}   EMPTY — 0 of {b['total']} notes. ✓")
        else:
            print(f"\nband {lo}-{hi}   {b['count']} of {b['total']} notes "
                  f"({100 * b['share']:.2f} %) — NOT empty. ✗")
            print(f"  pitches {b['pitches']}")
            print(f"  by track {b['by_track']}")
            failures.append(f"band {lo}-{hi} holds {b['count']} note(s)")

    h = pitch_classes(m.notes)
    if h["total_ticks"]:
        print("\npitch classes, weighted by sounding duration")
        for pc in h["ranked"]:
            v = h["by_pc"][pc]
            if v["ticks"]:
                print(f"  {PC_NAMES[pc]:<2} {100 * v['share']:6.2f} %   "
                      f"{v['ticks']:>7} ticks · {v['events']} events")

    if args.mode:
        pcs, label = parse_mode(args.mode)
        mp = mode_purity(m.notes, pcs)
        print(f"\nmode {label}  pcs {[PC_NAMES[p] for p in pcs]}")
        print(f"  purity {100 * mp['purity']:.2f} %")
        if mp["outside"]:
            print("  outside " + " · ".join(
                f"{PC_NAMES[pc]} {100 * s:.2f} %" for pc, s in mp["outside"].items()))
        if args.min_purity is not None:
            if mp["purity"] + 1e-12 < args.min_purity:
                print(f"  below the floor {100 * args.min_purity:.2f} %. ✗")
                failures.append(
                    f"mode purity {100 * mp['purity']:.2f} % < {100 * args.min_purity:.2f} %")
            else:
                print(f"  at or above the floor {100 * args.min_purity:.2f} %. ✓")

    if args.expect_notes is not None:
        got = len(m.notes)
        if got == args.expect_notes:
            print(f"\nnote count  {got} = expected {args.expect_notes}. ✓")
        else:
            print(f"\nnote count  {got} ≠ expected {args.expect_notes}. ✗")
            failures.append(f"note count {got} ≠ {args.expect_notes}")

    if args.same:
        s = same_pitches(m.notes, args.same)
        print(f"\nagainst {args.same}")
        print(f"  counts {s['count_a']} vs {s['count_b']} · "
              f"note-for-note {s['note_for_note']} · multiset {s['multiset']}")
        if s["first_divergence"]:
            print(f"  first divergence {s['first_divergence']}")
        if not s["multiset"]:
            print(f"  multiset delta {s['multiset_delta']}")
            failures.append("pitches differ as a multiset")

    drums = [n for n in m.notes if n.channel == DRUM_CHANNEL]
    if drums:
        dp = drum_positions(m.notes, m.division, m.time_signatures)
        print(f"\ndrums (channel 10) — {dp['count']} hits, eighth-note position within the bar")
        for pitch, hist in dp["by_pitch"].items():
            print(f"  {dp['names'][pitch]:<12} midi {pitch:<3} " +
                  " ".join(f"{k}×{v}" for k, v in hist.items()))
        for pitch, ok in dp["four_on_the_floor"].items():
            print(f"  {dp['names'][pitch]} four-on-the-floor: "
                  + ("yes — 0 2 4 6 and nothing else" if ok else "no"))

    if args.expect_tempos is not None:
        got = len(m.tempos)
        if got == args.expect_tempos:
            print(f"\ntempo events {got} = expected {args.expect_tempos}. ✓")
        else:
            print(f"\ntempo events {got} ≠ expected {args.expect_tempos}. ✗ "
                  "(a bare Q: in an ABC body is ignored — a mid-tune tempo needs the inline [Q:1/4=N])")
            failures.append(f"tempo events {got} ≠ {args.expect_tempos}")

    if m.unclosed:
        failures.append(f"{m.unclosed} note(s) never closed")

    print()
    if failures:
        print("VERDICT  FAILED — " + "; ".join(failures))
        return 1
    print("VERDICT  every expectation met.")
    return 0


def cmd_registers(args) -> int:
    m = read(args.file)
    _print_read(m)
    _print_registers(m)
    return 0


def cmd_bands(args) -> int:
    m = read(args.file)
    bad = 0
    for lo, hi in args.empty:
        b = band_occupancy(m.notes, lo, hi)
        print(f"{lo}-{hi}  {b['count']}/{b['total']} notes ({100 * b['share']:.2f} %)"
              f"  {'EMPTY ✓' if b['empty'] else 'OCCUPIED ✗ ' + str(b['pitches'])}")
        bad += 0 if b["empty"] else 1
    return 1 if bad else 0


def cmd_pcs(args) -> int:
    m = read(args.file)
    h = pitch_classes(m.notes)
    for pc in h["ranked"]:
        v = h["by_pc"][pc]
        if v["ticks"]:
            print(f"{PC_NAMES[pc]:<2} {100 * v['share']:6.2f} %  {v['ticks']:>8} ticks  "
                  f"{v['events']} events")
    return 0


def cmd_drums(args) -> int:
    m = read(args.file)
    dp = drum_positions(m.notes, m.division, m.time_signatures)
    if not dp["count"]:
        print("no channel-10 notes in this file")
        return 0
    print(f"{dp['count']} drum hits")
    for pitch, hist in dp["by_pitch"].items():
        print(f"  {dp['names'][pitch]:<12} midi {pitch:<3} " +
              " ".join(f"eighth {k}×{v}" for k, v in hist.items()))
    for pitch, ok in dp["four_on_the_floor"].items():
        print(f"  {dp['names'][pitch]} four-on-the-floor: {'yes' if ok else 'no'}")
    return 0


def cmd_same(args) -> int:
    s = same_pitches(args.a, args.b)
    print(json.dumps(s, indent=2, default=str))
    return 0 if s["multiset"] else 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="atelier_midi.py",
        description="Read a rendered MIDI file and prove what is inside it. "
                    "Standard library only — never mido.",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    v = sub.add_parser("verify", help="run every expectation against one rendered file")
    v.add_argument("file")
    v.add_argument("--empty", type=_range, action="append", metavar="LO-HI",
                   help="MIDI range that must hold zero notes; repeatable (e.g. 45-53)")
    v.add_argument("--mode", help="ddorian | 'e phrygian' | Bbmajor | 0,2,4,5,7,9,11")
    v.add_argument("--min-purity", type=float, default=None,
                   help="turn --mode into an expectation: fail below this share (0-1)")
    v.add_argument("--expect-notes", type=int, default=None, help="exact note count expected")
    v.add_argument("--expect-tempos", type=int, default=None,
                   help="exact number of tempo events expected (mid-tune tempo needs inline [Q:])")
    v.add_argument("--same", metavar="OTHER.mid",
                   help="assert the pitches are unchanged against another file")
    v.set_defaults(func=cmd_verify)

    r = sub.add_parser("registers", help="per-track extent and inter-track overlap")
    r.add_argument("file")
    r.set_defaults(func=cmd_registers)

    b = sub.add_parser("bands", help="occupancy of one or more MIDI ranges")
    b.add_argument("file")
    b.add_argument("--empty", type=_range, action="append", required=True, metavar="LO-HI")
    b.set_defaults(func=cmd_bands)

    c = sub.add_parser("pitch-classes", help="duration-weighted pitch-class histogram")
    c.add_argument("file")
    c.set_defaults(func=cmd_pcs)

    d = sub.add_parser("drums", help="eighth-note position of every channel-10 note")
    d.add_argument("file")
    d.set_defaults(func=cmd_drums)

    s = sub.add_parser("same", help="compare two files note-for-note and as a multiset")
    s.add_argument("a")
    s.add_argument("b")
    s.set_defaults(func=cmd_same)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
