#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

input=$(cat -)

# The reply ended: the session is no longer working on a prompt (work_in_progress.sh).
. "$SCRIPT_DIR/work_in_progress.sh"
claude_work_finished "$input"

# No hook fires on /rename: record a name change at the end of each turn.
. "$SCRIPT_DIR/terminal_binding.sh"
claude_check_terminal_binding_rename "$input"
session_id=$(echo "$input" | jq -r .session_id)
transcript_path=$(echo "$input" | jq -r .transcript_path)
output_dir="$CLAUDE_SESSIONDATA_ROOT/$session_id"
mkdir -p "$output_dir"

# Capture all assistant responses as they accumulate (JSONL parsing)
if [ -f "$transcript_path" ]; then
  progressive="$output_dir/_responses_progressive.jsonl"
  jq -c 'select(.type=="assistant")' "$transcript_path" | hook_secret_sanitize_stream > "$progressive.tmp.$$" \
    && [ -s "$progressive.tmp.$$" ] && mv -f "$progressive.tmp.$$" "$progressive"
  rm -f "$progressive.tmp.$$"
fi

# Keep the whole transcript, its subagents and tool-results (lib.sh,
# claude_archive_session). Detached: the turn does not wait for it.
claude_detach bash "$SCRIPT_DIR/transcript_archive.sh" session "$transcript_path" "$output_dir"

# Save last_assistant_message as its own event stream for ceremony-session-observer
last_msg=$(echo "$input" | jq -r '.last_assistant_message // empty')
if [ -n "$last_msg" ]; then
  claude_write_jsonl "$output_dir/_claude_AssistantResponse.jsonl" "$input"
  claude_write_json "$output_dir/last_claude_AssistantResponse.json" "$input"
fi

claude_write_jsonl "$output_dir/_claude_Stop.jsonl" "$input"
