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

# ── what carries a file off this machine ────────────────────────────────────
#
# The old matcher knew only `curl -F` and then substring-tested the WHOLE
# command for a voiced basename. Both halves were wrong, and an adversarial
# review broke each:
#
#   · the plugin's OWN publish path is `atelier_portal.py import`, and it was
#     invisible. The one act this hook exists to refuse had a first-class
#     in-plugin command that walked straight past it.
#   · a backslash-continued curl — the ordinary way to write a multipart POST —
#     was missed, because the pattern excluded newline.
#   · substring-testing the command denied `--label "derived from <voiced>"`,
#     denied running `check-publish` in the same Bash call as a publish, and
#     denied a `grep` for the name. Doing it right got you refused.
#
# So: find the ARGUMENTS that name a file being sent, and test only those.
#
# `re.S` so a `\`-continued command is one command. Each pattern captures the
# path in group 1.
_SENDERS = [
    # curl -F field=@path · --form · -T path · --upload-file · --data-binary @path · -d @path
    (r"curl\b", r"(?:-F|--form)\s+[\'\"]?[^\s=\'\"]*=@([^\s\'\";|&]+)"),
    (r"curl\b", r"(?:-T|--upload-file)\s+[\'\"]?([^\s\'\";|&]+)"),
    (r"curl\b", r"(?:--data-binary|--data|-d)\s+[\'\"]?@([^\s\'\";|&]+)"),
    # the plugin's own uploader, and the portal API by any client
    (r"atelier_portal\.py", r"\bimport\s+[\'\"]?([^\s\'\"-][^\s\'\";|&]*)"),
    (r"atelier_portal\.py", r"\badd-image\s+\S+\s+[\'\"]?([^\s\'\";|&]+)"),
    # other clients that put a file on a wire
    (r"\bwget\b", r"--post-file[= ][\'\"]?([^\s\'\";|&]+)"),
    (r"\bhttpie?\b|\bhttp\b", r"\w+@([^\s\'\";|&]+)"),
    (r"\bscp\b|\brsync\b|\brclone\b", r"(?:^|\s)([^\s\'\";|&-][^\s\'\";|&]*)\s+\S+:"),
    (r"\baws\b.*\bs3\b", r"\bcp\s+[\'\"]?([^\s\'\";|&]+)"),
]
_SENDERS = [(re.compile(tool, re.I), re.compile(arg, re.I | re.S)) for tool, arg in _SENDERS]


def sent_files(command):
    """Basenames of every file this command hands to something off-machine.

    Only the argument that names the payload — never the whole command line —
    so a label, a comment, a grep pattern or a sibling check-publish call
    cannot be mistaken for the thing being sent.
    """
    names = set()
    for tool, arg in _SENDERS:
        if not tool.search(command):
            continue
        for match in arg.finditer(command):
            value = (match.group(1) or "").strip("\'\"")
            if value and "://" not in value:
                names.add(os.path.basename(value.rstrip("/")))
    return names


def _decide(decision, reason):
    json.dump(
        {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": decision,
                "permissionDecisionReason": reason,
            }
        },
        sys.stdout,
    )
    sys.stdout.write("\n")
    sys.exit(0)


def deny(reason):
    _decide("deny", reason)


def ask(reason):
    """Hand the decision to the person. Used when the ledger cannot be read:
    an unreadable ledger is not evidence of consent, and it is not evidence of
    its absence either."""
    _decide("ask", reason)


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

    sent = sent_files(command)
    if sent:
        marked = _ledger.voiced_basenames()
        if marked is None:
            # The ledger could not be read. "Nothing is marked" and "I could not
            # look" are different answers and must not share an idiom — that is
            # the whole reason hooks/_ledger.py returns None. Blocking outright
            # would fire on ordinary work and get this guard switched off;
            # allowing silently is how a recording leaves without anyone
            # deciding. So: hand the decision to the person.
            ask(
                "This command sends %s off this machine, and I could not read the "
                "consent ledger at %s — so I cannot tell whether any of it carries "
                "their voice.\n"
                "Their standing words: \"I don't consent that my voice and my original "
                "recording goes outside of the boundary here.\"\n"
                "You decide. To settle it first:\n"
                "  python3 \"${CLAUDE_PLUGIN_ROOT}/scripts/atelier_consent.py\" "
                "check-publish <file>"
                % (", ".join(sorted(sent)), _ledger.ledger_path())
            )
        hits = sorted(sent & marked)
        if hits:
            deny(
                "Refused: this sends "
                + ", ".join(hits)
                + " off this machine, and the consent ledger records it as carrying "
                "their voice. Their MIDI is the offered part; the voice is not, and "
                "derived work built from it inherits the same rule.\n"
                "If they have given the word FOR THIS FILE, record it and the refusal "
                "lifts:\n"
                "  python3 \"${CLAUDE_PLUGIN_ROOT}/scripts/atelier_consent.py\" clear "
                "<file> --by <who> --quote '<their words>'\n"
                "Consent is not transitive: that clears one file, not the next one."
            )

    sys.exit(0)


if __name__ == "__main__":
    main()
