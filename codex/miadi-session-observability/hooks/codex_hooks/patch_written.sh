#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"
output_dir="$1"; input="$2"
id=$(jq -r '.tool_use_id' <<< "$input")
prompt=$(jq -r '.prompt_id // empty' <<< "$input")
agent=$(jq -r '.agent_id // empty' <<< "$input")
n=0
while IFS= read -r path; do
    [ -f "$path" ] || continue
    n=$((n + 1))
    [ "$n" -le "$CODEX_WRITTEN_MAX_LINES" ] || break
    codex_files_written_keep "$output_dir" "$path" changed "$n" "$id" apply_patch "$agent" "" "$prompt"
done < <(python3 "$SCRIPT_DIR/native.py" patch-paths <<< "$input")
