#!/usr/bin/env bash
# workspace_clone_guard.sh: PreToolUse guard. A repo that stc-workspaces.json maps to a
# working directory is worked on there, never in its second clone under the auto-clone root.
#
# WHY
#   miadisabelle/home is worked on in /home/mia. A session committed and pushed from
#   /workspace/repos/miadisabelle/home on 2026-09-27 (cff790a), and the next pull in /home/mia
#   on 2026-10-12 stopped on a rebase conflict. jgwill/workspace#60.
#
# WHAT IT BLOCKS
#   A write whose target lies in <autoClonePath>/<owner>/<repo>/ when the config maps
#   owner/repo to another localPath that exists on this host:
#     Write, Edit, MultiEdit, NotebookEdit    the file_path / notebook_path
#     Bash  >  >>                             the redirect target
#     Bash  git commit / git push             run in the clone (cwd, a `cd`, or `git -C`)
#
# WHAT IT ALLOWS
#   Reads, git fetch and git pull in the clone. A repo with no entry, or whose entry points at
#   the clone itself. An entry whose localPath does not exist on this host (the clone is then
#   the only copy here). A host with no Miadi checkout (MIADI_SRC unset) or no config.
#
# CONFIG
#   STC_WORKSPACES_CONFIG, else $MIADI_SRC/config/stc-workspaces.json. MIADI_SRC names the
#   jgwill/Miadi checkout of a developer host. With neither set the guard has nothing to
#   read and allows everything, while the capture hooks of this plugin run as usual.
#   The clone root is the config's defaults.autoClonePath (/workspace/repos on gaia).
#   To work in a clone on purpose, point that repo's localPath at it in the config.
#
# EXIT  0 allow, also on any internal failure (unreadable config or payload, no python3).
#       2 block, refusal on stderr, fed back to the model by Claude Code.
#
# TEST  bash tests/workspace-clone-guard.sh

set -uo pipefail

if [ -n "${STC_WORKSPACES_CONFIG:-}" ]; then
  CONFIG="$STC_WORKSPACES_CONFIG"
elif [ -n "${MIADI_SRC:-}" ]; then
  CONFIG="$MIADI_SRC/config/stc-workspaces.json"
else
  exit 0
fi
[ -r "$CONFIG" ] || exit 0
command -v python3 >/dev/null 2>&1 || exit 0

python3 -c '
import json, os, shlex, sys

try:
    p = json.load(sys.stdin)
    cfg = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)

root = os.path.realpath((cfg.get("defaults") or {}).get("autoClonePath") or "/workspace/repos")
homes = {}
for w in cfg.get("workspaces") or []:
    repo, lp = (w.get("repository") or "").lower(), w.get("localPath")
    if repo and lp:
        homes.setdefault(repo, []).append(os.path.realpath(lp))

def under(path, base):
    return path == base or path.startswith(base + os.sep)

def check(target):
    t = os.path.realpath(target)
    if not t.startswith(root + os.sep):
        return None
    parts = t[len(root) + 1:].split(os.sep)
    if len(parts) < 2:
        return None
    repo = (parts[0] + "/" + parts[1]).lower()
    mapped = homes.get(repo)
    if not mapped or any(under(t, h) for h in mapped):
        return None
    live = [h for h in mapped if os.path.isdir(h)]
    if not live:
        return None
    return repo, os.path.join(root, parts[0], parts[1]), live

tool = p.get("tool_name") or ""
ti = p.get("tool_input") or {}
cwd = p.get("cwd") or os.getcwd()
targets = []

if tool == "apply_patch":
    import re
    for line in (ti.get("command") or ti.get("patch") or "").splitlines():
        match = re.match(r"\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$", line)
        if match:
            f = match[1]
            targets.append(("write", f if os.path.isabs(f) else os.path.join(cwd, f)))
elif tool in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
    f = ti.get("file_path") or ti.get("notebook_path")
    if f:
        targets.append(("write", f if os.path.isabs(f) else os.path.join(cwd, f)))
elif tool == "Bash":
    cmd = ti.get("command") or ""
    try:
        toks = shlex.split(cmd, comments=True)
    except ValueError:
        toks = cmd.split()
    BREAK = {"&&", "||", ";", "|", "&", "(", ")", "{", "}"}
    here = cwd
    def absolutise(raw, base):
        q = os.path.expanduser(os.path.expandvars(raw))
        return q if os.path.isabs(q) else os.path.normpath(os.path.join(base, q))
    i = 0
    while i < len(toks):
        t = toks[i]
        if t in ("cd", "pushd") and i + 1 < len(toks) and toks[i + 1] not in BREAK:
            here = absolutise(toks[i + 1], here)
            i += 2
            continue
        if os.path.basename(t) == "git":
            gdir, j = here, i + 1
            while j < len(toks) and toks[j].startswith("-"):
                if toks[j] == "-C" and j + 1 < len(toks):
                    gdir = absolutise(toks[j + 1], gdir)
                    j += 2
                elif toks[j] == "-c":
                    j += 2
                else:
                    j += 1
            if j < len(toks) and toks[j] in ("commit", "push"):
                targets.append(("git " + toks[j], gdir))
            i = j
            continue
        if t.startswith(">"):
            tail = t.lstrip(">")
            if tail and not tail.startswith("&"):
                targets.append(("redirect", absolutise(tail, here)))
            elif not tail and i + 1 < len(toks) and toks[i + 1] not in BREAK:
                targets.append(("redirect", absolutise(toks[i + 1], here)))
                i += 1
        i += 1
else:
    sys.exit(0)

for kind, target in targets:
    hit = check(target)
    if not hit:
        continue
    repo, clone, live = hit
    sys.stderr.write(
        "Refused: " + kind + " into " + target + "\n\n"
        "  " + clone + " is a second clone of " + repo + ".\n"
        "  " + sys.argv[1] + " maps " + repo + " to " + " and ".join(live) + ". Work there.\n\n"
        "  A commit made in a second clone reaches origin from a tree nobody else works in,\n"
        "  and the next pull in the working directory stops on a rebase conflict\n"
        "  (miadisabelle/home, jgwill/workspace#60).\n\n"
        "  Reading the clone, git fetch and git pull in it are not blocked. To work in the\n"
        "  clone on purpose, point the repo localPath at it in the config first.\n")
    sys.exit(2)
sys.exit(0)
' "$CONFIG"
[ $? -eq 2 ] && exit 2
exit 0
