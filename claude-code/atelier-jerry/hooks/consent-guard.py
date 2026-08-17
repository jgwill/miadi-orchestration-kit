#!/usr/bin/env python3
"""consent-guard.py — the one refusal this atelier makes on its own.

PreToolUse hook on Bash. It denies exactly two shapes of command and lets
everything else through untouched:

  1. anything that calls a portal's /transcribe endpoint, because that ships a
     person's recorded voice to a third-party speech service;
  2. any upload of a file the consent ledger records as containing their voice,
     to a destination outside the studio it came from.

Why a hook and not guidance: guidance can be read and ignored, and the failure
it prevents is not recoverable. Once audio has left, it has left. Everything
else in this plugin is designed so an agent can move without asking — this is
the short list of what is not that.

The rule it enforces, in the musician's own words (2026-08-16):

    "I don't consent that my voice and my original recording goes outside of
     the boundary here."

    "it's really a great privilege to use this sound, nobody is authorized to
     use it without my consent."

Consent is not transitive: a yes for one piece is not a yes for the next.

DELIBERATELY NARROW. It does not police measuring, rendering, verifying,
publishing the agent's own renders, cropping on the person's own device, or any
local file operation. A guard that fires on ordinary work gets disabled, and a
disabled guard protects nothing.

Exit codes: 0 allow (silent). A denial is emitted as JSON on stdout so the
model is told why, in words it can act on.
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _ledger  # noqa: E402  — the single reader; see hooks/_ledger.py

# /transcribe on a Pixel Recorder composition clip, however the URL is spelled.
TRANSCRIBE = re.compile(r"/clips?/[^\s'\"]+/transcribe", re.I)

# an upload leaving the machine: curl -F/--form or -T/--upload-file to a URL
UPLOAD = re.compile(r"\bcurl\b[^\n|;]*?(?:-F|--form|-T|--upload-file)\b", re.I)


def deny(reason):
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        },
        sys.stdout,
    )
    sys.stdout.write("\n")
    sys.exit(0)


def voiced_files():
    """Filenames the ledger marks as carrying the person's voice.

    Delegates to `atelier_consent.voiced_basenames` through `hooks/_ledger.py`,
    which searches every key a writer in this atelier has ever used for a
    filename. This function used to look for a key named `file`; nothing has
    ever written one, so this denial could not fire. Fixed 2026-08-17.
    """
    names = _ledger.voiced_basenames()
    return set() if names is None else names


def main():
    try:
        event = json.load(sys.stdin)
    except (ValueError, OSError):
        sys.exit(0)  # unreadable event is not grounds to block a person's work

    if event.get("tool_name") != "Bash":
        sys.exit(0)

    command = (event.get("tool_input") or {}).get("command") or ""
    if not command:
        sys.exit(0)

    if TRANSCRIBE.search(command):
        deny(
            "Refused: this calls a studio's /transcribe endpoint, which sends a person's "
            "recorded voice to a third-party speech service. That is their action, not "
            "yours — the button is in their own room, or they give the word for this "
            "specific take. Record it with:\n"
            "  python3 \"${CLAUDE_PLUGIN_ROOT}/scripts/atelier_consent.py\" held "
            "transcribe-<file> --why 'ships their voice to a third party'\n"
            "Their standing words: \"I don't consent that my voice and my original "
            "recording goes outside of the boundary here.\" Consent is not transitive."
        )

    if UPLOAD.search(command):
        hits = [n for n in voiced_files() if n and n in command]
        if hits:
            deny(
                "Refused: this uploads "
                + ", ".join(sorted(hits))
                + ", which the consent ledger records as carrying their voice. Their MIDI "
                "is the offered part; the voice is not, and derived work built from it "
                "inherits the same rule.\n"
                "If they have given the word for this file, record it first:\n"
                "  python3 \"${CLAUDE_PLUGIN_ROOT}/scripts/atelier_consent.py\" release "
                "<name> --by <who> --quote '<their words>'"
            )

    sys.exit(0)


if __name__ == "__main__":
    main()
