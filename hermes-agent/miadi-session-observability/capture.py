"""Local capture, compatible legacy event filenames, and bounded lifecycle work."""

from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import logging
import os
from pathlib import Path
import re
import tempfile

from .binding import make_binding
from .redaction import Redactor

LOG = logging.getLogger("miadi-session-observability")
EVENTS = {
    "on_session_start": ("session_start",),
    "on_session_end": ("session_end",),  # Legacy name: this is a TURN boundary.
    "pre_tool_call": ("pre_tool_use",),
    "post_tool_call": ("post_tool_use",),
    "pre_llm_call": ("user_prompt_submit", "corrective_feedback"),
    "pre_approval_request": ("permission_request",),
    "post_approval_response": ("accepted_redirection",),
    "subagent_start": ("subagent_start",),
    "subagent_stop": ("subagent_stop",),
    "post_llm_call": ("post_llm_call",),
    "on_session_finalize": ("session_finalize",),
    "on_session_reset": ("session_reset",),
    "post_api_request": ("api_usage",),
    "api_request_error": ("api_request_error",),
    "post_compaction": ("post_compaction",),
}
SESSION_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,254}\Z")


def resolve_root(environ=None):
    env = os.environ if environ is None else environ
    for key in ("HERMES_SESSIONDATA_ROOT", "MIADI_SESSION_DIR", "MIADI_SESSIONDATA_ROOT", "SESSION_DATA_ROOT"):
        if env.get(key):
            return Path(env[key]).expanduser().absolute()
    return Path("/src/_sessiondata") if Path("/src").is_dir() else Path.home() / "_sessiondata"


def safe_directory(path):
    if path.is_symlink():
        raise ValueError("capture subdirectory must not be a symlink")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not path.is_dir() or path.is_symlink():
        raise ValueError("capture directory is unavailable")


def append(path, text):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "a", encoding="utf-8") as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        stream.write(text + "\n")
        stream.flush()


def atomic_write(path, text):
    if path.is_symlink():
        raise ValueError("capture target must not be a symlink")
    fd, temporary = tempfile.mkstemp(prefix=".observability-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(text + "\n")
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


@contextmanager
def session_lock(directory):
    fd = os.open(directory / ".observability.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "r+") as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        yield


def read_json(path):
    if path.is_symlink():
        raise ValueError("capture state must not be a symlink")
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return None


class Capture:
    def __init__(self, root, profile="default", continuity=True, cwd_resolver=None):
        # An operator-selected root may itself be a host symlink (/src on Eury).
        self.root = Path(root).expanduser().resolve()
        self.profile = profile
        self.continuity = continuity
        self.cwd_resolver = cwd_resolver
        self.redactor = Redactor()
        self.started_here = set()

    def check_root(self):
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        safe_directory(self.root / "data")
        # Prove write access rather than trusting os.access, then leave no probe.
        fd, probe = tempfile.mkstemp(prefix=".observability-probe-", dir=self.root)
        os.close(fd)
        Path(probe).unlink()

    def dump(self, value):
        return json.dumps(self.redactor.clean(value), ensure_ascii=False, separators=(",", ":"), allow_nan=False)

    def callback(self, hook):
        def observe(**kwargs):
            try:
                self.record(hook, kwargs)
            except Exception as exc:
                # pre_tool_call is a policy hook in Hermes: an exception there
                # blocks a tool. Capture must never block or modify execution.
                # No payload, path, exception text, or credential is logged.
                LOG.error("capture failed for %s (%s); agent execution unchanged", hook, type(exc).__name__)
            return None
        observe.__name__ = "capture_" + hook
        return observe

    def payload(self, hook, sid, kwargs):
        omitted = {"args", "tool_name", "session_id", "conversation_history", "request", "response", "assistant_message"}
        extra = {k: v for k, v in kwargs.items() if k not in omitted}
        history = kwargs.get("conversation_history")
        if isinstance(history, list):
            extra["conversation_history_count"] = len(history)
            if hook == "post_llm_call":
                extra["conversation_history_capture"] = "_hermes_history_latest.jsonl"
        return {
            "hook_event_name": hook, "tool_name": kwargs.get("tool_name"),
            "tool_input": kwargs.get("args"), "session_id": sid,
            "cwd": kwargs.get("cwd") or (self.cwd_resolver() if self.cwd_resolver else "") or str(Path.cwd()),
            "profile": self.profile,
            "extra": extra, "platform": kwargs.get("platform") or "unknown",
            "source": kwargs.get("source"), "model": kwargs.get("model"),
            "turn_id": kwargs.get("turn_id"), "tool_call_id": kwargs.get("tool_call_id"),
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "captured_by": "miadi-session-observability", "capture_schema_version": 1,
        }

    def record(self, hook, kwargs):
        sid = kwargs.get("session_id") or kwargs.get("parent_session_id") or os.environ.get("HERMES_SESSION_ID")
        if hook == "on_session_reset":
            sid = kwargs.get("old_session_id")  # Never mark the replacement session as ended.
        if not isinstance(sid, str) or not SESSION_ID.fullmatch(sid) or sid == "data":
            raise ValueError("missing or unsafe session id")
        directory = self.root / sid
        safe_directory(directory)
        safe_directory(self.root / "data")
        payload = self.payload(hook, sid, kwargs)
        with session_lock(directory):
            if hook == "on_session_start":
                self.started_here.add(sid)
            for event in EVENTS[hook]:
                line = self.dump({**payload, "capture_event": event})
                append(directory / ("_hermes_" + event + ".jsonl"), line)
                atomic_write(directory / ("last_hermes_" + event + ".json"), line)
                append(directory / "_hermes_hooks_all.jsonl", line)
                append(self.root / "data" / "hermes_hooks_all.jsonl", line)
            if self.continuity and hook in ("on_session_start", "pre_llm_call"):
                marker = directory / ".observability-indexed"
                if not marker.exists():
                    index = {k: payload[k] for k in ("session_id", "platform", "source", "model", "captured_at", "profile")}
                    append(self.root / "data" / "session_index.jsonl", self.dump(index))
                    atomic_write(marker, "indexed")
            if self.continuity and hook in ("on_session_start", "pre_llm_call", "on_session_finalize", "on_session_reset"):
                self.bind(directory, hook, payload)
            elif not self.continuity and hook == "pre_llm_call" and sid not in self.started_here:
                # Miadi 0.3 owns start/end/index but has no resume callback.
                # Fill that non-overlapping boundary only for a verified pane.
                self.bind(directory, hook, payload, require_tmux=True)
            if hook in ("on_session_finalize", "on_session_reset"):
                self.started_here.discard(sid)
                if not self.continuity:
                    state_path = directory / ".observability-binding.json"
                    previous = read_json(state_path)
                    if previous:
                        atomic_write(state_path, self.dump({**previous, "event": "session.end"}))
            if hook == "post_llm_call":
                history = kwargs.get("conversation_history")
                if isinstance(history, list):
                    atomic_write(directory / "_hermes_history_latest.jsonl", "\n".join(self.dump(m) for m in history))
                append(directory / "_hermes_responses.jsonl", self.dump({
                    "session_id": sid, "turn_id": kwargs.get("turn_id"),
                    "at": payload["captured_at"], "response": kwargs.get("assistant_response"),
                }))

    def bind(self, directory, hook, payload, require_tmux=False):
        state_path = directory / ".observability-binding.json"
        previous = read_json(state_path)
        event = {"on_session_start": "session.start", "pre_llm_call": "session.observed",
                 "on_session_finalize": "session.end", "on_session_reset": "session.end"}[hook]
        binding = make_binding(payload["session_id"], event, payload, previous)
        if require_tmux and binding["tmux"] is None:
            return
        comparable = ("pid", "tmux", "name", "cwd", "team", "episode", "account_person", "launch_alias")
        if event != "session.end" and previous and previous.get("event") != "session.end" and all(binding[k] == previous.get(k) for k in comparable):
            return
        if event != "session.end" and previous and binding["name"] != previous.get("name"):
            binding["event"] = "session.rename"
        line = self.dump(binding)
        append(directory / "_terminal_binding.jsonl", line)
        append(self.root / "data" / "terminal_bindings.jsonl", line)
        # Keep our own rich state; do not overwrite the shell hooks' state file,
        # since an older, still-running process may be using it.
        atomic_write(state_path, line)
