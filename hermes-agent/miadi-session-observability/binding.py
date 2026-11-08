"""Terminal-binding schema shared with binscripts' terminal_binding.sh and tide.

Rules mirror that script: verify the tmux socket/server; declared team, session,
longest folder, name pattern; episode by --add-dir, cwd, then declared episode.
This module does not source person.env or any other environment/credential file.
"""

import json
import os
from pathlib import Path
import re
import socket
import subprocess


def tmux_query(*args):
    tmux = os.environ.get("TMUX", "").split(",")
    pane = os.environ.get("TMUX_PANE", "")
    if len(tmux) < 2 or not pane:
        return ""
    try:
        return subprocess.run(
            ["tmux", "-S", tmux[0], *args], check=True, capture_output=True,
            text=True, timeout=1,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def tmux_binding():
    fields = tmux_query("display-message", "-p", "-t", os.environ.get("TMUX_PANE", ""),
                        "#{pid}\t#{session_name}\t#{window_index}\t#{pane_index}\t#{pane_id}").split("\t")
    tmux = os.environ.get("TMUX", "").split(",")
    if len(fields) != 5 or len(tmux) < 2 or fields[0] != tmux[1]:
        return None
    return {"session": fields[1], "window": int(fields[2]), "pane": int(fields[3]),
            "pane_id": fields[4], "socket": tmux[0]}


def team_binding(cwd, tmux, name):
    declared = os.environ.get("MIADI_TEAM")
    if not declared and tmux:
        declared = tmux_query("show-options", "-qv", "-t", tmux["pane_id"], "@miadi-team")
    if declared:
        return {"id": declared, "source": "declared"}
    path = os.environ.get("MIADI_TEAMS_FILE")
    if not path and os.environ.get("MIADI_ORCHESTRATION_KIT_ROOT"):
        path = str(Path(os.environ["MIADI_ORCHESTRATION_KIT_ROOT"]) / "teams" / "teams.json")
    if not path:
        return {"id": "unassigned", "source": "no teams file"}
    try:
        teams = json.loads(Path(path).read_text())["teams"]
        names = [x for x in ((tmux or {}).get("session"), name) if x]
        for team in teams:
            if any(n in team.get("sessions", []) for n in names):
                return {"id": team["id"], "source": "session"}
        folders = [(len(f), team) for team in teams for f in team.get("folders", [])
                   if cwd == f or cwd.startswith(f.rstrip("/") + "/")]
        if folders:
            return {"id": max(folders, key=lambda x: x[0])[1]["id"], "source": "folder"}
        for team in teams:
            if any(re.search(p, n) for p in team.get("name_patterns", []) for n in names):
                return {"id": team["id"], "source": "name"}
        return {"id": "unassigned", "source": "no rule matched"}
    except (OSError, ValueError, KeyError, TypeError, re.error):
        return {"id": "unassigned", "source": "unreadable teams file"}


def episode_binding(cwd, argv):
    root = os.environ.get("MIADI_CHRONICLE_ROOT")
    roots = [Path(root), Path(root).resolve()] if root else []

    def episode(path):
        for base in roots:
            try:
                name = Path(path).relative_to(base).parts[0]
                if re.match(r"^\d{4}-\d{2}-\d{2}-episode-\d+", name):
                    return name
            except (ValueError, IndexError):
                pass
        return None

    dirs = []
    collecting = False
    for arg in argv:
        if arg == "--add-dir":
            collecting = True
        elif arg.startswith("--add-dir="):
            dirs.append(arg.partition("=")[2])
            collecting = False
        elif arg.startswith("-"):
            collecting = False
        elif collecting:
            dirs.append(arg)
    for path in dirs:
        name = episode(Path(cwd) / path)
        if name:
            return {"id": name, "source": "add-dir"}
    name = episode(cwd)
    if name:
        return {"id": name, "source": "cwd"}
    declared = os.environ.get("MIADI_CHRONICLE_PROD_EPISODE", "").rstrip("/")
    return {"id": Path(declared).name, "source": "declared"} if declared else None


def agent_process():
    # Native callbacks may run in Hermes's plugin-host subprocess. Walk to the
    # actual Hermes launcher instead of binding every session to the host PID.
    pid = os.getpid()
    for _ in range(12):
        try:
            proc = Path("/proc") / str(pid)
            argv = [x for x in (proc / "cmdline").read_text().split("\0") if x]
            if (proc / "comm").read_text().strip() == "hermes" or any(
                Path(a).name in ("hermes", "hermes_cli", "hermes_cli.main") for a in argv[:4]
            ):
                return pid, argv
            stat = (proc / "status").read_text()
            parent = re.search(r"^PPid:\s+(\d+)", stat, re.M)
            if parent is None:
                break
            pid = int(parent[1])
            if pid <= 1:
                break
        except (OSError, ValueError, TypeError):
            break
    # In tests/embedded use, do not invent an agent process identity.
    return None, []


def make_binding(sid, event, payload, previous=None):
    pid, argv = agent_process()
    cwd = payload["cwd"]
    tmux = tmux_binding()
    name = payload["extra"].get("session_name") or payload["extra"].get("name") or ""
    previous_name = (previous or {}).get("name") or {}
    if not name:
        name = previous_name.get("name", "")
    name_info = None
    if name:
        former = list(previous_name.get("former", []))
        old = previous_name.get("name")
        if old and old != name:
            former.append({"name": old, "since": previous_name.get("since")})
        name_info = {"name": name, "source": "hermes", "since":
                     previous_name.get("since") if old == name else payload["captured_at"], "former": former}
    return {
        "at": payload["captured_at"], "event": event, "source": payload["platform"],
        "agent": "hermes", "session_id": sid, "cwd": cwd,
        "transcript_path": "", "host": socket.gethostname().split(".")[0],
        "pid": pid, "argv": argv, "launch_alias": os.environ.get("MIADI_LAUNCH_ALIAS", ""),
        "name": name_info, "tmux": tmux, "team": team_binding(cwd, tmux, name),
        "episode": episode_binding(cwd, argv),
        "account_person": os.environ.get("MIADI_ACCOUNT_PERSON") or None,
    }
