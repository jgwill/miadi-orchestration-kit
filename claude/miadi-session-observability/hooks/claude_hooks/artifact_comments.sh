#!/bin/bash
# Writes the artifact comment threads one tool call or prompt carried to
# _claude_artifact_comments.jsonl (lib.sh, claude_artifact_comments_capture). Run
# detached by PostToolUse and UserPromptSubmit, so no call waits for the index.
#   artifact_comments.sh <output_dir> <job id>
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

[ -n "${1:-}" ] && [ -n "${2:-}" ] && [ -d "$1" ] || exit 0
claude_with_lock "$1/.artifact_comments.lock" claude_artifact_comments_capture "$1" "$2"
