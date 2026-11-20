#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""atelier_timbre.py -- choose an instrument by measuring it, not by liking it.

Standard library only. All spectral work is delegated to atelier_audio.py; all
rendering is delegated to atelier_render.sh. This file owns exactly one thing:
turning "which timbre?" from a matter of taste into a ranked table of two
numbers per candidate.

THE TWO NUMBERS

    stridence          share of spectral energy in 2-5 kHz over the whole
                       rendered piece. How much the piece scrapes.
    his band           share of energy in the singer's own Hz band. How hard
                       the arrangement sits on top of him.

    Jerry's thresholds, and they are his, not invented:
        > 13.12 %   rejected
        <= 5.98 %   accepted
        <=  3.00 %  soft
    A multi-voice piece rarely reaches 5.98 %. When nothing passes, this tool
    SAYS SO and names the lowest candidate as the least bad. It never moves the
    line to manufacture a winner.

THE LESSON THIS TOOL EXISTS TO ENFORCE
    On 2026-08-16 a techno piece measured 27.07 % stridence -- more than double
    the reject threshold. The hi-hats were blamed, as everyone would. Then it
    was measured:

        drums at 100            27.07 %
        drums at 55             28.52 %   <- it went UP
        no open hi-hat          28.54 %   <- UP
        no hi-hats at all       28.73 %   <- UP

    Lowering or removing the drums RAISED the proportion: the hi-hats were not
    the source, they were merely the loudest suspect. The source was the lead's
    sawtooth. Swapping the lead is what fixed it:

        saw lead (81)   27.07 %      square lead (80)  21.61 %
        vibraphone (11) 20.68 %      brass (62)        17.36 %
        new age pad (88)15.21 %      FM piano (5)      13.47 %
        recorder (74)   12.15 %      e-piano           12.08 %
        CALLIOPE (82)   11.30 %   <- kept, and 1.96 % in his band

    MEASURE THE CANDIDATES. DO NOT BLAME THE OBVIOUS. Removing a part changes
    the denominator as well as the numerator, so "take out the bright thing" is
    not even arithmetically guaranteed to help. One rendered measurement per
    candidate settles in seconds what an argument cannot settle at all.

USAGE
    atelier_timbre.py <file.abc|file.mid> --voice N --programs 74,80,82,88

    --voice N        which voice to vary. For an ABC source, the number in its
                     `V:N` line. For a MIDI source, the CHANNEL (1-16).
    --programs LIST  GM program numbers, comma or space separated (0-127).
    --band LO-HI     his singing band in Hz (default 116-156, measured -- the
                     same default atelier_audio.py carries).
    --outdir DIR     keep the candidate renders here instead of a temp dir.
    --audio-tool P   path to atelier_audio.py     (default: beside this file,
    --render-tool P  path to atelier_render.sh     or under ${CLAUDE_PLUGIN_ROOT})
    --json           machine-readable results on stdout.

EXIT STATUS
    0  the run measured every candidate and at least one is not rejected
    2  a bad argument, or the source cannot be varied as asked
    3  atelier_audio.py is missing -- nothing was measured, nothing is claimed
    4  a candidate render or measurement failed
    5  every candidate is above the reject threshold. Not an error in the tool:
       an answer. The bar does not move.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile

# Jerry's thresholds, as fractions. atelier_audio.py carries the same three
# numbers; they are repeated here so this tool can rank and report even when the
# audio tool is only reachable as a subprocess.
STRIDENCE_REJECT = 0.1312
STRIDENCE_ACCEPT = 0.0598
STRIDENCE_SOFT = 0.0300

#: His singing band in Hz. 116-156 Hz is roughly MIDI 45-52 -- the band 94.1 %
#: of his drone occupies, and the one every piece leaves empty.
DEFAULT_BAND = (116.0, 156.0)

#: General MIDI program names, 0-based, so the ranked table reads as music
#: rather than as integers.
GM_NAMES = (
    "acoustic grand", "bright acoustic", "electric grand", "honky-tonk",
    "e-piano 1", "e-piano 2", "harpsichord", "clavinet",
    "celesta", "glockenspiel", "music box", "vibraphone",
    "marimba", "xylophone", "tubular bells", "dulcimer",
    "drawbar organ", "percussive organ", "rock organ", "church organ",
    "reed organ", "accordion", "harmonica", "tango accordion",
    "nylon guitar", "steel guitar", "jazz guitar", "clean guitar",
    "muted guitar", "overdrive guitar", "distortion guitar", "guitar harmonics",
    "acoustic bass", "finger bass", "pick bass", "fretless bass",
    "slap bass 1", "slap bass 2", "synth bass 1", "synth bass 2",
    "violin", "viola", "cello", "contrabass",
    "tremolo strings", "pizzicato strings", "orchestral harp", "timpani",
    "string ensemble 1", "string ensemble 2", "synth strings 1", "synth strings 2",
    "choir aahs", "voice oohs", "synth voice", "orchestra hit",
    "trumpet", "trombone", "tuba", "muted trumpet",
    "french horn", "brass section", "synth brass 1", "synth brass 2",
    "soprano sax", "alto sax", "tenor sax", "baritone sax",
    "oboe", "english horn", "bassoon", "clarinet",
    "piccolo", "flute", "recorder", "pan flute",
    "blown bottle", "shakuhachi", "whistle", "ocarina",
    "lead square", "lead sawtooth", "lead calliope", "lead chiff",
    "lead charang", "lead voice", "lead fifths", "lead bass+lead",
    "pad new age", "pad warm", "pad polysynth", "pad choir",
    "pad bowed", "pad metallic", "pad halo", "pad sweep",
    "fx rain", "fx soundtrack", "fx crystal", "fx atmosphere",
    "fx brightness", "fx goblins", "fx echoes", "fx sci-fi",
    "sitar", "banjo", "shamisen", "koto",
    "kalimba", "bagpipe", "fiddle", "shanai",
    "tinkle bell", "agogo", "steel drums", "woodblock",
    "taiko drum", "melodic tom", "synth drum", "reverse cymbal",
    "guitar fret noise", "breath noise", "seashore", "bird tweet",
    "telephone ring", "helicopter", "applause", "gunshot",
)


class TimbreError(Exception):
    """Something this tool refuses to guess around."""

    def __init__(self, message, status=2):
        super().__init__(message)
        self.status = status


# ═════════════════════════════════════════════════════════════════════════
#  Locating the sibling tools
# ═════════════════════════════════════════════════════════════════════════

def _plugin_scripts_dir():
    """Where the atelier's scripts live.

    `${CLAUDE_PLUGIN_ROOT}` first, because that is the variable that makes this
    plugin host-portable; then the directory this file sits in, which is the
    right answer whenever the plugin is being run straight from a checkout.
    Never a hardcoded absolute path.
    """
    root = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if root:
        cand = os.path.join(root, "scripts")
        if os.path.isdir(cand):
            return cand
        return root
    return os.path.dirname(os.path.abspath(__file__))


def resolve_tool(explicit, filename, human_name, missing_status):
    """Find a sibling tool, or refuse with a message that names the contract."""
    if explicit:
        path = os.path.abspath(os.path.expanduser(explicit))
        if not os.path.isfile(path):
            raise TimbreError(
                "%s not found at the path you gave: %s" % (human_name, path),
                missing_status)
        return path
    path = os.path.join(_plugin_scripts_dir(), filename)
    if os.path.isfile(path):
        return path
    raise TimbreError(
        "%s is not present.\n"
        "  Looked for: %s\n"
        "  ${CLAUDE_PLUGIN_ROOT} is %s\n"
        "  Point at it with --%s PATH, or install the plugin so that %s sits\n"
        "  beside this file in scripts/.\n"
        "  NOTHING WAS MEASURED, so nothing is claimed: this tool does not\n"
        "  guess a stridence, and it does not carry its own copy of the FFT."
        % (human_name, path,
           os.environ.get("CLAUDE_PLUGIN_ROOT", "unset"),
           "audio-tool" if filename.endswith(".py") else "render-tool",
           filename),
        missing_status)


# ═════════════════════════════════════════════════════════════════════════
#  Making one candidate out of the source
# ═════════════════════════════════════════════════════════════════════════

_VOICE_LINE = re.compile(r"^V:\s*(\S+)")
_PROGRAM_LINE = re.compile(r"^%%MIDI\s+program\s+\d+", re.IGNORECASE)
_CHANNEL_LINE = re.compile(r"^%%MIDI\s+channel\s+(\d+)", re.IGNORECASE)


def abc_variant(text, voice, program):
    """Return `text` with voice `voice`'s `%%MIDI program` set to `program`.

    Only header `V:` lines are touched -- the ones at column 0. Interleaved
    `[V:n]` body lines start with a bracket and are left alone.

    If the voice declares `%%MIDI channel 10` this refuses: on channel 10 the
    program does not choose the instrument, the pitch does, so varying it would
    produce ten identical renders and a table that means nothing.
    """
    lines = text.splitlines()
    target = str(voice)
    start = None
    for i, line in enumerate(lines):
        m = _VOICE_LINE.match(line)
        if m and m.group(1) == target:
            start = i
            break
    if start is None:
        declared = [m.group(1) for m in
                    (_VOICE_LINE.match(l) for l in lines) if m]
        raise TimbreError(
            "no header line `V:%s` in this ABC. Voices declared: %s"
            % (target, ", ".join(declared) if declared else "none"))

    # the voice's block runs to the next header V: line
    end = len(lines)
    for j in range(start + 1, len(lines)):
        if _VOICE_LINE.match(lines[j]):
            end = j
            break

    for j in range(start, end):
        m = _CHANNEL_LINE.match(lines[j])
        if m and int(m.group(1)) == 10:
            raise TimbreError(
                "voice %s is on channel 10. There the PITCH chooses the "
                "percussion, not the program -- varying the program would render "
                "ten identical files. Vary a pitched voice instead." % target)

    for j in range(start, end):
        if _PROGRAM_LINE.match(lines[j]):
            lines[j] = "%%MIDI program " + str(program)
            return "\n".join(lines) + "\n"

    # no program line yet: insert one right after the V: header
    insert_at = start + 1
    while insert_at < end and lines[insert_at].startswith("%%MIDI"):
        insert_at += 1
    lines.insert(insert_at, "%%MIDI program " + str(program))
    return "\n".join(lines) + "\n"


def _varlen(data, p):
    v = 0
    while True:
        b = data[p]
        p += 1
        v = (v << 7) | (b & 0x7F)
        if not b & 0x80:
            return v, p


def midi_program_offsets(data, channel):
    """Byte offsets of the program-change data byte for `channel` (1-16).

    A minimal event walk, because a program change cannot be found by searching
    for a byte value -- any data byte could collide. Reading MIDI for ANALYSIS
    belongs to atelier_midi.py; this is only the byte patch that analysis does
    not provide, and it changes no length, so no track header needs fixing.
    """
    if data[:4] != b"MThd":
        raise TimbreError("not a Standard MIDI File (no MThd)")
    import struct
    _fmt, ntrk, _div = struct.unpack(">HHH", data[8:14])
    p = 14
    want = (channel - 1) & 0x0F
    hits = []
    for _ in range(ntrk):
        if data[p:p + 4] != b"MTrk":
            raise TimbreError("malformed MIDI: expected MTrk at byte %d" % p)
        length = struct.unpack(">I", data[p + 4:p + 8])[0]
        p += 8
        end = p + length
        running = None
        while p < end:
            _delta, p = _varlen(data, p)
            status = data[p]
            if status & 0x80:
                running = status
                p += 1
            else:
                status = running
            if status is None:
                raise TimbreError("malformed MIDI: running status with no status byte")
            if status == 0xFF:
                p += 1
                n, p = _varlen(data, p)
                p += n
            elif status in (0xF0, 0xF7):
                n, p = _varlen(data, p)
                p += n
            else:
                high, chan = status & 0xF0, status & 0x0F
                nbytes = 1 if high in (0xC0, 0xD0) else 2
                if high == 0xC0 and chan == want:
                    hits.append(p)
                p += nbytes
        p = end
    return hits


def midi_variant(data, channel, program):
    """Return `data` with every program change on `channel` set to `program`."""
    offsets = midi_program_offsets(data, channel)
    if not offsets:
        raise TimbreError(
            "this MIDI carries no program change on channel %d, so there is "
            "nothing to vary. Inserting one would mean rewriting track lengths; "
            "vary the ABC source instead -- that is where the timbre decision "
            "belongs anyway." % channel)
    out = bytearray(data)
    for off in offsets:
        out[off] = program & 0x7F
    return bytes(out)


# ═════════════════════════════════════════════════════════════════════════
#  Rendering and measuring one candidate
# ═════════════════════════════════════════════════════════════════════════

def render(render_tool, source_path, outdir):
    """Render one candidate to WAV and return its path.

    Delegates to atelier_render.sh so the abc2midi error check, the soundfont
    search and the runtime-floor checks all happen once, in one place.
    ATELIER_NO_M4A=1 because only the WAV is measured; encoding an AAC per
    candidate would be pure waste.
    """
    env = dict(os.environ, ATELIER_NO_M4A="1")
    proc = subprocess.run(
        ["bash", render_tool, source_path, "--outdir", outdir],
        capture_output=True, text=True, env=env)
    base = os.path.splitext(os.path.basename(source_path))[0]
    wav = os.path.join(outdir, base + ".wav")
    if proc.returncode != 0 or not os.path.isfile(wav):
        raise TimbreError(
            "render failed for %s (exit %d).\n%s"
            % (os.path.basename(source_path), proc.returncode,
               _indent(proc.stderr or proc.stdout)), 4)
    return wav


_SHARE = r"([0-9]+(?:\.[0-9]+)?)\s*%"
_BAND_RE = re.compile(r"\bband\b.*?" + _SHARE, re.IGNORECASE)
_STRIDENCE_RE = re.compile(r"\bstridence\b.*?" + _SHARE, re.IGNORECASE)


def measure(audio_tool, wav, band):
    """Both numbers for one WAV, via atelier_audio.py.

    The contract used is its `voice` subcommand, which reports the band share
    and the stridence together:

        python3 atelier_audio.py voice <wav> --band LO-HI
          <path>  (13.49 s, 44100 Hz, 2 ch)
            his band 116-156 Hz   1.96 %
            stridence 2-5 kHz     11.30 %   accepted

    Its output is parsed by the two labelled lines rather than by position, so a
    reworded header or an extra line does not break the read. If neither number
    can be found, this RAISES with the raw output attached -- it does not fall
    back on a guess. A fabricated stridence is worse than no stridence.
    """
    proc = subprocess.run(
        [sys.executable, audio_tool, "voice", wav,
         "--band", "%g-%g" % (band[0], band[1])],
        capture_output=True, text=True)
    text = (proc.stdout or "") + "\n" + (proc.stderr or "")
    if proc.returncode != 0:
        raise TimbreError(
            "atelier_audio.py exited %d on %s:\n%s"
            % (proc.returncode, os.path.basename(wav), _indent(text)), 4)
    mb = _BAND_RE.search(text)
    ms = _STRIDENCE_RE.search(text)
    if not mb or not ms:
        raise TimbreError(
            "could not read the two numbers out of atelier_audio.py.\n"
            "  Expected a line containing \"band ... N %%\" and one containing\n"
            "  \"stridence ... N %%\". What it actually printed:\n%s"
            % _indent(text), 4)
    return float(ms.group(1)) / 100.0, float(mb.group(1)) / 100.0


def _indent(text, prefix="  | "):
    return "\n".join(prefix + l for l in (text or "").rstrip().splitlines())


def verdict(stridence):
    """Jerry's ladder, and only his."""
    if stridence > STRIDENCE_REJECT:
        return "REJECTED"
    if stridence <= STRIDENCE_SOFT:
        return "soft"
    if stridence <= STRIDENCE_ACCEPT:
        return "accepted"
    return "under the bar"          # not rejected, not accepted -- say which


def gm_name(program):
    return GM_NAMES[program] if 0 <= program < len(GM_NAMES) else "?"


# ═════════════════════════════════════════════════════════════════════════
#  The run
# ═════════════════════════════════════════════════════════════════════════

def run(args):
    audio_tool = resolve_tool(args.audio_tool, "atelier_audio.py",
                              "atelier_audio.py", 3)
    render_tool = resolve_tool(args.render_tool, "atelier_render.sh",
                               "atelier_render.sh", 3)

    src = os.path.abspath(os.path.expanduser(args.source))
    if not os.path.isfile(src):
        raise TimbreError("source not found: %s" % src)
    ext = os.path.splitext(src)[1].lower()
    if ext in (".abc", ".txt"):
        kind = "abc"
        payload = open(src, "r", encoding="utf-8", errors="replace").read()
    elif ext in (".mid", ".midi"):
        kind = "midi"
        payload = open(src, "rb").read()
    else:
        raise TimbreError("unknown source type \"%s\": give a .abc or a .mid" % ext)

    if kind == "midi" and not 1 <= args.voice <= 16:
        raise TimbreError("for a MIDI source --voice is a channel, 1-16; got %d"
                          % args.voice)

    workdir = args.outdir
    temporary = workdir is None
    if temporary:
        workdir = tempfile.mkdtemp(prefix="atelier-timbre.")
    else:
        workdir = os.path.abspath(os.path.expanduser(workdir))
        os.makedirs(workdir, exist_ok=True)

    rows = []
    try:
        for program in args.programs:
            stem = "cand%03d" % program
            if kind == "abc":
                cand = os.path.join(workdir, stem + ".abc")
                with open(cand, "w", encoding="utf-8") as fh:
                    fh.write(abc_variant(payload, args.voice, program))
            else:
                cand = os.path.join(workdir, stem + ".mid")
                with open(cand, "wb") as fh:
                    fh.write(midi_variant(payload, args.voice, program))
                # a .mid needs no abc2midi pass; render straight from it
            wav = (render(render_tool, cand, workdir) if kind == "abc"
                   else _render_midi(render_tool, cand, workdir))
            strid, bandshare = measure(audio_tool, wav, args.band)
            rows.append({"program": program, "name": gm_name(program),
                         "stridence": strid, "band": bandshare,
                         "verdict": verdict(strid), "wav": wav})
            print("  measured %3d %-18s stridence %6.2f %%   his band %5.2f %%"
                  % (program, gm_name(program), 100 * strid, 100 * bandshare),
                  file=sys.stderr)
    finally:
        if temporary and not args.keep:
            shutil.rmtree(workdir, ignore_errors=True)

    rows.sort(key=lambda r: r["stridence"])
    report(rows, args)
    if not any(r["stridence"] <= STRIDENCE_REJECT for r in rows):
        return 5
    return 0


def _render_midi(render_tool, mid_path, outdir):
    """A MIDI candidate does not go through abc2midi. Synthesise it directly,
    reusing the render script's soundfont search by handing it a one-line ABC
    would be a lie -- so this calls fluidsynth the same way the script does, and
    says so plainly rather than pretending the chain is identical."""
    sf = os.environ.get("ATELIER_SOUNDFONT")
    if not sf:
        # reuse the render script's documented search list rather than a second
        # copy of it: ask the script itself.
        out = subprocess.run(["bash", render_tool, "--help"],
                             capture_output=True, text=True).stdout
        for line in out.splitlines():
            cand = line.strip()
            if cand.endswith(".sf2") and os.path.isfile(cand):
                sf = cand
                break
    if not sf:
        raise TimbreError(
            "no soundfont for the MIDI path. Set ATELIER_SOUNDFONT, or measure "
            "the ABC source instead so atelier_render.sh handles it.", 4)
    wav = os.path.splitext(mid_path)[0] + ".wav"
    proc = subprocess.run(
        ["fluidsynth", "-ni", "-F", wav,
         "-r", os.environ.get("ATELIER_SAMPLE_RATE", "44100"),
         "-g", os.environ.get("ATELIER_GAIN", "0.8"), sf, mid_path],
        capture_output=True, text=True)
    if proc.returncode != 0 or not os.path.isfile(wav):
        raise TimbreError("fluidsynth failed on %s:\n%s"
                          % (mid_path, _indent(proc.stderr)), 4)
    return wav


def report(rows, args):
    if args.json:
        import json
        json.dump({"band_hz": list(args.band),
                   "thresholds": {"reject": STRIDENCE_REJECT,
                                  "accept": STRIDENCE_ACCEPT,
                                  "soft": STRIDENCE_SOFT},
                   "candidates": [{k: v for k, v in r.items() if k != "wav"}
                                  for r in rows]},
                  sys.stdout, indent=2)
        sys.stdout.write("\n")
        return

    lo, hi = args.band
    print()
    print("timbre candidates for %s, voice %s -- ranked by stridence"
          % (os.path.basename(args.source), args.voice))
    print("  stridence = share of energy 2-5 kHz · his band = share in %g-%g Hz"
          % (lo, hi))
    print()
    print("   prog  instrument           stridence    his band   verdict")
    print("   ----  -------------------  ---------    --------   -------")
    for r in rows:
        print("   %4d  %-19s  %7.2f %%    %6.2f %%   %s"
              % (r["program"], r["name"], 100 * r["stridence"],
                 100 * r["band"], r["verdict"]))
    print()
    print("   thresholds (Jerry's): reject > %.2f %% · accept <= %.2f %% · "
          "soft <= %.2f %%"
          % (100 * STRIDENCE_REJECT, 100 * STRIDENCE_ACCEPT, 100 * STRIDENCE_SOFT))
    print()

    passing = [r for r in rows if r["stridence"] <= STRIDENCE_ACCEPT]
    under = [r for r in rows if r["stridence"] <= STRIDENCE_REJECT]
    best = rows[0]

    if passing:
        print("   %d candidate(s) at or under the accept line. Lowest: %d %s at "
              "%.2f %%." % (len(passing), best["program"], best["name"],
                            100 * best["stridence"]))
    elif under:
        print("   NOTHING REACHES THE ACCEPT LINE OF %.2f %%."
              % (100 * STRIDENCE_ACCEPT))
        print("   %d candidate(s) are under the reject line of %.2f %%; the "
              "lowest is %d %s at %.2f %%."
              % (len(under), 100 * STRIDENCE_REJECT, best["program"],
                 best["name"], 100 * best["stridence"]))
        print("   That is the honest answer, not a failure. A multi-voice piece")
        print("   rarely reaches 5.98 %; a piece with hi-hats in it never will.")
        print("   Say the number. Do not move the line.")
    else:
        print("   EVERY CANDIDATE IS REJECTED (all above %.2f %%)."
              % (100 * STRIDENCE_REJECT))
        print("   Lowest is still %d %s at %.2f %%."
              % (best["program"], best["name"], 100 * best["stridence"]))
        print("   Before widening the candidate list, remember what was measured")
        print("   on 2026-08-16: taking the hi-hats OUT raised stridence from")
        print("   27.07 % to 28.73 %. The brightest-sounding part is not")
        print("   reliably the source. Vary a different voice and measure again.")

    if best["band"] > 0.05:
        print()
        print("   Note: the lowest-stridence candidate also puts %.2f %% of its"
              % (100 * best["band"]))
        print("   energy in his band. The least strident candidate is often the")
        print("   one sitting hardest on top of him -- read BOTH columns.")


def _programs(value):
    out = []
    for chunk in re.split(r"[,\s]+", value.strip()):
        if not chunk:
            continue
        n = int(chunk)
        if not 0 <= n <= 127:
            raise argparse.ArgumentTypeError("GM program out of 0-127: %d" % n)
        out.append(n)
    if not out:
        raise argparse.ArgumentTypeError("no programs given")
    return out


def _band(value):
    m = re.match(r"^\s*([0-9.]+)\s*[-:]\s*([0-9.]+)\s*$", value)
    if not m:
        raise argparse.ArgumentTypeError("a band looks like LO-HI, in Hz")
    lo, hi = float(m.group(1)), float(m.group(2))
    if hi <= lo:
        raise argparse.ArgumentTypeError("band LO must be below HI")
    return lo, hi


def build_parser():
    p = argparse.ArgumentParser(
        prog="atelier_timbre.py",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description="Choose an instrument by measuring it. Renders one variant "
                    "per GM program, measures stridence (2-5 kHz share) and the "
                    "energy in his singing band, and ranks them.",
        epilog="""\
THE LESSON THIS TOOL EXISTS TO ENFORCE

  On 2026-08-16 a piece measured 27.07 % stridence, twice the reject line.
  The hi-hats were blamed, as everyone would. Then it was measured:

      drums at 100        27.07 %
      drums at 55         28.52 %   <- it went UP
      no open hi-hat      28.54 %   <- UP
      no hi-hats at all   28.73 %   <- UP

  REMOVING THE HI-HATS RAISED STRIDENCE. They were not the source; the lead's
  sawtooth was. Swapping the lead from saw (81, 27.07 %) to calliope
  (82, 11.30 %) is what fixed it.

  MEASURE THE CANDIDATES. DO NOT BLAME THE OBVIOUS.

Jerry's thresholds: reject > 13.12 % · accept <= 5.98 % · soft <= 3.00 %.
A multi-voice piece rarely reaches 5.98 %. When nothing passes, this tool says
so and names the least bad. It never moves the line to produce a winner.

All spectral work is delegated to atelier_audio.py and all rendering to
atelier_render.sh, both found through ${CLAUDE_PLUGIN_ROOT} or --audio-tool /
--render-tool. If atelier_audio.py is absent, this tool refuses and measures
nothing rather than carrying a second copy of the FFT.""")
    p.add_argument("source", help="the .abc or .mid to vary")
    p.add_argument("--voice", type=int, required=True,
                   help="ABC: the number in its V: line. MIDI: the channel, 1-16.")
    p.add_argument("--programs", type=_programs, required=True,
                   metavar="LIST", help="GM programs, e.g. 74,80,82,88")
    p.add_argument("--band", type=_band, default=DEFAULT_BAND, metavar="LO-HI",
                   help="his singing band in Hz (default 116-156, measured)")
    p.add_argument("--outdir", default=None,
                   help="keep candidate renders here (default: a temp dir)")
    p.add_argument("--keep", action="store_true",
                   help="keep the temp dir instead of removing it")
    p.add_argument("--audio-tool", default=None, metavar="PATH",
                   help="path to atelier_audio.py")
    p.add_argument("--render-tool", default=None, metavar="PATH",
                   help="path to atelier_render.sh")
    p.add_argument("--json", action="store_true", help="machine-readable output")
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        return run(args)
    except TimbreError as exc:
        print("atelier_timbre.py: %s" % exc, file=sys.stderr)
        return exc.status
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
