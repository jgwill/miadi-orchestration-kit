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
mkdir -p "$ROOT/data" "$ROOT/$SID" "$WORK/elsewhere" "$WORK/kit/claude/miadi-witness"
ln -s "$ROOT" "$WORK/link-to-root"
export CLAUDE_SESSIONDATA_ROOT="$ROOT"
unset MIADI_SESSION_DIR MIADI_SESSIONDATA_ROOT SESSION_DATA_ROOT MIADI_SESSION_LOOKUP_GUARD

failures=0
expect() {  # <label> <expected exit> <command>
    expect_in "$1" "$2" "$WORK" "$3"
}
expect_in() {  # <label> <expected exit> <the shell's folder> <command>
    python3 -c 'import json,sys;print(json.dumps({"tool_name":"Bash","cwd":sys.argv[1],"tool_input":{"command":sys.argv[2]}}))' \
        "$3" "$4" | bash "$GUARD" 2>/dev/null
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
expect "jq on one session's raw capture is refused" 2 "jq -c . $ROOT/$SID/_claude_user_inputs.jsonl | tail"
expect "tail on a last_claude file is refused" 2 "tail -5 $ROOT/$SID/last_claude_PreToolUse.json"
expect "a glob over every session's capture is refused" 2 "cat $ROOT/*/_claude_PreToolUse.jsonl | wc -l"
expect "a reader behind timeout is still seen" 2 "timeout 30 grep -c Bash $ROOT/$SID/_claude_PostToolUse.jsonl"

expect "tide agents list is allowed" 0 "timeout 30 tide agents list | grep mw-rwl-repo"
expect "miadi-hooks-interpret on a session dir is allowed" 0 "miadi-hooks-interpret digest $ROOT/$SID"
expect "the binding line read with jq is allowed" 0 \
    "jq -c 'select(.tmux.session == \"mw-rwl-repo\")' $ROOT/data/terminal_bindings.jsonl | tail -3"
expect "a find under another folder is allowed" 0 "find $WORK/elsewhere -name '*.md'"
expect "a find from a relative folder is allowed" 0 "find . -name SKILL.md"
expect "a non-recursive ls of a session folder is allowed" 0 "ls $ROOT/$SID"
expect "a grep for / as text is allowed" 0 "grep -n '/' README.md"
expect "an empty command is allowed" 0 ""

# A relative path is read against the folder the command cds to (2026-11-10, Phase 4 of the
# search-inside-sessions mission), and a scan of the capture is still refused.
IN="$ROOT/$SID"
expect_in "measured: from a shell in the capture, cd to a repo then grep -r a folder there is allowed" 0 "$IN" \
    "cd $WORK/kit/claude && grep -rlE \"workspace/\\.mino\" miadi-witness"
expect_in "from a shell in the capture, grep -r . is still refused" 2 "$IN" "grep -rn mw-rwl-repo ."
expect_in "after a cd elsewhere, grep -r over the root by its path is still refused" 2 "$IN" "cd $WORK/elsewhere && grep -rn x $ROOT"
expect "a cd into the root then grep -r . is refused" 2 "cd $ROOT && grep -rn x ."
expect "a cd into a session folder then cat of its raw capture is refused" 2 "cd $ROOT/$SID; cat _claude_user_inputs.jsonl"
expect_in "a cd inside a closed subshell does not carry past it" 2 "$IN" "(cd $WORK/elsewhere); grep -rn x ."
expect_in "a cd piped into the search does not carry into it" 2 "$IN" "cd $WORK/elsewhere | grep -rn x ."
expect_in "a cd to a folder the guard cannot read falls back to the shell's folder" 2 "$IN" "cd \"\$NOT_SET_ANYWHERE\" && grep -rn x ."
expect_in "cds follow one another" 0 "$IN" "cd $WORK/elsewhere; cd ..; grep -rn x elsewhere kit"

printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":"find / -name x"}}' "$WORK" \
    | MIADI_SESSION_LOOKUP_GUARD=off bash "$GUARD" 2>/dev/null
if [ $? = 0 ]; then echo "ok   MIADI_SESSION_LOOKUP_GUARD=off in the environment allows"; else echo "FAIL the off switch"; failures=$((failures + 1)); fi

out="$(printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":"find / -name x"}}' "$WORK" | bash "$GUARD" 2>&1 >/dev/null)"
case "$out" in
    *"tide agents list"*"miadi-hooks-interpret join"*) echo "ok   the refusal names the doors" ;;
    *) echo "FAIL the refusal does not name the doors"; failures=$((failures + 1)) ;;
esac

[ "$failures" = 0 ] && echo "all passed" || { echo "$failures failed"; exit 1; }
