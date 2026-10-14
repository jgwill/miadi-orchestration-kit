#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

# Creates a GitHub issue on the first user prompt of each session.
# Runs on UserPromptSubmit. Skips if issue already created for this session.

input=$(cat -)
session_id=$(echo "$input" | jq -r .session_id)
user_prompt=$(echo "$input" | jq -r '.prompt // empty')

output_dir="$_SESSION_DATA_ROOT/$session_id"
mkdir -p "$output_dir"

# Only fire on the first prompt — use marker file
marker="$output_dir/.issue_created"
[ -f "$marker" ] && exit 0

# Guard: need a prompt and gh CLI
[ -z "$user_prompt" ] && exit 0
command -v gh >/dev/null 2>&1 || exit 0

# Truncate long prompts for the issue title (first 80 chars)
title_prompt=$(printf '%s' "$user_prompt" | head -c 80)
[ ${#user_prompt} -gt 80 ] && title_prompt="${title_prompt}..."

# Create the issue in the background so we don't block the session
(
    issue_url=$(gh issue create \
        --repo "${CHRONICLE_SESSIONS_REPO:-miadisabelle/chronicle-sessions}" \
        --title "Session ${session_id:0:8}: ${title_prompt}" \
        --body "$(cat <<EOF
## Session

- **ID**: \`$session_id\`
- **Started**: $(date -Iseconds)
- **CWD**: $(echo "$input" | jq -r '.cwd // "unknown"')

## First Prompt

\`\`\`
$user_prompt
\`\`\`
EOF
)" 2>&1)

    if [ $? -eq 0 ]; then
        echo "$issue_url" > "$marker"
        echo "Issue created: $issue_url at $(date -Iseconds)" >> "$output_dir/trace.log"
    else
        echo "Issue creation failed: $issue_url at $(date -Iseconds)" >> "$output_dir/trace.log"
    fi
) &

exit 0
