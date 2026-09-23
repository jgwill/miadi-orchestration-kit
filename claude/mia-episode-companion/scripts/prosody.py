#!/usr/bin/env python3
"""Read the tone of a take: what the voice did, beside the words it said.

William, Episode 339, 2026-09-23: the transcript keeps the words and loses the
laugh, the slowing down, the rise in pitch. This measures those from the audio
that is already kept, and writes them next to the transcript, never inside it.

    prosody.py <audio> [--transcript <file>] [--json <out>] [--quiet]

What it measures, per take and per third of it:

  pitch   the voice's fundamental, by autocorrelation on voiced frames.
          Median and the 5th-95th range, in hertz. The closest thing to the
          "musical notes" of a sentence.
  pace    words per minute, when a transcript is given; otherwise the share of
          the take that carries voice.
  volume  RMS loudness in dBFS, its median and its spread, and the frames that
          stand well above the median, which is where emphasis falls.
  pauses  silences of at least 0.35 s: how many, and the longest.

It reads the audio through ffmpeg, so any format the recorder writes works.
numpy is the only library. It never edits the transcript.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

RATE = 16000
FRAME = int(0.040 * RATE)   # 40 ms
HOP = int(0.020 * RATE)     # 20 ms
PITCH_MIN, PITCH_MAX = 70, 350
SILENCE_MIN = 0.35          # seconds


def decode(path: Path) -> np.ndarray:
    """The take as mono 16 kHz float samples, through ffmpeg."""
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(RATE), "-f", "s16le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(out, dtype="<i2").astype(np.float32) / 32768.0


def frames(x: np.ndarray) -> np.ndarray:
    if len(x) < FRAME:
        return np.empty((0, FRAME), dtype=np.float32)
    count = 1 + (len(x) - FRAME) // HOP
    idx = np.arange(FRAME)[None, :] + HOP * np.arange(count)[:, None]
    return x[idx]


def pitch_of(frame: np.ndarray) -> float:
    """The frame's fundamental in hertz, or 0 when it carries no clear one."""
    f = frame - frame.mean()
    n = len(f)
    spectrum = np.fft.rfft(f, 2 * n)
    corr = np.fft.irfft(spectrum * np.conj(spectrum))[:n]
    if corr[0] <= 0:
        return 0.0
    corr = corr / corr[0]
    lo, hi = RATE // PITCH_MAX, min(RATE // PITCH_MIN, n - 1)
    if hi <= lo:
        return 0.0
    window = corr[lo:hi]
    lag = int(np.argmax(window)) + lo
    # A weak peak is noise, not a voice.
    return RATE / lag if window.max() >= 0.3 else 0.0


def read(audio: Path, transcript: str | None) -> dict:
    x = decode(audio)
    duration = len(x) / RATE
    fr = frames(x)
    if len(fr) == 0:
        return {"audio": audio.name, "duration_s": round(duration, 2), "error": "too short to read"}

    rms = np.sqrt((fr ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms)
    floor = np.percentile(db, 20) + 6          # voice sits above the room
    voiced = db > floor
    pitches = np.array([pitch_of(f) if v else 0.0 for f, v in zip(fr, voiced)])
    heard = pitches[pitches > 0]

    # Pauses: runs of unvoiced frames at least SILENCE_MIN long.
    pauses, run = [], 0
    for v in voiced:
        if v:
            if run * HOP / RATE >= SILENCE_MIN:
                pauses.append(run * HOP / RATE)
            run = 0
        else:
            run += 1
    if run * HOP / RATE >= SILENCE_MIN:
        pauses.append(run * HOP / RATE)

    words = len(transcript.split()) if transcript else 0

    def part(lo: int, hi: int) -> dict:
        p = pitches[lo:hi]
        p = p[p > 0]
        d = db[lo:hi]
        share = float(voiced[lo:hi].mean()) if hi > lo else 0.0
        return {
            "pitch_hz": round(float(np.median(p)), 1) if len(p) else None,
            "loud_db": round(float(np.median(d)), 1) if hi > lo else None,
            "voiced_share": round(share, 2),
        }

    n = len(fr)
    thirds = [part(0, n // 3), part(n // 3, 2 * n // 3), part(2 * n // 3, n)]

    return {
        "audio": audio.name,
        "duration_s": round(duration, 2),
        "pitch_hz": {
            "median": round(float(np.median(heard)), 1) if len(heard) else None,
            "low": round(float(np.percentile(heard, 5)), 1) if len(heard) else None,
            "high": round(float(np.percentile(heard, 95)), 1) if len(heard) else None,
        },
        "loudness_dbfs": {
            "median": round(float(np.median(db)), 1),
            "spread": round(float(np.percentile(db, 95) - np.percentile(db, 5)), 1),
            "emphasis_frames": int(((db - np.median(db)) > 6).sum()),
        },
        "pace": {
            "words": words,
            "words_per_minute": round(words / (duration / 60), 1) if words and duration else None,
            "voiced_share": round(float(voiced.mean()), 2),
        },
        "pauses": {
            "count": len(pauses),
            "longest_s": round(max(pauses), 2) if pauses else 0.0,
            "total_s": round(sum(pauses), 2),
        },
        "thirds": thirds,
    }


def say(r: dict) -> str:
    """One plain sentence about how the take sounded."""
    if "error" in r:
        return f"{r['audio']}: {r['error']}"
    parts = []
    wpm = r["pace"]["words_per_minute"]
    if wpm:
        pace = "fast" if wpm > 170 else "unhurried" if wpm < 120 else "steady"
        parts.append(f"{pace}, {wpm:.0f} words a minute")
    p = r["pitch_hz"]
    if p["median"]:
        parts.append(f"pitch around {p['median']:.0f} hertz, reaching {p['high']:.0f}")
    thirds = [t["pitch_hz"] for t in r["thirds"]]
    if all(thirds):
        if thirds[2] > thirds[0] * 1.08:
            parts.append("rising towards the end")
        elif thirds[2] < thirds[0] * 0.92:
            parts.append("settling towards the end")
    if r["pauses"]["count"]:
        parts.append(f"{r['pauses']['count']} pauses, the longest {r['pauses']['longest_s']:.1f} s")
    if r["loudness_dbfs"]["emphasis_frames"] > 0.1 * (r["duration_s"] * 50):
        parts.append("often emphatic")
    return f"{r['audio']}: " + "; ".join(parts) + "."


def main() -> int:
    ap = argparse.ArgumentParser(description="Read a take's tone beside its words.")
    ap.add_argument("audio", type=Path)
    ap.add_argument("--transcript", type=Path, help="the validated transcript, for words per minute")
    ap.add_argument("--json", type=Path, help="write the measurements here (default: beside the audio, prosody.json)")
    ap.add_argument("--quiet", action="store_true", help="write the file, say nothing")
    args = ap.parse_args()

    if not args.audio.exists():
        print(f"prosody: no such audio: {args.audio}", file=sys.stderr)
        return 2
    text = args.transcript.read_text(encoding="utf8") if args.transcript and args.transcript.exists() else None
    reading = read(args.audio, text)
    reading["reading"] = say(reading)

    out = args.json or args.audio.with_name("prosody.json")
    out.write_text(json.dumps(reading, indent=2) + "\n", encoding="utf8")
    if not args.quiet:
        print(reading["reading"])
        print(f"written: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
