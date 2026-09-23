#!/usr/bin/env bash
# Install built .debs in a clean Ubuntu container and check each package given.
#   bash test-install.sh dist/*_<version>_all.deb
#   IMAGE=ubuntu:24.04 bash test-install.sh dist/*_<version>_all.deb
# The host-level check, including the upgrade from the published package, is
# runtime/miadi-host in miadisabelle/workspace.
set -euo pipefail
debs=$(mktemp -d)
trap 'rm -rf "$debs"' EXIT
cp "$@" "$debs/"
tests=$(cd "$(dirname "$0")/tests" && pwd)
docker run --rm -v "$debs:/tmp/debs:ro" -v "$tests:/tmp/tests:ro" "${IMAGE:-ubuntu:22.04}" bash -euc '
  # miadi-terminal depends on python3 and xdg-utils, which a bare image lacks.
  apt-get update -qq >/dev/null
  apt-get install -y -qq /tmp/debs/*.deb >/dev/null 2>&1
  printf "MIADI_URL_BASE=https://example.test\n" >> /etc/miadi/miadi.env

  if dpkg -s miadi >/dev/null 2>&1; then
    dpkg -s miadi | sed -n "s/^Version: /installed miadi /p"
  fi

  if dpkg -s miadi-config >/dev/null 2>&1; then
    grep -qx /etc/miadi/miadi.env /var/lib/dpkg/info/miadi-config.conffiles
    test -z "$(bash -uc ". /usr/share/miadi/env.sh" 2>&1)"
    bash -uc ". /usr/share/miadi/env.sh
      test \"\$MIADI_DATA_DIR\" = /srv/miadi
      test \"\$MIADI_CHRONICLE_ROOT\" = /srv/miadi/episodes/miadi-chronicle
      test \"\$MIADI_WEBHOOK_URL\" = https://example.test/api/workflow/webhook
      test \"\$(MIADI_DATA_DIR=/data bash -c \". /usr/share/miadi/env.sh; echo \\\$MIADI_EPISODES_DIR\")\" = /data/episodes
      echo \"env ok: \$(env | grep -c ^MIADI_) MIADI_* variables, silent under set -u\""
    test "$(bash -lc "echo \$MIADI_DATA_DIR")" = /srv/miadi && echo "a login shell loads it"
    test "$(miadi-config get MIADI_WEBHOOK_URL)" = https://example.test/api/workflow/webhook && echo "miadi-config get resolves"
    miadi-config settings | grep -q "^MIADI_CHRONICLE_OPEN_URL " && echo "miadi-config knows MIADI_CHRONICLE_OPEN_URL"
  fi

  if dpkg -s miadi-terminal >/dev/null 2>&1; then
    dpkg -s miadi-terminal | sed -n "s/^Version: /installed miadi-terminal /p"
    open=https://example.test/api/chronicle/open?uri=
    test "$(miadi-chronicle-open miadi-chronicle:126)" = "${open}miadi-chronicle%3A126"
    test "$(miadi-chronicle-open "miadi-chronicle:092/126#scene=river).")" = "${open}miadi-chronicle%3A092%2F126%23scene%3Driver"
    test "$(MIADI_CHRONICLE_OPEN_URL=https://tailnet.test/ miadi-chronicle-open miadi-chronicle://311)" = \
      "https://tailnet.test/api/chronicle/open?uri=miadi-chronicle%3A%2F%2F311"
    echo "the opener builds the open door on the configured front"
    code() { set +e; "$@" >/dev/null 2>&1; echo $?; set -e; }
    test "$(code miadi-chronicle-open)" = 64
    test "$(code miadi-chronicle-open https://example.test)" = 65
    empty=$(mktemp -d)
    test "$(code env -i PATH=/usr/bin:/bin MIADI_ETC="$empty" miadi-chronicle-open miadi-chronicle:126)" = 78
    echo "usage 64, not a reference 65, no front 78"

    plugin=/usr/lib/python3/dist-packages/terminatorlib/plugins/miadi_chronicle_url_handler.py
    python3 - "$plugin" <<PY
import ast, re, sys
tree = ast.parse(open(sys.argv[1]).read())
match = next(n.value.value for n in ast.walk(tree)
             if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "match")
pattern = re.compile(match)
for text, want in [("see miadi-chronicle:126.", "miadi-chronicle:126"),
                   ("git log: miadi-chronicle://092/126#scene=river end", "miadi-chronicle://092/126#scene=river"),
                   ("(miadi-chronicle:311/services-inventory)", "miadi-chronicle:311/services-inventory"),
                   ("see MIADI-CHRONICLE:126.", "MIADI-CHRONICLE:126")]:
    found = pattern.search(text)
    assert found, text
    assert found.group(0).rstrip(".,;:!?)]}\x27\"") == want, (found.group(0), want)
print("the plugin parses and its pattern finds references in running text")
PY
    apt-get install -y -qq desktop-file-utils >/dev/null 2>&1
    desktop-file-validate /usr/share/applications/miadi-chronicle-open.desktop
    grep -q "x-scheme-handler/miadi-chronicle=miadi-chronicle-open.desktop" /usr/share/applications/mimeinfo.cache
    echo "the scheme handler is valid and registered"

    apt-get install -y -qq tmux python3-configobj >/dev/null 2>&1
    useradd -m reader
    install -m 0755 /tmp/tests/reader-enable.sh /usr/local/bin/reader-enable.sh
    su reader -s /bin/bash -c /usr/local/bin/reader-enable.sh
    python3 /tmp/tests/tmux-click.py /usr/share/miadi-terminal/tmux/miadi-chronicle.conf /usr/bin/miadi-chronicle-open
    miadi-terminal front https://front.test >/dev/null && unset MIADI_CHRONICLE_OPEN_URL
    test "$(miadi-chronicle-open miadi-chronicle:126)" = "https://front.test/api/chronicle/open?uri=miadi-chronicle%3A126"
    echo "miadi-terminal front sets the front through miadi-config"
  fi

  if dpkg -s miadi-config >/dev/null 2>&1; then
    apt-get remove -y -qq miadi-config >/dev/null 2>&1 && test -f /etc/miadi/miadi.env && echo "remove keeps the edited conffile"
  fi
'
