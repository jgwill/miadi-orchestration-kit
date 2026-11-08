"""Native Hermes adapter for the kit's canonical, tested Miette seat runtime."""

import fcntl
import hashlib
import importlib.util
import json
import logging
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess

KIT = Path(os.environ.get("MIADI_ORCHESTRATION_KIT_ROOT", str(Path(__file__).resolve().parents[2]))).expanduser().resolve()
SCRIPT = KIT / "claude/miette-plan-insight/scripts/miette-plan-insight.mjs"
TRUSTED = {"cli", "tui", "desktop", "acp", "telegram"}
SAFE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,254}\Z")
LOG = logging.getLogger("miette-plan-insight")


def redactor():
    path = KIT / "hermes-agent/miadi-session-observability/redaction.py"
    spec = importlib.util.spec_from_file_location("miadi_plan_redaction", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("canonical Hermes redactor is unavailable")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Redactor()


class PlanAdapter:
    def __init__(self, ctx):
        self.ctx = ctx
        node = shutil.which("node")
        if not node or not SCRIPT.is_file():
            raise RuntimeError("Node and the kit's shared Miette runtime are required")
        self.node: str = node
        home = Path(os.environ.get("HERMES_HOME", "~/.hermes")).expanduser()
        self.root = Path(os.environ.get("MIADI_MIETTE_STATE_DIR", str(home / "plugin-data/miette-plan-insight")))
        self.cleaner = redactor()

    def environment(self):
        return {**os.environ, "MIADI_MIETTE_AGENT": "hermes", "MIADI_MIETTE_STATE_DIR": str(self.root)}

    def run(self, args, payload=None, cwd=None):
        return subprocess.run([self.node, str(SCRIPT), *args], input=payload, text=True,
                              capture_output=True, timeout=12, env=self.environment(),
                              cwd=cwd or self.ctx.session_cwd() or None)

    def disabled(self):
        return (os.environ.get("MIADI_MIETTE_PLAN_INSIGHT", "").lower() in ("0", "off", "false", "no")
                or bool(os.environ.get("MIADI_MIETTE_SEAT")))

    def post_tool(self, tool_name=None, args=None, status=None, session_id=None, platform=None, **kwargs):
        if self.disabled() or (platform or self.ctx.session_surface()) not in TRUSTED:
            return None
        if status != "ok" or tool_name not in ("write_file", "patch") or not isinstance(args, dict):
            return None
        sid = session_id or os.environ.get("HERMES_SESSION_ID")
        if not isinstance(sid, str) or not SAFE_ID.fullmatch(sid):
            return None
        cwd = self.ctx.session_cwd() or str(Path.cwd())
        paths = [args["path"]] if isinstance(args.get("path"), str) else []
        if isinstance(args.get("patch"), str):
            paths += re.findall(r"^\*\*\* (?:Add|Update) File: (.+)$", args["patch"], re.M)
        for raw in dict.fromkeys(paths):
            # Inspect only named plan files, never scan a workspace or a transcript.
            lexical = Path(cwd) / Path(raw).expanduser()
            if lexical.suffix != ".md" or lexical.parent.name != "plans" or lexical.parent.parent.name != ".hermes":
                continue
            if lexical.is_symlink() or not lexical.is_file() or lexical.stat().st_size > 512 * 1024:
                continue
            plan = self.cleaner.text(lexical.read_text())
            if not plan.strip():
                continue
            key = hashlib.sha256((sid + "\0" + str(lexical.resolve())).encode()).hexdigest()
            digest = hashlib.sha256(plan.encode()).hexdigest()
            triggers = self.root / "triggers"
            triggers.mkdir(mode=0o700, parents=True, exist_ok=True)
            fd = os.open(triggers / key, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, "r+") as stream:
                fcntl.flock(stream, fcntl.LOCK_EX)
                if stream.read().strip() == digest:
                    continue
                payload = json.dumps({"session_id": sid, "cwd": cwd, "tool_name": "ExitPlanMode",
                                      "tool_input": {"plan": plan}})
                result = self.run(["hook"], payload=payload, cwd=cwd)
                if result.returncode != 0 or not result.stdout.strip():
                    raise RuntimeError("Miette runtime did not acknowledge the plan")
                json.loads(result.stdout)
                stream.seek(0)
                stream.truncate()
                stream.write(digest)
        return None

    def safe_post_tool(self, **kwargs):
        try:
            return self.post_tool(**kwargs)
        except Exception as exc:
            LOG.warning("plan trigger failed (%s); plan execution unchanged", type(exc).__name__)
            return None

    def seat_context(self, **kwargs):
        if not os.environ.get("MIADI_MIETTE_SEAT"):
            return None
        try:
            result = self.run(["session-start"])
            value = json.loads(result.stdout) if result.stdout.strip() else {}
            context = value.get("hookSpecificOutput", {}).get("additionalContext")
            return {"context": context} if context else None
        except (OSError, ValueError, subprocess.SubprocessError):
            return None

    def command(self, verb, raw):
        if self.ctx.session_surface() not in TRUSTED:
            return "Miette commands require an authenticated local/Telegram session; webhook and unknown surfaces are refused."
        if verb == "ask" and self.disabled():
            return "Plan insight is disabled for this session, or this is already a Miette review seat."
        try:
            args = shlex.split(raw)
        except ValueError:
            return "Unbalanced command quoting."
        if verb == "listen" and args == ["status"]:
            verb, args = "status", []
        options = {"ask": {"--plan", "--mission", "--episode", "--for", "--session"},
                   "listen": {"--session", "--timeout", "--interval"},
                   "file": {"--session"}, "status": {"--session"}}[verb]
        # The shared runtime's dry-run belongs to `open`, not `ask`. Never
        # accept a flag that looks side-effect-free but is ignored downstream.
        flags = {"--no-register"} if verb == "file" else set()
        i = 0
        while i < len(args):
            value = args[i]
            if value in options:
                if i + 1 >= len(args):
                    return "Missing value for " + value
                if value in ("--session", "--mission") and not SAFE_ID.fullmatch(args[i + 1]):
                    return "Unsafe identity; it was not normalized or replaced."
                i += 2
            elif value in flags or (verb == "file" and not value.startswith("-")):
                i += 1
            else:
                return "Unsupported argument: " + value
        # Registry dispatch keeps command execution in Hermes's approval and process
        # tracking path. Only public, noncredential routing values are put inline.
        command = shlex.join(["env", "MIADI_MIETTE_AGENT=hermes", "MIADI_MIETTE_STATE_DIR=" + str(self.root),
                              self.node, str(SCRIPT), verb, *args])
        payload = {"command": command, "workdir": self.ctx.session_cwd() or str(Path.cwd()), "timeout": 90}
        if verb == "listen":
            payload.update(background=True, notify=True)
        return self.ctx.dispatch_tool("terminal", payload)


def register(ctx):
    adapter = PlanAdapter(ctx)
    ctx.register_hook("post_tool_call", adapter.safe_post_tool)
    ctx.register_hook("pre_llm_call", adapter.seat_context)
    for name in ("miette-plan-insight", "plan-critic"):
        path = Path(__file__).parent / "skills" / name / "SKILL.md"
        ctx.register_skill(name, path, "Hermes " + name + ": a plan, a critic pass, and a named review seat.")
    for command, verb in (("miette-insight", "ask"), ("miette-listen", "listen"),
                          ("miette-file", "file"), ("miette-status", "status")):
        ctx.register_command(command, lambda raw, v=verb: adapter.command(v, raw),
                             description="Miette plan seat: " + verb, args_hint="[options]")
