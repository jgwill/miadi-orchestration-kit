#!/usr/bin/env python3
"""Render YouTube JSON3 or local ASR JSON without rewriting transcript words."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path


def timestamp(milliseconds):
    seconds, ms = divmod(round(milliseconds), 1000)
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    return (f"{hours:02d}:" if hours else "") + f"{minutes:02d}:{seconds:02d}.{ms:03d}"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--source", required=True, help="Original video URL")
    parser.add_argument("--kind", required=True, choices=["youtube-auto", "youtube-manual", "local-asr"])
    parser.add_argument("--out", required=True, type=Path, help="Output stem, e.g. /evidence/transcript")
    args = parser.parse_args()
    raw = args.input.read_bytes()
    payload = json.loads(raw)
    rows = []
    events = payload["segments"] if args.kind == "local-asr" else payload["events"]
    for event in events:
        if args.kind == "local-asr":
            text = " ".join(event["text"].split())
            start = event["start"] * 1000
        else:
            text = " ".join("".join(part.get("utf8", "") for part in event.get("segs", [])).split())
            start = event.get("tStartMs")
        if text:
            if not isinstance(start, (int, float)) or not math.isfinite(start) or start < 0:
                parser.error("Caption timestamps must be finite, nonnegative numbers")
            rows.append((start, text))
    if not rows:
        parser.error("No transcript text found; no output written")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.with_suffix(".txt").write_text("\n".join(text for _, text in rows) + "\n", encoding="utf-8")
    header = f"# Transcript\n\nSource: {args.source}\n\nKind: {args.kind}; not human-verified.\n\n"
    args.out.with_suffix(".timestamped.md").write_text(
        header + "\n\n".join(f"[{timestamp(start)}] {text}" for start, text in rows) + "\n", encoding="utf-8")
    receipt = {"source_url": args.source, "kind": args.kind, "source_file": str(args.input.resolve()),
               "source_sha256": hashlib.sha256(raw).hexdigest(), "segments": len(rows),
               "rendered_at": datetime.now(timezone.utc).isoformat()}
    args.out.with_suffix(".provenance.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"Rendered {len(rows)} segments to {args.out}.txt and {args.out}.timestamped.md")


if __name__ == "__main__":
    main()
