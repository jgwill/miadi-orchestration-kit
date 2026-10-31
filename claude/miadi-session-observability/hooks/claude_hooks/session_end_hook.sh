#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"
. "$SCRIPT_DIR/terminal_binding.sh"

# Claude Code cancels SessionEnd hooks after 1.5 s (CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS)
# and prints "SessionEnd hook ... failed: Hook cancelled" on exit. The binding line alone
# costs about 1 s of jq, and sanitizing a large transcript takes seconds. So the hook reads
# what disappears when claude exits (its pid and command line), hands the rest to a detached
# copy of itself, and returns at once. setsid puts the copy outside claude's process group.
if [ "${1:-}" != "--detached" ]; then
    MIADI_SESSION_END_INPUT=$(cat -)
    [[ $MIADI_SESSION_END_INPUT =~ \"session_id\":\"([A-Za-z0-9_-]+)\" ]] && _tb_sid="${BASH_REMATCH[1]}"
    _TB_AGENT_PID=$(_tb_agent_pid "${_tb_sid:-}")
    _TB_ARGV_JSON=$(_tb_argv_json "$_TB_AGENT_PID")
    export MIADI_SESSION_END_INPUT _TB_AGENT_PID _TB_ARGV_JSON
    if command -v setsid >/dev/null 2>&1; then
        setsid bash "${BASH_SOURCE[0]}" --detached </dev/null >/dev/null 2>&1 &
    else
        nohup bash "${BASH_SOURCE[0]}" --detached </dev/null >/dev/null 2>&1 &
    fi
    exit 0
fi

input="$MIADI_SESSION_END_INPUT"
. "$SCRIPT_DIR/work_in_progress.sh"
claude_work_finished "$input"
claude_write_terminal_binding "session.end" "$input"
session_id=$(echo "$input" | jq -r .session_id)
transcript_path=$(echo "$input" | jq -r .transcript_path)
output_dir="$CLAUDE_SESSIONDATA_ROOT/$session_id"
mkdir -p "$output_dir"

claude_write_jsonl "$output_dir/_claude_SessionEnd.jsonl" "$input"
claude_write_json "$output_dir/last_claude_SessionEnd.jsonl" "$input"

# Archive the complete transcript, its subagents and tool-results (lib.sh)
claude_with_lock "$output_dir/.archive.lock" claude_archive_session "$transcript_path" "$output_dir"
