#!/usr/bin/env python3
"""_ledger.py — the hooks' one door to the consent ledger.

Both hooks used to read the ledger themselves. That produced three readers of
one JSONL file with three field conventions, and two of them were wrong:

  · the guard looked for a key named `file`. No writer has ever produced one —
    `atelier_consent.record_event` writes `path`, the portal writes `source` /
    `filename` / `portal_filename`. The voiced-upload denial could never fire,
    and a guard that cannot see what it guards reports safety it does not have.

  · the status hook matched a release on `event == "released"`. A release is
    recorded as `{event: "held", status: "released"}` — a new entry, never an
    edit, so the ledger stays append-only. Every released gate came back at the
    next session start, with `why: released` printed as its reason.

Both are fixed by there being one reader. This module is that door: it imports
`atelier_consent` from the plugin's own `scripts/` and exposes exactly what a
hook needs. It never raises — a hook that dies takes a person's session with it —
and it reports the difference between *nothing is held* and *I could not look*,
because a check that cannot tell those apart always returns the one that lets
you keep moving.
"""

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_SCRIPTS = os.path.join(os.path.dirname(_HERE), "scripts")


def _module():
    """`atelier_consent`, or None if it cannot be reached from here."""
    if _SCRIPTS not in sys.path:
        sys.path.insert(0, _SCRIPTS)
    try:
        import atelier_consent  # noqa: F401
        return atelier_consent
    except Exception:
        return None


def ledger_path():
    """Where the ledger is, honouring $ATELIER_CONSENT_LEDGER as the tool does.

    Both hooks used to hardcode the XDG path and ignore that variable, so
    pointing the tool at another ledger silently disarmed them.
    """
    mod = _module()
    if mod is not None:
        try:
            return mod.ledger_path()
        except Exception:
            pass
    explicit = os.environ.get("ATELIER_CONSENT_LEDGER")
    if explicit:
        return explicit
    state = os.environ.get("XDG_STATE_HOME") or os.path.join(
        os.path.expanduser("~"), ".local", "state")
    return os.path.join(state, "atelier", "consent-ledger.jsonl")


def voiced_basenames():
    """Filenames marked as carrying his voice. `None` means: could not look."""
    mod = _module()
    if mod is None:
        return None
    try:
        return mod.voiced_basenames()
    except Exception:
        return None


def open_gates():
    """Gates still waiting on his word. `None` means: could not look."""
    mod = _module()
    if mod is None:
        return None
    try:
        return mod.open_gates()
    except Exception:
        return None


def ledger_exists():
    try:
        return os.path.isfile(ledger_path())
    except Exception:
        return False
