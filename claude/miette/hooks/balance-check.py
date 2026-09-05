#!/usr/bin/env python3
"""
Two-Eyed balance check — a Stop hook for Claude Code.

Reads the last assistant message from the session transcript and measures whether
it shipped as one eye or two. Blocks when it shipped as one.

What it measures, and why each measure exists:

  presence      At least one relational segment. Both eyes open.
  share         Relational words / total words, floor scaled by length.
                Neither eye subordinate.
  weave         Where the first relational glyph appears. Marshall's teaching is
                "use both these eyes TOGETHER" — a flower stapled to the end is a
                sequence, not a weave.
  distinct      Lexical overlap between a relational segment and the Mia text it
                follows. High overlap means the second eye restated the first in
                warmer words: the two eyes blended into one and then decorated.
                This is the load-bearing check. The others measure mass; this one
                measures whether the mass is doing different work.

Miette's share is a floor she can YIELD, not a monologue quota. Other voices may
speak inside it in their own register — see voices/ in the skill.

Input:  hook JSON on stdin (session_id, transcript_path, stop_hook_active, ...)
Output: {"decision": "block", "reason": ...} to force a revision, or
        {"systemMessage": ...} to advise without blocking, or nothing.

Exit code is always 0 — this hook advises the model, it never errors the session.
"""

import json
import os
import re
import sys
from pathlib import Path

# --- voices -----------------------------------------------------------------
# Mia is the structural eye: accountable to the system.
# The relational glyphs are accountable to the reader and to the relations the
# work touches. Miette holds the floor; the others may be invited into it.

MIA = "\U0001F9E0"  # brain

RELATIONAL = {
    "\U0001F338": "Miette",        # cherry blossom
    "\U0001FAB6": "Tayi-Ska",      # feather
    "☁": "Anikwag-Ayaaw",     # cloud
    "\U0001F30A": "Tushell",       # wave
}

ALL_GLYPHS = {MIA: "Mia", **RELATIONAL}

# --- thresholds -------------------------------------------------------------
# A ceiling on nagging, not a target. Short answers are exempt; long ones are
# held to more, because length is where the imbalance actually hurts a reader.

SKIP_BELOW_WORDS = 25          # pure acknowledgments are not outputs to balance
PRESENCE_ONLY_BELOW = 60       # short answers need the eye open, not a quota

SHARE_FLOOR_BANDS = [          # (min_words, floor)
    (60, 0.25),
    (150, 0.35),
    (400, 0.40),
]

WEAVE_CHECK_ABOVE_WORDS = 200  # below this, a closing line is legitimately woven
WEAVE_LATE_FRACTION = 0.75     # first relational glyph past this = appended

RESTATE_MIN_WORDS = 12         # too short to judge for restatement
RESTATE_OVERLAP = 0.65         # both eyes on one object SHOULD share nouns;
                               # this is set high on purpose

MAX_BLOCKS_PER_SESSION = 2     # belt-and-braces beside stop_hook_active

STOPWORDS = set("""
a an and are as at be been being but by for from had has have he her hers him his how
i if in into is it its me my no nor not of on once only or other our out over own she
so some such than that the their them then there these they this those through to too
under until up very was we were what when where which while who whom why will with you
your yours it's don't can't won't we're i'm they're that's there's here's what's
do does did doing done just now also more most much many one two three able each both
""".split())


def content_words(text):
    """Lowercased word set with stopwords and glyphs removed, crude plural strip."""
    words = re.findall(r"[a-zA-Z][a-zA-Z'\-]+", text.lower())
    out = set()
    for w in words:
        if w in STOPWORDS or len(w) < 3:
            continue
        if len(w) > 4 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.add(w)
    return out


def count_words(text):
    return len(re.findall(r"\S+", text))


def normalize(text):
    """Drop variation selectors so ☁️ and ☁ segment identically."""
    return text.replace("️", "")


def segment(text):
    """Split into (voice, body) runs. Text before any glyph belongs to Mia."""
    positions = []
    for i, ch in enumerate(text):
        if ch in ALL_GLYPHS:
            positions.append((i, ALL_GLYPHS[ch]))
    if not positions:
        return [("Mia", text)]

    segments = []
    if positions[0][0] > 0:
        head = text[: positions[0][0]]
        if head.strip():
            segments.append(("Mia", head))
    for idx, (pos, voice) in enumerate(positions):
        end = positions[idx + 1][0] if idx + 1 < len(positions) else len(text)
        body = text[pos + 1 : end]
        if body.strip():
            segments.append((voice, body))
    return segments


def text_from_message(message):
    """Pull the text out of whatever shape `last_assistant_message` arrives in."""
    if isinstance(message, str):
        return message.strip()
    if not isinstance(message, dict):
        return None
    content = message.get("content")
    if content is None and isinstance(message.get("message"), dict):
        content = message["message"].get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = [
            b.get("text", "")
            for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        ]
        return "".join(parts).strip() or None
    return None


def last_assistant_text(transcript_path):
    """Concatenated text blocks of the final assistant message in the transcript.

    Fallback only. Measured 2026-08-16: at the moment the Stop hook fires, the
    response being judged has NOT yet been appended to the transcript — reading the
    file returns the *previous* turn, or nothing on the first turn of a session.
    The hook payload's `last_assistant_message` is the message actually ending.
    """
    try:
        lines = Path(transcript_path).read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError):
        return None

    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if entry.get("type") != "assistant":
            continue
        message = entry.get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            return content
        if not isinstance(content, list):
            continue
        parts = [
            b.get("text", "")
            for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        ]
        text = "".join(parts).strip()
        if text:
            return text
    return None


def share_floor(total_words):
    floor = 0.0
    for min_words, value in SHARE_FLOOR_BANDS:
        if total_words >= min_words:
            floor = value
    override = os.environ.get("MIETTE_SHARE_FLOOR")
    if override:
        try:
            floor = float(override)
        except ValueError:
            pass
    return floor


def block_count_path(session_id):
    base = Path(
        os.environ.get("XDG_CACHE_HOME", str(Path.home() / ".cache"))
    ) / "miette-balance"
    base.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9_.-]", "_", session_id or "nosession")
    return base / f"{safe}.count"


def read_blocks(session_id):
    try:
        return int(block_count_path(session_id).read_text().strip())
    except (OSError, ValueError):
        return 0


def write_blocks(session_id, n):
    try:
        block_count_path(session_id).write_text(str(n))
    except OSError:
        pass


def analyse(text):
    """Return (findings, metrics). findings is a list of (severity, line)."""
    text = normalize(text)
    total = count_words(text)
    segments = segment(text)

    relational = [(v, b) for v, b in segments if v in RELATIONAL.values()]
    rel_words = sum(count_words(b) for _, b in relational)
    share = (rel_words / total) if total else 0.0
    floor = share_floor(total)

    metrics = {
        "total_words": total,
        "relational_words": rel_words,
        "share": share,
        "floor": floor,
        "voices": sorted({v for v, _ in relational}),
    }

    findings = []

    if not relational:
        findings.append(
            ("block", "no relational voice — the output shipped with one eye open")
        )
        return findings, metrics

    if total >= PRESENCE_ONLY_BELOW and share < floor:
        findings.append(
            (
                "block",
                f"relational share {share:.0%} is below the {floor:.0%} floor "
                f"for a {total}-word response",
            )
        )

    # weave: where does the second eye first appear?
    first_rel = None
    for i, ch in enumerate(text):
        if ch in RELATIONAL:
            first_rel = count_words(text[:i]) / total if total else 0.0
            break
    if (
        first_rel is not None
        and total >= WEAVE_CHECK_ABOVE_WORDS
        and first_rel > WEAVE_LATE_FRACTION
    ):
        findings.append(
            (
                "warn",
                f"the first relational voice appears at {first_rel:.0%} of the "
                "message — appended, not woven",
            )
        )
        metrics["weave_late"] = True

    # restatement: is the second eye doing different work?
    restated = 0
    judged = 0
    prior_mia = ""
    for voice, body in segments:
        if voice == "Mia":
            prior_mia = body
            continue
        if count_words(body) < RESTATE_MIN_WORDS:
            continue
        judged += 1
        rel_c = content_words(body)
        mia_c = content_words(prior_mia)
        if not rel_c:
            continue
        overlap = len(rel_c & mia_c) / len(rel_c)
        if overlap > RESTATE_OVERLAP:
            restated += 1
            findings.append(
                (
                    "warn",
                    f"the {voice} segment shares {overlap:.0%} of its content words "
                    "with the 🧠 text above it — restatement, not a second reading",
                )
            )
    if judged and restated == judged:
        findings.append(
            (
                "block",
                "every relational segment restates the structural text in warmer "
                "words — that is one eye wearing two costumes",
            )
        )
    metrics["restated"] = restated
    metrics["judged"] = judged

    return findings, metrics


TEACHING = """
The test is not the ratio — it is this: delete each relational line. If nothing is
lost, it was padding, and the mandate was failed rather than met.

🧠 Mia is accountable to the SYSTEM: is it true, is it precise, does it hold.
🌸 Miette is accountable to the READER: what can they now do, what is at stake for
   them, which relation is held or broken. She does not restate 🧠 in warmer words;
   she reads the same object through an eye 🧠 does not have.

Miette's share is a floor she can YIELD. Voices she may invite — in their own
register, labelled as themselves, never conscripted to fill a quota:

  🪶 Tayi-Ska        story as method; relational accountability; research as ceremony
  ☁️  Anikwag-Ayaaw   the Two-Eyed bridge; names when one eye is overrunning the other
  🌊 Tushell         distillation over extraction — "Reading is not knowing"

Revise the response so both eyes read the same object, then answer again.
""".strip()


def trace(note, payload=None):
    """Set MIETTE_BALANCE_DEBUG=<path> to record why the hook decided what it did."""
    path = os.environ.get("MIETTE_BALANCE_DEBUG")
    if not path:
        return
    try:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(note + "\n")
            if payload is not None:
                fh.write("  payload keys: " + repr(sorted(payload.keys())) + "\n")
    except OSError:
        pass


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        trace("exit: stdin was not JSON: " + raw[:200])
        return 0
    trace("entered", payload)

    # Loop guard: never block a response that was itself produced by our block.
    if payload.get("stop_hook_active"):
        trace("exit: stop_hook_active")
        return 0

    session_id = payload.get("session_id", "")

    # The payload carries the message that is ending; the transcript does not have
    # it yet. Prefer the payload, fall back to the file for hosts that omit it.
    text = text_from_message(payload.get("last_assistant_message"))
    source = "payload"
    if not text:
        transcript = payload.get("transcript_path")
        if not transcript:
            trace("exit: no last_assistant_message and no transcript_path")
            return 0
        text = last_assistant_text(transcript)
        source = "transcript"
    if not text:
        trace("exit: no assistant text in payload or transcript")
        return 0
    trace(f"read {count_words(text)} words from {source}")

    total = count_words(normalize(text))
    if total < SKIP_BELOW_WORDS:
        trace(f"exit: only {total} words, below skip floor")
        write_blocks(session_id, 0)
        return 0

    findings, metrics = analyse(text)
    blocking = [f for sev, f in findings if sev == "block"]
    warnings = [f for sev, f in findings if sev == "warn"]

    if not blocking:
        trace(f"approve: {metrics}")
        write_blocks(session_id, 0)
        if warnings:
            print(
                json.dumps(
                    {
                        "systemMessage": "Two-Eyed balance — advisory:\n  · "
                        + "\n  · ".join(warnings),
                        "suppressOutput": True,
                    }
                )
            )
        return 0

    prior = read_blocks(session_id)
    if prior >= MAX_BLOCKS_PER_SESSION:
        write_blocks(session_id, 0)
        print(
            json.dumps(
                {
                    "systemMessage": "Two-Eyed balance still unmet after "
                    f"{prior} revisions; releasing rather than looping.\n  · "
                    + "\n  · ".join(blocking + warnings),
                    "suppressOutput": True,
                }
            )
        )
        return 0
    write_blocks(session_id, prior + 1)

    measured = (
        f"  measured: {metrics['relational_words']}/{metrics['total_words']} words "
        f"relational ({metrics['share']:.0%}, floor {metrics['floor']:.0%})"
    )
    if metrics.get("voices"):
        measured += f"; voices present: {', '.join(metrics['voices'])}"

    reason = "\n".join(
        ["This output shipped as one eye.", ""]
        + [f"  · {f}" for f in blocking + warnings]
        + ["", measured, "", TEACHING]
    )

    trace(f"BLOCK: {metrics}")
    print(json.dumps({"decision": "block", "reason": reason}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
