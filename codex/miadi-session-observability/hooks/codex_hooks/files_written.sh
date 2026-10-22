#!/bin/bash
# Copies the files one tool call wrote to written/ (lib.sh,
# codex_files_written_capture). Run detached by PostToolUse and
# PostToolUseFailure, so no tool call waits for it.
#   files_written.sh <output_dir> <tool_use_id>
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

[ -n "${1:-}" ] && [ -n "${2:-}" ] && [ -d "$1" ] || exit 0
codex_with_lock "$1/.files_written.lock" codex_files_written_capture "$1" "$2"
