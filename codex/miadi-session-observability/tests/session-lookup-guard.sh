#!/usr/bin/env bash
# The session lookup guard: which agent runs where, and what a session did, are asked of
# tide and miadi-hooks-interpret, never searched for on disk (2026-11-01, William).
# Run: bash tests/session-lookup-guard.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="$HERE/hooks/session_lookup_guard.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

ROOT="$WORK/_sessiondata"
SID="0e514958-b9e0-49cb-b60d-27ad83d8b258"
mkdir -p "$ROOT/data" "$ROOT/$SID" "$WORK/elsewhere"
ln -s "$ROOT" "$WORK/link-to-root"
export CODEX_SESSIONDATA_ROOT="$ROOT"
unset MIADI_SESSION_DIR MIADI_SESSIONDATA_ROOT SESSION_DATA_ROOT MIADI_SESSION_LOOKUP_GUARD

failures=0
expect() {  # <label> <expected exit> <command>
    python3 -c 'import json,sys;print(json.dumps({"tool_name":"Bash","cwd":sys.argv[1],"tool_input":{"command":sys.argv[2]}}))' \
        "$WORK" "$3" | bash "$GUARD" 2>/dev/null
    local got=$?
    if [ "$2" = "$got" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected exit $2, got $got"
        failures=$((failures + 1))
    fi
}

expect "the command that started this guard is refused" 2 \
    "ps -o pid,args --ppid 71679 2>/dev/null | head; echo ---; find / -name terminal_bindings.jsonl 2>/dev/null | head -3"
expect "a find from / with options first is refused" 2 "find / -maxdepth 3 -type d"
expect "a find under the sessiondata root is refused" 2 "find $ROOT -name '*.jsonl'"
expect "a find through a link to the root is refused" 2 "find $WORK/link-to-root -newer x"
expect "a recursive grep over the root is refused" 2 "grep -rn mw-rwl-repo $ROOT"
expect "rg over the root is refused" 2 "rg K7c $ROOT"
expect "ls -R over the root is refused" 2 "ls -laR $ROOT"
expect "jq on one session's raw capture is refused" 2 "jq -c . $ROOT/$SID/_codex_user_inputs.jsonl | tail"
expect "tail on a last_codex file is refused" 2 "tail -5 $ROOT/$SID/last_codex_PreToolUse.json"
expect "a glob over every session's capture is refused" 2 "cat $ROOT/*/_codex_PreToolUse.jsonl | wc -l"
expect "a reader behind timeout is still seen" 2 "timeout 30 grep -c Bash $ROOT/$SID/_codex_PostToolUse.jsonl"

expect "tide agents list is allowed" 0 "timeout 30 tide agents list | grep mw-rwl-repo"
expect "miadi-hooks-interpret on a session dir is allowed" 0 "miadi-hooks-interpret digest $ROOT/$SID"
expect "the binding line read with jq is allowed" 0 \
    "jq -c 'select(.tmux.session == \"mw-rwl-repo\")' $ROOT/data/terminal_bindings.jsonl | tail -3"
expect "a find under another folder is allowed" 0 "find $WORK/elsewhere -name '*.md'"
expect "a find from a relative folder is allowed" 0 "find . -name SKILL.md"
expect "a non-recursive ls of a session folder is allowed" 0 "ls $ROOT/$SID"
expect "a grep for / as text is allowed" 0 "grep -n '/' README.md"
expect "an empty command is allowed" 0 ""

printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":"find / -name x"}}' "$WORK" \
    | MIADI_SESSION_LOOKUP_GUARD=off bash "$GUARD" 2>/dev/null
if [ $? = 0 ]; then echo "ok   MIADI_SESSION_LOOKUP_GUARD=off in the environment allows"; else echo "FAIL the off switch"; failures=$((failures + 1)); fi

out="$(printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":"find / -name x"}}' "$WORK" | bash "$GUARD" 2>&1 >/dev/null)"
case "$out" in
    *"tide agents list"*"miadi-hooks-interpret join"*) echo "ok   the refusal names the doors" ;;
    *) echo "FAIL the refusal does not name the doors"; failures=$((failures + 1)) ;;
esac

[ "$failures" = 0 ] && echo "all passed" || { echo "$failures failed"; exit 1; }
