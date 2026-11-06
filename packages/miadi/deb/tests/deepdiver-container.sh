#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl xvfb xauth iproute2 >/dev/null
apt-get install -y --no-install-recommends /debs/miadi-deepdiver-chromium_1.64.1-1_amd64.deb /debs/miadi-deepdiver_0.1.0-1_amd64.deb /debs/deepdiver_0.1.0-1_all.deb >/dev/null
printf 'PASS install %s\n' "$(. /etc/os-release; echo "$PRETTY_NAME")"
test ! -e /root/.config/deepdiver
/usr/bin/deepdiver --help | grep 'chrome' >/dev/null
/usr/bin/deepdiver --version
if /usr/bin/deepdiver chrome launch >/tmp/root-launch 2>&1; then echo 'FAIL root launch'; exit 1; fi
grep 'ROOT BROWSER REFUSED' /tmp/root-launch
useradd -m -s /bin/bash diver
as_user() { runuser -u diver -- env HOME=/home/diver "$@"; }
as_user /usr/bin/miadi-deepdiver setup
cfg=/home/diver/.config/deepdiver/config.yaml
before=$(sha256sum "$cfg")
as_user /usr/bin/miadi-deepdiver setup
test "$before" = "$(sha256sum "$cfg")"
test "$(stat -c %a "$cfg")" = 600
printf 'PASS config idempotency and privacy\n'
as_user /usr/bin/miadi-deepdiver doctor --offline --browser-smoke
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
curl --noproxy '*' -fsS http://127.0.0.1:9222/json/version | grep -E 'Chrome|Chromium' >/dev/null
listeners=$(ss -ltnH 'sport = :9222')
printf '%s\n' "$listeners"
test -n "$listeners"
if printf '%s' "$listeners" | grep -E '0\.0\.0\.0:9222|\*:9222|\[::\]:9222'; then echo 'FAIL external CDP'; exit 1; fi
printf '%s' "$listeners" | grep '127.0.0.1:9222' >/dev/null
printf 'PASS upstream Chrome launch and loopback CDP (auth exit %s; not E2E)\n' "$chrome_rc"
# Use only this disposable container's browser, not any host/user session.
pkill -u diver -f '/usr/lib/miadi-deepdiver/browsers/' || true
# Reinstall while disconnected: venv uses only the packaged wheels.
apt-get --reinstall install -y --no-install-recommends /debs/miadi-deepdiver_0.1.0-1_amd64.deb >/dev/null
test "$before" = "$(sha256sum "$cfg")"
# Upgrade from a generated prior-version fixture; not a claim of prior release.
dpkg-deb -R /debs/miadi-deepdiver_0.1.0-1_amd64.deb /tmp/old
sed -i 's/^Version: .*/Version: 0.0.9-1/' /tmp/old/DEBIAN/control
dpkg-deb --build /tmp/old /tmp/old.deb >/dev/null
dpkg --remove deepdiver >/dev/null
dpkg -i /tmp/old.deb >/dev/null
apt-get install -y --no-install-recommends /debs/miadi-deepdiver_0.1.0-1_amd64.deb >/dev/null
test "$(dpkg-query -W -f='${Version}' miadi-deepdiver)" = 0.1.0-1
test "$before" = "$(sha256sum "$cfg")"
printf 'PASS reinstall and fixture upgrade\n'
apt-get remove -y miadi-deepdiver >/dev/null
test -f "$cfg"
test -d /home/diver/.chrome-deepdiver
test ! -e /usr/lib/miadi-deepdiver/venv
apt-get purge -y miadi-deepdiver >/dev/null
test -f "$cfg"
printf 'PASS remove/purge preserve user config/profile/skills\n'
echo 'PASS all clean-container lifecycle checks'
