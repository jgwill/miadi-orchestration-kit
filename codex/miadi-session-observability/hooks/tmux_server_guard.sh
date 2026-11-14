#!/usr/bin/env bash
# tmux_server_guard.sh: PreToolUse guard. One tmux server holds every session on this machine,
# so an agent's command does not end it. A person does, or tide after asking one.
#
# WHY
#   2026-11-05 20:49: a test that one agent had just written ran `tmux kill-server` with
#   TMUX_TMPDIR pointing at a temporary folder and $TMUX still set. $TMUX wins over
#   TMUX_TMPDIR, so the command reached the live server: 120 panes, 69 running agents.
#
# WHAT IT BLOCKS (Bash only)
#   tmux kill-server, tmux kill-session -a      without -L or -S, abbreviations included
#   pkill, killall on tmux; kill <server pid>   the same act by signal
#   systemctl stop, restart, kill tmux-server   the same act through the unit
#
# WHAT IT ALLOWS
#   tmux -L <name> or -S <path>: a server of its own. TMUX= and TMUX_TMPDIR=<dir> on the same
#   command (or env -u TMUX): the same. TMUX_TMPDIR alone is refused, it is the shape of 20:49.
#   tmux kill-session -t <one>. The words anywhere they are not a command: a heredoc body,
#   a commit message, a grep pattern.
#
# WHAT IT CANNOT SEE
#   A program that calls tmux itself, such as `node --test`. That is how 20:49 happened: the
#   command the hook would have read was the test run. A test keeps to its own server by
#   deleting TMUX and TMUX_PANE from the environment it gives tmux.
#
# OFF  MIADI_TMUX_SERVER_GUARD=off in the session's environment, for work on tmux itself.
#      A prefix in the command text does not count.
#
# EXIT  0 allow, also on any internal failure. 2 block, the reason on stderr.
#
# TEST  bash tests/tmux-server-guard.sh

set -uo pipefail
[ "${MIADI_TMUX_SERVER_GUARD:-on}" = "off" ] && exit 0
command -v python3 >/dev/null 2>&1 || exit 0

python3 -c '
import json, os, re, shlex, sys

try:
    p = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if p.get("tool_name") != "Bash":
    sys.exit(0)
cmd = (p.get("tool_input") or {}).get("command") or ""

SEPARATORS = set(";&|()\n")
WRAPPERS = {"sudo", "timeout", "nice", "command", "env", "xargs", "exec", "nohup", "setsid"}
VALUE_FLAGS = {"-u", "-g", "-s", "-k", "-n", "-C"}
SHELLS = {"bash", "sh", "dash", "zsh"}
KILL_SERVER = re.compile(r"^kill-ser(v|ve|ver)?$")
TMUX_TARGET = re.compile(r"(^|/)tmux($|:| )")
TMUX_VALUE_FLAGS = {"-c", "-f", "-T"}
UNIT = re.compile(r"^tmux-server(\.service)?$")
HEREDOC = re.compile(r"<<-?\s*[\x27\"]?([A-Za-z_][A-Za-z0-9_]*)[\x27\"]?")


def without_heredocs(text):
    """A heredoc body is data, whatever words it holds."""
    kept, delimiter = [], None
    for line in text.split("\n"):
        if delimiter is not None:
            if line.strip() == delimiter:
                delimiter = None
            continue
        kept.append(line)
        found = HEREDOC.search(line)
        if found:
            delimiter = found.group(1)
    return "\n".join(kept)


def segments_of(text):
    lexer = shlex.shlex(without_heredocs(text).replace("\\\n", " "), posix=True, punctuation_chars=";&|()\n")
    lexer.whitespace = " \t\r"
    lexer.whitespace_split = True
    parts, seg = [], []
    for token in lexer:
        if token and set(token) <= SEPARATORS:
            if seg:
                parts.append(seg)
            seg = []
        else:
            seg.append(token)
    if seg:
        parts.append(seg)
    return parts


def is_server(pid):
    try:
        with open(f"/proc/{pid}/comm") as f:
            return f.read().strip() == "tmux: server"
    except OSError:
        return False


def reason_for(tokens):
    assigned, unset, s = {}, set(), list(tokens)
    while s:
        match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$", s[0], re.S)
        if match:
            assigned[match.group(1)] = match.group(2)
            s = s[1:]
        elif os.path.basename(s[0]) in WRAPPERS:
            wrapper = os.path.basename(s[0])
            s = s[1:]
            while s and (s[0].startswith("-") or re.match(r"^[0-9.]+[smh]?$", s[0])):
                flag = s[0]
                s = s[1:]
                if flag in VALUE_FLAGS and s:
                    if wrapper == "env" and flag == "-u":
                        unset.add(s[0])
                    s = s[1:]
        else:
            break
    if not s:
        return None
    prog, args = os.path.basename(s[0]), s[1:]

    if prog in SHELLS:
        for i, a in enumerate(args[:-1]):
            if re.match(r"^-[a-z]*c$", a):
                return reason_in(args[i + 1])
        return None

    if prog == "tmux":
        own_server, i = False, 0
        while i < len(args) and args[i].startswith("-"):
            flag = args[i]
            if flag[:2] in ("-L", "-S"):
                own_server = True
                if len(flag) == 2:
                    i += 1
            elif flag in TMUX_VALUE_FLAGS:
                i += 1
            i += 1
        if i >= len(args):
            return None
        if own_server:
            return None
        cleared = "TMUX" in unset or assigned.get("TMUX", "x") == ""
        if cleared and assigned.get("TMUX_TMPDIR"):
            return None
        if KILL_SERVER.match(args[i]):
            if "TMUX_TMPDIR" in assigned and not cleared:
                return "TMUX_TMPDIR does not move a client whose $TMUX is set: this reaches the live server"
            return "tmux kill-server ends every session on this machine"
        if args[i] == "kill-session" and "-a" in args[i + 1:]:
            return "tmux kill-session -a ends every other session on this machine"
        return None

    if prog in ("pkill", "killall"):
        if any(TMUX_TARGET.search(a) for a in args if not a.startswith("-")):
            return f"{prog} on tmux ends every session on this machine"
        return None

    if prog == "kill":
        if any(a.isdigit() and is_server(a) for a in args):
            return "that pid is the tmux server, and ending it ends every session on this machine"
        return None

    if prog == "systemctl":
        words = [a for a in args if not a.startswith("-")]
        if len(words) >= 2 and words[0] in ("stop", "restart", "kill", "try-restart") and any(UNIT.match(w) for w in words[1:]):
            return f"systemctl {words[0]} tmux-server ends every session on this machine"
    return None


def reason_in(text):
    for seg in segments_of(text):
        found = reason_for(seg)
        if found:
            return found
    return None


try:
    reason = reason_in(cmd)
except Exception:
    sys.exit(0)

if not reason:
    sys.exit(0)

sys.stderr.write(f"""tmux-server-guard: refused, {reason}.
A server of your own, for a test or an experiment:  tmux -L <name> -f /dev/null ...
  or, from a program, delete TMUX and TMUX_PANE from the environment it gives tmux.
One session:                                        tmux kill-session -t <name>
Sessions lost or stuck: skill miadi-session-observability:session-continuity. Tell the person.
Work on tmux itself: set MIADI_TMUX_SERVER_GUARD=off in the session environment.
""")
sys.exit(2)
' || exit $?
exit 0
