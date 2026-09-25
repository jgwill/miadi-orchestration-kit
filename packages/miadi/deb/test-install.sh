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
  # miadi-tide needs Python >= 3.11 with venv: native on 24.04, deadsnakes on 22.04.
  if ls /tmp/debs/miadi-tide_*.deb >/dev/null 2>&1 && grep -q "VERSION_CODENAME=jammy" /etc/os-release; then
    apt-get install -y -qq software-properties-common >/dev/null 2>&1
    add-apt-repository -y ppa:deadsnakes/ppa >/dev/null 2>&1
    apt-get update -qq >/dev/null
  fi
  apt-get install -y -qq /tmp/debs/*.deb >/tmp/install.log 2>&1 || { tail -30 /tmp/install.log; exit 1; }
  grep "^miadi-tide:" /tmp/install.log || true
  if [ -f /etc/miadi/miadi.env ]; then printf "MIADI_URL_BASE=https://example.test\n" >> /etc/miadi/miadi.env; fi

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

  if dpkg -s miadi-tide >/dev/null 2>&1; then
    dpkg -s miadi-tide | sed -n "s/^Version: /installed miadi-tide /p"
    grep -q "(plannotator-tui $(plannotator-tui --version | cut -d" " -f2))" /usr/share/miadi-tide/SOURCE
    echo "plannotator-tui $(plannotator-tui --version | cut -d" " -f2) is the build SOURCE names"
    venv=/usr/lib/miadi-tide/tide-runtime
    grep -qx "include-system-site-packages = false" $venv/pyvenv.cfg
    test "$($venv/bin/pip list --format=freeze 2>/dev/null | grep -v -E "^(pip|ironsilk)==" | sort)" = \
      "$(grep -v "^#" /usr/share/miadi-tide/wheels/constraints.txt | sort)"
    tide --help | grep -q "daemon" && echo "tide $($venv/bin/pip show ironsilk | sed -n "s/^Version: //p") runs from its own venv ($($venv/bin/python -V)), pinned dependencies only"
    test "$(node_pkg() { sed -n "s/^  \"$1\": \"\(.*\)\",/\1/p" /usr/share/miadi-tide/node/@miadi/tide/package.json; }; node_pkg name)" = "@miadi/tide"
    ! grep -q "workspace:" /usr/share/miadi-tide/node/@miadi/*/package.json && echo "the @miadi/tide sources are the packed form, no workspace: ranges"
    for u in tide-runtime.service tide-store-prune.service tide-store-prune.timer; do test -f /usr/lib/systemd/user/$u; done
    grep -q "^ExecStart=/usr/bin/tide daemon" /usr/lib/systemd/user/tide-runtime.service && echo "the server half ships as user units"
    code() { set +e; "$@" >/dev/null 2>&1; echo $?; set -e; }
    test "$(code tan)" = 64 && echo "tan without a target: 64"

    # The loop end to end: a review delivered into a pane, through the packaged guard.
    useradd -m annotator
    su annotator -s /bin/bash -c "
      set -e
      tmux new-session -d -s work -x 200 -y 50
      doc=\$HOME/reply.md
      printf \"# Reply\\n\\nThe build passes.\\n\" > \$doc
      plannotator-tui --annotate-block \$doc 1 \"say which build\" >/dev/null
      plannotator-tmux-review work --from-file \$doc --no-tui --submit 2>\$HOME/deliver.log || { cat \$HOME/deliver.log; exit 1; }
      grep -q \"pane-write-guard: clear\" \$HOME/deliver.log
      sleep 1
      tmux capture-pane -p -t work | grep -q \"say which build\"
      tmux kill-server
    "
    echo "tan-style delivery: marked, guarded by the packaged guard, typed into the pane"

    apt-get remove -y -qq miadi-tide >/dev/null 2>&1
    test ! -e $venv && echo "remove takes the venv with it"
  fi

  if dpkg -s miadi-config >/dev/null 2>&1; then
    apt-get remove -y -qq miadi-config >/dev/null 2>&1 && test -f /etc/miadi/miadi.env && echo "remove keeps the edited conffile"
  fi
'
