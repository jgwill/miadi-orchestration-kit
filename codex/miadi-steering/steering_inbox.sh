#!/usr/bin/env bash
# The fast half of the Codex steering inbox (jgwill/Miadi#942). With nothing pending it answers
# without starting node. steering_inbox.mjs holds the contract; this file names Codex to it and keeps
# seat.json, which is how the factory runner learns this seat went idle: Codex has no registry to read.
event="${1:-}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
version="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$here/package.json" | head -1)"
root="${MIADI_STEERING_DIR:-${MIADI_FACTORY_DIR:-/srv/miadi/factory}/steering}"
input="$(cat)"
# The top-level session_id: inside a nested string its quotes are escaped, so this cannot match there.
[[ "$input" =~ \"session_id\"[[:space:]]*:[[:space:]]*\"([0-9a-zA-Z-]{8,64})\" ]] || exit 0
dir="$root/${BASH_REMATCH[1]}"
seat() { [ -f "$dir/adapter.json" ] && printf '{"status":"%s","at":"%s"}\n' "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$dir/seat.json"; }
case "$event" in
  session-start | session-end) ;;
  *)
    shopt -s nullglob
    pending=("$dir/pending/"*.json)
    if ((${#pending[@]} == 0)); then
      case "$event" in
        stop) seat idle ;;
        user-prompt-submit | post-tool-use) seat busy ;;
      esac
      exit 0
    fi
    seat busy
    ;;
esac
printf '%s' "$input" | exec node "$here/steering_inbox.mjs" "$event" codex "$version"
