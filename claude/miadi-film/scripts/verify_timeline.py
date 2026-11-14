#!/usr/bin/env python3
"""Render each project of a scenes.json through melt and check the blacks are where the plan puts them.

    verify_timeline.py DIR [--keep]

DIR holds scenes.json and the projects scenes_to_kdenlive.py wrote. For each project: melt (Kdenlive's
engine) renders it small and fast; ffprobe gives its length; ffmpeg's blackdetect finds each black
and silencedetect each silence of at least 5 s. One line per project, and the exit is 1 when a
length, a black's start or a black's length is off by more than one frame, or a black has sound.
The renders go to a temporary folder and are removed, unless --keep.
"""
import argparse, json, os, re, subprocess, sys, tempfile


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def check(d, m, tmp):
    proj = os.path.join(d, m["project"])
    out = os.path.join(tmp, m["project"].replace(".kdenlive", ".mp4"))
    r = run(["melt", "-quiet", proj, "-consumer", f"avformat:{out}", "vcodec=libx264", "preset=ultrafast",
             "crf=35", "acodec=aac", "ab=64k"])
    if r.returncode != 0 or not os.path.exists(out):
        return [f"melt failed ({r.returncode}): {r.stderr.strip()[-300:]}"], out
    fps, frame = m["fps"], 1 / m["fps"]
    dur = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).stdout)
    black = re.findall(r"black_start:([0-9.]+) black_end:[0-9.]+ black_duration:([0-9.]+)",
                       run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-vf", "blackdetect=d=1:pix_th=0.05",
                            "-an", "-f", "null", "-"]).stderr)
    quiet = re.findall(r"silence_end: ([0-9.]+) \| silence_duration: ([0-9.]+)",
                       run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-af", "silencedetect=noise=-50dB:d=5",
                            "-vn", "-f", "null", "-"]).stderr)
    want = [(s["timeline_at"] + round(s["seconds"] * fps)) / fps for s in m["scenes"][:-1]]
    bad = []
    if abs(dur - m["timeline_seconds"]) > 2 * frame + 0.1:   # the audio stream may end a little after the picture
        bad.append(f"length {dur:.3f} s, planned {m['timeline_seconds']:.3f} s")
    if len(black) != len(want):
        bad.append(f"{len(black)} blacks found, {len(want)} planned")
    for w, (st, du) in zip(want, black):
        if abs(float(st) - w) > frame + 0.01 or abs(float(du) - m["pause_seconds"]) > frame + 0.01:
            bad.append(f"black at {float(st):.3f} s for {float(du):.3f} s, planned {w:.3f} s for {m['pause_seconds']:g} s")
    for w in want:
        if not any(float(e) - float(du) <= w + 0.1 and float(e) >= w + m["pause_seconds"] - 0.1 for e, du in quiet):
            bad.append(f"sound under the black at {w:.3f} s")
    print(f"{m['project']}: {dur:.3f} s, {len(black)} blacks of {sorted({round(float(x), 2) for _, x in black})} s, "
          f"{len(quiet)} silences of 5 s or more, {'ok' if not bad else 'FAILED'}")
    return bad, out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("dir")
    ap.add_argument("--keep", action="store_true", help="keep the renders and print their folder")
    a = ap.parse_args()
    plan = json.load(open(os.path.join(a.dir, "scenes.json"), encoding="utf-8"))
    tmp = tempfile.mkdtemp(prefix="verify-timeline-")
    failed = 0
    for m in plan:
        bad, out = check(a.dir, m, tmp)
        for b in bad:
            print("  " + b)
        failed += bool(bad)
        if not a.keep and os.path.exists(out):
            os.remove(out)
    if a.keep:
        print("renders kept in", tmp)
    else:
        os.rmdir(tmp)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
