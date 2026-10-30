#!/usr/bin/env bash
# The binding line names the person the local account acts for (jgwill/Miadi#887): from
# MIADI_ACCOUNT_PERSON, else from ~/.miadi/person.env as `miadi-local-account bind` wrote it.
# An account bound to nobody carries no account_person field, so its lines are as before.
# Run: bash tests/binding-account-person.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS="$HERE/hooks/claude_hooks"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export HOME="$WORK/home" CLAUDE_SESSIONDATA_ROOT="$WORK/root"
mkdir -p "$HOME/.claude/sessions" "$CLAUDE_SESSIONDATA_ROOT"
unset TMUX TMUX_PANE MIADI_RUN_MISSION MIADI_TEAM MIADI_ACCOUNT_PERSON

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected $2, got $3"; failures=$((failures + 1)); fi
}
hook() {  # <json> [env assignments...]
    local json="$1"; shift
    printf '%s' "$json" | env "$@" bash "$HOOKS/session_start_hook.sh" >/dev/null
}
first() { head -n 1 "$CLAUDE_SESSIONDATA_ROOT/$1/_terminal_binding.jsonl" 2>/dev/null; }

hook '{"session_id":"s-none","cwd":"/tmp","source":"startup"}'
expect "an account bound to nobody has no account_person" "false" "$(first s-none | jq 'has("account_person")')"

hook '{"session_id":"s-env","cwd":"/tmp","source":"startup"}' MIADI_ACCOUNT_PERSON="node:human:1789710466321:95nnhl"
expect "the person from the environment" "node:human:1789710466321:95nnhl" "$(first s-env | jq -r '.account_person')"

mkdir -p "$HOME/.miadi"
printf '# Written by miadi-local-account bind\nMIADI_ACCOUNT_PERSON=node:human:1789786084482:np9i46\nMIADI_ACCOUNT_TOKEN=mwt_x\n' > "$HOME/.miadi/person.env"
hook '{"session_id":"s-file","cwd":"/tmp","source":"startup"}'
expect "else the person from ~/.miadi/person.env" "node:human:1789786084482:np9i46" "$(first s-file | jq -r '.account_person')"
expect "the token never reaches the line" "false" "$(first s-file | grep -q mwt_ && echo true || echo false)"

[ "$failures" -eq 0 ] && echo "all passed" || { echo "$failures failed"; exit 1; }
