#!/usr/bin/env bash
# Install the witness service as a systemd user unit and start it.
#   install-unit.sh           write ~/.config/systemd/user/miadi-witness.service, enable, (re)start
#   install-unit.sh --print   print the unit it would write, change nothing
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node_bin="$(command -v node)"
tide_bin=/usr/bin/tide  # the miadi-tide package's, the binary its daemon unit runs
[ -x "$tide_bin" ] || tide_bin="$(command -v tide || echo tide)"
unit="$(sed -e "s|@NODE@|${node_bin}|" -e "s|@SERVICE_DIR@|${here}|" -e "s|@TIDE@|${tide_bin}|" "${here}/miadi-witness.service")"
if [[ "${1:-}" == "--print" ]]; then
  printf '%s\n' "$unit"
  exit 0
fi
target="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/miadi-witness.service"
mkdir -p "$(dirname "$target")"
printf '%s\n' "$unit" > "$target"
systemctl --user daemon-reload
systemctl --user enable miadi-witness.service
systemctl --user restart miadi-witness.service
sleep 1
systemctl --user is-active miadi-witness.service
echo "installed ${target}"
echo "node ${node_bin} (nvm-versioned: re-run this script after a node upgrade)"
echo "tide ${tide_bin}"
