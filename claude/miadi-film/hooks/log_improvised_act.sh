#!/usr/bin/env bash
# PostToolUse (Bash): writes one line to the miadi-film acts log for a shell command that touched a display or
# a production program outside film_desk.py (S8 of rispecs/agents-in-the-programs/03-specify.md).
# Silent, never blocks, exits 0 on every path. The verbs of film_desk.py write their own lines and are skipped.
input=$(cat)
case "$input" in
	*film_desk*) exit 0 ;;
	*xdotool*|*wmctrl*|*"import -window"*|*"DISPLAY="*|*org.kde.kdenlive*|*"pactl list sink-inputs"*|*"kdenlive "*|*ardour*|*musescore*|*mscore*) ;;
	*) exit 0 ;;
esac
command -v python3 >/dev/null || exit 0
HOOK_INPUT="$input" python3 - <<'EOF' 2>/dev/null
import getpass, json, os, re, socket
from datetime import datetime, timezone
from pathlib import Path
try:
    d = json.loads(os.environ["HOOK_INPUT"])
except Exception:
    raise SystemExit(0)
if d.get("tool_name") != "Bash":
    raise SystemExit(0)
cmd = (d.get("tool_input") or {}).get("command") or ""
# a program counts only where it is started: first word, after ; & | or a launcher, possibly with a path
started = r"(^|[;&|]\s*|\b(?:nohup|setsid|exec|env|timeout \d+)\s+|DISPLAY=\S+\s+)(\S*/)?(kdenlive|ardour\d*|musescore\d*|mscore)\b"
if not (re.search(r"xdotool|wmctrl|import -window|org\.kde\.kdenlive|pactl list sink-inputs", cmd)
        or re.search(started, cmd, re.M)) or "film_desk" in cmd:
    raise SystemExit(0)
state = Path(os.environ.get("XDG_STATE_HOME") or Path.home() / ".local/state") / "miadi-film"
path = Path(os.environ.get("MIADI_FILM_ACTS_LOG") or state / "acts.jsonl")
path.parent.mkdir(parents=True, exist_ok=True)
resp = d.get("tool_response") or {}
line = {
    "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "host": socket.gethostname(), "user": getpass.getuser(),
    "display": (re.search(r"DISPLAY=(\S+)", cmd) or [None, os.environ.get("DISPLAY")])[1],
    "verb": "improvised", "group": "improvised", "argv": None,
    "command": cmd[:2000], "description": (d.get("tool_input") or {}).get("description"),
    "session_id": d.get("session_id"), "cwd": d.get("cwd"),
    "tmux_pane": os.environ.get("TMUX_PANE"),
    "interrupted": resp.get("interrupted") if isinstance(resp, dict) else None,
}
with path.open("a") as f:
    f.write(json.dumps(line, ensure_ascii=False) + "\n")
EOF
exit 0
