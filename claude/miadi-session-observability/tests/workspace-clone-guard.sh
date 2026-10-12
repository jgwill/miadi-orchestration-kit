#!/usr/bin/env bash
# The workspace clone guard: a repo mapped to a working directory in stc-workspaces.json is
# not written, committed or pushed from its second clone under the auto-clone root.
# jgwill/workspace#60.
# Run: bash tests/workspace-clone-guard.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="$HERE/hooks/workspace_clone_guard.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

CLONES="$WORK/repos"
HOME_TREE="$WORK/home-mia"
mkdir -p "$CLONES/me/home" "$CLONES/me/self" "$CLONES/me/free" "$CLONES/me/away" "$HOME_TREE"
cat > "$WORK/stc.json" <<EOF
{"defaults": {"autoClonePath": "$CLONES"},
 "workspaces": [
  {"repository": "me/home", "localPath": "$HOME_TREE"},
  {"repository": "me/self", "localPath": "$CLONES/me/self"},
  {"repository": "me/away", "localPath": "$WORK/not-on-this-host"}
 ]}
EOF
export STC_WORKSPACES_CONFIG="$WORK/stc.json"

failures=0
expect() {  # <label> <expected exit> <payload>
    printf '%s' "$3" | bash "$GUARD" 2>/dev/null
    local got=$?
    if [ "$2" = "$got" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected exit $2, got $got"
        failures=$((failures + 1))
    fi
}
edit() { printf '{"tool_name":"Edit","cwd":"%s","tool_input":{"file_path":"%s"}}' "$WORK" "$1"; }
bash_in() { python3 -c 'import json,sys;print(json.dumps({"tool_name":"Bash","cwd":sys.argv[1],"tool_input":{"command":sys.argv[2]}}))' "$1" "$2"; }

expect "Edit in a clone mapped elsewhere is refused" 2 "$(edit "$CLONES/me/home/.claude/settings.json")"
expect "Write in a clone mapped elsewhere is refused" 2 \
    "$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s"}}' "$CLONES/me/home/new.md")"
expect "Edit in the mapped working directory is allowed" 0 "$(edit "$HOME_TREE/.claude/settings.json")"
expect "Edit in a clone mapped to itself is allowed" 0 "$(edit "$CLONES/me/self/README.md")"
expect "Edit in a clone with no entry is allowed" 0 "$(edit "$CLONES/me/free/README.md")"
expect "Edit where the mapped directory is not on this host is allowed" 0 "$(edit "$CLONES/me/away/README.md")"
expect "a file directly under the owner folder is allowed" 0 "$(edit "$CLONES/me/AGENTS.md")"
expect "Read is never blocked" 0 \
    "$(printf '{"tool_name":"Read","tool_input":{"file_path":"%s"}}' "$CLONES/me/home/x")"

expect "git commit with cwd in the clone is refused" 2 "$(bash_in "$CLONES/me/home" 'git commit x -m "y"')"
expect "cd into the clone then git push is refused" 2 "$(bash_in "$WORK" "cd $CLONES/me/home && git push origin main")"
expect "git -C clone commit is refused" 2 "$(bash_in "$WORK" "git -C $CLONES/me/home commit -m z")"
expect "git pull in the clone is allowed" 0 "$(bash_in "$CLONES/me/home" 'git pull --rebase')"
expect "git status in the clone is allowed" 0 "$(bash_in "$WORK" "git -C $CLONES/me/home status")"
expect "git commit in the working directory is allowed" 0 "$(bash_in "$HOME_TREE" 'git commit a -m b')"
expect "a redirect into the clone is refused" 2 "$(bash_in "$WORK" "echo x > $CLONES/me/home/f.txt")"
expect "a redirect to stderr is not a target" 0 "$(bash_in "$CLONES/me/home" 'ls 2>&1')"
expect "reading the clone in Bash is allowed" 0 "$(bash_in "$WORK" "cat $CLONES/me/home/f.txt")"

expect "an unparseable payload is allowed" 0 'not json'
STC_WORKSPACES_CONFIG="$WORK/missing.json" expect "no config on this host is allowed" 0 \
    "$(edit "$CLONES/me/home/x")"

echo
if [ "$failures" -eq 0 ]; then
    echo "all workspace clone guard checks passed"
else
    echo "$failures check(s) failed"
    exit 1
fi
