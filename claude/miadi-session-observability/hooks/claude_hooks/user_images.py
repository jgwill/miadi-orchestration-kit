#!/usr/bin/env python3
"""Images a person attached to a prompt, kept in the session folder (0.1.50, layout 2 since 0.1.52).

    user_images.py capture <transcript> <output_dir>
        Write every image attached to a prompt of <transcript> that <output_dir> does not
        hold yet. A transcript whose size and mtime are those of the last pass is not read.
    user_images.py wait <transcript> <prompt_id> [seconds]
        Return when the prompt's line is in <transcript>, or after [seconds] (60). The file is
        read whole once, then only the bytes added since.

The UserPromptSubmit hook is given the prompt's text only. Claude Code keeps an attached
image twice: as a base64 block on the prompt's line of the transcript, and, for an image
uploaded from the app or the web (~/.claude/uploads/<session_id>/) or given as a file, as the
file named in an `inlined_image_paths` attachment line, in display order. That attachment's
parentUuid is the prompt's line, or another attachment line that hangs under it (a
`total_tokens_reminder` in 24 of 42 cases on gaia, 2026-11-19), so the chain is followed back.
The transcript copy may be downscaled for the model: of the 14 photos Guillaume sent from the
iOS app on 2026-11-19, the last one was 357,156 bytes uploaded and 234,840 in the transcript.

Layout 2. Each image goes to images/<message_uuid>/<NN>-<name>, one folder per transcript line,
because one prompt id can sit on many lines: a forked session's copied history carries one id
on every copied prompt (27 lines in e1c06072), and queued messages share one. Each image gets
one line in _claude_images.jsonl with the prompt's id, the start of the line's text
(`prompt_text`) and how many lines carry that id (`prompt_lines`), so a reader joins an image to
the prompt that sent it and not to every prompt with the same id. An image is kept from the
named file while it exists, else decoded from the transcript, strictly: base64 the secret
sanitizer changed in the archived copy is listed, not written as broken bytes.

An image on a slash command's expansion line (isMeta, with the same prompt id as the person's
command line) was the person's and is kept. An image inside a tool result (a Read of a picture,
a browser screenshot) was not attached by the person and is left out, as are subagent lines. A
partial last line waits for the next call. Running it again writes nothing it already holds.

A session folder written in layout 1 (images/<prompt_id>/, 0.1.50 and 0.1.51) is moved to
images/v1/ with its index as images/v1/index.jsonl, and captured again in layout 2.
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
STATE = ".images.state"
LAYOUT = 2
TEXT_CHARS = 200
EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp"}
UUID_FIELD = re.compile(rb'"uuid":"([0-9A-Za-z-]{8,64})"')
PARENT_FIELD = re.compile(rb'"parentUuid":"([0-9A-Za-z-]{8,64})"')


def complete_lines(path, start=0):
    """(end offset, line) for each complete line from <start> of a file Claude Code appends to."""
    try:
        with open(path, "rb") as handle:
            handle.seek(start)
            offset = start
            for raw in handle:
                if not raw.endswith(b"\n"):
                    return
                offset += len(raw)
                yield offset, raw
    except OSError:
        return


def text_of(content):
    """The text a person typed on a prompt line: a slash command as `/name args`."""
    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        text = "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    else:
        return ""
    name = re.search(r"<command-name>(.*?)</command-name>", text, re.S)
    if name:
        args = re.search(r"<command-args>(.*?)</command-args>", text, re.S)
        text = ("%s %s" % (name.group(1).strip(), args.group(1).strip() if args else "")).strip()
    return " ".join(text.split())[:TEXT_CHARS]


def attachment_ids(raw):
    """(uuid, parentUuid) of an attachment line, without parsing a large one whole."""
    if len(raw) < 262144:
        try:
            line = json.loads(raw)
            return line.get("uuid"), line.get("parentUuid")
        except ValueError:
            return None, None
    parent = PARENT_FIELD.search(raw[:512])
    uuids = UUID_FIELD.findall(raw)
    return (uuids[-1].decode() if uuids else None), (parent.group(1).decode() if parent else None)


def scan(transcript):
    """The image lines of a person's prompts, in transcript order, with what the reader needs."""
    image_lines, named, attachment_parent = [], {}, {}
    human_lines = {}     # promptId -> [(order, text)] of the person's own lines
    order = 0
    for _, raw in complete_lines(transcript):
        order += 1
        if b'"type":"attachment"' in raw and b'"type":"user"' not in raw:
            uuid, parent = attachment_ids(raw)
            if uuid:
                attachment_parent[uuid] = parent
            if b'"inlined_image_paths"' in raw:
                try:
                    line = json.loads(raw)
                except ValueError:
                    continue
                attachment = line.get("attachment") or {}
                if line.get("type") == "attachment" and attachment.get("type") == "inlined_image_paths":
                    named[line.get("uuid")] = [p for p in attachment.get("paths") or [] if isinstance(p, str)]
            continue
        if b'"type":"user"' not in raw:
            continue
        has_image = b'"type":"image"' in raw
        if not has_image and (b'"tool_use_id"' in raw or b'"isMeta":true' in raw):
            continue
        try:
            line = json.loads(raw)
        except ValueError:
            continue
        if line.get("type") != "user" or line.get("isSidechain"):
            continue
        content = (line.get("message") or {}).get("content")
        prompt_id = line.get("promptId")
        if not line.get("isMeta") and not (isinstance(content, list) and any(
                isinstance(b, dict) and b.get("type") == "tool_result" for b in content)):
            human_lines.setdefault(prompt_id, []).append((order, text_of(content)))
        if not has_image or not isinstance(content, list):
            continue
        images = [b for b in content if isinstance(b, dict) and b.get("type") == "image"]
        if images:
            image_lines.append((order, line, images))

    # An inlined_image_paths line hangs under the prompt's line, or under attachments that do.
    by_line = {}
    for attachment_uuid, paths in named.items():
        parent, seen = attachment_parent.get(attachment_uuid), set()
        while parent in attachment_parent and parent not in seen:
            seen.add(parent)
            parent = attachment_parent[parent]
        if parent:
            by_line[parent] = paths

    prompts = []
    for order, line, images in image_lines:
        prompt_id = line.get("promptId")
        mine = human_lines.get(prompt_id, [])
        if line.get("isMeta"):
            # A slash command's expansion: the person's line is the command line before it.
            before = [t for o, t in mine if o < order]
            if not before:
                continue
            text = before[-1]
        else:
            text = text_of((line.get("message") or {}).get("content"))
        prompts.append((line, images, by_line.get(line.get("uuid")) or [], text, len(mine)))
    return prompts


def read_index(index_path):
    """The keys the index holds and the layout its first line declares (1 when none does)."""
    keys, layout, first = set(), None, True
    for _, raw in complete_lines(index_path):
        try:
            line = json.loads(raw)
        except ValueError:
            continue
        if first:
            layout = line.get("layout") or 1
            first = False
        keys.add((line.get("message_uuid"), line.get("index")))
    return keys, layout


def safe(name):
    return re.sub(r"[^A-Za-z0-9._-]", "_", name or "") or "unknown"


def write_atomic(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = "%s.tmp.%d" % (path, os.getpid())
    with open(tmp, "wb") as handle:
        handle.write(data)
    os.replace(tmp, path)


def append_line(path, record):
    """Append one JSON line, after a newline if a killed pass left a partial one."""
    with open(path, "ab+") as handle:
        handle.seek(0, os.SEEK_END)
        if handle.tell() > 0:
            handle.seek(-1, os.SEEK_END)
            if handle.read(1) != b"\n":
                handle.write(b"\n")
        handle.write((json.dumps(record, ensure_ascii=False) + "\n").encode("utf-8"))


def move_layout_1(output_dir):
    """Layout 1 (images/<prompt_id>/) goes to images/v1/, kept, never deleted."""
    index_path = os.path.join(output_dir, INDEX)
    images_dir = os.path.join(output_dir, "images")
    v1 = os.path.join(images_dir, "v1")
    os.makedirs(v1, exist_ok=True)
    for name in os.listdir(images_dir) if os.path.isdir(images_dir) else []:
        if name != "v1" and not os.path.exists(os.path.join(v1, name)):
            os.replace(os.path.join(images_dir, name), os.path.join(v1, name))
    target = os.path.join(v1, "index.jsonl")
    if os.path.exists(target):
        target = os.path.join(v1, "index.%d.jsonl" % int(time.time()))
    os.replace(index_path, target)


def source_stamp(transcript):
    """The state line, and the transcript's mtime when the pass starts."""
    try:
        st = os.stat(transcript)
    except OSError:
        return None, None
    return "%d %d %d %s" % (LAYOUT, st.st_size, st.st_mtime_ns, transcript), st.st_mtime_ns


def capture(transcript, output_dir):
    stamp, mtime_ns = source_stamp(transcript)
    if stamp is None:
        return 0
    state_path = os.path.join(output_dir, STATE)
    index_path = os.path.join(output_dir, INDEX)
    try:
        with open(state_path) as handle:
            if handle.read().strip() == stamp:
                os.utime(state_path, ns=(mtime_ns, mtime_ns))
                return 0
    except OSError:
        pass
    keys, layout = read_index(index_path)
    if layout is not None and layout < LAYOUT:
        move_layout_1(output_dir)
        keys = set()
    from_archive = os.path.basename(transcript) == "_transcript_final.jsonl"
    written = 0
    for line, images, files, text, prompt_lines in scan(transcript):
        uuid = line.get("uuid")
        # The named files follow the images in display order. When their counts differ,
        # which file is which image is not known, and the transcript copies are kept.
        if len(files) != len(images):
            files = []
        folder = os.path.join("images", safe(uuid))
        for n, block in enumerate(images, 1):
            if (uuid, n) in keys:
                continue
            source = block.get("source") or {}
            media_type = source.get("media_type")
            original = files[n - 1] if files else None
            data, kept_from, name, note = None, None, None, None
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
                    data = base64.b64decode(source.get("data") or "", validate=True)
                    kept_from = "transcript"
                    name = "image.%s" % EXTENSIONS.get(media_type, "bin")
                except (binascii.Error, ValueError):
                    data = None
                    note = ("not copied: the archived copy's base64 was changed by the secret sanitizer"
                            if from_archive else "not copied: the transcript's base64 does not decode")
            elif data is None:
                note = "not copied: source type %s" % source.get("type")
            record = {
                "layout": LAYOUT,
                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "session_id": line.get("sessionId"),
                "prompt_id": line.get("promptId"),
                "message_uuid": uuid,
                "prompted_at": line.get("timestamp"),
                "prompt_text": text or None,
                "prompt_lines": prompt_lines,
                "meta_line": bool(line.get("isMeta")),
                "index": n,
                "count": len(images),
                "media_type": media_type,
                "kept_from": kept_from,
                "original": original,
                "read_from": "archive" if from_archive else "transcript",
                "entrypoint": line.get("entrypoint"),
                "prompt_source": line.get("promptSource"),
            }
            if data is None:
                record.update({"path": None, "bytes": None, "sha256": None, "note": note,
                               "url": source.get("url")})
            else:
                rel = os.path.join(folder, "%02d-%s" % (n, safe(name)))
                write_atomic(os.path.join(output_dir, rel), data)
                record.update({"path": rel, "bytes": len(data),
                               "sha256": hashlib.sha256(data).hexdigest()})
            append_line(index_path, record)
            keys.add((uuid, n))
            written += 1
    with open(state_path, "w") as handle:
        handle.write(stamp + "\n")
    # The state file takes the transcript's mtime from the start of this pass, so lib.sh
    # skips the next pass with two builtin tests: a line written since makes it newer.
    os.utime(state_path, ns=(mtime_ns, mtime_ns))
    return written


def wait(transcript, prompt_id, seconds):
    needle = ('"promptId":"%s"' % prompt_id).encode()
    deadline, offset = time.time() + seconds, 0
    while time.time() < deadline:
        try:
            if os.path.getsize(transcript) < offset:
                offset = 0
        except OSError:
            offset = 0
        for end, raw in complete_lines(transcript, offset):
            offset = end
            if needle in raw and b'"type":"user"' in raw:
                # Its attachment lines are written right after the prompt's line.
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
