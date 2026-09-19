#!/usr/bin/env bash
# Install built .debs in a clean Ubuntu container and load the environment.
#   bash test-install.sh dist/*_<version>_all.deb
#   IMAGE=ubuntu:24.04 bash test-install.sh dist/*_<version>_all.deb
# The host-level check, including the upgrade from the published package, is
# runtime/miadi-host in miadisabelle/workspace.
set -euo pipefail
debs=$(mktemp -d)
trap 'rm -rf "$debs"' EXIT
cp "$@" "$debs/"
docker run --rm -v "$debs:/tmp/debs:ro" "${IMAGE:-ubuntu:22.04}" bash -euc '
  apt-get install -y -qq /tmp/debs/*.deb >/dev/null
  dpkg -s miadi | sed -n "s/^Version: /installed miadi /p"
  grep -qx /etc/miadi/miadi.env /var/lib/dpkg/info/miadi-config.conffiles
  printf "MIADI_URL_BASE=https://example.test\n" >> /etc/miadi/miadi.env
  test -z "$(bash -uc ". /usr/share/miadi/env.sh" 2>&1)"
  bash -uc ". /usr/share/miadi/env.sh
    test \"\$MIADI_DATA_DIR\" = /srv/miadi
    test \"\$MIADI_CHRONICLE_ROOT\" = /srv/miadi/episodes/miadi-chronicle
    test \"\$MIADI_WEBHOOK_URL\" = https://example.test/api/workflow/webhook
    test \"\$(MIADI_DATA_DIR=/data bash -c \". /usr/share/miadi/env.sh; echo \\\$MIADI_EPISODES_DIR\")\" = /data/episodes
    echo \"env ok: \$(env | grep -c ^MIADI_) MIADI_* variables, silent under set -u\""
  test "$(bash -lc "echo \$MIADI_DATA_DIR")" = /srv/miadi && echo "a login shell loads it"
  test "$(miadi-config get MIADI_WEBHOOK_URL)" = https://example.test/api/workflow/webhook && echo "miadi-config get resolves"
  apt-get remove -y -qq miadi-config >/dev/null && test -f /etc/miadi/miadi.env && echo "remove keeps the edited conffile"
'
