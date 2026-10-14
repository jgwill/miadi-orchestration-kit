#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

# Posts a closing comment on the session's GitHub issue at SessionEnd.
# Includes the last assistant message and a session summary.

input=$(cat -)
session_id=$(echo "$input" | jq -r .session_id)
transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')

output_dir="$_SESSION_DATA_ROOT/$session_id"

# Only proceed if an issue was created for this session
marker="$output_dir/.issue_created"
[ -f "$marker" ] || exit 0

issue_url=$(cat "$marker" | head -1)
[ -z "$issue_url" ] && exit 0

command -v gh >/dev/null 2>&1 || exit 0

# Extract last assistant message from transcript
last_message=""
if [ -f "$transcript_path" ]; then
    last_message=$(jq -rs '[.[] | select(.type=="assistant")] | last | .message.content[] | select(.type=="text") | .text' "$transcript_path" 2>/dev/null)
fi

# Build session summary from captured JSONL files
tool_count=0
user_input_count=0
if [ -f "$output_dir/_claude_PostToolUse.jsonl" ]; then
    tool_count=$(wc -l < "$output_dir/_claude_PostToolUse.jsonl")
fi
if [ -f "$output_dir/_claude_user_inputs.jsonl" ]; then
    user_input_count=$(wc -l < "$output_dir/_claude_user_inputs.jsonl")
fi

# Count unique files touched (from PreToolUse Write/Edit events)
files_touched=0
if [ -f "$output_dir/_claude_PreToolUse.jsonl" ]; then
    files_touched=$(jq -r 'select(.tool_name=="Write" or .tool_name=="Edit") | .tool_input.file_path // empty' "$output_dir/_claude_PreToolUse.jsonl" 2>/dev/null | sort -u | grep -c .)
fi

# Truncate last message if very long
if [ ${#last_message} -gt 3000 ]; then
    last_message="${last_message:0:3000}

_(truncated)_"
fi

# Post comment in background
(
    gh issue comment "$issue_url" --body "$(cat <<EOF
## Session End

### Summary

| Metric | Count |
|--------|-------|
| User prompts | $user_input_count |
| Tool uses | $tool_count |
| Files touched | $files_touched |

### Last Agent Response

${last_message:-_(no final message captured)_}
EOF
)" 2>>"$output_dir/trace.log"

    echo "Session end comment posted to $issue_url at $(date -Iseconds)" >> "$output_dir/trace.log"
) &

exit 0
