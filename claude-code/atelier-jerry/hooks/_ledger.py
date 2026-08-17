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

import contextlib
import importlib.util
import os
import sys

# realpath, not abspath: a hooks/ directory populated by per-file symlinks —
# stow, a hand-built .claude/hooks/ — leaves abspath pointing at a parent that
# has no scripts/ beside it, and the guard then silently sees no marks at all.
_HERE = os.path.dirname(os.path.realpath(__file__))
_SCRIPTS = os.path.join(os.path.dirname(_HERE), "scripts")
_TARGET = os.path.join(_SCRIPTS, "atelier_consent.py")

_CACHE = []


def _module():
    """`atelier_consent`, loaded BY FILE PATH, or None if it cannot be reached.

    By path rather than by name, deliberately. Importing by name loses to any
    other `atelier_consent` already on `sys.path` — a rogue on `PYTHONPATH`
    answered for the real one and the guard reported an empty ledger. Loading
    the exact file also keeps `sys.modules` clean and writes no `__pycache__`
    into a plugin tree that may be installed read-only.

    Nothing escapes this function. `BaseException`, not `Exception`, because a
    module-level `sys.exit()` in the target would otherwise take the hook — and
    a dying hook takes a person's session. Its stdout is redirected to stderr
    for the same reason in reverse: stdout is the decision channel, and a stray
    `print` at import time would make the JSON unparseable and lose the verdict.
    """
    if _CACHE:
        return _CACHE[0]
    module = None
    try:
        if os.path.isfile(_TARGET):
            spec = importlib.util.spec_from_file_location(
                "_atelier_consent_for_hooks", _TARGET)
            if spec and spec.loader:
                candidate = importlib.util.module_from_spec(spec)
                with contextlib.redirect_stdout(sys.stderr):
                    spec.loader.exec_module(candidate)
                module = candidate
    except BaseException:
        module = None
    _CACHE.append(module)
    return module


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
