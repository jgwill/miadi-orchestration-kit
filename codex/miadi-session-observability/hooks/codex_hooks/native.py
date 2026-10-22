#!/usr/bin/env python3
"""Codex wire-format adapter and durable rollout archive (stdlib only)."""
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
CODEX_HOME = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex")))
SAFE_ID = re.compile(r"^[A-Za-z0-9_-]+$")


def dumps(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def sanitize(data):
    return subprocess.run(["bash", str(HERE.parent / "secret_capture_sanitizer.sh"),
                           "--stream"], input=data, stdout=subprocess.PIPE, check=True).stdout


def atomic(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix="." + path.name)
    try:
        with os.fdopen(fd, "wb") as out:
            out.write(data)
        os.replace(tmp, path)
    finally:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(tmp)


def thread_row(sid):
    # This optional lookup tolerates schema upgrades and never writes Codex's DB.
    for db in sorted(CODEX_HOME.glob("state_*.sqlite"), reverse=True):
        try:
            with contextlib.closing(sqlite3.connect(db.as_uri() + "?mode=ro", uri=True, timeout=.2)) as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute("select * from threads where id = ?", (sid,)).fetchone()
                if row:
                    return dict(row)
        except sqlite3.Error:
            continue
    return {}


def normalize(data):
    sid = data.get("session_id", "")
    if not isinstance(sid, str) or not SAFE_ID.fullmatch(sid):
        return None
    data.setdefault("prompt_id", data.get("turn_id"))
    ti = data.get("tool_input")
    if isinstance(ti, str):
        ti = {"command": ti}
    if not isinstance(ti, dict):
        ti = {}
    if "cmd" in ti and "command" not in ti:
        ti["command"] = ti["cmd"]
    if isinstance(ti.get("command"), list):
        import shlex
        ti["command"] = shlex.join(ti["command"])
    ti.setdefault("command", ti.get("patch", ""))
    data["tool_input"] = ti
    name = data.get("tool_name", "")
    if name in ("exec_command", "shell", "shell_command"):
        data["tool_name"] = "Bash"
    response = data.get("tool_response")
    text = response if isinstance(response, str) else ""
    if isinstance(response, dict):
        text = "\n".join(str(response[k]) for k in ("stdout", "stderr", "output") if k in response)
        if isinstance(response.get("content"), list):
            text += "\n" + "\n".join(c.get("text", "") for c in response["content"] if isinstance(c, dict))
        if "stdout" not in response and text:
            response = {**response, "stdout": text}
    elif response is not None:
        response = {"stdout": text}
    if response is not None:
        data["tool_response"] = response
    status = response.get("exit_code", response.get("exitCode")) if isinstance(response, dict) else None
    match = re.search(r"(?:Process exited with code|Process exit code:|exit code[: ]+)\s*(-?\d+)", text)
    if status is None and match:
        status = int(match[1])
    failed = (status is not None and str(status) not in ("0", "success"))
    failed |= bool(isinstance(response, dict) and response.get("isError"))
    data["codex_tool_exit_code"] = status
    data["codex_tool_failed"] = failed
    return data


def archive_jsonl(src, dest):
    """Append sanitized complete lines; recopy on truncation/replacement/copy damage."""
    src, dest = Path(src), Path(dest)
    if not src.is_file() or src.resolve() == dest.resolve():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    state = dest.with_name("." + dest.name + ".offset.json")
    stat = src.stat()
    offset = 0
    old = {}
    with contextlib.suppress(OSError, ValueError):
        old = json.loads(state.read_text())
    if (not dest.is_symlink() and dest.is_file() and old.get("inode") == stat.st_ino
            and old.get("device") == stat.st_dev and old.get("size") == dest.stat().st_size
            and 0 <= old.get("offset", -1) <= stat.st_size):
        offset = old["offset"]
    with src.open("rb") as source:
        if offset and old.get("head_sha"):
            head = source.read(min(offset, 4096))
            if hashlib.sha256(head).hexdigest() != old["head_sha"]:
                offset = 0
        if offset:
            source.seek(offset - 1)
            if source.read(1) != b"\n":
                offset = 0
        source.seek(offset)
        chunk = source.read()
    chunk = chunk[:chunk.rfind(b"\n") + 1]
    if not chunk:
        return
    clean = sanitize(chunk)
    if offset:
        with dest.open("ab") as out:
            out.write(clean)
    else:
        atomic(dest, clean)
    with src.open("rb") as source:
        head_sha = hashlib.sha256(source.read(min(offset + len(chunk), 4096))).hexdigest()
    atomic(state, dumps({"offset": offset + len(chunk), "size": dest.stat().st_size, "head_sha": head_sha,
                         "inode": stat.st_ino, "device": stat.st_dev}).encode())


def archive(transcript, output, agent_id=None):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    with (output / ".archive.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        dest = output / "_transcript_final.jsonl"
        if agent_id:
            if not SAFE_ID.fullmatch(agent_id):
                return
            dest = output / "agents" / (agent_id + ".transcript.jsonl")
        archive_jsonl(transcript, dest)
        if agent_id or not dest.is_file():
            return
        # Preserve both legacy names without another full sanitization pass.
        atomic(output / "_codex_transcript_latest.jsonl", dest.read_bytes())
        progressive = bytearray()
        with dest.open("rb") as lines:
            for line in lines:
                try:
                    record = json.loads(line)
                except ValueError:
                    continue
                payload = record.get("payload", {})
                if ((record.get("type") == "event_msg" and payload.get("type") == "agent_message")
                        or (record.get("type") == "response_item" and payload.get("type") == "message"
                            and payload.get("role") == "assistant")):
                    progressive.extend(line)
        for name in ("_responses_progressive.jsonl", "_codex_responses_progressive.jsonl"):
            atomic(output / name, progressive)


def sweep(root):
    root = Path(root)
    children = []
    for directory in (CODEX_HOME / "sessions", CODEX_HOME / "archived_sessions"):
        if not directory.is_dir():
            continue
        for path in directory.rglob("rollout-*.jsonl"):
            try:
                with path.open() as lines:
                    meta = json.loads(next(lines)).get("payload", {})
                sid = meta.get("id", "")
                if not SAFE_ID.fullmatch(sid):
                    continue
                if (root / sid).is_dir():
                    archive(path, root / sid)
                source = meta.get("source", {})
                spawn = source.get("subagent", {}).get("thread_spawn", {}) if isinstance(source, dict) else {}
                parent = spawn.get("parent_thread_id", meta.get("parent_thread_id", ""))
                if isinstance(parent, str) and SAFE_ID.fullmatch(parent) and (root / parent).is_dir():
                    children.append((path, root / parent, sid, meta))
            except (OSError, ValueError, StopIteration, AttributeError):
                continue
    for path, parent, sid, meta in children:
        archive(path, parent, sid)
        atomic(parent / "agents" / (sid + ".meta.json"), sanitize(dumps(meta).encode()) + b"\n")


def publications(data, output):
    """Record URLs returned by explicit GitHub connector writes; ignore read tools."""
    name = data.get("tool_name", "")
    if data.get("codex_tool_failed") or not re.search(
            r"github_(?:create_(?:issue|pull_request|release)|add_(?:issue_comment|comment_to_issue)|"
            r"update_(?:issue|pull_request|issue_comment)|submit_review|merge_pull_request)$", name):
        return
    found = set()

    def visit(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ("url", "html_url") and isinstance(child, str) and re.fullmatch(
                        r"https://github.com/[\w.-]+/[\w.-]+/(?:issues/\d+|pull/\d+|releases/tag/[^\s]+)(?:#[\w-]+)?", child):
                    found.add(child)
                elif key == "text" and isinstance(child, str):
                    with contextlib.suppress(ValueError):
                        visit(json.loads(child))
                else:
                    visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(data.get("tool_response"))
    output = Path(output)
    with (output / ".publications.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        for url in sorted(found):
            kind = "pr" if "/pull/" in url else "release" if "/releases/" in url else "issue"
            if "#" in url:
                kind += "-comment"
            entry = {key: data.get(key) for key in ("session_id", "tool_use_id", "tool_name", "prompt_id", "agent_id")}
            entry.update(kind=kind, url=url, source="tool_response", action=name)
            with (output / "_codex_publications.jsonl").open("ab") as index:
                index.write(sanitize(dumps(entry).encode()) + b"\n")


def main():
    mode, *args = sys.argv[1:]
    if mode == "name":
        row = thread_row(args[0])
        name = row.get("name") or row.get("agent_nickname") or row.get("title") or os.environ.get("MIADI_SESSION_NAME")
        print(dumps({"name": name, "source": "codex-thread", "since": None, "former": []} if name else None))
    elif mode == "normalize":
        try:
            data = json.load(sys.stdin)
            normalized = normalize(data) if isinstance(data, dict) else None
        except (ValueError, TypeError):
            normalized = None
        if normalized:
            print(dumps(normalized))
    elif mode == "archive":
        archive(*args)
    elif mode == "sweep":
        sweep(*args)
    elif mode == "publications":
        publications(json.load(sys.stdin), args[0])
    elif mode == "patch-paths":
        data = json.load(sys.stdin)
        patch = data.get("tool_input", {}).get("command", "")
        cwd = data.get("cwd") or os.getcwd()
        for line in patch.splitlines():
            match = re.match(r"\*\*\* (?:Add File|Update File|Move to): (.+)$", line)
            if match:
                print(str(Path(cwd, match[1]).resolve()))


if __name__ == "__main__":
    main()
