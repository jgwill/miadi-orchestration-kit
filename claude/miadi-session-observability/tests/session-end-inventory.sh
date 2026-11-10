#!/usr/bin/env bash
# SessionEnd writes the ending session's inventory record in its detached half, with
# miadi-witness's inventory.mjs: from the installed plugin, else from the kit checkout at
# MIADI_ORCHESTRATION_KIT_ROOT, else not at all. The first half still returns at once.
# session_inventory.sh where prints the same script for /inventory-exit.
# Run: bash tests/session-end-inventory.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KIT="$(cd "$HERE/../.." && pwd)"
HOOKS="$HERE/hooks/claude_hooks"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export HOME="$WORK/home" CLAUDE_SESSIONDATA_ROOT="$WORK/root" XDG_STATE_HOME="$WORK/state"
export WITNESS_INVENTORY_DIR="$WORK/inventory" MIADI_FACTORY_LEDGER="$WORK/no-ledger.jsonl" MIADI_MISSIONS_DIR="$WORK/no-missions"
mkdir -p "$HOME/.claude/sessions" "$CLAUDE_SESSIONDATA_ROOT/data" "$WITNESS_INVENTORY_DIR" "$WORK/cwd"
unset TMUX TMUX_PANE MIADI_RUN_MISSION MIADI_TEAM MIADI_ORCHESTRATION_KIT_ROOT CLAUDE_CONFIG_DIR WITNESS_BINDINGS MIADI_SESSIONDATA_ROOT MIADI_SESSION_DIR SESSION_DATA_ROOT

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected $2, got $3"
        failures=$((failures + 1))
    fi
}
detached() {  # <session id> [argv json]
    MIADI_SESSION_END_INPUT=$(jq -nc --arg id "$1" --arg cwd "$WORK/cwd" '{session_id: $id, cwd: $cwd, transcript_path: "/nonexistent", hook_event_name: "SessionEnd", reason: "prompt_input_exit"}') \
        _TB_ARGV_JSON="${2:-[\"claude\"]}" bash "$HOOKS/session_end_hook.sh" --detached > /dev/null 2>&1
}
record() { [ -f "$WITNESS_INVENTORY_DIR/$1.json" ] && echo yes || echo no; }

A=aaaaaaaa-0000-4000-8000-00000000000a
detached "$A"
expect "with no miadi-witness and no kit root, no record" "no" "$(record "$A")"

export MIADI_ORCHESTRATION_KIT_ROOT="$KIT"
B=bbbbbbbb-0000-4000-8000-00000000000b
detached "$B"
expect "the kit checkout's inventory.mjs writes the record" "yes" "$(record "$B")"
expect "keyed by the ending session" "$B" "$(jq -r .session_id "$WITNESS_INVENTORY_DIR/$B.json" 2>/dev/null)"
expect "from its session.end binding line" "unreviewed" "$(jq -r .status "$WITNESS_INVENTORY_DIR/$B.json" 2>/dev/null)"
expect "the run is kept in the session's trace.log" "1" "$(grep -c "Session inventory: $KIT/claude/miadi-witness/scripts/inventory.mjs write --session $B" "$CLAUDE_SESSIONDATA_ROOT/$B/trace.log")"

C=cccccccc-0000-4000-8000-00000000000c
detached "$C" '["claude","-p","edit this"]'
expect "a headless claude -p child gets no record" "no" "$(record "$C")"

# An installed miadi-witness comes first; a project install for another folder does not count.
mkdir -p "$WORK/witness-user/scripts" "$WORK/witness-other/scripts" "$HOME/.claude/plugins"
for w in user other; do
    printf '%s\n' "import { writeFileSync } from 'node:fs'; writeFileSync(process.env.WITNESS_INVENTORY_DIR + '/used-$w', process.argv.slice(2).join(' '));" > "$WORK/witness-$w/scripts/inventory.mjs"
done
jq -n --arg u "$WORK/witness-user" --arg o "$WORK/witness-other" '{version: 2, plugins: {"miadi-witness@miadi-orchestration-kit": [
    {scope: "project", projectPath: "/somewhere/else", installPath: $o},
    {scope: "user", installPath: $u}]}}' > "$HOME/.claude/plugins/installed_plugins.json"
D=dddddddd-0000-4000-8000-00000000000d
detached "$D"
expect "the installed plugin's inventory.mjs is the one run" "write --session $D" "$(cat "$WITNESS_INVENTORY_DIR/used-user" 2>/dev/null)"
expect "not a project install for another folder" "no" "$([ -f "$WITNESS_INVENTORY_DIR/used-other" ] && echo yes || echo no)"
expect "/inventory-exit finds the same script" "$WORK/witness-user/scripts/inventory.mjs" "$(bash "$HOOKS/session_inventory.sh" where "$WORK/cwd")"
rm -f "$HOME/.claude/plugins/installed_plugins.json"
expect "else the kit checkout's" "$KIT/claude/miadi-witness/scripts/inventory.mjs" "$(bash "$HOOKS/session_inventory.sh" where "$WORK/cwd")"
expect "and nothing, failing, without either" "1" "$(MIADI_ORCHESTRATION_KIT_ROOT= bash "$HOOKS/session_inventory.sh" where "$WORK/cwd" > /dev/null; echo $?)"

E=eeeeeeee-0000-4000-8000-00000000000e
mv "$WITNESS_INVENTORY_DIR" "$WORK/inventory-away"
detached "$E"
mv "$WORK/inventory-away" "$WITNESS_INVENTORY_DIR"
expect "a host with no inventory folder gets none" "no" "$([ -d "$WORK/inventory-away" ] || [ -f "$WITNESS_INVENTORY_DIR/$E.json" ] && echo yes || echo no)"

# The first half hands everything to the detached copy and returns well inside Claude Code's 1.5 s.
F=ffffffff-0000-4000-8000-00000000000f
start=$(date +%s%N)
jq -nc --arg id "$F" --arg cwd "$WORK/cwd" '{session_id: $id, cwd: $cwd, transcript_path: "/nonexistent", hook_event_name: "SessionEnd"}' \
    | bash "$HOOKS/session_end_hook.sh" > /dev/null 2>&1
elapsed=$(( ($(date +%s%N) - start) / 1000000 ))
expect "the first half returns under 1500 ms (took ${elapsed} ms)" "yes" "$([ "$elapsed" -lt 1500 ] && echo yes || echo no)"
for _ in $(seq 1 100); do [ -f "$WITNESS_INVENTORY_DIR/$F.json" ] && break; sleep 0.1; done
expect "and the detached half writes the record" "yes" "$(record "$F")"

[ "$failures" -eq 0 ] && echo "all passed" || { echo "$failures failed"; exit 1; }
