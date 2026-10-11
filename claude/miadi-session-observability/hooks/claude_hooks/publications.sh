#!/bin/bash
# Writes what one tool call published to _claude_publications.jsonl (lib.sh,
# claude_publications_capture). Run detached by PostToolUse, so no tool call
# waits for the git checks.
#   publications.sh <output_dir> <tool_use_id>
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

[ -n "${1:-}" ] && [ -n "${2:-}" ] && [ -d "$1" ] || exit 0
claude_with_lock "$1/.publications.lock" claude_publications_capture "$1" "$2"
