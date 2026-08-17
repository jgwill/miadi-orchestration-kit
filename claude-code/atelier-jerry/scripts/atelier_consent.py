#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""atelier_consent.py -- the consent guard of the atelier.

Standard library only.

WHY THIS FILE EXISTS
  The human recorded these words. They bind the tools, not just the people:

    "I don't consent that my voice and my original recording goes outside of the
     boundary here."

    "it's really a great privilege to use this sound, nobody is authorized to use it
     without my consent."

  What the atelier does, and what this guard keeps it doing:
    - voice and cries are fetched, ANALYSED, then DESTROYED locally. Only numbers leave.
    - crops are cut on his device, never by copying the source out and back.
    - no audio of his voice is published. No SoundFont was built: a .sf2 is a format
      made to travel, and that permission was never given.
    - consent is not transitive. A yes for one piece is not a yes for the next.
    - transcription sends audio to a third party: the human triggers it, not an agent.

THE LEDGER
  Append-only JSONL. It records what was fetched, what was measured, what was
  destroyed, and every HELD GATE -- a thing named but not done for want of the
  human's word. A gate lives in a ledger, never in scrollback.

  Default path: ${XDG_STATE_HOME:-$HOME/.local/state}/atelier/consent-ledger.jsonl
  Override with ATELIER_CONSENT_LEDGER.
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import shutil
import subprocess
import sys

PROG = "atelier_consent.py"

ENV_LEDGER = "ATELIER_CONSENT_LEDGER"
ENV_STATE = "XDG_STATE_HOME"

HIS_WORDS = [
    ("2026-08-08",
     "I don't consent that my voice and my original recording goes outside of the "
     "boundary here."),
    ("2026-08-16",
     "it's really a great privilege to use this sound, nobody is authorized to use it "
     "without my consent."),
]

EVENTS = ("fetched", "measured", "destroyed", "held", "published", "refused", "marked")


# --------------------------------------------------------------------------- #
# ledger
# --------------------------------------------------------------------------- #

def ledger_path():
    explicit = os.environ.get(ENV_LEDGER)
    if explicit:
        return explicit
    state = os.environ.get(ENV_STATE)
    if not state:
        home = os.environ.get("HOME")
        if not home:
            raise RuntimeError(
                "cannot locate a state directory: neither %s nor HOME is set. "
                "Pass --ledger." % ENV_STATE
            )
        state = os.path.join(home, ".local", "state")
    return os.path.join(state, "atelier", "consent-ledger.jsonl")


def _now():
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def record_event(event, ledger=None, **fields):
    """Append one entry. Append-only: the file is opened 'a' and never rewritten."""
    path = ledger or ledger_path()
    parent = os.path.dirname(os.path.abspath(path))
    if parent and not os.path.isdir(parent):
        os.makedirs(parent, mode=0o700)
    entry = {"ts": _now(), "event": event}
    for key, value in fields.items():
        if value is not None:
            entry[key] = value
    line = json.dumps(entry, ensure_ascii=False, sort_keys=True)
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(line + "\n")
    return entry


def read_ledger(ledger=None):
    path = ledger or ledger_path()
    if not os.path.exists(path):
        return []
    out = []
    with open(path, "r", encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except ValueError:
                sys.stderr.write("  (ledger line %d is not JSON, skipped)\n" % lineno)
    return out


# --------------------------------------------------------------------------- #
# measurement helpers -- numbers only
# --------------------------------------------------------------------------- #

def file_numbers(path):
    """The numbers that may outlive a destroyed file. No audio, no words."""
    st = os.stat(path)
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            chunk = fh.read(1 << 20)
            if not chunk:
                break
            digest.update(chunk)
    return {
        "bytes": st.st_size,
        "sha256": digest.hexdigest(),
        "mtime": int(st.st_mtime),
    }


def parse_kv(items):
    out = {}
    for item in items or []:
        if "=" not in item:
            raise ValueError("measurement %r is not k=v" % item)
        key, value = item.split("=", 1)
        try:
            out[key] = float(value) if ("." in value or "e" in value.lower()) else int(value)
        except ValueError:
            out[key] = value
    return out


# --------------------------------------------------------------------------- #
# shred
# --------------------------------------------------------------------------- #

def shred(path, ledger=None, passes=3, measured=None, reason=None):
    """Securely delete a local analysis copy, verify it is gone, print what remains.

    What remains is numbers: byte count, sha256, mtime, and whatever measurements
    were carried out of it. Not the sound.
    """
    path = os.path.abspath(path)
    if not os.path.isfile(path):
        raise FileNotFoundError("nothing to destroy at %s" % path)
    numbers = file_numbers(path)
    tool = shutil.which("shred")
    method = None
    if tool:
        proc = subprocess.run([tool, "-u", "-n", str(passes), path],
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if proc.returncode == 0:
            method = "shred -u -n %d" % passes
        else:
            sys.stderr.write(
                "  shred(1) exited %d: %s\n"
                % (proc.returncode, proc.stderr.decode("utf-8", "replace").strip())
            )
    if method is None:
        # Fallback: overwrite in place, then unlink. Stated plainly -- on a
        # copy-on-write or flash filesystem an overwrite is not a guarantee.
        size = numbers["bytes"]
        with open(path, "r+b") as fh:
            for _ in range(passes):
                fh.seek(0)
                remaining = size
                while remaining > 0:
                    block = os.urandom(min(remaining, 1 << 20))
                    fh.write(block)
                    remaining -= len(block)
                fh.flush()
                os.fsync(fh.fileno())
        os.unlink(path)
        method = "overwrite x%d + unlink (shred(1) unavailable)" % passes

    gone = not os.path.exists(path)
    record_event(
        "destroyed", ledger=ledger, path=path, method=method, verified_gone=gone,
        reason=reason, **numbers
    )
    if measured:
        record_event("measured", ledger=ledger, path=path, sha256=numbers["sha256"],
                     measurements=measured)

    print("DESTROYED  %s" % path)
    print("  method        : %s" % method)
    print("  verified gone : %s" % ("yes" if gone else "NO -- IT IS STILL THERE"))
    print("  what remains, numbers only:")
    print("    bytes  = %d" % numbers["bytes"])
    print("    sha256 = %s" % numbers["sha256"])
    print("    mtime  = %d" % numbers["mtime"])
    if measured:
        for key in sorted(measured):
            print("    %-6s = %s" % (key, measured[key]))
    if not gone:
        raise RuntimeError("destruction NOT verified -- the file still exists at %s" % path)
    return numbers


# --------------------------------------------------------------------------- #
# publish guard
# --------------------------------------------------------------------------- #

VOICE_KEYS = ("voice", "contains_voice", "his_voice")

#: Every key under which some writer in this atelier has recorded a filename.
#: There is one list because there was once three, and two of them were wrong.
FILE_KEYS = ("path", "dest", "source", "filename", "portal_filename", "out", "src")


def _entry_marks_voice(entry):
    for key in VOICE_KEYS:
        if entry.get(key):
            return True
    return False


def entry_basenames(entry):
    """Every filename this entry refers to, under any key a writer has used."""
    names = set()
    for key in FILE_KEYS:
        value = entry.get(key)
        if isinstance(value, str) and value:
            names.add(os.path.basename(value))
    return names


def voiced_basenames(ledger=None):
    """Filenames the ledger marks as carrying his voice.

    THE READER THE HOOKS MUST USE. Written because there were three readers of
    this one file with three field conventions, and the guard's — which looked
    for a key named `file` that no writer has ever produced — could never fire.
    A guard that cannot see what it guards is worse than none, because it
    reports safety.
    """
    names = set()
    for entry in read_ledger(ledger):
        if _entry_marks_voice(entry):
            names |= entry_basenames(entry)
    return names


def open_gates(ledger=None):
    """The gates still waiting on his word, newest first.

    A release is recorded as `{event: "held", status: "released"}` — a new
    entry, never an edit, so the ledger stays append-only. A reader that
    matches on `event` alone therefore resurrects every released gate. That
    happened: the tool said no gate was open while the session hook listed one.
    """
    held_entries = [e for e in read_ledger(ledger) if e.get("event") == "held"]
    released = {e.get("name") for e in held_entries if e.get("status") == "released"}
    open_ = {}
    for entry in held_entries:
        name = entry.get("name")
        if entry.get("status") == "released" or name in released:
            continue
        open_[name] = entry          # a later hold on the same name wins
    return list(open_.values())


def check_publish(path, ledger=None, allow_unknown=False):
    """Refuse to publish a file whose provenance marks it as carrying his voice.

    Returns (verdict, reason). Verdicts: CLEAR, REFUSED_VOICE, REFUSED_UNKNOWN.
    """
    path = os.path.abspath(path)
    base = os.path.basename(path)
    digest = None
    if os.path.isfile(path):
        digest = file_numbers(path)["sha256"]

    entries = read_ledger(ledger)
    matched = []
    for entry in entries:
        candidates = set()
        for key in ("path", "dest", "source", "filename", "portal_filename", "out", "src"):
            value = entry.get(key)
            if isinstance(value, str) and value:
                candidates.add(os.path.basename(value))
        hit = base in candidates
        if not hit and digest and entry.get("sha256") == digest:
            hit = True
        if hit:
            matched.append(entry)

    voiced = [e for e in matched if _entry_marks_voice(e)]
    if voiced:
        return "REFUSED_VOICE", voiced
    if not matched:
        if allow_unknown:
            return "CLEAR", []
        return "REFUSED_UNKNOWN", []
    return "CLEAR", matched


def print_check(path, verdict, evidence):
    print("candidate : %s" % os.path.abspath(path))
    if verdict == "CLEAR":
        print("verdict   : CLEAR")
        print("  %d ledger entr%s cover this file and none marks it as his voice."
              % (len(evidence), "y" if len(evidence) == 1 else "ies"))
        print("  CLEAR is not a blanket yes. Consent is not transitive: a yes for one")
        print("  piece is not a yes for the next. Ask him for this one.")
        return 0
    if verdict == "REFUSED_VOICE":
        print("verdict   : REFUSED")
        print("  The provenance ledger marks this file as carrying his voice.")
        for entry in evidence:
            print("    %s  %s  %s" % (entry.get("ts"), entry.get("event"),
                                      entry.get("path") or entry.get("filename")))
        print("  His words:")
        for when, quote in HIS_WORDS:
            print("    (%s) \"%s\"" % (when, quote))
        print("  What may leave instead: the numbers measured from it, and the MIDI.")
        print("  The recording itself stays inside the boundary, and is destroyed here")
        print("  when the measurement is done:  %s shred <path>" % PROG)
        return 2
    print("verdict   : REFUSED (provenance unknown)")
    print("  No ledger entry covers this file. An unrecorded file is not a cleared file.")
    print("  Record where it came from first:")
    print("    %s fetched <path> --from <url> [--voice]" % PROG)
    print("  Or, if you are certain it carries nothing of his: re-run with --allow-unknown.")
    return 3


# --------------------------------------------------------------------------- #
# held gates
# --------------------------------------------------------------------------- #

def held(name, why, quote=None, ledger=None):
    entry = record_event("held", ledger=ledger, name=name, why=why, quote=quote,
                         status="open")
    print("HELD  %s" % name)
    print("  why   : %s" % why)
    if quote:
        print("  quote : \"%s\"" % quote)
    print("  This gate now lives in the ledger, not in scrollback:")
    print("    %s" % (ledger or ledger_path()))
    return entry


def held_list(ledger=None, include_released=False):
    entries = [e for e in read_ledger(ledger) if e.get("event") == "held"]
    released = {e.get("name") for e in entries if e.get("status") == "released"}
    shown = 0
    for entry in entries:
        if entry.get("status") == "released" and not include_released:
            continue
        if entry.get("status") != "released" and entry.get("name") in released \
                and not include_released:
            continue
        shown += 1
        print("%s  %-28s %s" % (entry.get("ts"), entry.get("name"), entry.get("why")))
        if entry.get("quote"):
            print("%s  %-28s \"%s\"" % (" " * len(str(entry.get("ts"))), "",
                                        entry.get("quote")))
    if not shown:
        print("no held gate open.")
        print("  An empty list here means nothing is waiting on his word -- it does not")
        print("  mean everything was permitted.")
    return 0


def release(name, by=None, quote=None, ledger=None):
    record_event("held", ledger=ledger, name=name, status="released", why="released",
                 released_by=by, quote=quote)
    print("RELEASED  %s" % name)
    if quote:
        print("  on his words: \"%s\"" % quote)
    return 0


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def build_parser():
    epilog = """\
ENVIRONMENT
  ATELIER_CONSENT_LEDGER  exact ledger path. Otherwise
                          ${XDG_STATE_HOME:-$HOME/.local/state}/atelier/consent-ledger.jsonl

THE SHAPE OF A SESSION
  1. fetched   -- record every copy pulled off his device, --voice if it carries him
  2. measured  -- record the numbers taken out of it
  3. shred     -- destroy the copy, verify, keep only numbers
  4. check-publish -- before anything leaves, ask the ledger
  5. held      -- every gate you named but did not pass, with his words if he said any

  The ledger is append-only. Nothing in it is ever edited; a gate is released by a
  new entry, so the holding is still readable afterwards.
"""
    p = argparse.ArgumentParser(
        prog=PROG,
        description="Consent guard and provenance ledger for the atelier (stdlib only).",
        epilog=epilog,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--ledger", default=None,
                   help="ledger path (default: $" + ENV_LEDGER +
                        ", else ${XDG_STATE_HOME:-$HOME/.local/state}"
                        "/atelier/consent-ledger.jsonl)")
    sub = p.add_subparsers(dest="cmd")

    sp = sub.add_parser("words", help="print his recorded words and what they bind")

    sp = sub.add_parser("where", help="print the ledger path and its size")

    sp = sub.add_parser("fetched", help="record a copy pulled off his device")
    sp.add_argument("path")
    sp.add_argument("--from", dest="source", default=None, help="portal URL or device path")
    sp.add_argument("--voice", action="store_true",
                    help="this file carries his voice, whistle or cries. Marking it "
                         "makes check-publish refuse it forever.")
    sp.add_argument("--note", default=None)

    sp = sub.add_parser("measured", help="record the numbers taken out of a file")
    sp.add_argument("path")
    sp.add_argument("--measure", action="append", metavar="K=V", default=[],
                    help="repeatable, e.g. --measure stridence=5.98")
    sp.add_argument("--note", default=None)

    sp = sub.add_parser("shred", help="destroy a local analysis copy and verify")
    sp.add_argument("path")
    sp.add_argument("--passes", type=int, default=3)
    sp.add_argument("--measure", action="append", metavar="K=V", default=[],
                    help="numbers to keep in the ledger as what remains")
    sp.add_argument("--reason", default=None)

    sp = sub.add_parser("check-publish", help="ask the ledger before anything leaves")
    sp.add_argument("path")
    sp.add_argument("--allow-unknown", action="store_true",
                    help="treat an unrecorded file as clear. Refused by default: an "
                         "unrecorded file is not a cleared file.")

    sp = sub.add_parser("held", help="record, or list, a gate waiting on his word")
    sp.add_argument("name", nargs="?", default=None)
    sp.add_argument("--why", default=None)
    sp.add_argument("--quote", default=None, help="his own words, verbatim, if he said any")
    sp.add_argument("--list", action="store_true", dest="list_them")
    sp.add_argument("--all", action="store_true", help="with --list, include released gates")

    sp = sub.add_parser("release", help="record that he gave his word on a held gate")
    sp.add_argument("name")
    sp.add_argument("--by", default=None)
    sp.add_argument("--quote", default=None, help="his own words, verbatim")

    sp = sub.add_parser("log", help="append an arbitrary entry (used by sibling scripts)")
    sp.add_argument("event", choices=list(EVENTS))
    sp.add_argument("--field", action="append", metavar="K=V", default=[])

    sp = sub.add_parser("tail", help="print the last N ledger entries")
    sp.add_argument("-n", type=int, default=20)

    return p


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.cmd:
        parser.print_help()
        return 1
    ledger = args.ledger

    try:
        if args.cmd == "words":
            print("His recorded words, and they bind the tools:")
            for when, quote in HIS_WORDS:
                print("  (%s) \"%s\"" % (when, quote))
            print()
            print("What follows from them, in this atelier:")
            print("  - voice and cries: fetched, analysed, DESTROYED locally. Only")
            print("    numbers leave the boundary.")
            print("  - crops are cut on his device, never copied out and back.")
            print("  - no .sf2 was built: a SoundFont is a format made to travel and")
            print("    that permission was not given.")
            print("  - transcription is his action. An agent does not trigger it.")
            print("  - consent is not transitive: a yes for one piece is not a yes for")
            print("    the next.")
            return 0

        if args.cmd == "where":
            path = ledger or ledger_path()
            print(path)
            if os.path.exists(path):
                print("  %d bytes, %d entries" % (os.path.getsize(path),
                                                  len(read_ledger(path))))
            else:
                print("  does not exist yet (it is created on the first entry)")
            return 0

        if args.cmd == "fetched":
            path = os.path.abspath(args.path)
            fields = {"path": path, "source": args.source, "note": args.note}
            if os.path.isfile(path):
                fields.update(file_numbers(path))
            if args.voice:
                fields["voice"] = True
            record_event("fetched", ledger=ledger, **fields)
            print("recorded: fetched %s%s" % (path, "  [HIS VOICE]" if args.voice else ""))
            if args.voice:
                print("  check-publish will refuse this file from now on.")
                print("  Destroy the copy when the measurement is done:")
                print("    %s shred %s" % (PROG, path))
            return 0

        if args.cmd == "measured":
            measurements = parse_kv(args.measure)
            path = os.path.abspath(args.path)
            fields = {"path": path, "measurements": measurements, "note": args.note}
            if os.path.isfile(path):
                fields["sha256"] = file_numbers(path)["sha256"]
            record_event("measured", ledger=ledger, **fields)
            print("recorded: %d measurement(s) from %s" % (len(measurements), path))
            for key in sorted(measurements):
                print("  %s = %s" % (key, measurements[key]))
            return 0

        if args.cmd == "shred":
            shred(args.path, ledger=ledger, passes=args.passes,
                  measured=parse_kv(args.measure), reason=args.reason)
            return 0

        if args.cmd == "check-publish":
            verdict, evidence = check_publish(args.path, ledger=ledger,
                                              allow_unknown=args.allow_unknown)
            code = print_check(args.path, verdict, evidence)
            if code != 0:
                record_event("refused", ledger=ledger,
                             path=os.path.abspath(args.path), verdict=verdict)
            return code

        if args.cmd == "held":
            if args.list_them or not args.name:
                return held_list(ledger=ledger, include_released=args.all)
            if not args.why:
                sys.stderr.write("ERROR: a held gate needs --why. A name alone says "
                                 "nothing to whoever reads the ledger next.\n")
                return 2
            held(args.name, args.why, quote=args.quote, ledger=ledger)
            return 0

        if args.cmd == "release":
            return release(args.name, by=args.by, quote=args.quote, ledger=ledger)

        if args.cmd == "log":
            record_event(args.event, ledger=ledger, **parse_kv(args.field))
            print("recorded: %s" % args.event)
            return 0

        if args.cmd == "tail":
            entries = read_ledger(ledger)
            for entry in entries[-args.n:]:
                print(json.dumps(entry, ensure_ascii=False, sort_keys=True))
            if not entries:
                print("ledger empty.")
            return 0

    except (OSError, ValueError, RuntimeError) as exc:
        sys.stderr.write("ERROR: %s\n" % exc)
        return 2

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
