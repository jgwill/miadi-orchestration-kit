#!/usr/bin/env bash
# A prompt puts the session in <state>/miadi/working/<session_id>.json until its reply ends.
# Stop, Interrupt or SessionEnd removes it. A file left there after a power-off is how tide knows
# the session was cut off mid-reply (jgwill/gaia#97, jgwill/Miadi#990).
# Run: bash tests/work-in-progress.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DISPATCH="$HERE/hooks/codex_hooks/dispatch.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export HOME="$WORK/home" CODEX_SESSIONDATA_ROOT="$WORK/root" XDG_STATE_HOME="$WORK/state" CODEX_HOME="$WORK/home/.codex"
mkdir -p "$CODEX_HOME" "$CODEX_SESSIONDATA_ROOT"
unset TMUX TMUX_PANE MIADI_RUN_MISSION MIADI_TEAM

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected $2, got $3"; failures=$((failures + 1)); fi
}
SID=01a1c059-0000-7000-8000-000000000001
marker="$XDG_STATE_HOME/miadi/working/$SID.json"
there() { [ -f "$marker" ] && echo yes || echo no; }
event() { printf '%s' "$2" | bash "$DISPATCH" "$1" > /dev/null 2>&1; }
prompt() { event UserPromptSubmit "$(jq -nc --arg sid "$SID" --arg p "$1" '{session_id:$sid, cwd:"/src/Miadi", transcript_path:"/tmp/rollout.jsonl", prompt:$p, turn_id:"t1"}')"; }
ended() { jq -nc --arg sid "$SID" '{session_id:$sid, cwd:"/src/Miadi", transcript_path:"/nonexistent"}'; }

long=$(printf 'word %.0s' $(seq 1 200))
prompt "Set up the plugin
of jgwill/Miadi#990. $long"
expect "a prompt writes the marker" yes "$(there)"
expect "with the session id" "$SID" "$(jq -r .session_id "$marker")"
expect "its folder" /src/Miadi "$(jq -r .cwd "$marker")"
expect "its rollout" /tmp/rollout.jsonl "$(jq -r .transcript_path "$marker")"
expect "the prompt on one line" "Set up the plugin of jgwill/Miadi#990. word" "$(jq -r '.prompt[0:43]' "$marker")"
expect "cut at 600 characters" 600 "$(jq -r '.prompt | length' "$marker")"
expect "readable by its owner only" 600 "$(stat -c %a "$marker")"

event Stop "$(ended)"
expect "the end of the reply removes it" no "$(there)"
prompt again; expect "a new prompt writes it again" yes "$(there)"
event Interrupt "$(ended)"
expect "an interrupt removes it before the hook returns" no "$(there)"
prompt again; event SessionEnd "$(ended)"
expect "so does the end of the session" no "$(there)"
sleep 1

[ "$failures" -eq 0 ] && echo "all passed" || { echo "$failures failed"; exit 1; }
