#!/bin/bash
# Writes what one tool call published to _codex_publications.jsonl (lib.sh,
# codex_publications_capture). Run detached by PostToolUse, so no tool call
# waits for the git checks.
#   publications.sh <output_dir> <tool_use_id>
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

[ -n "${1:-}" ] && [ -n "${2:-}" ] && [ -d "$1" ] || exit 0
codex_with_lock "$1/.publications.lock" codex_publications_capture "$1" "$2"
