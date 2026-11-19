#!/usr/bin/env python3
"""Images a person attached to a prompt, kept in the session folder (0.1.50).

    user_images.py capture <transcript> <output_dir>
        Write every image attached to a prompt of <transcript> that <output_dir> does not
        hold yet.
    user_images.py wait <transcript> <prompt_id> [seconds]
        Return when the prompt's line is in <transcript>, or after [seconds] (60).

The UserPromptSubmit hook is given the prompt's text only. Claude Code keeps an attached
image twice: as a base64 block in the prompt's line of the transcript, and, for an image
uploaded from the app or the web (~/.claude/uploads/<session_id>/) or given as a file, as the
file named in the `inlined_image_paths` attachment written after that line, in display order.
The transcript copy may be downscaled for the model: of the 14 photos Guillaume sent from the
iOS app on 2026-11-19, the last one was 357,156 bytes uploaded and 234,840 in the transcript.

Each image goes to images/<prompt_id>/<NN>-<name> in the session folder, from the named file
while it still exists, else from the transcript, and gets one line in _claude_images.jsonl.
An image inside a tool result (a Read of a picture, a browser screenshot) was not attached by
the person and is left out, as are subagent and meta lines. A partial last line waits for the
next call. Running it again writes nothing it already holds.
"""
import base64
import binascii
import hashlib
import json
import mimetypes
import os
import re
import sys
import time
from datetime import datetime, timezone

INDEX = "_claude_images.jsonl"
EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp"}


def complete_lines(path):
    """The complete lines of a JSONL file Claude Code appends to."""
    try:
        with open(path, "rb") as handle:
            for raw in handle:
                if not raw.endswith(b"\n"):
                    return
                yield raw
    except OSError:
        return


def scan(transcript):
    """(line, image blocks) for each prompt carrying images, and the named files by message uuid."""
    prompts, named = [], {}
    for raw in complete_lines(transcript):
        if b'"inlined_image_paths"' in raw:
            try:
                line = json.loads(raw)
            except ValueError:
                continue
            attachment = line.get("attachment") or {}
            if line.get("type") == "attachment" and attachment.get("type") == "inlined_image_paths":
                named[line.get("parentUuid")] = [p for p in attachment.get("paths") or [] if isinstance(p, str)]
        elif b'"type":"image"' in raw and b'"type":"user"' in raw:
            try:
                line = json.loads(raw)
            except ValueError:
                continue
            if line.get("type") != "user" or line.get("isSidechain") or line.get("isMeta"):
                continue
            content = (line.get("message") or {}).get("content")
            if not isinstance(content, list):
                continue
            images = [b for b in content if isinstance(b, dict) and b.get("type") == "image"]
            if images:
                prompts.append((line, images))
    return prompts, named


def held(index_path):
    keys = set()
    for raw in complete_lines(index_path):
        try:
            line = json.loads(raw)
        except ValueError:
            continue
        keys.add((line.get("message_uuid"), line.get("index")))
    return keys


def safe(name):
    return re.sub(r"[^A-Za-z0-9._-]", "_", name or "") or "unknown"


def write_atomic(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = "%s.tmp.%d" % (path, os.getpid())
    with open(tmp, "wb") as handle:
        handle.write(data)
    os.replace(tmp, path)


def capture(transcript, output_dir):
    prompts, named = scan(transcript)
    if not prompts:
        return 0
    index_path = os.path.join(output_dir, INDEX)
    keys = held(index_path)
    written = 0
    for line, images in prompts:
        uuid = line.get("uuid")
        prompt_id = line.get("promptId") or uuid
        files = named.get(uuid) or []
        # The named files follow the images in display order. When their counts differ,
        # which file is which image is not known, and the transcript copies are kept.
        if len(files) != len(images):
            files = []
        folder = os.path.join("images", safe(prompt_id))
        for n, block in enumerate(images, 1):
            if (uuid, n) in keys:
                continue
            source = block.get("source") or {}
            media_type = source.get("media_type")
            original = files[n - 1] if files else None
            data, kept_from = None, None
            if original and os.path.isfile(original):
                try:
                    with open(original, "rb") as handle:
                        data = handle.read()
                    kept_from = "file"
                    name = os.path.basename(original)
                    media_type = mimetypes.guess_type(original)[0] or media_type
                except OSError:
                    data = None
            if data is None and source.get("type") == "base64":
                try:
                    data = base64.b64decode(source.get("data") or "", validate=False)
                    kept_from = "transcript"
                    name = "image.%s" % EXTENSIONS.get(media_type, "bin")
                except (binascii.Error, ValueError):
                    data = None
            record = {
                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "session_id": line.get("sessionId"),
                "prompt_id": line.get("promptId"),
                "message_uuid": uuid,
                "prompted_at": line.get("timestamp"),
                "index": n,
                "count": len(images),
                "media_type": media_type,
                "kept_from": kept_from,
                "original": original,
                "entrypoint": line.get("entrypoint"),
                "prompt_source": line.get("promptSource"),
            }
            if data is None:
                # A url or file block, or base64 that does not decode: listed, nothing copied.
                record.update({"path": None, "bytes": None, "sha256": None,
                               "note": "not copied: source type %s" % source.get("type"),
                               "url": source.get("url")})
            else:
                rel = os.path.join(folder, "%02d-%s" % (n, safe(name)))
                write_atomic(os.path.join(output_dir, rel), data)
                record.update({"path": rel, "bytes": len(data),
                               "sha256": hashlib.sha256(data).hexdigest()})
            with open(index_path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(record, ensure_ascii=False) + "\n")
            keys.add((uuid, n))
            written += 1
    return written


def wait(transcript, prompt_id, seconds):
    needle = ('"promptId":"%s"' % prompt_id).encode()
    deadline = time.time() + seconds
    while time.time() < deadline:
        for raw in complete_lines(transcript):
            if needle in raw and b'"type":"user"' in raw:
                # The inlined_image_paths line is written right after the prompt's line.
                time.sleep(1)
                return True
        time.sleep(1)
    return False


def main(argv):
    if len(argv) >= 3 and argv[0] == "capture":
        capture(argv[1], argv[2])
        return 0
    if len(argv) >= 3 and argv[0] == "wait":
        seconds = float(argv[3]) if len(argv) > 3 else 60.0
        return 0 if wait(argv[1], argv[2], seconds) else 1
    sys.stderr.write(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
