#!/usr/bin/env bash
# The fast half of the Claude Code steering inbox (jgwill/Miadi#930). This hook runs on every tool
# call of every session, so with nothing pending it answers without starting node.
# steering_inbox.mjs holds the contract.
event="${1:-}"
root="${MIADI_STEERING_DIR:-${MIADI_FACTORY_DIR:-/srv/miadi/factory}/steering}"
# Only the head of the input: session_id comes first, and a tool's output can be many megabytes.
IFS= read -r -d '' -n 4096 head || true
case "$event" in
  session-start | session-end) ;;
  *)
    # The top-level session_id: inside a nested string its quotes are escaped, so this cannot match there.
    [[ "$head" =~ \"session_id\"[[:space:]]*:[[:space:]]*\"([0-9a-fA-F-]{8,64})\" ]] || exit 0
    shopt -s nullglob
    pending=("$root/${BASH_REMATCH[1]}/pending/"*.json)
    ((${#pending[@]})) || exit 0
    ;;
esac
{ printf '%s' "$head"; cat; } | exec node "$(dirname "${BASH_SOURCE[0]}")/steering_inbox.mjs" "$event"
