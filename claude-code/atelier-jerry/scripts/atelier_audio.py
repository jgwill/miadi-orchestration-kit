#!/usr/bin/env python3
"""atelier_audio.py — measure a rendered piece, and measure a voice.

numpy plus the standard library `wave` module. Never librosa, never soundfile,
never mido: none of them exist on the host this atelier runs on. numpy itself
is not guaranteed to be importable under whatever `python3` resolves to, so
this module FINDS an interpreter that has it, or refuses out loud with the list
of what it tried. It never pretends.

WHAT THIS MODULE IS FOR
  Timbre is chosen by measurement here, never by taste, and the thresholds are
  Jerry's, not invented:

      stridence  > 13.12 %  rejected
                 ≤  5.98 %  accepted
                 ≤  3.00 %  soft

  A multi-voice piece rarely reaches 5.98 %. Say the number; do not fake it.

  Five corrections this module exists to make impossible to repeat:
    · a band read off a week-old recording was 4 semitones wrong — measure the
      newest take, always
    · an autocorrelation octave error invented a note the singer never sang —
      fold octaves AND check the energy at f/4  (octave_error_check)
    · held notes, not frames, separate singing from speech (≥200 ms, ±1 semitone)
    · motif vs drone is a rule, not an impression: ≥3 notes, ≥3 distinct
      pitches, span ≥3 semitones
    · removing the hi-hats RAISED stridence once — the source was the lead's
      sawtooth. Measure; do not blame the obvious.

CONSENT
  His voice is analysed and then destroyed locally. Only numbers leave the
  device. Nothing in this file writes audio anywhere.

CLI
    python3 atelier_audio.py stridence FILE.wav
    python3 atelier_audio.py voice FILE.wav --band 116-156
    python3 atelier_audio.py motifs FILE.wav
    python3 atelier_audio.py f0 FILE.wav [--ceiling 60]
    python3 atelier_audio.py seams FILE.wav --at 12.0 --at 25.5
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import wave
from typing import NamedTuple, Sequence

__all__ = [
    "Audio",
    "F0Track",
    "load_wav",
    "spectrum",
    "stridence",
    "stridence_verdict",
    "band_share",
    "f0_track",
    "fold_octaves",
    "octave_error_check",
    "held_notes",
    "motifs",
    "interval_cells",
    "seams",
    "STRIDENCE_REJECT",
    "STRIDENCE_ACCEPT",
    "STRIDENCE_SOFT",
]

# Jerry's thresholds, as spoken. Shares, not percentages.
STRIDENCE_REJECT = 0.1312
STRIDENCE_ACCEPT = 0.0598
STRIDENCE_SOFT = 0.0300

STRIDENCE_BAND = (2000.0, 5000.0)

# Interpreter fallbacks, in order, when the running python has no numpy.
# ATELIER_PYTHON overrides everything; the anaconda path is the fallback
# verified on the atelier host, and is a declaration, not an assumption —
# if it is absent the error below says exactly that.
_ENV_INTERPRETER = "ATELIER_PYTHON"
_FALLBACK_INTERPRETERS = ("/opt/anaconda3/bin/python3",)
_REEXEC_GUARD = "ATELIER_AUDIO_REEXEC"

_np = None


class NumpyMissing(RuntimeError):
    """Raised when no interpreter on this host can import numpy."""


def _interpreter_candidates():
    seen, out = set(), []
    for c in (
        os.environ.get(_ENV_INTERPRETER),
        sys.executable,
        *_FALLBACK_INTERPRETERS,
        shutil.which("python3"),
        shutil.which("python"),
    ):
        if c and c not in seen:
            seen.add(c)
            out.append(c)
    return out


def numpy_or_die():
    """Import numpy, or raise NumpyMissing naming every interpreter tried.

    Decides nothing musical. It decides whether this module is allowed to run
    at all — a plugin that quietly assumes a library misleads rather than
    refuses, and refusing loudly is the contract.
    """
    global _np
    if _np is not None:
        return _np
    try:
        import numpy  # noqa: F401
    except ImportError:
        tried = []
        for cand in _interpreter_candidates():
            if not os.path.exists(cand):
                tried.append(f"{cand}  (absent)")
                continue
            try:
                r = subprocess.run(
                    [cand, "-c", "import numpy"],
                    capture_output=True, timeout=60,
                )
            except (OSError, subprocess.TimeoutExpired) as exc:
                tried.append(f"{cand}  (could not run: {exc})")
                continue
            tried.append(f"{cand}  ({'has numpy' if r.returncode == 0 else 'no numpy'})")
        raise NumpyMissing(
            "atelier_audio needs numpy and the running interpreter "
            f"({sys.executable}) does not have it.\n"
            "Interpreters tried, in order:\n  " + "\n  ".join(tried) + "\n"
            f"Set {_ENV_INTERPRETER}=/path/to/python-with-numpy and re-run, "
            "or invoke that interpreter directly. Nothing was measured."
        )
    else:
        import numpy
        _np = numpy
        return _np
    return _np


def _reexec_if_needed():
    """CLI entry only: hop to an interpreter that has numpy, once.

    Import-time callers get the exception instead — a library must not replace
    its caller's process.
    """
    try:
        import numpy  # noqa: F401
        return
    except ImportError:
        pass
    if os.environ.get(_REEXEC_GUARD):
        return  # already hopped once; let numpy_or_die() report honestly
    for cand in _interpreter_candidates():
        if cand == sys.executable or not os.path.exists(cand):
            continue
        try:
            r = subprocess.run([cand, "-c", "import numpy"], capture_output=True, timeout=60)
        except (OSError, subprocess.TimeoutExpired):
            continue
        if r.returncode == 0:
            env = dict(os.environ, **{_REEXEC_GUARD: "1"})
            print(f"[atelier_audio] no numpy under {sys.executable}; re-running under {cand}",
                  file=sys.stderr)
            os.execve(cand, [cand, os.path.abspath(__file__), *sys.argv[1:]], env)
    # nothing found: fall through, numpy_or_die() will name what was tried


# ── reading ───────────────────────────────────────────────────────────────


class Audio(NamedTuple):
    """Mono float samples in [-1, 1], and the sample rate that produced them."""

    samples: object
    rate: int
    path: str
    channels: int


def load_wav(path) -> Audio:
    """Read a PCM WAV with the standard library and mix it down to mono.

    Mono on purpose: every measure here is about spectral content and pitch,
    and a stereo pair measured separately would answer twice without deciding
    anything. Refuses compressed WAV rather than guessing — `wave` cannot
    decode it and a silent wrong answer is worse than a stop.
    """
    np = numpy_or_die()
    path = str(path)
    with wave.open(path, "rb") as w:
        nch, width, rate, nframes = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(nframes)
    if width == 1:
        a = np.frombuffer(raw, dtype=np.uint8).astype(np.float32)
        a = (a - 128.0) / 128.0
    elif width == 2:
        a = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    elif width == 3:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        v = (b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16))
        v = np.where(v & 0x800000, v - 0x1000000, v)
        a = v.astype(np.float32) / 8388608.0
    elif width == 4:
        a = np.frombuffer(raw, dtype="<i4").astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"{path}: unsupported sample width {width} bytes")
    if nch > 1:
        a = a.reshape(-1, nch).mean(axis=1)
    return Audio(a.astype(np.float64), rate, path, nch)


def _as_audio(x) -> Audio:
    if isinstance(x, Audio):
        return x
    return load_wav(x)


# ── spectrum ──────────────────────────────────────────────────────────────


N_FFT = 2048
HOP = 1024


def spectrum(audio: Audio, n_fft: int = N_FFT, hop: int = HOP):
    """Mean power spectrum over the whole file, Hann-windowed. Returns (freqs, power).

    Fixed 2048-point frames with 50 % overlap, so the same file measured on two
    hosts returns the same number. A band edge is given in Hz, never in bins.
    """
    np = numpy_or_die()
    x = audio.samples
    n = int(n_fft)
    if len(x) < n:
        x = np.pad(x, (0, n - len(x)))
    win = np.hanning(n)
    acc = np.zeros(n // 2 + 1)
    frames = 0
    for s in range(0, len(x) - n + 1, int(hop)):
        acc += np.abs(np.fft.rfft(x[s : s + n] * win)) ** 2
        frames += 1
    if frames:
        acc /= frames
    return np.fft.rfftfreq(n, 1.0 / audio.rate), acc


def band_share(wav, lo_hz: float, hi_hz: float, weight: str = "magnitude", **kw) -> float:
    """Share of total spectral weight inside an arbitrary Hz band, whole file.

    Decides which instrument a piece gets, and whether an arrangement will mask
    the singer. Two bands are read for every candidate timbre: 2-5 kHz (does it
    scratch) and his own singing band in Hz (does it sit on top of him). The
    winner is the best of the two numbers, not the prettiest sound.

    `weight='magnitude'` sums |X| — the default, and the only scale on which
    Jerry's thresholds mean anything. On this day's pieces it reads 2-8 %,
    which is the range he was speaking about; summing |X|² instead puts every
    one of them under 1 % and makes a 13.12 % reject line unreachable by any
    sound, which cannot be what he calibrated against. `weight='power'` is
    available and is a different number — never compare the two.
    """
    a = _as_audio(wav)
    freqs, power = spectrum(a, **kw)
    np = numpy_or_die()
    v = power if weight == "power" else np.sqrt(power)
    total = float(v.sum())
    if total <= 0:
        return 0.0
    m = (freqs >= lo_hz) & (freqs < hi_hz)
    return float(v[m].sum()) / total


def stridence(wav, **kw) -> float:
    """Share of spectral magnitude in 2000-5000 Hz over the whole file.

    THE timbre decision. > 13.12 % rejected, ≤ 5.98 % accepted, ≤ 3 % soft.
    Whole file on purpose: a bright section measured alone answers a different
    question than the one Jerry asked, which is whether the piece scratches.

    UNVERIFIED against the session's own figures. The atelier's stridence code
    was never written down in a generator, and the candidate renders it read
    are gone, so this implementation could not be checked number for number.
    Measured here on the surviving renders of 2026-08-16: op019 2.09 %,
    op018 4.42 %, ava2v2 6.50 %, op023 8.44 % — the same ordering and the same
    4-8 % range the session reported for that day, running 15-25 % low against
    the two figures it named (ava2v2 7.60 %, op023 11.30 %). Treat a number
    from this function as comparable to another number from this function, and
    re-measure every candidate rather than quoting a figure from the day.
    """
    return band_share(wav, *STRIDENCE_BAND, **kw)


def stridence_verdict(share: float) -> str:
    """Name the threshold a stridence share falls under. Jerry's words, no others."""
    if share > STRIDENCE_REJECT:
        return "rejected"
    if share <= STRIDENCE_SOFT:
        return "soft"
    if share <= STRIDENCE_ACCEPT:
        return "accepted"
    return "between the accept line (5.98 %) and the reject line (13.12 %) — say the number"


# ── pitch ─────────────────────────────────────────────────────────────────


class F0Track(NamedTuple):
    times: object       # seconds, frame centres
    midi: object        # MIDI floats, NaN where unvoiced
    hz: object          # Hz, NaN where unvoiced
    rms: object         # per-frame RMS
    confidence: object  # normalised autocorrelation peak, 0-1
    rate: int
    window_s: float
    hop_s: float
    path: str


def f0_track(wav, window_s: float = 0.040, hop_s: float = 0.020,
             fmin: float = 60.0, fmax: float = 1000.0,
             conf_floor: float = 0.30, rms_floor: float = 1e-4,
             smooth: int = 5) -> F0Track:
    """Autocorrelation f0 per 40 ms window, 5-frame median smoothing.

    Decides what he actually sings, as opposed to what a listener reports. Two
    guards, both earned:
      · frames below `conf_floor` or `rms_floor` are UNVOICED (NaN), not
        forced to a pitch — silence with a pitch attached is an invention;
      · the median smoother removes single-frame octave flips, which are the
        cheap half of the octave problem. The expensive half needs
        octave_error_check(), and skipping it once invented a note he had
        never sung.
    """
    np = numpy_or_die()
    a = _as_audio(wav)
    x = a.samples
    n = max(64, int(window_s * a.rate))
    hop = max(1, int(hop_s * a.rate))
    lag_lo = max(2, int(a.rate / fmax))
    lag_hi = min(n - 1, int(a.rate / fmin))
    nfft = 1 << (int(math.ceil(math.log2(2 * n))))

    times, hz, rms_l, conf_l = [], [], [], []
    for s in range(0, max(1, len(x) - n + 1), hop):
        seg = x[s : s + n]
        if len(seg) < n:
            break
        seg = seg - seg.mean()
        r0 = float(np.dot(seg, seg))
        rms = math.sqrt(r0 / n)
        times.append((s + n / 2.0) / a.rate)
        rms_l.append(rms)
        if r0 <= 0 or rms < rms_floor or lag_hi <= lag_lo:
            hz.append(float("nan"))
            conf_l.append(0.0)
            continue
        spec = np.fft.rfft(seg, nfft)
        ac = np.fft.irfft(np.abs(spec) ** 2, nfft)[:n]
        ac = ac / ac[0]
        window = ac[lag_lo : lag_hi + 1]
        k = int(np.argmax(window)) + lag_lo
        c = float(ac[k])
        if c < conf_floor:
            hz.append(float("nan"))
            conf_l.append(c)
            continue
        # parabolic interpolation around the peak, for sub-sample lag
        if 0 < k < n - 1:
            y0, y1, y2 = ac[k - 1], ac[k], ac[k + 1]
            denom = (y0 - 2 * y1 + y2)
            k_ref = k + (0.5 * (y0 - y2) / denom) if denom else k
        else:
            k_ref = k
        hz.append(a.rate / k_ref if k_ref > 0 else float("nan"))
        conf_l.append(c)

    hz_arr = np.array(hz, dtype=float)
    midi = np.where(np.isnan(hz_arr), np.nan, 69.0 + 12.0 * np.log2(np.maximum(hz_arr, 1e-9) / 440.0))
    if smooth and smooth > 1:
        midi = _median_smooth(midi, smooth)
        hz_arr = np.where(np.isnan(midi), np.nan, 440.0 * 2.0 ** ((midi - 69.0) / 12.0))
    return F0Track(np.array(times), midi, hz_arr, np.array(rms_l),
                   np.array(conf_l), a.rate, window_s, hop_s, a.path)


def _median_smooth(series, k: int):
    """Median over k frames, NaN-aware. A single wild frame must not become a note."""
    np = numpy_or_die()
    out = np.array(series, dtype=float).copy()
    half = k // 2
    for i in range(len(out)):
        lo, hi = max(0, i - half), min(len(out), i + half + 1)
        w = series[lo:hi]
        w = w[~np.isnan(w)]
        out[i] = float(np.median(w)) if len(w) else float("nan")
    return out


def fold_octaves(midi_series, ceiling: float, floor: float = None):
    """Fold every MIDI value down by octaves until it sits at or under `ceiling`.

    Decides where his voice really is. His band was measured the same day:
    94.1 % of the park drone between A2 and E3. A tracker that reports B4 for a
    man droning B2 is reporting its own error, and folding is the first half of
    the fix — the second half is octave_error_check(), which says whether the
    fold was warranted or whether he genuinely sang up there.
    """
    np = numpy_or_die()
    m = np.array(midi_series, dtype=float).copy()
    ok = ~np.isnan(m)
    while np.any(ok & (m > ceiling)):
        sel = ok & (m > ceiling)
        m[sel] -= 12.0
    if floor is not None:
        while np.any(ok & (m < floor)):
            sel = ok & (m < floor)
            m[sel] += 12.0
    return m


def octave_error_check(wav, f0: F0Track, ratio_hz: float = 4.0,
                       band_frac: float = 0.06, min_hz: float = 40.0,
                       long_window_factor: int = 4) -> dict:
    """Energy at f/4 against energy at f, frame by frame. This caught an invented note.

    Decides whether a reported high pitch is real. On 1301 frames tracked near
    494 Hz, the energy at f/4 — his B2 — was 5.33× stronger, in 86 % of frames.
    The B4 did not exist. When `share_below` is high and `median_ratio` > 1,
    the tracker is octave-doubling and the series must be folded before a note
    is claimed.

    The analysis window here is longer than the tracker's (4× by default):
    f/4 of 494 Hz is 123 Hz, which a 40 ms window cannot resolve. Measuring the
    correction at the resolution that produced the error would reproduce it.

    The ratio is a POWER ratio, so a component at four times the amplitude
    reads 16 and not 4. Verified against a synthesised case: f/4 built at 5×
    amplitude reads 24.82. Say which ratio you mean when you quote it.
    """
    np = numpy_or_die()
    a = _as_audio(wav)
    n = max(256, int(f0.window_s * a.rate) * long_window_factor)
    nfft = 1 << int(math.ceil(math.log2(n)))
    win = np.hanning(n)
    ratios = []
    for t, f in zip(f0.times, f0.hz):
        if math.isnan(f) or f / ratio_hz < min_hz:
            continue
        c = int(t * a.rate)
        s = max(0, c - n // 2)
        seg = a.samples[s : s + n]
        if len(seg) < n:
            continue
        spec = np.abs(np.fft.rfft((seg - seg.mean()) * win, nfft)) ** 2
        freqs = np.fft.rfftfreq(nfft, 1.0 / a.rate)
        lo = f * (1 - band_frac)
        hi = f * (1 + band_frac)
        e_f = float(spec[(freqs >= lo) & (freqs <= hi)].sum())
        fl = f / ratio_hz
        e_sub = float(spec[(freqs >= fl * (1 - band_frac)) & (freqs <= fl * (1 + band_frac))].sum())
        if e_f > 0:
            ratios.append(e_sub / e_f)
    if not ratios:
        return {"frames": 0, "median_ratio": None, "mean_ratio": None,
                "share_below": None, "verdict": "no voiced frame could be checked"}
    r = np.array(ratios)
    share = float((r > 1.0).mean())
    med = float(np.median(r))
    if med > 1.0 and share > 0.5:
        verdict = (f"octave error: energy at f/{ratio_hz:g} is {med:.2f}× stronger in "
                   f"{100 * share:.0f} % of frames — fold before claiming a note")
    else:
        verdict = f"no octave error detected (median ratio {med:.2f}, {100 * share:.0f} % of frames)"
    return {
        "frames": len(ratios),
        "median_ratio": med,
        "mean_ratio": float(r.mean()),
        "share_below": share,
        "verdict": verdict,
    }


# ── notes, gestures, cells ────────────────────────────────────────────────


class HeldNote(NamedTuple):
    start: float
    end: float
    midi: float
    rms: float

    @property
    def duration(self) -> float:
        return self.end - self.start


def held_notes(f0: F0Track, min_ms: float = 200.0, tol_semitones: float = 1.0) -> list:
    """Frames that stay within ±1 semitone for at least 200 ms become one note.

    Decides what is singing and what is speech. Speech never holds a pitch for
    200 ms; a drone holds it for seconds. Everything downstream — the pitch-class
    profile, the motif database, the interval cells — is built on these notes and
    not on frames, because a frame count is a property of the tracker's hop and
    a held note is a property of him.
    """
    np = numpy_or_die()
    out = []
    run = []
    min_s = min_ms / 1000.0

    def close(run):
        if not run:
            return
        ts = [f0.times[i] for i in run]
        ms = [f0.midi[i] for i in run]
        dur = ts[-1] - ts[0] + f0.hop_s
        if dur >= min_s:
            out.append(HeldNote(round(float(ts[0]), 4),
                                round(float(ts[0] + dur), 4),
                                float(np.median(ms)),
                                float(np.mean([f0.rms[i] for i in run]))))

    for i, m in enumerate(f0.midi):
        if math.isnan(m):
            close(run)
            run = []
            continue
        if not run:
            run = [i]
            continue
        ref = float(np.median([f0.midi[j] for j in run]))
        if abs(m - ref) <= tol_semitones and (f0.times[i] - f0.times[run[-1]]) <= 2.5 * f0.hop_s:
            run.append(i)
        else:
            close(run)
            run = [i]
    close(run)
    return out


MOTIF_MIN_NOTES = 3
MOTIF_MIN_DISTINCT = 3
MOTIF_MIN_SPAN = 3.0


def motifs(notes: Sequence[HeldNote], gap_s: float = 0.5) -> list:
    """Split held notes into gestures at every silence, then classify each one.

    The rule, and it is a rule and not an impression: a gesture is a MOTIF when
    it has ≥3 notes, ≥3 distinct pitches and a span of ≥3 semitones. Anything
    else is a DRONE. Without it, a man who bourdonne reads as a melodist — which
    is exactly the mistake that would have had him handed a tune to sing instead
    of a world to stand inside.
    """
    gestures = []
    cur = []
    for n in notes:
        if cur and (n.start - cur[-1].end) > gap_s:
            gestures.append(cur)
            cur = []
        cur.append(n)
    if cur:
        gestures.append(cur)

    out = []
    for g in gestures:
        pitches = [round(n.midi) for n in g]
        distinct = len(set(pitches))
        span = (max(pitches) - min(pitches)) if pitches else 0
        is_motif = (len(g) >= MOTIF_MIN_NOTES and distinct >= MOTIF_MIN_DISTINCT
                    and span >= MOTIF_MIN_SPAN)
        out.append({
            "kind": "motif" if is_motif else "drone",
            "start": g[0].start,
            "end": g[-1].end,
            "duration": round(g[-1].end - g[0].start, 3),
            "n_notes": len(g),
            "distinct": distinct,
            "span": span,
            "pitches": pitches,
            "intervals": [pitches[i + 1] - pitches[i] for i in range(len(pitches) - 1)],
            "notes": g,
        })
    return out


def interval_cells(gestures: Sequence[dict], lengths=(2, 3, 4), motifs_only: bool = True) -> list:
    """Recurring interval sequences across gestures, with the time of every hit.

    Finds his signature cell. Intervals and not pitches on purpose: a cell sung
    twice at different heights is the same cell, and counting pitches would miss
    it. His came back as +3 -8 +5 — an E minor arpeggio with an octave drop —
    three times inside six seconds, and nothing else came back that tight.

    Returns cells sorted by count then length, each with its timestamps. A cell
    that appears once is still returned; the timestamps are what let a human
    listen and disagree.
    """
    hits = {}
    for gi, g in enumerate(gestures):
        if motifs_only and g["kind"] != "motif":
            continue
        iv = g["intervals"]
        for L in lengths:
            for i in range(0, len(iv) - L + 1):
                key = tuple(iv[i : i + L])
                rec = hits.setdefault(key, {"cell": list(key), "length": L, "count": 0,
                                            "times": [], "gestures": []})
                rec["count"] += 1
                rec["times"].append(round(float(g["notes"][i].start), 3))
                rec["gestures"].append(gi)
    return sorted(hits.values(), key=lambda r: (-r["count"], -r["length"], r["times"][0]))


# ── assembly ──────────────────────────────────────────────────────────────


def seams(wav, times: Sequence[float], window_s: float = 0.25) -> list:
    """RMS before, during and after every crossfade point.

    Decides whether an assembled piece is listenable. A seam that dips to
    silence is a hole; a seam that jumps is a click. Both are audible and both
    are invisible in the source score, because the score does not know the
    pieces were glued. Reported as a ratio as well as levels: dB differences are
    what an ear notices, and `jump_db` is the number to argue about.
    """
    np = numpy_or_die()
    a = _as_audio(wav)
    x = a.samples

    def rms(t0, t1):
        i0, i1 = max(0, int(t0 * a.rate)), min(len(x), int(t1 * a.rate))
        if i1 <= i0:
            return 0.0
        seg = x[i0:i1]
        return float(np.sqrt(np.dot(seg, seg) / len(seg)))

    def db(v):
        return 20.0 * math.log10(v) if v > 0 else float("-inf")

    out = []
    for t in times:
        before = rms(t - window_s, t)
        during = rms(t - window_s / 2.0, t + window_s / 2.0)
        after = rms(t, t + window_s)
        out.append({
            "at": float(t),
            "window_s": window_s,
            "rms_before": before, "rms_during": during, "rms_after": after,
            "db_before": db(before), "db_during": db(during), "db_after": db(after),
            "jump_db": (db(after) - db(before)) if before > 0 and after > 0 else None,
            # a seam that runs into silence is a hole; a seam that halves is a dip.
            # Both are audible, and the silence case must not be excused by a
            # missing ratio — that is exactly the seam a listener notices first.
            "silent": min(before, during, after) <= 0.0 < max(before, during, after),
            "dip": (before > 0 and after > 0 and during < 0.5 * min(before, after))
                   or (min(before, during, after) <= 0.0 < max(before, during, after)),
        })
    return out


# ── CLI ───────────────────────────────────────────────────────────────────


def _band(text: str):
    lo, _, hi = text.partition("-")
    if not hi:
        raise argparse.ArgumentTypeError(f"expected LO-HI in Hz, got {text!r}")
    return float(lo), float(hi)


def cmd_stridence(args) -> int:
    for path in args.file:
        s = stridence(path)
        print(f"{path}")
        print(f"  2000-5000 Hz  {100 * s:.2f} %   {stridence_verdict(s)}")
        print(f"  thresholds    reject > {100 * STRIDENCE_REJECT:.2f} % · "
              f"accept ≤ {100 * STRIDENCE_ACCEPT:.2f} % · soft ≤ {100 * STRIDENCE_SOFT:.2f} %")
    return 0


def cmd_voice(args) -> int:
    lo, hi = args.band
    for path in args.file:
        a = load_wav(path)
        v = band_share(a, lo, hi)
        s = stridence(a)
        print(f"{path}  ({len(a.samples) / a.rate:.2f} s, {a.rate} Hz, {a.channels} ch)")
        print(f"  his band {lo:.0f}-{hi:.0f} Hz   {100 * v:.2f} %")
        print(f"  stridence 2-5 kHz          {100 * s:.2f} %   {stridence_verdict(s)}")
        print("  (choose on both numbers: the least strident candidate is often the one "
              "sitting hardest on top of him)")
    return 0


def cmd_f0(args) -> int:
    for path in args.file:
        a = load_wav(path)
        t = f0_track(a)
        oc = octave_error_check(a, t)
        import numpy as np  # available: f0_track already forced the check
        voiced = int((~np.isnan(t.midi)).sum())
        print(f"{path}")
        print(f"  frames {len(t.times)} · voiced {voiced} "
              f"({100 * voiced / max(1, len(t.times)):.1f} %) · "
              f"window {1000 * t.window_s:.0f} ms hop {1000 * t.hop_s:.0f} ms")
        print(f"  octave check: {oc['verdict']}  (n={oc['frames']})")
        m = t.midi
        if args.ceiling is not None:
            m = fold_octaves(m, args.ceiling)
            print(f"  folded to a ceiling of MIDI {args.ceiling:g}")
        ok = m[~np.isnan(m)]
        if len(ok):
            print(f"  MIDI median {float(np.median(ok)):.2f} · "
                  f"range {float(ok.min()):.2f}-{float(ok.max()):.2f}")
        notes = held_notes(t._replace(midi=m))
        print(f"  held notes ≥200 ms within ±1 semitone: {len(notes)}")
        if notes:
            durs = sorted(n.duration for n in notes)
            print(f"  median held duration {durs[len(durs) // 2]:.2f} s")
    return 0


def cmd_motifs(args) -> int:
    for path in args.file:
        a = load_wav(path)
        t = f0_track(a)
        m = fold_octaves(t.midi, args.ceiling) if args.ceiling is not None else t.midi
        notes = held_notes(t._replace(midi=m), min_ms=args.min_ms, tol_semitones=args.tol)
        gest = motifs(notes, gap_s=args.gap)
        cells = interval_cells(gest, lengths=tuple(args.lengths))
        n_motif = sum(1 for g in gest if g["kind"] == "motif")
        print(f"{path}")
        print(f"  held notes {len(notes)} · gestures {len(gest)} "
              f"({n_motif} motif, {len(gest) - n_motif} drone)")
        print(f"  rule: motif = ≥{MOTIF_MIN_NOTES} notes, ≥{MOTIF_MIN_DISTINCT} distinct "
              f"pitches, span ≥{MOTIF_MIN_SPAN:g} semitones")
        for c in cells[: args.top]:
            if c["count"] < args.min_count:
                continue
            times = ", ".join(f"{x:.2f}" for x in c["times"][:8])
            print(f"  cell {c['cell']}  ×{c['count']}  at {times}"
                  + (" …" if len(c["times"]) > 8 else ""))
        if args.json:
            print(json.dumps({"gestures": [
                {k: v for k, v in g.items() if k != "notes"} for g in gest]}, indent=2))
    return 0


def cmd_seams(args) -> int:
    rows = seams(args.file, args.at, window_s=args.window)
    bad = 0
    for r in rows:
        j = "n/a" if r["jump_db"] is None else f"{r['jump_db']:+.1f} dB"
        print(f"  {r['at']:8.3f} s  before {r['db_before']:7.1f}  during {r['db_during']:7.1f}  "
              f"after {r['db_after']:7.1f}  jump {j}" + ("   DIP" if r["dip"] else ""))
        bad += 1 if r["dip"] else 0
    return 1 if bad else 0


def cmd_bands(args) -> int:
    a = load_wav(args.file)
    for lo, hi in args.band:
        print(f"  {lo:8.0f}-{hi:<8.0f} Hz   {100 * band_share(a, lo, hi):6.2f} %")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="atelier_audio.py",
        description="Measure a rendered piece and a recorded voice. numpy + stdlib wave only; "
                    "finds an interpreter with numpy or refuses out loud.",
        epilog=f"stridence thresholds (Jerry's): reject > {100 * STRIDENCE_REJECT:.2f} %, "
               f"accept ≤ {100 * STRIDENCE_ACCEPT:.2f} %, soft ≤ {100 * STRIDENCE_SOFT:.2f} %",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("stridence", help="share of energy in 2-5 kHz over the whole file")
    s.add_argument("file", nargs="+")
    s.set_defaults(func=cmd_stridence)

    v = sub.add_parser("voice", help="energy in his singing band, alongside stridence")
    v.add_argument("file", nargs="+")
    v.add_argument("--band", type=_band, default=(116.0, 156.0), metavar="LO-HI",
                   help="his band in Hz (default 116-156, measured)")
    v.set_defaults(func=cmd_voice)

    f = sub.add_parser("f0", help="autocorrelation f0, octave check, held-note count")
    f.add_argument("file", nargs="+")
    f.add_argument("--ceiling", type=float, default=None,
                   help="fold octaves down to this MIDI ceiling before counting")
    f.set_defaults(func=cmd_f0)

    m = sub.add_parser("motifs", help="held notes -> gestures -> recurring interval cells")
    m.add_argument("file", nargs="+")
    m.add_argument("--ceiling", type=float, default=None, help="MIDI ceiling for octave folding")
    m.add_argument("--min-ms", type=float, default=200.0)
    m.add_argument("--tol", type=float, default=1.0, help="semitones a held note may wander")
    m.add_argument("--gap", type=float, default=0.5, help="silence that ends a gesture, seconds")
    m.add_argument("--lengths", type=int, nargs="+", default=[2, 3, 4])
    m.add_argument("--top", type=int, default=12)
    m.add_argument("--min-count", type=int, default=2)
    m.add_argument("--json", action="store_true")
    m.set_defaults(func=cmd_motifs)

    e = sub.add_parser("seams", help="RMS before/during/after each crossfade point")
    e.add_argument("file")
    e.add_argument("--at", type=float, action="append", required=True, metavar="SECONDS")
    e.add_argument("--window", type=float, default=0.25)
    e.set_defaults(func=cmd_seams)

    b = sub.add_parser("bands", help="share of energy in arbitrary Hz bands")
    b.add_argument("file")
    b.add_argument("--band", type=_band, action="append", required=True, metavar="LO-HI")
    b.set_defaults(func=cmd_bands)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except NumpyMissing as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] not in ("-h", "--help"):
        _reexec_if_needed()
    sys.exit(main())
