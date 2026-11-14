#!/usr/bin/env python3
"""Cut videos into their scenes and lay each video's scenes on a Kdenlive timeline, black between.

    scenes_to_kdenlive.py VIDEO [VIDEO ...] --out DIR [--pause 6] [--threshold 8]

For each VIDEO, one project DIR/<slug>.scenes.kdenlive in the video's own size and frame rate, and
one entry in DIR/scenes.json (written for the whole run). A scene starts where ffmpeg's scdet filter
sees the picture change with a score of at least --threshold. On the timeline:

    V1 "Scenes"         each scene, then a black color clip of --pause seconds, then the next scene
    A1 "Narration"      the scene's own sound under it, grouped with the picture; nothing under black
    A2 "Music (later)"  empty, for the composer
    guides              one at the start of each black, named for silence or music

The cuts are in and out points on the source file: nothing is re-encoded, and the editor can move
every one. The source carries a marker at each scene start, seen in the clip monitor.

The title of a Deep Diver video comes from the manifest.json of its notebook folder, when the video
sits in its keep/ folder; otherwise from the file name. A video under $MIADI_CHRONICLE_ROOT gets the
address miadi-chronicle://<n>/<path in the episode>.

Kdenlive document format 1.04 (Kdenlive 21.12 and 22.04). Proven on 2026-11-13: Kdenlive 22.04.3
opened and saved the projects of Episode 575 with every clip, group and guide, and melt rendered them
to the planned length with the blacks where scenes.json puts them (verify_timeline.py).
"""
import argparse, json, math, os, re, subprocess, sys, unicodedata, uuid
from xml.sax.saxutils import escape

ROOT = os.environ.get("MIADI_CHRONICLE_ROOT", "/srv/miadi/episodes/miadi-chronicle")


def probe(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
                                   "-show_entries", "stream=width,height,r_frame_rate,nb_read_packets",
                                   "-of", "json", path], text=True)
    s = json.loads(out)["streams"][0]
    num, den = (int(x) for x in s["r_frame_rate"].split("/"))
    return s["width"], s["height"], num, den, int(s["nb_read_packets"])


def scene_starts(path, fps, threshold):
    """(frame, score) where a new scene starts; the first frame is not listed."""
    log = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-an",
                          "-vf", f"scdet=threshold={threshold}:sc_pass=0", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    hits = re.findall(r"lavfi\.scd\.score: ([0-9.]+), lavfi\.scd\.time: ([0-9.]+)", log)
    if not hits and "scdet" in log and "No such filter" in log:
        sys.exit("ffmpeg has no scdet filter (it arrived in ffmpeg 4.4)")
    return [(int(round(float(t) * fps)), float(sc)) for sc, t in hits]


def address_of(path):
    rel = os.path.relpath(os.path.realpath(path), os.path.realpath(ROOT))
    m = re.match(r"\d{4}-\d\d-\d\d-episode-0*(\d+)-[^/]*/(.*)", rel)
    return f"miadi-chronicle://{m.group(1)}/{m.group(2)}" if m and not rel.startswith("..") else os.path.realpath(path)


def title_of(path):
    keep = os.path.dirname(os.path.realpath(path))
    manifest = os.path.join(os.path.dirname(keep), "manifest.json")
    if os.path.basename(keep) == "keep" and os.path.exists(manifest):
        for d in json.load(open(manifest, encoding="utf-8")).get("downloads", []):
            if os.path.basename((d.get("kept") or {}).get("path", "")) == os.path.basename(path):
                return d["title"]
    return re.sub(r"[-_]+", " ", os.path.splitext(os.path.basename(path))[0]).strip()


def slug_of(title):
    s = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", title.lower()).encode("ascii", "ignore").decode()).strip("-")
    return s[:60].rstrip("-") or "video"


def prop(name, value, pad="  "):
    return f'{pad}<property name="{escape(name)}">{escape(str(value))}</property>\n'


def project(src, out_dir, pause_s, threshold, note):
    src = os.path.realpath(src)
    width, height, num, den, frames = probe(src)
    fps = num / den
    pause = int(round(pause_s * fps))
    cuts = scene_starts(src, fps, threshold)
    title, address = title_of(src), address_of(src)
    starts = [0] + [f for f, _ in cuts]
    scores = [None] + [sc for _, sc in cuts]
    ends = [f - 1 for f, _ in cuts] + [frames - 1]

    scenes, v1, a1, guides, groups, pos = [], "", "", [], [], 0
    for n, (a, b, sc) in enumerate(zip(starts, ends, scores), 1):
        entry = f'  <entry producer="source" in="{a}" out="{b}">\n' + prop("kdenlive:id", 2, "   ") + "  </entry>\n"
        v1 += entry
        a1 += entry
        # A group's leaf is "<track position>:<frame>", positions counted from the bottom track:
        # A2 is 0, A1 is 1, V1 is 2.
        groups.append({"type": "AVSplit", "children": [
            {"type": "Leaf", "leaf": "clip", "data": f"1:{pos}"},
            {"type": "Leaf", "leaf": "clip", "data": f"2:{pos}"}]})
        scenes.append({"scene": n, "source_in": a, "source_out": b, "source_in_s": round(a / fps, 3),
                       "seconds": round((b - a + 1) / fps, 3), "timeline_at": pos,
                       "timeline_at_s": round(pos / fps, 3), "scdet_score": sc})
        pos += b - a + 1
        if n < len(starts):
            v1 += f'  <entry producer="black" in="0" out="{pause - 1}">\n' + prop("kdenlive:id", 3, "   ") + "  </entry>\n"
            a1 += f'  <blank length="{pause}"/>\n'
            guides.append({"comment": f"Black {pause_s:g} s, after scene {n}: silence or music", "pos": pos, "type": 0})
            pos += pause
    last = pos - 1

    marks = json.dumps([{"pos": s["source_in"], "comment": f"Scene {s['scene']}", "type": 0} for s in scenes], ensure_ascii=False)
    notes = (f"<p><b>{escape(title)}</b>, {escape(address)}.</p>"
             f"<p>{len(scenes)} scenes, cut where the picture changes (ffmpeg scdet, score at least {threshold:g}), each followed by "
             f"{pause_s:g} s of black for silence or music. {escape(note)} Every cut is an in and out point on the source and can be moved.</p>"
             "<p>V1 scenes and black. A1 the sound of each scene. A2 empty, for the music.</p>")
    g = math.gcd(width, height)
    bin_props = (prop("kdenlive:folder.-1.1", "Sources")
                 + prop("kdenlive:docproperties.version", "1.04")
                 + prop("kdenlive:docproperties.uuid", "{%s}" % uuid.uuid5(uuid.NAMESPACE_URL, address))
                 + prop("kdenlive:docproperties.audioChannels", 2)
                 + prop("kdenlive:docproperties.guides", json.dumps(guides, ensure_ascii=False))
                 + prop("kdenlive:docproperties.groups", json.dumps(groups))
                 + prop("kdenlive:docproperties.miadi.source", address)
                 + prop("kdenlive:documentnotes", notes) + prop("xml_retain", 1))
    track = lambda name, audio: (prop("kdenlive:track_name", name) + (prop("kdenlive:audio_track", 1) if audio else "")
                                 + prop("kdenlive:trackheight", 67))
    mix = lambda b: (f'  <transition id="mix{b}">\n' + prop("a_track", 0, "   ") + prop("b_track", b, "   ")
                     + prop("mlt_service", "mix", "   ") + prop("kdenlive_id", "mix", "   ") + prop("internal_added", 237, "   ")
                     + prop("always_active", 1, "   ") + prop("accepts_blanks", 1, "   ") + prop("sum", 1, "   ") + "  </transition>\n")
    xml = (f'<?xml version="1.0" encoding="utf-8"?>\n<mlt LC_NUMERIC="C" producer="main_bin" version="7.4.0" root="{escape(os.path.realpath(out_dir))}">\n'
           f' <profile frame_rate_num="{num}" frame_rate_den="{den}" width="{width}" height="{height}" progressive="1" sample_aspect_num="1"'
           f' sample_aspect_den="1" display_aspect_num="{width // g}" display_aspect_den="{height // g}" colorspace="709" description="{width}x{height} {fps:g}fps"/>\n'
           f' <producer id="source" in="0" out="{frames - 1}">\n' + prop("length", frames) + prop("eof", "pause")
           + prop("resource", src) + prop("mlt_service", "avformat-novalidate") + prop("kdenlive:id", 2)
           + prop("kdenlive:clipname", title) + prop("kdenlive:folderid", 1) + prop("kdenlive:markers", marks)
           + prop("kdenlive:miadi.take", address) + " </producer>\n"
           f' <producer id="black" in="0" out="{pause - 1}">\n' + prop("length", pause) + prop("eof", "pause")
           + prop("resource", "0x000000ff") + prop("mlt_service", "color") + prop("mlt_image_format", "rgb")
           + prop("kdenlive:id", 3) + prop("kdenlive:clip_type", 2)
           + prop("kdenlive:clipname", f"Black {pause_s:g} s, for silence or music") + " </producer>\n"
           f' <playlist id="main_bin">\n{bin_props}'
           f'  <entry producer="source" in="0" out="{frames - 1}"/>\n  <entry producer="black" in="0" out="{pause - 1}"/>\n </playlist>\n'
           f' <producer id="black_track" in="0" out="{last}">\n' + prop("length", 2147483647) + prop("eof", "continue")
           + prop("resource", "black") + prop("aspect_ratio", 1) + prop("mlt_service", "color")
           + prop("mlt_image_format", "rgba") + prop("set.test_audio", 0) + " </producer>\n"
           ' <playlist id="p_a2">\n' + prop("kdenlive:audio_track", 1) + ' </playlist>\n <playlist id="p_a2b"/>\n'
           ' <tractor id="t_a2" in="0">\n' + track("Music (later)", True) + '  <track hide="video" producer="p_a2"/>\n  <track hide="video" producer="p_a2b"/>\n </tractor>\n'
           ' <playlist id="p_a1">\n' + prop("kdenlive:audio_track", 1) + a1 + ' </playlist>\n <playlist id="p_a1b"/>\n'
           ' <tractor id="t_a1" in="0">\n' + track("Narration", True) + '  <track hide="video" producer="p_a1"/>\n  <track hide="video" producer="p_a1b"/>\n </tractor>\n'
           ' <playlist id="p_v1">\n' + v1 + ' </playlist>\n <playlist id="p_v1b"/>\n'
           ' <tractor id="t_v1" in="0">\n' + track("Scenes", False) + '  <track hide="audio" producer="p_v1"/>\n  <track hide="audio" producer="p_v1b"/>\n </tractor>\n'
           # out= is the last frame: melt renders a project without it far past its end.
           f' <tractor id="maintractor" in="0" out="{last}">\n'
           '  <track producer="black_track"/>\n  <track producer="t_a2"/>\n  <track producer="t_a1"/>\n  <track producer="t_v1"/>\n'
           + mix(1) + mix(2)
           + '  <transition id="composite3">\n' + prop("a_track", 0, "   ") + prop("b_track", 3, "   ") + prop("version", "0.9", "   ")
           + prop("mlt_service", "frei0r.cairoblend", "   ") + prop("kdenlive_id", "frei0r.cairoblend", "   ")
           + prop("internal_added", 237, "   ") + prop("always_active", 1, "   ") + "  </transition>\n"
           " </tractor>\n</mlt>\n")
    name = f"{slug_of(title)}.scenes.kdenlive"
    with open(os.path.join(out_dir, name), "w", encoding="utf-8") as fh:
        fh.write(xml)
    print(f"{name}: {len(scenes)} scenes, {len(scenes) - 1} blacks, {pos / fps:.1f} s on the timeline")
    return {"project": name, "title": title, "source": address, "file": src, "width": width, "height": height,
            "fps": fps, "source_frames": frames, "pause_seconds": pause_s, "pause_frames": pause,
            "timeline_frames": pos, "timeline_seconds": round(pos / fps, 3), "scdet_threshold": threshold,
            "scenes": scenes}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("videos", nargs="+")
    ap.add_argument("--out", required=True, help="folder for the projects and scenes.json")
    ap.add_argument("--pause", type=float, default=6, help="seconds of black between scenes (6)")
    ap.add_argument("--threshold", type=float, default=8, help="scdet score that starts a scene (8)")
    ap.add_argument("--note", default="Prepared by an agent: a proposal until a person keeps it.",
                    help="one sentence for the project notes: who prepared it and why")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    run = [project(v, a.out, a.pause, a.threshold, a.note) for v in a.videos]
    with open(os.path.join(a.out, "scenes.json"), "w", encoding="utf-8") as fh:
        json.dump(run, fh, indent=1, ensure_ascii=False)
        fh.write("\n")


if __name__ == "__main__":
    main()
