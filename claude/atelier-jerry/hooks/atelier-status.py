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

import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _ledger  # noqa: E402  — the single reader; see hooks/_ledger.py

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
    """Open gates, read through the one reader in `hooks/_ledger.py`.

    Returns `None` when the ledger could not be read at all — which is not the
    same as no gates, and must not be reported as if it were.

    This function used to read the file itself and match a release on
    `event == "released"`. A release is written as
    `{event: "held", status: "released"}`, so every released gate came back at
    the next session start with `why: released` as its reason, while the tool
    correctly reported none open. Fixed 2026-08-17 by deleting the second
    reader rather than teaching it the convention.
    """
    return _ledger.open_gates()


def main():
    lines = ["atelier-jerry — current reality"]

    gates = held_gates()
    if gates is None:
        if _ledger.ledger_exists():
            lines.append("  held gates: COULD NOT READ the ledger at %s" % _ledger.ledger_path())
            lines.append("    this is not 'none open' — assume a gate is held until it is read")
        else:
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
