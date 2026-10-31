#!/usr/bin/env bash
# A prompt puts the session in <state>/miadi/working/<session_id>.json until its reply ends:
# Stop or SessionEnd removes it. A file left there after a power-off is how tide knows the
# session was cut off mid-reply (jgwill/gaia#97).
# Run: bash tests/work-in-progress.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS="$HERE/hooks/claude_hooks"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export HOME="$WORK/home" CLAUDE_SESSIONDATA_ROOT="$WORK/root" XDG_STATE_HOME="$WORK/state"
mkdir -p "$HOME/.claude/sessions" "$CLAUDE_SESSIONDATA_ROOT"
unset TMUX TMUX_PANE MIADI_RUN_MISSION MIADI_TEAM

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected $2, got $3"
        failures=$((failures + 1))
    fi
}
hook() { printf '%s' "$2" | bash "$HOOKS/$1" > /dev/null 2>&1; }
marker="$XDG_STATE_HOME/miadi/working/s-1.json"

long=$(printf 'word %.0s' $(seq 1 200))
hook user_prompt_submit_hook.sh "$(jq -nc --arg p "Create the child issue
of jgwill/Miadi#666. $long" '{session_id: "s-1", cwd: "/a/src/Miadi-18", transcript_path: "/tmp/t.jsonl", prompt: $p, hook_event_name: "UserPromptSubmit"}')"
expect "a prompt writes the marker" "yes" "$([ -f "$marker" ] && echo yes || echo no)"
expect "with the session id" "s-1" "$(jq -r .session_id "$marker")"
expect "its folder" "/a/src/Miadi-18" "$(jq -r .cwd "$marker")"
expect "its transcript" "/tmp/t.jsonl" "$(jq -r .transcript_path "$marker")"
expect "the prompt on one line" "Create the child issue of jgwill/Miadi#666. word" "$(jq -r '.prompt[0:48]' "$marker")"
expect "cut at 600 characters" "600" "$(jq -r '.prompt | length' "$marker")"
expect "a start time" "true" "$(jq -r '.started_at | test("^[0-9]{4}-[0-9]{2}-[0-9]{2}T")' "$marker")"
expect "readable by its owner only" "600" "$(stat -c %a "$marker")"

hook stop_hook.sh '{"session_id":"s-1","transcript_path":"/nonexistent","hook_event_name":"Stop"}'
expect "the end of the reply removes it" "no" "$([ -f "$marker" ] && echo yes || echo no)"

hook user_prompt_submit_hook.sh '{"session_id":"s-1","cwd":"/tmp","prompt":"again","hook_event_name":"UserPromptSubmit"}'
MIADI_SESSION_END_INPUT='{"session_id":"s-1","transcript_path":"/nonexistent","hook_event_name":"SessionEnd"}' \
    bash "$HOOKS/session_end_hook.sh" --detached > /dev/null 2>&1
expect "so does the end of the session" "no" "$([ -f "$marker" ] && echo yes || echo no)"

hook user_prompt_submit_hook.sh '{"cwd":"/tmp","prompt":"no id"}'
expect "a prompt without a session id writes nothing" "0" "$(find "$XDG_STATE_HOME/miadi/working" -name '*.json' | wc -l)"

[ "$failures" -eq 0 ] && echo "all passed" || { echo "$failures failed"; exit 1; }
