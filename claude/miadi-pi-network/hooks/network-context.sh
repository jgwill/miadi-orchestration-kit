#!/usr/bin/env bash
# SessionStart: report Miadi Pi Network reachability into session context.
# Silent and successful when the network is not configured for this host.
set -uo pipefail

[ -n "${MIADI_PI_NETWORK_TOKEN:-}" ] || exit 0

status="$("${CLAUDE_PLUGIN_ROOT}/scripts/mpn.mjs" status 2>&1)" || {
  echo "Miadi Pi Network: hub unreachable at ${MIADI_PI_NETWORK_URL:-http://127.0.0.1:8787}."
  echo "Do not retry in a loop; tell the user if network work is requested."
  exit 0
}

echo "Miadi Pi Network is configured for this session:"
echo "$status"
echo "Use the miadi-pi-network skill or /miadi-network to act on it."
exit 0
