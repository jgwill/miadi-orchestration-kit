#!/usr/bin/env bash
# Refs: jgwill/gaia#71, jgwill/miadi-orchestration-kit#102
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
gaia="${GAIA_LINUX_MIGRATION:-/opt/gaia/linux_migration}"
script="$here/miadi-config/usr/bin/miadi-mirror-monitor"
cmp "$gaia/66-mirror-monitor.sh" "$script"
cmp "$gaia/tests/test_mirror_monitor.py" "$here/tests/mirror-monitor.py"
printf 'PASS identical Gaia/package mirror script and tests\n'
bash -n "$script"
MIRROR_MONITOR_SCRIPT="$script" python3 "$here/tests/mirror-monitor.py"
