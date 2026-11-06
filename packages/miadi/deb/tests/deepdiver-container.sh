#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl xvfb xauth iproute2 procps >/dev/null
apt-get install -y --no-install-recommends /debs/miadi-deepdiver-chromium_1.64.1-1_amd64.deb /debs/miadi-deepdiver_0.1.0-1_amd64.deb /debs/deepdiver_0.1.0-1_all.deb >/dev/null
printf 'PASS install %s\n' "$(. /etc/os-release; echo "$PRETTY_NAME")"
test ! -e /root/.config/deepdiver
/usr/bin/python3 /tests/deepdiver-assert.py
/usr/bin/deepdiver --help | grep 'chrome' >/dev/null
/usr/bin/deepdiver --version
/usr/lib/miadi-deepdiver/venv/bin/deepdiver --help >/dev/null
/usr/lib/miadi-deepdiver/venv/bin/pip check
if /usr/bin/deepdiver chrome launch >/tmp/root-launch 2>&1; then echo 'FAIL root launch'; exit 1; fi
grep 'ROOT BROWSER REFUSED' /tmp/root-launch
useradd -m -s /bin/bash diver
as_user() { runuser -u diver -- env HOME=/home/diver "$@"; }
# An old Google profile must not be opened or modified by Chrome for Testing.
as_user mkdir -m 700 /home/diver/.chrome-deepdiver
printf 'old-profile-preserved\n' > /home/diver/.chrome-deepdiver/Local\ State
chown diver:diver /home/diver/.chrome-deepdiver/Local\ State
old_profile=$(sha256sum /home/diver/.chrome-deepdiver/Local\ State)
as_user /usr/bin/miadi-deepdiver setup
cfg=/home/diver/.config/deepdiver/config.yaml
before=$(sha256sum "$cfg")
as_user /usr/bin/miadi-deepdiver setup
test "$before" = "$(sha256sum "$cfg")"
test "$(stat -c %a "$cfg")" = 600
printf 'PASS config idempotency and privacy\n'
# Legacy manual venv copy: detect a shadow before readiness, remove only its
# verified pip distribution on explicit opt-in, never the venv or user data.
as_user /usr/bin/python3 -m venv /home/diver/legacy-venv
as_user /home/diver/legacy-venv/bin/python -m pip install --no-index --no-deps /usr/share/miadi-deepdiver/wheels/deepdiver-0.1.1-py3-none-any.whl >/dev/null
as_user touch /home/diver/legacy-venv/user-data-kept
as_user /home/diver/legacy-venv/bin/python -I -c 'from importlib.metadata import distribution; p=distribution("deepdiver").locate_file("deepdiver/deepdiver.yaml"); p.write_text(p.read_text()+"\n# retained-custom-config\n")'
if as_user env PATH=/home/diver/legacy-venv/bin:/usr/bin:/bin /usr/bin/miadi-deepdiver doctor --offline >/tmp/legacy 2>&1; then echo 'FAIL legacy not detected'; exit 1; fi
grep 'LEGACY CLI DETECTED' /tmp/legacy
as_user env PATH=/home/diver/legacy-venv/bin:/usr/bin:/bin /usr/bin/miadi-deepdiver setup --remove-legacy
test ! -e /home/diver/legacy-venv/bin/deepdiver
test -e /home/diver/legacy-venv/user-data-kept
grep -r -l 'retained-custom-config' /home/diver/.local/state/miadi-deepdiver/legacy >/dev/null
test "$before" = "$(sha256sum "$cfg")"
printf 'PASS legacy CLI detected and removed without deleting user data\n'
as_user mkdir -p /home/diver/unknown/bin
printf '#!/bin/sh\ntouch /home/diver/unsafe-legacy-executed\n' > /home/diver/unknown/bin/python
printf '#!/home/diver/unknown/bin/python\n# from deepdiver.deepdive import main\n' > /home/diver/unknown/bin/deepdiver
chmod 755 /home/diver/unknown/bin/{python,deepdiver}
if as_user env PATH=/home/diver/unknown/bin:/usr/bin:/bin /usr/bin/miadi-deepdiver setup --remove-legacy >/tmp/unknown-legacy 2>&1; then echo 'FAIL unknown launcher removed'; exit 1; fi
grep 'LEGACY PRESERVED' /tmp/unknown-legacy
test -f /home/diver/unknown/bin/deepdiver
test ! -f /home/diver/unsafe-legacy-executed
printf 'PASS unknown legacy launcher preserved and never executed\n'
as_user /usr/bin/miadi-deepdiver doctor --offline --browser-smoke
# A current-directory config must be checked through the fork's real resolver.
as_user mkdir -p /home/diver/unsafe-project/deepdiver
printf 'BROWSER_SETTINGS:\n  cdp_url: http://198.51.100.7:9222\n' > /home/diver/unsafe-project/deepdiver/deepdiver.yaml
if (cd /home/diver/unsafe-project && as_user /usr/bin/miadi-deepdiver doctor --offline >/tmp/unsafe-config 2>&1); then echo 'FAIL cwd config missed'; exit 1; fi
grep 'UNSAFE CDP CONFIG' /tmp/unsafe-config
# Force the standard SUID fallback instead of relying only on user namespaces.
as_user env PLAYWRIGHT_BROWSERS_PATH=/usr/lib/miadi-deepdiver/browsers /usr/lib/miadi-deepdiver/venv/bin/python -I - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(channel='chromium', headless=True, chromium_sandbox=True, args=['--disable-namespace-sandbox'])
    page = b.new_page()
    page.goto('chrome://sandbox')
    text = page.inner_text('body')
    assert 'SUID' in text and 'You are adequately sandboxed.' in text, text
    b.close()
print('PASS SUID fallback sandbox (no no-sandbox flag)')
PY
if as_user env -u DISPLAY /usr/bin/deepdiver chrome launch >/tmp/nodisplay 2>&1; then echo 'FAIL no display'; exit 1; fi
grep 'DISPLAY UNAVAILABLE' /tmp/nodisplay
if as_user env DISPLAY=:65432 /usr/bin/deepdiver chrome launch >/tmp/baddisplay 2>&1; then echo 'FAIL bad display'; exit 1; fi
grep 'DISPLAY UNAVAILABLE' /tmp/baddisplay
if as_user /usr/bin/miadi-deepdiver doctor --offline --claude >/tmp/claude-missing 2>&1; then echo 'FAIL missing Claude'; exit 1; fi
grep 'CLAUDE MISSING' /tmp/claude-missing
as_user /usr/bin/deepdiver skills install --agent claude
test -f /home/diver/.claude/skills/notebooklm-automation/SKILL.md
printf '\n# personal marker\n' >> /home/diver/.claude/skills/notebooklm-automation/SKILL.md
as_user /usr/bin/deepdiver skills install --agent claude
grep 'personal marker' /home/diver/.claude/skills/notebooklm-automation/SKILL.md
printf 'PASS embedded skill preservation\n'
# Launch using the fork's lifecycle, with an ephemeral blank profile. It may
# fail authentication/attach without internet; CDP/runtime security is independent.
as_user Xvfb :98 -screen 0 1280x800x24 >/tmp/xvfb.log 2>&1 &
sleep 1
set +e
as_user env DISPLAY=:98 /usr/bin/deepdiver chrome launch >/tmp/chrome-launch 2>&1
chrome_rc=$?
set -e
test "$chrome_rc" = 2 || test "$chrome_rc" = 3 || test "$chrome_rc" = 0
set +e
as_user /usr/bin/deepdiver chrome status >/tmp/chrome-status 2>&1
status_rc=$?
set -e
test "$status_rc" = 2 || test "$status_rc" = 3
test "$old_profile" = "$(sha256sum /home/diver/.chrome-deepdiver/Local\ State)"
test -d /home/diver/.chrome-deepdiver-apt
curl --noproxy '*' -fsS http://127.0.0.1:9222/json/version | grep -E 'Chrome|Chromium' >/dev/null
listeners=$(ss -ltnH 'sport = :9222')
printf '%s\n' "$listeners"
test -n "$listeners"
if printf '%s' "$listeners" | grep -E '0\.0\.0\.0:9222|\*:9222|\[::\]:9222'; then echo 'FAIL external CDP'; exit 1; fi
printf '%s' "$listeners" | grep '127.0.0.1:9222' >/dev/null
printf 'PASS upstream Chrome launch and loopback CDP (auth exit %s; not E2E)\n' "$chrome_rc"
# Exercise all upstream default launch routes, not only plain chrome launch.
stop_browser() {
  pkill -u diver -f '/usr/lib/miadi-deepdiver/browsers/' || true
  for attempt in {1..15}; do
    curl --noproxy '*' -fsS http://127.0.0.1:9222/json/version >/dev/null 2>&1 || return 0
    sleep 1
  done
  echo 'FAIL fixture browser did not stop'; exit 1
}
stop_browser
(cd /home/diver; printf 'y\n' | as_user env DISPLAY=:98 /usr/bin/deepdiver init) >/tmp/init-route 2>&1
curl --noproxy '*' -fsS http://127.0.0.1:9222/json/version >/dev/null
test "$old_profile" = "$(sha256sum /home/diver/.chrome-deepdiver/Local\ State)"
stop_browser
set +e
as_user env DISPLAY=:98 /usr/bin/deepdiver chrome launch --clone-profile Default >/tmp/clone-route 2>&1
clone_rc=$?
set -e
test "$clone_rc" = 2 || test "$clone_rc" = 3
curl --noproxy '*' -fsS http://127.0.0.1:9222/json/version >/dev/null
test "$old_profile" = "$(sha256sum /home/diver/.chrome-deepdiver/Local\ State)"
stop_browser
printf 'PASS init and clone routes use the APT home and preserve the old profile\n'
# Cached browser reconfiguration must work even with the network unavailable.
env https_proxy=http://127.0.0.1:9 http_proxy=http://127.0.0.1:9 /usr/bin/python3 -I /usr/lib/miadi-deepdiver/install-browser.py >/dev/null
printf 'PASS cached browser offline reinstall\n'
# Reinstall while disconnected: venv uses only the packaged wheels.
apt-get --reinstall install -y --no-install-recommends /debs/miadi-deepdiver_0.1.0-1_amd64.deb >/dev/null
test "$before" = "$(sha256sum "$cfg")"
# Upgrade from a generated prior-version fixture; not a claim of prior release.
dpkg-deb -R /debs/miadi-deepdiver_0.1.0-1_amd64.deb /tmp/old
sed -i 's/^Version: .*/Version: 0.0.9-1/' /tmp/old/DEBIAN/control
dpkg-deb -Zzstd -z3 --build /tmp/old /tmp/old.deb >/dev/null
dpkg --remove deepdiver >/dev/null
dpkg -i /tmp/old.deb >/dev/null
apt-get install -y --no-install-recommends /debs/miadi-deepdiver_0.1.0-1_amd64.deb >/dev/null
test "$(dpkg-query -W -f='${Version}' miadi-deepdiver)" = 0.1.0-1
test "$before" = "$(sha256sum "$cfg")"
printf 'PASS reinstall and fixture upgrade\n'
apt-get remove -y miadi-deepdiver >/dev/null
test -f "$cfg"
test -d /home/diver/.chrome-deepdiver-apt
test "$old_profile" = "$(sha256sum /home/diver/.chrome-deepdiver/Local\ State)"
test ! -e /usr/lib/miadi-deepdiver/venv
apt-get purge -y miadi-deepdiver >/dev/null
test -f "$cfg"
printf 'PASS remove/purge preserve user config/profile/skills\n'
echo 'PASS all clean-container lifecycle checks'
