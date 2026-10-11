#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

input=$(cat -)
session_id=$(echo "$input" | jq -r .session_id)

# Capture-output root resolved in lib.sh (portable via env alias / self-location)
output_dir="$CLAUDE_SESSIONDATA_ROOT/$session_id"
mkdir -p "$output_dir"
claude_write_jsonl "$output_dir/_claude_PostToolUseFailure.jsonl" "$input"
claude_write_json "$output_dir/last_claude_PostToolUseFailure.json" "$input"

# A failed command can still have written files: copy them to written/,
# detached (lib.sh, claude_files_written_queue).
tool_name=$(echo "$input" | jq -r .tool_name)
claude_files_written_queue "$output_dir" "$input" "$tool_name"
