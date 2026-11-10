#!/bin/bash
# The session inventory's writer, miadi-witness scripts/inventory.mjs (fields in SCHEMA.md of the
# inventory folder). Sourced by session_end_hook.sh, whose detached half writes the ending
# session's record from the binding line and the hook capture, with no model call. Run as
#   bash session_inventory.sh where [<cwd>]
# it prints the path of inventory.mjs, which /inventory-exit uses.
#
# The script comes from the installed miadi-witness plugin, else from the kit checkout at
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

if [ "${BASH_SOURCE[0]}" = "$0" ] && [ "${1:-}" = "where" ]; then
    _inventory_script "${2:-$PWD}"
fi
