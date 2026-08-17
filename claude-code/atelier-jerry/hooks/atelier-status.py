#!/usr/bin/env python3
"""atelier-status.py — SessionStart hook. Prints the atelier's current reality.

It answers three questions an agent would otherwise assume the answer to:

  1. Which held gates are open — acts named and deliberately not done for want
     of a person's word. A gate lives in a ledger, never in scrollback, because
     scrollback scrolls.
  2. Which of the tools this plugin depends on are actually installed here.
     Declaring a runtime floor and failing loudly beats discovering it midway
     through someone's session.
  3. That hooks load at session start and do not hot-swap — so an edit to this
     plugin's hooks takes effect on the next session, not this one.

It never blocks and never fails the session: an unreadable ledger or a missing
binary is reported, not raised.
"""

import json
import os
import shutil
import sys

STATE = os.environ.get("XDG_STATE_HOME") or os.path.join(os.path.expanduser("~"), ".local", "state")
LEDGER = os.path.join(STATE, "atelier", "consent-ledger.jsonl")

# what the atelier needs, and what stops working without it
FLOORS = [
    ("abc2midi", "notation to MIDI — nothing renders"),
    ("abcm2ps", "the score; audio still works"),
    ("fluidsynth", "MIDI to audio — no timbre can be measured"),
    ("ffmpeg", "encoding, mixing, crops"),
    ("rubberband", "pitch-shifting a sample without stretching it"),
    ("rsvg-convert", "score images only"),
]


def held_gates():
    """Open gates, newest wins, releases removing their gate.

    The ledger written by scripts/atelier_consent.py keys its record type on
    `event`. `kind` is accepted too, so a ledger written by an older or a
    hand-rolled writer is still read rather than silently reported as empty —
    a check that cannot tell "nothing is held" from "I am reading the wrong
    field" will always return the answer that lets you keep moving.
    """
    out = []
    try:
        with open(LEDGER, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except ValueError:
                    continue
                what = rec.get("event") or rec.get("kind")
                if what == "held":
                    out = [g for g in out if g.get("name") != rec.get("name")]
                    out.append(rec)
                elif what in ("released", "release"):
                    out = [g for g in out if g.get("name") != rec.get("name")]
    except OSError:
        return None  # no ledger yet is not the same as no gates
    return out


def main():
    lines = ["atelier-jerry — current reality"]

    gates = held_gates()
    if gates is None:
        lines.append("  held gates: no ledger yet (nothing has been held on this machine)")
    elif not gates:
        lines.append("  held gates: none open")
    else:
        lines.append("  held gates — do not act on these without the person's word:")
        for g in gates:
            name = g.get("name", "?")
            why = g.get("why", "")
            quote = g.get("quote")
            lines.append("    - {}: {}".format(name, why))
            if quote:
                lines.append('        their words: "{}"'.format(quote))

    missing = [(b, why) for b, why in FLOORS if shutil.which(b) is None]
    if missing:
        lines.append("  missing tools:")
        for b, why in missing:
            lines.append("    - {} — {}".format(b, why))
    else:
        lines.append("  tools: all present")

    lines.append("  hooks load at session start and do not hot-swap — edits apply next session")

    sys.stdout.write("\n".join(lines) + "\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
