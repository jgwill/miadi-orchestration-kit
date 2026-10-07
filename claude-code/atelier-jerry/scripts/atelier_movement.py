#!/usr/bin/env python3
"""atelier_movement.py — read an OSC movement capture and say what the body did.

Standard library only, and numpy is not imported at all — not optionally,
not lazily. A movement take is a few thousand packets; `statistics` is enough,
and a module that runs everywhere is worth more here than one that runs fast.
Nothing degrades, because there is nothing to degrade to.

THE STREAM
  One JSON object per line. Address /wek/inputs, nine float channels:

      0-2  linear acceleration
      3-5  gyroscope
      6-8  attitude          — channel 8 is a HEADING in radians, and it wraps

  UNITS ARE NOT DECLARED. The studio's own field ledger says the channel
  semantic map is absent and states only what it WOULD read. So every number
  this module prints is written WITHOUT A UNIT. The music never depended on
  units — it comes from ratios. Saying "m/s²" once, as if it were known, was a
  mistake already paid for.

DEDUPE COMES FIRST, ALWAYS
  100 Hz requested delivered 23.8 Hz of new values — 76 % of packets repeated
  the previous one. That is not a fault: holding each channel's last value
  between beats is the OSC literature's standard mitigation for UDP's
  non-assured delivery, and the conductor does it on purpose. But onsets found
  in the raw stream were the staircase of held values, not his body — 28
  "onsets" spaced 120-133 ms, which is the hold interval and nothing else. On
  the deduped stream: 15 onsets, spaced 153 to 1481 ms.

  So: every function here operates on the deduped stream, and the held-value
  ratio is reported before anything else, every time.

CLI
    python3 atelier_movement.py report TAKE.jsonl
    python3 atelier_movement.py onsets TAKE.jsonl
    python3 atelier_movement.py heading TAKE.jsonl
    python3 atelier_movement.py stillness TAKE.jsonl --threshold 0.5
"""

from __future__ import annotations

import argparse
import collections
import json
import math
import statistics
import sys
from typing import NamedTuple, Sequence

__all__ = [
    "load",
    "dedupe",
    "held_ratio",
    "rates",
    "per_second",
    "magnitudes",
    "onsets",
    "unwrap_heading",
    "sextants",
    "stillness",
    "ACCEL",
    "ROTATION",
    "ATTITUDE",
    "HEADING_CHANNEL",
]

ACCEL = (0, 1, 2)
ROTATION = (3, 4, 5)
ATTITUDE = (6, 7, 8)
HEADING_CHANNEL = 8

TWO_PI = 2.0 * math.pi


# ── reading, and the dedupe that must come first ──────────────────────────


def load(jsonl) -> list:
    """Read one capture, one JSON object per line. Malformed lines are counted, not guessed.

    Returns the RAW packets. Nothing downstream should use them directly —
    dedupe() first. The raw list is kept so the held-value ratio can be stated,
    which is the number that tells a human whether the requested rate was real.
    """
    packets = []
    bad = 0
    with open(str(jsonl), "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                p = json.loads(line)
            except ValueError:
                bad += 1
                continue
            if "values" in p and "t" in p:
                packets.append(p)
            else:
                bad += 1
    if bad:
        print(f"[atelier_movement] {bad} line(s) in {jsonl} were not usable packets",
              file=sys.stderr)
    return packets


def dedupe(packets: Sequence[dict]) -> list:
    """Drop every packet whose `values` equal the previous packet's.

    MANDATORY BEFORE ANY OTHER MOVEMENT MEASURE. A held value is the
    conductor's UDP mitigation, not a sample of his body; counting it as one
    turns the hold interval into a rhythm and hands back a staircase.
    """
    out = []
    prev = None
    for p in packets:
        v = p.get("values")
        if prev is None or v != prev:
            out.append(p)
        prev = v
    return out


def held_ratio(packets: Sequence[dict]) -> float:
    """Share of raw packets that repeated the previous value. Report this first, always.

    0 % means the sensor kept up with the requested rate. 76 % means it did
    not, and that the real resolution is four times coarser than the number on
    the box. Both are honest; only one is what was asked for.
    """
    n = len(packets)
    if n <= 1:
        return 0.0
    return 1.0 - (len(dedupe(packets)) / n)


def _span(packets: Sequence[dict]) -> float:
    if len(packets) < 2:
        return 0.0
    return float(packets[-1]["t"]) - float(packets[0]["t"])


def rates(packets: Sequence[dict]) -> dict:
    """Declared packet rate against the real rate of NEW values.

    Decides what resolution the analysis below is entitled to claim. Multiplying
    the requested cadence by ten multiplied the information by 2.4 — a real
    gain, 100 ms down to 41 ms, and not ten. A tempo read at 23 Hz carries
    roughly ±7 BPM of instrument error around 140 BPM; saying 150 and 136 are
    different tempi without saying that would be dishonest.
    """
    raw = list(packets)
    new = dedupe(raw)
    span = _span(raw)
    gaps = [float(new[i]["t"]) - float(new[i - 1]["t"]) for i in range(1, len(new))]
    return {
        "packets": len(raw),
        "new_values": len(new),
        "held": len(raw) - len(new),
        "held_ratio": (1.0 - len(new) / len(raw)) if raw else 0.0,
        "duration": span,
        "packet_hz": (len(raw) / span) if span > 0 else 0.0,
        "new_value_hz": (len(new) / span) if span > 0 else 0.0,
        "median_gap_new": statistics.median(gaps) if gaps else None,
        "resolution_ms": (1000.0 * statistics.median(gaps)) if gaps else None,
    }


# ── magnitudes ────────────────────────────────────────────────────────────


def magnitudes(packets: Sequence[dict], channels=ACCEL) -> list:
    """(t, |v|) per packet for a channel group. Euclidean, because direction is a
    separate question answered by unwrap_heading().

    Deduped input assumed. The magnitude of a group is what drives density,
    dynamics and onsets; the sign of an individual axis depends on how the
    phone sat in his pocket and decides nothing.
    """
    out = []
    for p in packets:
        v = p["values"]
        try:
            m = math.sqrt(sum(float(v[c]) ** 2 for c in channels))
        except (IndexError, TypeError, ValueError):
            continue
        out.append((float(p["t"]), m))
    return out


def per_second(packets: Sequence[dict], channels=None) -> dict:
    """Mean magnitude per whole second, for acceleration (0-2) and rotation (3-5).

    ONE SECOND OF HIS BODY = ONE BAR. That is the whole reason this function
    exists: it is the bridge from a stream to a score, and it is the shape of
    every piece the atelier built from movement. Reading it back is how the
    form is checked against him — plateau, peak, dissolution — rather than
    against a story about him.
    """
    groups = channels if channels is not None else {"acceleration": ACCEL, "rotation": ROTATION}
    if isinstance(groups, (list, tuple)) and groups and isinstance(groups[0], int):
        groups = {"channels": tuple(groups)}
    out = {}
    for name, chans in groups.items():
        buckets = collections.defaultdict(list)
        for t, m in magnitudes(packets, chans):
            buckets[int(t)].append(m)
        keys = sorted(buckets)
        out[name] = [statistics.mean(buckets[k]) for k in keys]
        out[name + "_seconds"] = keys
    return out


# ── onsets ────────────────────────────────────────────────────────────────


def onsets(packets: Sequence[dict], channels=ACCEL, k: float = 1.2,
           min_sep_s: float = 0.15, dedupe_first: bool = True) -> dict:
    """Local maxima above median + 1.2σ, with a minimum separation. Rhythm from the body.

    Decides where a note is struck when his movement plays the piece. Run on
    the raw stream this returns the hold interval — 28 evenly spaced ghosts —
    so `dedupe_first` defaults to True and turning it off is a deliberate act.

    `min_sep_s` exists because a single gesture crosses the threshold on
    several consecutive new values; without it one attack is reported as three.
    The 0.15 s default is calibrated, not guessed: on the take of 2026-08-16 at
    17:14 it returns 15 attacks in two bursts, which is what the atelier used.
    Verified against that take — the count and the two-burst shape reproduce;
    11 of the 15 timestamps land within 30 ms of the session's own list, and
    the remaining four differ, because the session's peak-picking was never
    written down. Re-measure; do not quote its list.
    """
    pk = dedupe(packets) if dedupe_first else list(packets)
    mag = magnitudes(pk, channels)
    if len(mag) < 3:
        return {"times": [], "forces": [], "threshold": None, "n": 0,
                "median_gap": None, "deduped": dedupe_first}
    vals = [m for _, m in mag]
    med = statistics.median(vals)
    sd = statistics.pstdev(vals) if len(vals) > 1 else 0.0
    thr = med + k * sd
    times, forces = [], []
    for i in range(1, len(mag) - 1):
        t, m = mag[i]
        if m < thr:
            continue
        if not (m >= mag[i - 1][1] and m >= mag[i + 1][1]):
            continue
        if times and (t - times[-1]) < min_sep_s:
            if m > forces[-1]:
                times[-1], forces[-1] = t, m
            continue
        times.append(t)
        forces.append(m)
    gaps = [times[i] - times[i - 1] for i in range(1, len(times))]
    return {
        "times": [round(t, 4) for t in times],
        "forces": [round(f, 4) for f in forces],
        "threshold": thr,
        "median": med,
        "sigma": sd,
        "k": k,
        "min_sep_s": min_sep_s,
        "n": len(times),
        "median_gap": statistics.median(gaps) if gaps else None,
        "gap_range": (min(gaps), max(gaps)) if gaps else None,
        "deduped": dedupe_first,
    }


# ── heading ───────────────────────────────────────────────────────────────


def unwrap_heading(packets: Sequence[dict], channel: int = HEADING_CHANNEL) -> dict:
    """Cumulative heading, and how many 2π wraps were removed to get it.

    Decides the harmony in every piece where the chord follows where he is
    facing. Channel 8 never goes below 0 and reaches 6.28: it is a compass
    bearing in radians and it wraps at north. Used raw, the music leaps a whole
    turn every time he passes north — a jump no ear forgives and that
    corresponds to no movement of his at all. Deltas are folded into (−π, π]
    and accumulated. `wraps` is the count removed; if it is 0 the channel may
    not be a heading at all and this reading should be doubted.
    """
    pk = dedupe(packets)
    vals, times = [], []
    for p in pk:
        try:
            vals.append(float(p["values"][channel]))
            times.append(float(p["t"]))
        except (IndexError, TypeError, ValueError):
            continue
    if not vals:
        return {"times": [], "heading": [], "wraps": 0, "turn": 0.0, "turn_degrees": 0.0}
    u = [vals[0]]
    wraps = 0
    for i in range(1, len(vals)):
        d = vals[i] - vals[i - 1]
        if abs(abs(d) - TWO_PI) < 0.8:
            wraps += 1
        while d > math.pi:
            d -= TWO_PI
        while d < -math.pi:
            d += TWO_PI
        u.append(u[-1] + d)
    turn = u[-1] - u[0]
    return {
        "times": times,
        "heading": u,
        "raw": vals,
        "wraps": wraps,
        "turn": turn,
        "turn_degrees": math.degrees(turn),
        "range": (min(u), max(u)),
    }


def sextants(heading, n: int = 6) -> dict:
    """Which nth of the compass at each moment, and where it changes.

    Six harmonic stations map onto six sixths of the compass: the chord stops
    being chosen by a clock or a threshold and starts being chosen by the
    direction he is facing. He turns, the harmony turns. The change points are
    the deliverable — they are where the chord moves, and they do not fall on
    bar lines, which is the point.

    Accepts the dict from unwrap_heading() or a bare sequence of unwrapped
    radians. Unwrapped, always: feeding raw heading here puts a chord change on
    every pass of north.
    """
    if isinstance(heading, dict):
        times = heading.get("times") or []
        series = heading["heading"]
    else:
        series = list(heading)
        times = list(range(len(series)))
    idx = [int((h % TWO_PI) / TWO_PI * n) % n for h in series]
    changes = []
    for i in range(1, len(idx)):
        if idx[i] != idx[i - 1]:
            changes.append({"index": i,
                            "t": times[i] if i < len(times) else None,
                            "from": idx[i - 1], "to": idx[i]})
    occupancy = collections.Counter(idx)
    total = sum(occupancy.values()) or 1
    return {
        "n": n,
        "sextant": idx,
        "changes": changes,
        "n_changes": len(changes),
        "occupancy": {k: occupancy[k] / total for k in sorted(occupancy)},
        "visited": sorted(occupancy),
    }


# ── stillness ─────────────────────────────────────────────────────────────


def stillness(packets: Sequence[dict], threshold: float = 0.5, channels=ROTATION,
              min_span_s: float = 1.0) -> dict:
    """The still spans that cut a piece into sections.

    Where his body stops, the harmony changes. Sections come from him and not
    from a bar count, and this is the function that says where. Read per whole
    second on the same grid as per_second(), so a section boundary and a bar
    boundary are the same object.

    `threshold` has no unit, because the stream declares none. 0.5 on rotation
    is what the atelier used; it is a choice, and it is undone by one word.
    """
    pk = dedupe(packets)
    buckets = collections.defaultdict(list)
    for t, m in magnitudes(pk, channels):
        buckets[int(t)].append(m)
    seconds = sorted(buckets)
    series = [statistics.mean(buckets[s]) for s in seconds]
    still = [v < threshold for v in series]
    spans, cuts = [], []
    i = 0
    while i < len(still):
        if still[i]:
            j = i
            while j + 1 < len(still) and still[j + 1]:
                j += 1
            dur = (seconds[j] - seconds[i]) + 1
            if dur >= min_span_s:
                spans.append({"start_second": seconds[i], "end_second": seconds[j],
                              "duration": dur})
                cuts.append(seconds[i])
            i = j + 1
        else:
            i += 1
    return {
        "threshold": threshold,
        "channels": tuple(channels),
        "seconds": seconds,
        "series": series,
        "still": still,
        "spans": spans,
        "cuts": cuts,
        "n_sections": len(cuts) if cuts else 1,
        "still_share": (sum(still) / len(still)) if still else 0.0,
    }


# ── CLI ───────────────────────────────────────────────────────────────────


def _bar(v: float, peak: float, width: int = 28) -> str:
    if peak <= 0:
        return ""
    return "#" * max(0, min(width, int(round(width * v / peak))))


def cmd_report(args) -> int:
    raw = load(args.file)
    if not raw:
        print(f"{args.file}: no packets")
        return 1
    pk = dedupe(raw)
    r = rates(raw)

    print(f"take        {args.file}")
    print(f"packets     {r['packets']} raw · {r['new_values']} new values · "
          f"{r['held']} held ({100 * r['held_ratio']:.1f} %)")
    if r["held_ratio"] > 0.5:
        print("            ⚠ over half the stream repeats the previous value. Everything "
              "below is measured on the deduped stream — as it must be.")
    print(f"duration    {r['duration']:.2f} s")
    print(f"rate        {r['packet_hz']:.1f} Hz of packets · "
          f"{r['new_value_hz']:.1f} Hz of NEW VALUES"
          + (f" · median gap {r['resolution_ms']:.0f} ms" if r["resolution_ms"] else ""))
    print(f"            the honest resolution is the second number, not the first")

    ps = per_second(pk)
    acc, rot = ps["acceleration"], ps["rotation"]
    peak = max(acc + rot) if (acc or rot) else 0.0
    print("\nper second (no units — the stream declares none)")
    print("  s      accel   rotation")
    for i, s in enumerate(ps["acceleration_seconds"]):
        a = acc[i] if i < len(acc) else 0.0
        g = rot[i] if i < len(rot) else 0.0
        print(f"  {s:<4} {a:7.3f} {g:9.3f}  {_bar(a, peak)}")

    o = onsets(pk, channels=tuple(args.channels))
    print(f"\nonsets      {o['n']} above median+{o['k']}σ "
          f"(median {o['median']:.3f}, σ {o['sigma']:.3f}, threshold {o['threshold']:.3f}, "
          f"min separation {o['min_sep_s']:.2f} s)")
    if o["n"]:
        print("  times   " + " ".join(f"{t:.2f}" for t in o["times"][:40])
              + (" …" if o["n"] > 40 else ""))
        print("  forces  " + " ".join(f"{f:.2f}" for f in o["forces"][:40])
              + (" …" if o["n"] > 40 else ""))
        if o["median_gap"]:
            print(f"  median gap {o['median_gap']:.3f} s → {60.0 / o['median_gap']:.1f} per minute "
                  f"· gaps {o['gap_range'][0]:.3f}-{o['gap_range'][1]:.3f} s")
    raw_o = onsets(raw, channels=tuple(args.channels), dedupe_first=False)
    print(f"  (on the RAW stream the same detector reports {raw_o['n']} — "
          "the staircase of held values, not his body)")

    h = unwrap_heading(pk, channel=args.heading_channel)
    print(f"\nheading     channel {args.heading_channel} · {h['wraps']} wrap(s) of 2π removed")
    if h["heading"]:
        print(f"  turn      {h['turn']:+.3f} rad = {h['turn_degrees']:+.0f}° "
              f"(a ratio of angles, not a converted unit)")
        sx = sextants(h, n=args.sextants)
        occ = " · ".join(f"{k} {100 * v:.0f} %" for k, v in sx["occupancy"].items())
        print(f"  sextants  {sx['n_changes']} change(s) · visited {sx['visited']} · {occ}")
        if sx["changes"]:
            print("  at        " + " ".join(
                f"{c['t']:.2f}" for c in sx["changes"][:20] if c["t"] is not None)
                + (" …" if sx["n_changes"] > 20 else ""))
    if h["wraps"] == 0:
        print("  ⚠ no wrap removed — either he never crossed north, or this channel is "
              "not a heading. Do not build harmony on it without looking.")

    st = stillness(pk, threshold=args.threshold)
    print(f"\nstillness   rotation < {args.threshold:g} · "
          f"{100 * st['still_share']:.0f} % of seconds still · {len(st['spans'])} span(s)")
    for s in st["spans"]:
        print(f"  {s['start_second']:>4}-{s['end_second']:<4} s   {s['duration']} s")
    print(f"  cuts at seconds {st['cuts']} → {st['n_sections']} section(s)")
    return 0


def cmd_onsets(args) -> int:
    pk = load(args.file)
    o = onsets(pk, channels=tuple(args.channels), k=args.k, min_sep_s=args.min_sep)
    print(json.dumps({k: v for k, v in o.items()}, indent=2, default=str))
    return 0


def cmd_heading(args) -> int:
    pk = load(args.file)
    h = unwrap_heading(pk, channel=args.heading_channel)
    sx = sextants(h, n=args.sextants)
    print(f"wraps removed {h['wraps']} · turn {h['turn']:+.3f} rad "
          f"({h['turn_degrees']:+.0f}°) · {sx['n_changes']} sextant change(s)")
    for c in sx["changes"]:
        print(f"  {c['t']:.3f} s   sextant {c['from']} → {c['to']}")
    return 0


def cmd_stillness(args) -> int:
    pk = load(args.file)
    st = stillness(pk, threshold=args.threshold)
    print(f"{100 * st['still_share']:.0f} % of seconds still · {len(st['spans'])} span(s)")
    for s in st["spans"]:
        print(f"  {s['start_second']}-{s['end_second']} s  ({s['duration']} s)")
    print(f"cuts {st['cuts']}")
    return 0


def cmd_rates(args) -> int:
    raw = load(args.file)
    r = rates(raw)
    print(json.dumps(r, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="atelier_movement.py",
        description="Read an OSC movement capture. Standard library only. Every measure runs "
                    "on the DEDUPED stream; the held-value ratio is reported first.",
        epilog="Channels: 0-2 acceleration · 3-5 rotation · 6-8 attitude (8 = heading, wraps at 2π). "
               "Units are not declared by the stream, so none are printed.",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("report", help="the full picture of one take")
    r.add_argument("file")
    r.add_argument("--channels", type=int, nargs="+", default=list(ACCEL),
                   help="channel group for onsets (default 0 1 2, acceleration)")
    r.add_argument("--threshold", type=float, default=0.5,
                   help="stillness threshold on rotation magnitude (no unit)")
    r.add_argument("--heading-channel", type=int, default=HEADING_CHANNEL)
    r.add_argument("--sextants", type=int, default=6)
    r.set_defaults(func=cmd_report)

    o = sub.add_parser("onsets", help="local maxima above median+kσ, on the deduped stream")
    o.add_argument("file")
    o.add_argument("--channels", type=int, nargs="+", default=list(ACCEL))
    o.add_argument("--k", type=float, default=1.2)
    o.add_argument("--min-sep", type=float, default=0.15)
    o.set_defaults(func=cmd_onsets)

    h = sub.add_parser("heading", help="unwrapped heading and its sextant changes")
    h.add_argument("file")
    h.add_argument("--heading-channel", type=int, default=HEADING_CHANNEL)
    h.add_argument("--sextants", type=int, default=6)
    h.set_defaults(func=cmd_heading)

    s = sub.add_parser("stillness", help="the still spans that cut a piece into sections")
    s.add_argument("file")
    s.add_argument("--threshold", type=float, default=0.5)
    s.set_defaults(func=cmd_stillness)

    t = sub.add_parser("rates", help="declared packet rate against the real new-value rate")
    t.add_argument("file")
    t.set_defaults(func=cmd_rates)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
