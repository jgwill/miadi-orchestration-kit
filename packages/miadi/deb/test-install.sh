#!/usr/bin/env bash
# Install a built .deb in a clean Ubuntu container and load the environment.
#   bash test-install.sh dist/miadi_<version>_all.deb [ubuntu:22.04]
set -euo pipefail
deb=$(realpath "$1")
image=${2:-ubuntu:22.04}
docker run --rm -v "$deb:/tmp/miadi.deb:ro" "$image" bash -euc '
  apt-get install -y -qq /tmp/miadi.deb >/dev/null
  dpkg -s miadi | sed -n "s/^Version: /installed miadi /p"
  test "$(cat /var/lib/dpkg/info/miadi.conffiles)" = /etc/miadi/miadi.env
  printf "MIADI_URL_BASE=https://example.test\n" >> /etc/miadi/miadi.env
  bash -c ". /usr/share/miadi/env.sh >/dev/null
    test \"\$MIADI_DATA_DIR\" = /srv/miadi
    test \"\$MIADI_CHRONICLE_ROOT\" = /srv/miadi/episodes/miadi-chronicle
    test \"\$MIADI_WEBHOOK_URL\" = https://example.test/api/workflow/webhook
    test \"\$(MIADI_DATA_DIR=/data bash -c \". /usr/share/miadi/env.sh >/dev/null; echo \\\$MIADI_EPISODES_DIR\")\" = /data/episodes
    echo \"env ok: \$(env | grep -c ^MIADI_) MIADI_* variables\""
  apt-get remove -y -qq miadi >/dev/null && test -f /etc/miadi/miadi.env && echo "remove keeps the edited conffile"
'
