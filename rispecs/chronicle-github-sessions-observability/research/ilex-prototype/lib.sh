#!/usr/bin/env bash

_CLAUDE_HOOKS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../secret_capture_sanitizer.sh
. "$_CLAUDE_HOOKS_ROOT/secret_capture_sanitizer.sh"

# Portable session data root: set CLAUDE_SESSION_DIR to override /src/_sessiondata
_SESSION_DATA_ROOT="${CLAUDE_SESSION_DIR:-/src/_sessiondata}"

claude_write_jsonl() {
    local file="$1"
    local text="$2"
    hook_secret_write_line "$file" "$text"
}

claude_write_json() {
    local file="$1"
    local text="$2"
    hook_secret_overwrite_line "$file" "$text"
}

claude_sanitize_file_to() {
    local src="$1"
    local dest="$2"
    hook_secret_sanitize_file_to "$src" "$dest"
}

claude_sanitize_text() {
    hook_secret_sanitize_text "$1"
}
