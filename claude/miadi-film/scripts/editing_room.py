#!/usr/bin/env python3
"""Prepare an episode's editing room: every medium of the episode in one Kdenlive project's bins, and a room sheet.

    editing_room.py EPISODE_DIR --out DIR [--fetch-from HOST] [--note "..."]

What goes in the room, found from the episode's own records:

    Deep Diver          captures/notebook-*/manifest.json, each kept video or audio, its title and transcript
    Voice takes         captures/*/capture.json, each take's audio and the first words of its transcript
    Episode voice       episode.mp3 and chapter-*.mp3 at the episode's root
    Other media         any other video or audio file in the episode
    Screenwalks         captures/*/screenwalk.json: online only, listed on the sheet with their link
    Stringouts          film/*/*.scenes.kdenlive: listed on the sheet with the command that opens them

A take recorded on another host is not in this checkout (raw captures stay out of git). With
--fetch-from HOST the room copies it from the same path on HOST and keeps it only when its sha256
matches capture.json. Nothing is fetched without the flag.

DIR/room.kdenlive holds the bins and an empty timeline: the editor makes the cuts. Each clip carries
its address and what is said in it as its description, and a Deep Diver video that has a stringout
carries a marker at each scene start. DIR/room.json lists every medium with its state (here, fetched,
missing, online) and DIR/README.md is the room sheet for the director.
"""
import argparse, glob, hashlib, json, math, os, re, subprocess, sys, uuid
from xml.sax.saxutils import escape

ROOT = os.environ.get("MIADI_CHRONICLE_ROOT", "/srv/miadi/episodes/miadi-chronicle")
MEDIA = (".mp4", ".mov", ".mkv", ".webm", ".m4a", ".mp3", ".wav", ".flac", ".aac", ".ogg")
BINS = ["Deep Diver", "Voice takes", "Episode voice", "Other media"]


def ffprobe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,r_frame_rate",
                          "-of", "json", path], capture_output=True, text=True)
    if out.returncode:
        return None
    d = json.loads(out.stdout)
    v = next((s for s in d.get("streams", []) if s.get("codec_type") == "video" and s.get("width")), None)
    has_audio = any(s.get("codec_type") == "audio" for s in d.get("streams", []))
    fps = None
    if v:
        n, m = (int(x) for x in v["r_frame_rate"].split("/"))
        fps = n / m if m else None
    return {"seconds": float(d["format"].get("duration", 0)), "width": v and v["width"], "height": v and v["height"],
            "fps": fps, "audio": has_audio}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for b in iter(lambda: fh.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def first_words(path, n=160):
    if not path or not os.path.exists(path):
        return ""
    lines = [l.strip() for l in open(path, encoding="utf-8", errors="replace")]
    text = " ".join(re.sub(r"^\[\d+:\d+\]\s*", "", l) for l in lines if l and not l.startswith(("#", "Video Overview", "Audio Overview")))
    return text[:n].rsplit(" ", 1)[0] + "…" if len(text) > n else text


def episode_address(ep):
    m = re.match(r"\d{4}-\d\d-\d\d-episode-0*(\d+)-", os.path.basename(ep))
    return f"miadi-chronicle://{m.group(1)}" if m else ep


def inventory(ep):
    addr, items, seen = episode_address(ep), [], set()
    def add(bin_, title, rel, said="", made="", expect=None):
        seen.add(os.path.normpath(rel))
        items.append({"bin": bin_, "title": title, "path": rel, "address": f"{addr}/{rel}", "said": said,
                      "made_by": made, "sha256": expect})
    for man in sorted(glob.glob(os.path.join(ep, "captures/notebook-*/manifest.json"))):
        nb = os.path.relpath(os.path.dirname(man), ep)
        for d in json.load(open(man, encoding="utf-8")).get("downloads", []):
            kept = d.get("kept") or {}
            if kept.get("path", "").lower().endswith(MEDIA):
                tr = (kept.get("transcript") or {}).get("path")
                add("Deep Diver", d["title"], f"{nb}/{kept['path']}", first_words(tr and os.path.join(ep, nb, tr)),
                    f"Deep Diver {d.get('family_label', '')}, notebook {nb.split('notebook-')[-1][:8]}", kept.get("sha256"))
    for cap in sorted(glob.glob(os.path.join(ep, "captures/*/capture.json"))):
        c = json.load(open(cap, encoding="utf-8"))
        a = c.get("audio") or {}
        if a.get("relativePath"):
            outs = (c.get("transcription") or {}).get("outputs") or []
            tr = outs[0]["relativePath"] if outs else None
            add("Voice takes", f"Take {os.path.basename(os.path.dirname(cap))}", a["relativePath"],
                first_words(tr and os.path.join(ep, tr)), "phone recording", a.get("sha256"))
    for f in sorted(glob.glob(os.path.join(ep, "episode.mp3")) + glob.glob(os.path.join(ep, "chapter-*.mp3"))):
        add("Episode voice", os.path.splitext(os.path.basename(f))[0], os.path.relpath(f, ep), "", "rendered chronicle voice")
    for dirpath, dirs, files in os.walk(ep):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for f in sorted(files):
            rel = os.path.normpath(os.path.relpath(os.path.join(dirpath, f), ep))
            if f.lower().endswith(MEDIA) and rel not in seen:
                add("Other media", os.path.splitext(f)[0], rel)
    online = []
    for sw in sorted(glob.glob(os.path.join(ep, "captures/*/screenwalk.json"))):
        v = json.load(open(sw, encoding="utf-8")).get("video") or {}
        if v.get("url"):
            online.append({"title": v.get("title", os.path.basename(os.path.dirname(sw))), "url": v["url"],
                           "record": os.path.relpath(sw, ep)})
    strings = []
    for sj in sorted(glob.glob(os.path.join(ep, "film/*/scenes.json"))):
        for m in json.load(open(sj, encoding="utf-8")):
            strings.append({"project": os.path.relpath(os.path.join(os.path.dirname(sj), m["project"]), ep),
                            "title": m["title"], "scenes": len(m["scenes"]), "seconds": m["timeline_seconds"],
                            "source": m["source"], "fps": m["fps"],
                            "marks": [{"pos": s["source_in"], "comment": f"Scene {s['scene']}"} for s in m["scenes"]]})
    return items, online, strings


def fetch(ep, it, host):
    dst = os.path.join(ep, it["path"])
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    part = dst + ".part"
    r = subprocess.run(["scp", "-q", "-o", "BatchMode=yes", f"{host}:{os.path.realpath(dst)}", part], capture_output=True, text=True)
    if r.returncode or not os.path.exists(part):
        return f"not on {host}"
    if it["sha256"] and sha256(part) != it["sha256"]:
        os.remove(part)
        return f"sha256 differs on {host}, not kept"
    os.replace(part, dst)
    return f"fetched from {host}, sha256 matches" if it["sha256"] else f"fetched from {host}, no sha256 to check"


def prop(name, value, pad="  "):
    return f'{pad}<property name="{escape(name)}">{escape(str(value))}</property>\n'


def write_room(ep, out, items, strings, note):
    here = [it for it in items if it["probe"]]
    lead = next((it for it in here if it["probe"]["width"] and it["probe"]["width"] >= it["probe"]["height"]),
                next((it for it in here if it["probe"]["width"]), None))
    w, h, fps = (lead["probe"]["width"], lead["probe"]["height"], lead["probe"]["fps"]) if lead else (1280, 720, 24.0)
    num, den = (int(round(fps * 1000)), 1000) if abs(fps - round(fps)) > 1e-6 else (int(round(fps)), 1)
    folders = {b: i + 1 for i, b in enumerate(b for b in BINS if any(it["bin"] == b for it in here))}
    producers, entries = "", ""
    for k, it in enumerate(here, 2):
        p = it["probe"]
        length = max(int(round(p["seconds"] * fps)), 1)
        src = os.path.realpath(os.path.join(ep, it["path"]))
        marks = next((s["marks"] for s in strings if s["source"] == it["address"]), [])
        if marks:   # scene starts are frames of the source; the room counts its own frames
            sfps = next(s["fps"] for s in strings if s["source"] == it["address"])
            marks = [{"pos": int(round(m["pos"] / sfps * fps)), "comment": m["comment"], "type": 0} for m in marks]
        desc = " ".join(x for x in (it["made_by"] + ".", it["said"] and f"«{it['said']}»", it["address"]) if x.strip(". "))
        producers += (f' <producer id="m{k}" in="0" out="{length - 1}">\n' + prop("length", length) + prop("eof", "pause")
                      + prop("resource", src) + prop("mlt_service", "avformat-novalidate") + prop("kdenlive:id", k)
                      + prop("kdenlive:clipname", it["title"]) + prop("kdenlive:folderid", folders[it["bin"]])
                      + prop("kdenlive:description", desc) + prop("kdenlive:markers", json.dumps(marks, ensure_ascii=False))
                      + prop("kdenlive:miadi.take", it["address"]) + " </producer>\n")
        entries += f'  <entry producer="m{k}" in="0" out="{length - 1}"/>\n'
    addr = episode_address(ep)
    notes = (f"<p><b>Editing room</b> of {escape(addr)}. {escape(note)}</p>"
             f"<p>{len(here)} media in the bins, by kind. The timeline is empty: the editor makes the cuts. "
             "The room sheet (README.md beside this project) lists every medium, what is said in it, where it is, "
             "and the stringouts that are already cut.</p>")
    g = math.gcd(w, h)
    bin_props = ("".join(prop(f"kdenlive:folder.-1.{i}", b) for b, i in folders.items())
                 + prop("kdenlive:docproperties.version", "1.04")
                 + prop("kdenlive:docproperties.uuid", "{%s}" % uuid.uuid5(uuid.NAMESPACE_URL, addr + "/editing-room"))
                 + prop("kdenlive:docproperties.audioChannels", 2)
                 + prop("kdenlive:docproperties.miadi.episode", addr)
                 + prop("kdenlive:documentnotes", notes) + prop("xml_retain", 1))
    track = lambda name, audio: (prop("kdenlive:track_name", name) + (prop("kdenlive:audio_track", 1) if audio else "")
                                 + prop("kdenlive:trackheight", 67))
    mix = lambda b: (f'  <transition id="mix{b}">\n' + prop("a_track", 0, "   ") + prop("b_track", b, "   ")
                     + prop("mlt_service", "mix", "   ") + prop("kdenlive_id", "mix", "   ") + prop("internal_added", 237, "   ")
                     + prop("always_active", 1, "   ") + prop("accepts_blanks", 1, "   ") + prop("sum", 1, "   ") + "  </transition>\n")
    xml = (f'<?xml version="1.0" encoding="utf-8"?>\n<mlt LC_NUMERIC="C" producer="main_bin" version="7.4.0" root="{escape(os.path.realpath(out))}">\n'
           f' <profile frame_rate_num="{num}" frame_rate_den="{den}" width="{w}" height="{h}" progressive="1" sample_aspect_num="1"'
           f' sample_aspect_den="1" display_aspect_num="{w // g}" display_aspect_den="{h // g}" colorspace="709" description="{w}x{h} {fps:g}fps"/>\n'
           + producers + f' <playlist id="main_bin">\n{bin_props}{entries} </playlist>\n'
           ' <producer id="black_track" in="0" out="0">\n' + prop("length", 2147483647) + prop("eof", "continue")
           + prop("resource", "black") + prop("aspect_ratio", 1) + prop("mlt_service", "color")
           + prop("mlt_image_format", "rgba") + prop("set.test_audio", 0) + " </producer>\n"
           + "".join(f' <playlist id="p_{t}">\n' + (prop("kdenlive:audio_track", 1) if t.startswith("a") else "") + f' </playlist>\n <playlist id="p_{t}b"/>\n'
                     f' <tractor id="t_{t}" in="0">\n' + track(n, t.startswith("a"))
                     + f'  <track hide="{"video" if t.startswith("a") else "audio"}" producer="p_{t}"/>\n'
                     f'  <track hide="{"video" if t.startswith("a") else "audio"}" producer="p_{t}b"/>\n </tractor>\n'
                     for t, n in (("a2", "A2"), ("a1", "A1"), ("v1", "V1"), ("v2", "V2")))
           + ' <tractor id="maintractor" in="0" out="0">\n  <track producer="black_track"/>\n'
           '  <track producer="t_a2"/>\n  <track producer="t_a1"/>\n  <track producer="t_v1"/>\n  <track producer="t_v2"/>\n'
           + mix(1) + mix(2)
           + "".join(f'  <transition id="composite{b}">\n' + prop("a_track", 0, "   ") + prop("b_track", b, "   ") + prop("version", "0.9", "   ")
                     + prop("mlt_service", "frei0r.cairoblend", "   ") + prop("kdenlive_id", "frei0r.cairoblend", "   ")
                     + prop("internal_added", 237, "   ") + prop("always_active", 1, "   ") + "  </transition>\n" for b in (3, 4))
           + " </tractor>\n</mlt>\n")
    with open(os.path.join(out, "room.kdenlive"), "w", encoding="utf-8") as fh:
        fh.write(xml)
    return len(here)


def clock(s):
    m, s = divmod(s, 60)
    return f"{int(m)}:{s:05.2f}" if m < 60 else f"{int(m // 60)}:{int(m % 60):02d}:{s:05.2f}"


def sheet(ep, out, items, online, strings, note):
    addr = episode_address(ep)
    rel = lambda p: os.path.relpath(os.path.join(ep, p), out)
    L = [f"# Editing room of Episode {addr.split('//')[-1]} ({addr})", "",
         note, "", "    kdenlive room.kdenlive", "",
         "The bins hold every medium found on this host, by kind. The timeline is empty: the editor makes the cuts.",
         "Each clip's description holds its address and the first words said in it. Those words come from the",
         "transcript kept beside each medium: machine-made and not checked (a Deep Diver transcript is an English",
         "rendering of the narration, which can be in French).", ""]
    for b in BINS:
        rows = [it for it in items if it["bin"] == b]
        if not rows:
            continue
        L += [f"## {b}", "", "| medium | length | what is said | state |", "|---|---|---|---|"]
        for it in rows:
            p = it["probe"]
            size = f", {p['width']}x{p['height']}" if p and p["width"] else ""
            L.append(f"| [{it['title']}]({rel(it['path'])}) | {clock(p['seconds']) + size if p else '–'} | {it['said'] or '–'} | {it['state']} |")
        L.append("")
    if strings:
        L += ["## Stringouts already cut", "", "| project | scenes | length |", "|---|---|---|"]
        L += [f"| [{s['title']}]({rel(s['project'])}) | {s['scenes']} | {clock(s['seconds'])} |" for s in strings]
        L.append("")
    if online:
        L += ["## Screenwalks, online only", "", "| screenwalk | link |", "|---|---|"]
        L += [f"| {o['title']} | {o['url']} |" for o in online]
        L.append("")
    missing = [it for it in items if not it["probe"]]
    if missing:
        L += ["## Not in the room", "", "Recorded, but the file is not on this host. `--fetch-from <host>` brings a take when its sha256 matches.", ""]
        L += [f"- {it['title']}: `{it['path']}` ({it['state']})" for it in missing]
        L.append("")
    with open(os.path.join(out, "README.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(L))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("episode")
    ap.add_argument("--out", required=True, help="folder for room.kdenlive, room.json and the room sheet")
    ap.add_argument("--fetch-from", metavar="HOST", help="copy a missing take from the same path on HOST, kept when its sha256 matches")
    ap.add_argument("--note", default="Prepared by an agent, as the assistant editor: a proposal until a person keeps it.")
    a = ap.parse_args()
    ep = os.path.realpath(a.episode.rstrip("/"))
    if not os.path.exists(os.path.join(ep, "episode.yaml")):
        sys.exit(f"not an episode (no episode.yaml): {ep}")
    os.makedirs(a.out, exist_ok=True)
    items, online, strings = inventory(ep)
    for it in items:
        f = os.path.join(ep, it["path"])
        it["state"] = "here"
        if not os.path.exists(f):
            it["state"] = fetch(ep, it, a.fetch_from) if a.fetch_from else "not on this host"
        it["probe"] = ffprobe(f) if os.path.exists(f) else None
        if os.path.exists(f) and not it["probe"]:
            it["state"] = "unreadable"
    n = write_room(ep, a.out, items, strings, a.note)
    sheet(ep, a.out, items, online, strings, a.note)
    with open(os.path.join(a.out, "room.json"), "w", encoding="utf-8") as fh:
        json.dump({"episode": episode_address(ep), "media": items, "stringouts": [{k: v for k, v in s.items() if k != "marks"} for s in strings],
                   "screenwalks": online}, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    by = {}
    for it in items:
        by[it["state"]] = by.get(it["state"], 0) + 1
    print(f"room.kdenlive: {n} media in {len({it['bin'] for it in items if it['probe']})} bins; "
          + ", ".join(f"{v} {k}" for k, v in sorted(by.items())) + f"; {len(strings)} stringouts, {len(online)} screenwalks online")


if __name__ == "__main__":
    main()
