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
# A package carries its sources, never the bytecode a test run leaves beside them (#66).
for deb in "$@"; do
	if dpkg-deb -c "$deb" | grep -E '\.pyc$|/__pycache__/'; then
		echo "$deb carries bytecode" >&2
		exit 1
	fi
done
tests=$(cd "$(dirname "$0")/tests" && pwd)
docker run --rm -e DEBIAN_FRONTEND=noninteractive -v "$debs:/tmp/debs:ro" -v "$tests:/tmp/tests:ro" "${IMAGE:-ubuntu:22.04}" bash -euc '
  # miadi-terminal depends on python3 and xdg-utils, which a bare image lacks.
  apt-get update -qq >/dev/null
  # miadi-tide needs Python >= 3.11 with venv: native on 24.04, deadsnakes on 22.04.
  if ls /tmp/debs/miadi-tide_*.deb >/dev/null 2>&1 && grep -q "VERSION_CODENAME=jammy" /etc/os-release; then
    apt-get install -y -qq software-properties-common >/dev/null 2>&1
    add-apt-repository -y ppa:deadsnakes/ppa >/dev/null 2>&1
    apt-get update -qq >/dev/null
  fi
  # miadi-tmux replaces the distribution tmux: install that first, as a host that has it.
  if ls /tmp/debs/miadi-tmux_*.deb >/dev/null 2>&1; then
    apt-get install -y -qq tmux >/dev/null 2>&1
    echo "before: $(tmux -V) from the distribution"
  fi
  if ls /tmp/debs/miadi-music-wheels-*.deb >/dev/null 2>&1; then
    # Only one wheels set fits a host, and apt picks it. Serve the debs as a local repository and
    # install the packages by name, so apt makes the choice, as on a host.
    apt-get install -y -qq apt-utils >/dev/null 2>&1
    mkdir /tmp/repo && cp /tmp/debs/*.deb /tmp/repo/ && (cd /tmp/repo && apt-ftparchive packages . > Packages)
    echo "deb [trusted=yes] file:/tmp/repo ./" > /etc/apt/sources.list.d/local-debs.list
    apt-get update -qq >/dev/null
    names=$(for d in /tmp/repo/*.deb; do dpkg-deb -f "$d" Package; done | grep -v "^miadi-music-wheels-")
    apt-get install -y -qq $names >/tmp/install.log 2>&1 || { tail -30 /tmp/install.log; exit 1; }
  else
    apt-get install -y -qq /tmp/debs/*.deb >/tmp/install.log 2>&1 || { tail -30 /tmp/install.log; exit 1; }
  fi
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
    miadi-config settings | grep -q "^MIADI_MUSIC_SOUNDFONT " && echo "miadi-config knows the miadi-music settings"
  fi

  if dpkg -s miadi-tmux >/dev/null 2>&1; then
    dpkg -s miadi-tmux | sed -n "s/^Version: /installed miadi-tmux /p"
    hash -r
    test "$(command -v tmux)" = /usr/bin/tmux
    test "$(tmux -V)" = "tmux $(dpkg -s miadi-tmux | sed -n "s/^Version: \([^-]*\)-.*/\1/p")"
    # Removed, its config files may remain (rc): only an installed one (ii) is a second tmux.
    if dpkg-query -W -f="\${db:Status-Abbrev}" tmux 2>/dev/null | grep -q "^ii"; then echo "the distribution tmux is still installed" >&2; exit 1; fi
    tmux -L probe -f /dev/null new-session -d -s probe && tmux -L probe kill-server
    echo "$(tmux -V) at /usr/bin/tmux in place of the distribution tmux, and a server starts"
    # A session named after a circle id is a target by its name (prep/patches/tmux-3.7c).
    tmux -L colons -f /dev/null new-session -d -s "circle:1791110394383:jj1ql8"
    tmux -L colons split-window -t "circle:1791110394383:jj1ql8:0"
    test "$(tmux -L colons display -p -t "circle:1791110394383:jj1ql8:0.1" "#{session_name}:#{pane_index}")" = "circle:1791110394383:jj1ql8:1"
    tmux -L colons has-session -t "circle:1791110394383:jj1ql8" && tmux -L colons kill-server
    echo "a session named circle:1791110394383:jj1ql8 is reached by its name, down to its panes"
  fi

  # miadi-terminal restore, the whole cycle a fresh machine runs (jgwill/gaia#90): enable it over a
  # config that loads the plugins itself, save two sessions, kill the server, start one, and the
  # sessions come back once, in their folders, with the hook that hands the agents to tide run.
  # A container has no systemd user manager, so the units are checked on a host, not here.
  if [ -f /usr/share/miadi-terminal/session-continuity/session-continuity.conf ] && command -v tmux >/dev/null; then
    apt-get install -y -qq git procps >/dev/null 2>&1
    export HOME=/root
    printf "set -g @plugin \x27tmux-plugins/tpm\x27\nrun \x27~/.tmux/plugins/tpm/tpm\x27\n" > ~/.tmux.conf
    miadi-terminal enable restore >/tmp/restore-enable.log 2>&1 || { cat /tmp/restore-enable.log; exit 1; }
    test "$(grep -c "^# moved into miadi-terminal restore: " ~/.tmux.conf)" = 2
    grep -qx "source-file /usr/share/miadi-terminal/session-continuity/session-continuity.conf  # miadi-terminal restore" ~/.tmux.conf
    test -d ~/.tmux/plugins/tmux-continuum
    echo "restore: enable commented out the 2 plugin lines, added its source-file line, cloned the plugins"
    tmux new-session -d -s alpha -c /tmp
    tmux new-session -d -s beta -c /etc
    tmux split-window -t beta -c /var
    sleep 3
    tmux run-shell "$HOME/.tmux/plugins/tmux-resurrect/scripts/save.sh quiet"
    test -e ~/.local/share/tmux/resurrect/last
    tmux kill-server
    sleep 2
    tmux new-session -d
    for i in $(seq 30); do ls ~/.miadi/navigator/restore/hook-*.log >/dev/null 2>&1 && break; sleep 1; done
    sleep 2
    test "$(tmux ls -F "#{session_name}" | sort | tr "\n" " ")" = "alpha beta "
    test "$(tmux list-panes -a -F "#{session_name}:#{pane_current_path}" | sort | tr "\n" " ")" = "alpha:/tmp beta:/etc beta:/var "
    test "$(cat ~/.miadi/navigator/restore/hook-*.log | grep -c "tmux restore finished")" = 1
    echo "restore: after a kill and a new server, alpha and beta came back in /tmp, /etc and /var, restored once"
    grep -h "tide" ~/.miadi/navigator/restore/hook-*.log | head -1 | sed "s/^[^ ]* /restore: hook: /"
    tmux kill-server
  fi

  if dpkg -s miadi-terminal >/dev/null 2>&1; then
    dpkg -s miadi-terminal | sed -n "s/^Version: /installed miadi-terminal /p"
    open=https://example.test/api/chronicle/open?uri=
    test "$(miadi-chronicle-open miadi-chronicle:126)" = "${open}miadi-chronicle%3A126"
    test "$(miadi-chronicle-open "miadi-chronicle:092/126#scene=river).")" = "${open}miadi-chronicle%3A092%2F126%23scene%3Driver"
    test "$(MIADI_CHRONICLE_OPEN_URL=https://tailnet.test/ miadi-chronicle-open miadi-chronicle://311)" = \
      "https://tailnet.test/api/chronicle/open?uri=miadi-chronicle%3A%2F%2F311"
    test "$(miadi-chronicle-open "circle:1790787727155:2slscw.")" = "${open}miadi-circle%3Acircle%3A1790787727155%3A2slscw"
    test "$(miadi-chronicle-open miadi-circle:circle:1790787727155:2slscw)" = "${open}miadi-circle%3Acircle%3A1790787727155%3A2slscw"
    test "$(miadi-chronicle-open ceremony:ep343:talking-circle:1)" = "${open}miadi-ceremony%3Aceremony%3Aep343%3Atalking-circle%3A1"
    echo "the opener builds the open door on the configured front, for a chronicle, ceremony or circle reference"
    code() { set +e; "$@" >/dev/null 2>&1; echo $?; set -e; }
    test "$(code miadi-chronicle-open)" = 64
    test "$(code miadi-chronicle-open https://example.test)" = 65
    test "$(code miadi-chronicle-open circle:foo)" = 65
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
                   ("see MIADI-CHRONICLE:126.", "MIADI-CHRONICLE:126"),
                   ("seated in circle:1790787727155:2slscw.", "circle:1790787727155:2slscw"),
                   ("<miadi-circle:circle:1790787727155:2slscw?mc.show=card>", "miadi-circle:circle:1790787727155:2slscw?mc.show=card"),
                   ("opened ceremony:ep343:talking-circle:1 today", "ceremony:ep343:talking-circle:1"),
                   ("see miadi-ceremony:3f2a9c1e", "miadi-ceremony:3f2a9c1e")]:
    found = pattern.search(text)
    assert found, text
    assert found.group(0).rstrip(".,;:!?)]}\x27\"") == want, (found.group(0), want)
for text in ["the circle: people", "circle:12", "a ceremony:opening"]:
    assert not pattern.search(text), text
print("the plugin parses and its pattern finds chronicle, ceremony and circle references in running text")
PY
    apt-get install -y -qq desktop-file-utils >/dev/null 2>&1
    desktop-file-validate /usr/share/applications/miadi-chronicle-open.desktop
    for scheme in miadi-chronicle miadi-ceremony miadi-circle; do
      grep -q "x-scheme-handler/$scheme=miadi-chronicle-open.desktop" /usr/share/applications/mimeinfo.cache
    done
    echo "the scheme handler is valid and registered for all three schemes"

    test "$(dpkg-query -W -f="\${Conffiles}\n" miadi-terminal | grep -c -E "^ /etc/(miadi/)?tmux.conf ")" = 2
    grep -qx "source-file -q /etc/miadi/tmux.conf" /etc/tmux.conf
    echo "/etc/tmux.conf reads /etc/miadi/tmux.conf, and dpkg keeps an edited copy of either"
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

  if dpkg -s miadi-music >/dev/null 2>&1; then
    dpkg -s miadi-music | sed -n "s/^Version: /installed miadi-music /p"
    grep "^miadi-music-measure:" /tmp/install.log
    tag=$(python3 -c "import sys; print(\"cp%d%d\" % sys.version_info[:2])")
    test "$(dpkg -l "miadi-music-wheels-*" | awk "/^ii/ {print \$2}")" = "miadi-music-wheels-$tag" && echo "apt chose miadi-music-wheels-$tag, the set for this python3, and no other"
    miadi-music check
    test "$(miadi-music python -c "import sys; print(sys.prefix)")" = /usr/lib/miadi-music/venv && echo "miadi-music python runs the venv"
    printf "X:1\nT:check\nM:4/4\nL:1/4\nK:C\nCDEF|G4|]\n" > /tmp/check.abc
    abc2midi /tmp/check.abc -o /tmp/check.mid >/dev/null
    fluidsynth -ni -F /tmp/check.wav -r 44100 "$(miadi-music env | sed -n "s/^MIADI_MUSIC_SOUNDFONT=//p")" /tmp/check.mid >/dev/null 2>&1
    miadi-music python -c "import wave, numpy; w = wave.open(\"/tmp/check.wav\"); x = numpy.frombuffer(w.readframes(w.getnframes()), dtype=numpy.int16); assert numpy.abs(x).max() > 1000; print(\"an ABC tune renders to sound:\", round(w.getnframes() / w.getframerate(), 1), \"s\")"
    apt-get install --reinstall -y -qq "miadi-music-wheels-$tag" >/tmp/reinstall.log 2>&1
    grep -q "^miadi-music-measure: numpy" /tmp/reinstall.log && miadi-music python -c "import scipy.signal" \
      && echo "a wheels package replaced triggers the venv rebuild"
    apt-get remove -y -qq miadi-music-measure >/dev/null 2>&1
    test ! -e /usr/lib/miadi-music/venv && echo "remove takes the venv with it"
  fi

  if dpkg -s miadi-perms >/dev/null 2>&1; then
    dpkg -s miadi-perms | sed -n "s/^Version: /installed miadi-perms /p"
    # A container has no systemd: the enabled state is the symlink postinst made.
    test -L /etc/systemd/system/timers.target.wants/miadi-perms.timer && echo "miadi-perms.timer is enabled at install"
    grep -qx "ExecStart=/usr/bin/miadi-perms" /usr/lib/systemd/system/miadi-perms.service
    # With /src present, MIADI_SESSIONDATA_ROOT resolves to /src/_sessiondata, as on gaia.
    useradd -m writer
    mkdir -p /src/_sessiondata && chown writer /src/_sessiondata
    su writer -s /bin/sh -c "umask 022; mkdir /src/_sessiondata/s1; echo x > /src/_sessiondata/s1/log; ln -s /etc/passwd /src/_sessiondata/s1/link; touch /src/_sessiondata/open; chmod 664 /src/_sessiondata/open"
    before=$(stat -c %Z /src/_sessiondata/open)
    sleep 1.1
    miadi-perms | tee /tmp/perms.log
    grep -qx "miadi-perms: /src/_sessiondata: g+rw on 3 entries" /tmp/perms.log
    test "$(find /src/_sessiondata ! -type l ! -perm -g+rw | wc -l)" = 0
    test "$(stat -c %a /etc/passwd)" = 644
    test "$(stat -c %Z /src/_sessiondata/open)" = "$before"
    echo "miadi-perms opened the 3 entries that lacked g+rw, left the open file and the symlink target alone"
    miadi-perms /nonexistent | grep -qx "miadi-perms: /nonexistent does not exist, skipped" && echo "a missing directory is skipped"
    apt-get remove -y -qq miadi-perms >/dev/null 2>&1 && test ! -e /usr/bin/miadi-perms && echo "remove takes the command and units with it"
  fi

  if dpkg -s miadi-node >/dev/null 2>&1; then
    dpkg -s miadi-node | sed -n "s/^Version: /installed miadi-node /p"
    test "$(/usr/lib/miadi-node/bin/node --version)" = "v$(dpkg -s miadi-node | sed -n "s/^Version: \([^-]*\)-.*/\1/p")"
    ! command -v node >/dev/null && ! command -v npm >/dev/null && echo "miadi-node runs from /usr/lib/miadi-node and puts no node or npm on PATH"
  fi

  if dpkg -s miadi-chronicle-client >/dev/null 2>&1; then
    dpkg -s miadi-chronicle-client | sed -n "s/^Version: /installed miadi-chronicle-client /p"
    for cmd in inquiry-weave passages mkepisode; do "$cmd" --help >/dev/null; done
    init="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test-install\",\"version\":\"0\"}}}"
    for mcp in inquiry-weave-mcp miadi-voice-mcp medicine-wheel-mcp; do
      (printf "%s\n" "$init"; sleep 3) | timeout 30 "$mcp" 2>/dev/null | grep -q "\"serverInfo\"" || { echo "$mcp did not answer initialize"; exit 1; }
    done
    echo "the client commands answer, and inquiry-weave-mcp, miadi-voice-mcp and medicine-wheel-mcp complete an initialize handshake"
  fi

  if dpkg -s miadi-chronicle-server >/dev/null 2>&1; then
    dpkg -s miadi-chronicle-server | sed -n "s/^Version: /installed miadi-chronicle-server /p"
    for cmd in miadi-hooks-interpret plan-insight-register miadi-transcription miadi-episode-capture; do "$cmd" --help >/dev/null; done
    { miadi-hooks --help 2>&1 || true; } | grep -q "usage: miadi-hooks"
    grep -q "^ExecStart=/bin/bash -c .*/usr/bin/miadi-capture-service" /usr/lib/systemd/user/miadi-capture-service.service
    inbox=$(mktemp -d)
    MIADI_CAPTURE_HOST=127.0.0.1 MIADI_CAPTURE_PORT=8799 MIADI_CAPTURE_INBOX=$inbox miadi-capture-service >/tmp/capture.log 2>&1 &
    capture=$!
    for i in $(seq 1 40); do (exec 3<>/dev/tcp/127.0.0.1/8799) 2>/dev/null && break; sleep 0.5; done
    exec 3<>/dev/tcp/127.0.0.1/8799
    printf "GET /api/captures HTTP/1.0\r\nHost: test\r\n\r\n" >&3
    head -1 <&3 | grep -q " 200 " || { cat /tmp/capture.log; exit 1; }
    exec 3>&-
    kill $capture
    echo "the server commands answer, and miadi-capture-service serves /api/captures"
  fi

  if dpkg -s miadi-node >/dev/null 2>&1; then
    installed=$(for p in miadi-chronicle-client miadi-chronicle-server miadi-node; do dpkg -s $p >/dev/null 2>&1 && echo $p; done)
    apt-get remove -y -qq $installed >/dev/null 2>&1
    test ! -e /usr/lib/miadi-node && test ! -e /usr/lib/miadi-chronicle-client && test ! -e /usr/lib/miadi-chronicle-server && echo "remove takes /usr/lib/miadi-node and both halves with it"
  fi

  if dpkg -s miadi-config >/dev/null 2>&1; then
    apt-get remove -y -qq miadi-config >/dev/null 2>&1 && test -f /etc/miadi/miadi.env && echo "remove keeps the edited conffile"
  fi
'
