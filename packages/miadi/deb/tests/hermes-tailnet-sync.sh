#!/usr/bin/env bash
# Refs: jgwill/gaia#95, jgwill/miadi-orchestration-kit#101
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
gaia="${GAIA_LINUX_MIGRATION:-/opt/gaia/linux_migration}"
share="$here/miadi-config/usr/share/miadi/hermes-tailnet"
for file in 26-hermes-tailscale-autostart.sh tailnet-service-publish.sh 26-hermes-tailscale-autostart.md; do
  cmp "$gaia/$file" "$share/$file"
  printf 'PASS identical Gaia/package copy: %s\n' "$file"
done
cmp "$gaia/tests/test_hermes_tailnet_proxy.py" "$here/tests/hermes-tailnet-proxy.py"
bash -n "$share/26-hermes-tailscale-autostart.sh" "$share/tailnet-service-publish.sh" "$here/miadi-config/usr/bin/miadi-hermes-tailnet"
HERMES_TAILNET_INSTALLER="$share/26-hermes-tailscale-autostart.sh" python3 "$here/tests/hermes-tailnet-proxy.py"
