#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"
. "$SCRIPT_DIR/terminal_binding.sh"

# Claude Code cancels SessionEnd hooks after 1.5 s (CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS)
# and prints "SessionEnd hook ... failed: Hook cancelled" on exit. The binding line alone
# costs about 1 s of jq, and sanitizing a large transcript takes seconds. So the hook reads
# what disappears when claude exits (its pid and command line), hands the rest to a detached
# copy of itself, and returns at once. setsid puts the copy outside claude's process group.
if [ "${1:-}" != "--detached" ]; then
    MIADI_SESSION_END_INPUT=$(cat -)
    [[ $MIADI_SESSION_END_INPUT =~ \"session_id\":\"([A-Za-z0-9_-]+)\" ]] && _tb_sid="${BASH_REMATCH[1]}"
    _TB_AGENT_PID=$(_tb_agent_pid "${_tb_sid:-}")
    _TB_ARGV_JSON=$(_tb_argv_json "$_TB_AGENT_PID")
    export MIADI_SESSION_END_INPUT _TB_AGENT_PID _TB_ARGV_JSON
    if command -v setsid >/dev/null 2>&1; then
        setsid bash "${BASH_SOURCE[0]}" --detached </dev/null >/dev/null 2>&1 &
    else
        nohup bash "${BASH_SOURCE[0]}" --detached </dev/null >/dev/null 2>&1 &
    fi
    exit 0
fi

# The ending session's inventory record (miadi-witness scripts/inventory.mjs, fields in SCHEMA.md
# of the inventory folder), written from the binding line and the hook capture with no model
# call. The script comes from the installed miadi-witness plugin, else from the kit checkout at
# MIADI_ORCHESTRATION_KIT_ROOT. With neither, with no node, or on a host with no inventory folder,
# nothing is written. A headless `claude -p` child is left out, as inventory.mjs --all leaves it.
_inventory_script() {
    local cwd="$1" registry="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/installed_plugins.json" path
    if [ -r "$registry" ]; then
        # A user install, or a project or local install whose folder holds the session's cwd.
        while IFS= read -r path; do
            [ -n "$path" ] && [ -f "$path/scripts/inventory.mjs" ] && { printf '%s\n' "$path/scripts/inventory.mjs"; return 0; }
        done < <(jq -r --arg cwd "$cwd" '
            .plugins // {} | to_entries[] | select(.key | startswith("miadi-witness@")) | .value[]?
            | select(.projectPath == null or (.projectPath as $p | $cwd == $p or ($cwd | startswith($p + "/"))))
            | .installPath // empty' "$registry" 2>/dev/null)
    fi
    path="${MIADI_ORCHESTRATION_KIT_ROOT:-}/claude/miadi-witness/scripts/inventory.mjs"
    [ -n "${MIADI_ORCHESTRATION_KIT_ROOT:-}" ] && [ -f "$path" ] && { printf '%s\n' "$path"; return 0; }
    return 1
}

claude_write_session_inventory() {
    local input="$1" session_id="$2" output_dir="$3" script run=(node)
    command -v node >/dev/null 2>&1 || return 0
    jq -e 'any(.[]?; . == "-p" or . == "--print")' <<< "${_TB_ARGV_JSON:-null}" >/dev/null 2>&1 && return 0
    # inventory.mjs's own default folder; a host without one keeps no inventory.
    [ -d "${WITNESS_INVENTORY_DIR:-$HOME/workspace/.mino/session-inventory}" ] || return 0
    script=$(_inventory_script "$(jq -r '.cwd // ""' <<< "$input")") || return 0
    command -v timeout >/dev/null 2>&1 && run=(timeout 120 node)
    {
        echo "Session inventory: $script write --session $session_id"
        MIADI_SESSIONDATA_ROOT="$CLAUDE_SESSIONDATA_ROOT" "${run[@]}" "$script" write --session "$session_id" 2>&1
    } >> "$output_dir/trace.log"
}

input="$MIADI_SESSION_END_INPUT"
. "$SCRIPT_DIR/work_in_progress.sh"
claude_work_finished "$input"
claude_write_terminal_binding "session.end" "$input"
session_id=$(echo "$input" | jq -r .session_id)
transcript_path=$(echo "$input" | jq -r .transcript_path)
output_dir="$CLAUDE_SESSIONDATA_ROOT/$session_id"
mkdir -p "$output_dir"

claude_write_jsonl "$output_dir/_claude_SessionEnd.jsonl" "$input"
claude_write_json "$output_dir/last_claude_SessionEnd.jsonl" "$input"
claude_write_session_inventory "$input" "$session_id" "$output_dir"

# Archive the complete transcript, its subagents and tool-results (lib.sh)
claude_with_lock "$output_dir/.archive.lock" claude_archive_session "$transcript_path" "$output_dir"
