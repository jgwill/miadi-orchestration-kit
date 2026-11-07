#!/usr/bin/env bash
# One inbox, carried by each provider's adapter (jgwill/Miadi#942): an installed plugin cannot reach
# a file outside its own folder, so the canonical file is copied, and tests/steering checks the copies.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
canonical=claude/miadi-session-observability/hooks/steering_inbox.mjs
for copy in pi/miadi-session-observability/lib/steering_inbox.mjs codex/miadi-steering/steering_inbox.mjs copilot/miadi-steering/steering_inbox.mjs; do
  [ -d "$(dirname "$copy")" ] || mkdir -p "$(dirname "$copy")"
  cp "$canonical" "$copy"
done
