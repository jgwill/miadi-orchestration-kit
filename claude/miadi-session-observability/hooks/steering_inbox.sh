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
  stop-watch)
    # The turn is ending. A correction can still land while the other Stop hooks finish, after the
    # Stop hook below has looked. This runs in the background (asyncRewake): for a short while it
    # looks again, and exit 2 from steering_inbox.mjs wakes the model with the correction.
    [[ "$head" =~ \"session_id\"[[:space:]]*:[[:space:]]*\"([0-9a-fA-F-]{8,64})\" ]] || exit 0
    dir="$root/${BASH_REMATCH[1]}"
    [ -f "$dir/adapter.json" ] || exit 0
    shopt -s nullglob
    found=
    for ((i = 0; i < ${MIADI_STEERING_WATCH_SECONDS:-30}; i++)); do
      pending=("$dir/pending/"*.json)
      if ((${#pending[@]})); then
        found=1
        break
      fi
      sleep 1
    done
    [ -n "$found" ] || exit 0
    ;;
  *)
    # The top-level session_id: inside a nested string its quotes are escaped, so this cannot match there.
    [[ "$head" =~ \"session_id\"[[:space:]]*:[[:space:]]*\"([0-9a-fA-F-]{8,64})\" ]] || exit 0
    shopt -s nullglob
    pending=("$root/${BASH_REMATCH[1]}/pending/"*.json)
    ((${#pending[@]})) || exit 0
    ;;
esac
{ printf '%s' "$head"; cat; } | exec node "$(dirname "${BASH_SOURCE[0]}")/steering_inbox.mjs" "$event"
