#!/usr/bin/env bash
# The guards through the dispatcher Codex actually calls: Codex's own tool names and input shapes
# reach them, a refusal is exit 2 before any capture of the call as a command, and the exposure
# alert is the only thing the hook prints. Every refused command is harmless if it ever ran.
# Run: bash tests/dispatch-guards.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DISPATCH="$HERE/hooks/codex_hooks/dispatch.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export HOME="$WORK/home" CODEX_SESSIONDATA_ROOT="$WORK/root" XDG_STATE_HOME="$WORK/state" CODEX_HOME="$WORK/home/.codex"
mkdir -p "$CODEX_HOME" "$CODEX_SESSIONDATA_ROOT"
unset TMUX TMUX_PANE MIADI_RUN_MISSION MIADI_TEAM MIADI_SRC MIADI_TMUX_SERVER_GUARD MIADI_SECRET_PRINT_GUARD MIADI_SESSION_LOOKUP_GUARD

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected $2, got $3"; failures=$((failures + 1)); fi
}
SID=11111111-2222-3333-4444-555555555555
OUT="$CODEX_SESSIONDATA_ROOT/$SID"
pre() {  # <tool name> <tool input json>; prints the exit status, keeps stderr
    jq -nc --arg sid "$SID" --arg tool "$1" --argjson input "$2" --arg cwd "$WORK" \
        '{session_id:$sid, hook_event_name:"PreToolUse", cwd:$cwd, tool_name:$tool, tool_use_id:"call_1", tool_input:$input}' \
        | bash "$DISPATCH" PreToolUse > "$WORK/stdout" 2> "$WORK/stderr"
    echo $?
}
bash_cmd() { pre Bash "$(jq -nc --arg c "$1" '{command:$c}')"; }

export EXAMPLE_API_TOKEN="$(head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)"

expect "the tmux guard refuses through the dispatcher" 2 "$(bash_cmd 'pkill -0 -x tmux')"
expect "and says why on stderr" 1 "$(grep -c 'tmux-server-guard: refused' "$WORK/stderr")"
expect "a refused command is not listed as run" no "$([ -f "$OUT/_codex_bash_commands.jsonl" ] && echo yes || echo no)"
expect "the event itself is still captured" 1 "$(wc -l < "$OUT/_codex_PreToolUse.jsonl" | tr -d ' ')"
expect "the lookup guard refuses" 2 "$(bash_cmd 'find / -maxdepth 0 -name nothing')"
expect "the secret guard refuses" 2 "$(bash_cmd 'printenv EXAMPLE_API_TOKEN')"
expect "and never shows the value" 0 "$(grep -cF "$EXAMPLE_API_TOKEN" "$WORK/stderr")"
expect "Codex's exec_command shape is refused" 2 "$(pre exec_command '{"cmd":"pkill -0 -x tmux"}')"
expect "Codex's shell argv shape is refused" 2 "$(pre shell '{"command":["bash","-c","pkill -0 -x tmux"]}')"
expect "an ordinary command passes" 0 "$(bash_cmd 'echo hello')"
expect "and is listed" 1 "$(wc -l < "$OUT/_codex_bash_commands.jsonl" | tr -d ' ')"
expect "a guard's switch in the session environment is honoured" 0 "$(MIADI_TMUX_SERVER_GUARD=off bash_cmd 'pkill -0 -x tmux')"
expect "a prefix in the command text is not" 2 "$(bash_cmd 'MIADI_TMUX_SERVER_GUARD=off pkill -0 -x tmux')"

post() {  # <output>; prints the hook's stdout
    jq -nc --arg sid "$SID" --arg out "$1" --arg cwd "$WORK" \
        '{session_id:$sid, hook_event_name:"PostToolUse", cwd:$cwd, tool_name:"exec_command", tool_use_id:"call_2", tool_input:{cmd:"probe"}, tool_response:$out}' \
        | bash "$DISPATCH" PostToolUse
}
said=$(post "the probe answered with $EXAMPLE_API_TOKEN")
expect "a held credential is announced as one JSON reply" true "$(jq -e 'has("systemMessage") and (.hookSpecificOutput.hookEventName == "PostToolUse")' <<< "$said")"
expect "by its name" 1 "$(jq -r .systemMessage <<< "$said" | grep -c 'EXAMPLE_API_TOKEN')"
expect "the reply never carries the value" 0 "$(grep -cF "$EXAMPLE_API_TOKEN" <<< "$said")"
expect "the ledger has it" rotate "$(jq -r .action "$OUT/_codex_secret_exposures.jsonl")"
expect "the ledger never carries the value" 0 "$(grep -cF "$EXAMPLE_API_TOKEN" "$OUT/_codex_secret_exposures.jsonl")"
expect "ordinary output prints nothing" "" "$(post 'all fine')"

[ "$failures" -eq 0 ] && echo "all passed" || { echo "$failures failed"; exit 1; }
