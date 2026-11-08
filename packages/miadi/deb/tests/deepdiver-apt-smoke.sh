#!/usr/bin/env bash
# Run after publication in a clean supported amd64 container; real signed repo.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl gnupg >/dev/null
curl -fsSL https://apt.sanctuaireagentique.com/sanctuaire-agentique.gpg -o /usr/share/keyrings/sanctuaire-agentique.gpg
gpg --show-keys --with-colons /usr/share/keyrings/sanctuaire-agentique.gpg | grep '43AEC70665D2B71FC9B53C7DB936F575CFCBE635' >/dev/null
printf 'deb [signed-by=/usr/share/keyrings/sanctuaire-agentique.gpg] https://apt.sanctuaireagentique.com stable main\n' > /etc/apt/sources.list.d/sanctuaire-agentique.list
apt-get update -qq
apt-cache policy miadi-deepdiver deepdiver miadi-deepdiver-chromium
apt-get install -y --no-install-recommends "${PACKAGE:-miadi-deepdiver}" >/dev/null
test "$(dpkg-query -W -f='${Version}' miadi-deepdiver)" = 0.1.0-2
/usr/bin/deepdiver --help >/dev/null
/usr/lib/miadi-deepdiver/venv/bin/pip check
useradd -m -s /bin/bash diver
cd /home/diver
runuser -u diver -- env HOME=/home/diver /usr/bin/miadi-deepdiver setup
runuser -u diver -- env HOME=/home/diver /usr/bin/miadi-deepdiver doctor --offline --browser-smoke
printf 'PASS signed APT index, fingerprint, exact version, CLI and sandboxed browser: %s\n' "$(. /etc/os-release; echo "$PRETTY_NAME")"
