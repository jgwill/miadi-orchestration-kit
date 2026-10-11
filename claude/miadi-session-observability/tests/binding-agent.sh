#!/usr/bin/env bash
# The binding line's agent process: the nearest ancestor Claude Code registered for THIS
# session, else the nearest claude. A `claude -p` started inside another session is not
# registered, and must not take the parent session's pid, name and command line.
# Run: bash tests/binding-agent.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export HOME="$WORK/home" CLAUDE_SESSIONDATA_ROOT="$WORK/root"
mkdir -p "$HOME/.claude/sessions" "$CLAUDE_SESSIONDATA_ROOT" "$WORK/bin"
cp "$(command -v bash)" "$WORK/bin/claude"   # a process whose comm is "claude"

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected $2, got $3"
        failures=$((failures + 1))
    fi
}

LOAD=". '$HERE/hooks/claude_hooks/lib.sh'; . '$HERE/hooks/claude_hooks/terminal_binding.sh'"

# This shell is the parent agent, registered for its own session.
printf '{"pid":%s,"sessionId":"parent-sid"}\n' "$$" > "$HOME/.claude/sessions/$$.json"

expect "the registered agent of this session" "$$" \
    "$(bash -c "$LOAD; _tb_agent_pid parent-sid")"
expect "no session given: the nearest registered agent, as before" "$$" \
    "$(bash -c "$LOAD; _tb_agent_pid")"

# A nested claude, not registered, under the registered parent.
out=$("$WORK/bin/claude" -c "bash -c \"$LOAD; echo \\\$PPID:\\\$(_tb_agent_pid child-sid)\"; true")
expect "a nested session names its own claude, not the parent" "${out%%:*}" "${out#*:}"

# Claude Code registered the nested claude, still under its previous session id (a /clear).
out=$("$WORK/bin/claude" -c "bash -c \"$LOAD; printf '{\\\"sessionId\\\":\\\"old-sid\\\"}' > \\\$HOME/.claude/sessions/\\\$PPID.json; echo \\\$PPID:\\\$(_tb_agent_pid new-sid)\"; true")
expect "a registry entry one session behind still names its own claude" "${out%%:*}" "${out#*:}"

echo
if [ "$failures" -eq 0 ]; then
    echo "all binding agent checks passed"
else
    echo "$failures check(s) failed"
    exit 1
fi
