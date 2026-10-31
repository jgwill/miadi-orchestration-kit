#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

input=$(cat -)

# The session is now working on this prompt until its reply ends (work_in_progress.sh).
. "$SCRIPT_DIR/work_in_progress.sh"
claude_work_started "$input"

# No hook fires on /rename: record a name change at the next prompt.
. "$SCRIPT_DIR/terminal_binding.sh"
claude_check_terminal_binding_rename "$input"
# A seat miadi-run launched names its mission's prompt.md in its first prompt.
claude_check_terminal_binding_mission "$input"
session_id=$(echo "$input" | jq -r .session_id)
output_dir="$CLAUDE_SESSIONDATA_ROOT/$session_id"
mkdir -p "$output_dir"
claude_write_jsonl "$output_dir/_claude_user_inputs.jsonl" "$input"
claude_write_json "$output_dir/last_claude_user_inputs.jsonl" "$input" # We might monitor just the last input we gave
# A comment sent to Claude from an Artifact thread, or the notice of an auto-reply
# (lib.sh, claude_artifact_comments_prompt_queue).
claude_artifact_comments_prompt_queue "$output_dir" "$input"

#echo "" >> "$output_dir/_claude_user_inputs.jsonl"
