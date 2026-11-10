#!/usr/bin/env bash
# session_lookup_guard.sh: PreToolUse guard. Which agent runs in a tmux session, and what a
# session did, are asked of the tools that keep the answer, never searched for on disk.
#
# WHY
#   2026-11-01: asked to inventory tmux mw-rwl-repo, a seat ran `find / -name
#   terminal_bindings.jsonl`. It held the shell for 120 s. `tide agents list` and
#   `miadi-hooks-interpret join <id>` answered the same question in under a second, and the
#   session-continuity skill names both. William: "I would have thought that your plugin has
#   all of the skills and whatever endpoint or MCP tools for handling that. I'm surprised that
#   you're actually fucking searching for files." He had also named the second shape on
#   2026-10-02: agents "parsing /a/src/_sessiondata/<session_id>/*.json on and on".
#
# WHAT IT BLOCKS (Bash only)
#   find whose start path is /                         a walk of every mount
#   find, grep -r, rg, ls -R over a sessiondata root   a fleet scan of the capture
#   cat, jq, grep, head, tail, sed, awk, less, wc, python on a raw capture file
#     <root>/<session uuid>/_claude_*, last_claude_*, _responses_*, _transcript*
#
# WHAT IT ALLOWS
#   find under any other folder. A relative path is read against the folder the command `cd`s
#   to before it, so `cd <repo> && grep -r … <dir>` from a shell in the capture is allowed. The binding line <root>/data/terminal_bindings.jsonl (the
#   session-continuity skill reads it with jq). Any command that is not a reader, so
#   `miadi-hooks-interpret digest <root>/<id>` and the plugin's own scripts and tests.
#
# OFF  MIADI_SESSION_LOOKUP_GUARD=off in the session's environment, for work on the capture
#      itself (hooks-core, hooks-interpreter). A prefix in the command text does not count.
#
# ROOTS  CLAUDE_SESSIONDATA_ROOT, MIADI_SESSION_DIR, MIADI_SESSIONDATA_ROOT,
#        SESSION_DATA_ROOT, /src/_sessiondata; each resolved through its links.
#
# EXIT  0 allow, also on any internal failure. 2 block, the doors on stderr.
#
# TEST  bash tests/session-lookup-guard.sh

set -uo pipefail
[ "${MIADI_SESSION_LOOKUP_GUARD:-on}" = "off" ] && exit 0
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
cwd = p.get("cwd") or os.getcwd()

roots = set()
for name in ("CLAUDE_SESSIONDATA_ROOT", "MIADI_SESSION_DIR", "MIADI_SESSIONDATA_ROOT", "SESSION_DATA_ROOT"):
    v = os.environ.get(name)
    if v:
        roots.add(os.path.realpath(v))
roots.add(os.path.realpath("/src/_sessiondata"))

def resolve(path, base):
    path = os.path.expanduser(path)
    if not os.path.isabs(path):
        path = os.path.join(base, path)
    return os.path.realpath(path)

def under_root(path, base):
    r = resolve(path, base)
    return any(r == root or r.startswith(root + os.sep) for root in roots)

RAW = re.compile(r"/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\*)/(_claude_|last_claude_|_responses_|_transcript)")
RAW_NAMES = ("_claude_", "last_claude_", "_responses_", "_transcript")
READERS = {"cat", "jq", "grep", "egrep", "rg", "head", "tail", "sed", "awk", "less", "wc", "python", "python3"}

try:
    lexer = shlex.shlex(cmd, posix=True, punctuation_chars=";&|()")
    lexer.whitespace_split = True
    tokens = list(lexer)
except Exception:
    sys.exit(0)

# The command in order: its segments and the separators between them, so a `cd` is followed.
items, seg = [], []
for t in tokens:
    if t and set(t) <= set(";&|()"):
        if seg:
            items.append(("cmd", seg))
        seg = []
        items.append(("sep", t))
    else:
        seg.append(t)
if seg:
    items.append(("cmd", seg))

# The folder a relative path is read against: the folder of the shell, then each `cd` or `pushd` the command
# makes before it. A `cd` ends at a pipe or a background `&` (a subshell) and at the `)` that
# closes its subshell. A target the guard cannot read (`cd -`, an unset variable) falls back to
# the folder of the shell, as before any `cd` was followed (2026-11-10, Phase 4 of the
# search-inside-sessions mission: `cd <kit> && grep -r … miadi-witness` from a shell in the
# capture was refused as a scan of the capture).
here, stack, undo = cwd, [], None
reason = None
for kind, s in items:
    if kind == "sep":
        if undo is not None and s in ("|", "|&", "&"):
            here = undo
        undo = None
        for ch in s:
            if ch == "(":
                stack.append(here)
            elif ch == ")" and stack:
                here = stack.pop()
        continue
    while s and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", s[0]):
        s = s[1:]
    while s and s[0] in ("sudo", "timeout", "nice", "command", "env", "xargs"):
        s = s[1:]
        while s and (s[0].startswith("-") or re.match(r"^[0-9.]+[smh]?$", s[0])):
            s = s[1:]
    if not s:
        continue
    prog = os.path.basename(s[0])
    args = s[1:]
    if prog in ("cd", "pushd", "popd"):
        target = next((a for a in args if a == "-" or not a.startswith("-")), None) if prog != "popd" else "-"
        undo = here
        if target is None:
            here = os.path.expanduser("~")
        else:
            target = os.path.expandvars(target)
            here = cwd if target == "-" or "$" in target or "`" in target else resolve(target, here)
        continue
    if prog == "find":
        starts = []
        for a in args:
            if a.startswith("-") or a in ("(", "!", ")"):
                break
            starts.append(a)
        if "/" in starts:
            reason = "a find from / walks every mount on this host"
        elif any(under_root(a, here) for a in starts):
            reason = "a find over the session capture is a fleet scan"
    elif prog in ("grep", "egrep", "rg", "ls"):
        flags = " ".join(a for a in args if a.startswith("-"))
        recursive = prog == "rg" or re.search(r"(^|\s)-[A-Za-z]*[rR]|--recursive", flags)
        paths = [a for a in args if not a.startswith("-")]
        if recursive and any(under_root(a, here) for a in paths):
            reason = "a recursive search over the session capture is a fleet scan"
    if reason is None and prog in READERS:
        if any(RAW.search(resolve(a, here)) and under_root(a, here) for a in args if "/" in a or a.startswith(RAW_NAMES)):
            reason = "the raw capture is read through miadi-hooks-interpret, not by hand"
    if reason:
        break

if not reason:
    sys.exit(0)

root = sorted(roots)[0]
sys.stderr.write(f"""session-lookup-guard: refused, {reason}.
Ask the tools that keep the answer (skill miadi-session-observability:session-continuity):
  which agent runs in a tmux session or pane   tide agents list
  a session id to its pane, team, episode and inventory record
                                               miadi-hooks-interpret join <id>...
  what a session did (prompts, last reply, commits, pushes, files)
                                               miadi-hooks-interpret digest <id>...
  every session at once                        miadi-hooks-interpret fleet
  the binding line of one tmux session         jq -c \x27select(.tmux.session == "<name>")\x27 {root}/data/terminal_bindings.jsonl
  where a repo, path, host or service lives    skill miadi-stack-map
Work on the capture itself: set MIADI_SESSION_LOOKUP_GUARD=off in the session environment.
""")
sys.exit(2)
'
