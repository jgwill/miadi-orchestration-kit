#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive DISABLE_AUTOUPDATER=1
apt-get update -qq
apt-get install -y --no-install-recommends /debs/miadi-deepdiver-chromium_1.64.1-1_amd64.deb /debs/miadi-deepdiver_0.1.0-2_amd64.deb >/dev/null
useradd -m -s /bin/bash diver
u() { runuser -u diver -- env HOME=/home/diver DISABLE_AUTOUPDATER=1 "$@"; }
u mkdir -p /home/diver/project /home/diver/.claude
printf '{"theme":"dark","env":{"PERSONAL_MARKER":"keep"},"enabledPlugins":{"personal@example":false}}\n' > /home/diver/.claude/settings.json
chown diver:diver /home/diver/.claude/settings.json
cd /home/diver/project
u /usr/bin/miadi-deepdiver setup --claude
u /usr/bin/miadi-deepdiver setup --claude
u /usr/bin/miadi-deepdiver doctor --offline --claude | tee /tmp/factory
grep 'FACTORY NEEDS node' /tmp/factory
grep 'FACTORY NOT READY' /tmp/factory
/usr/bin/python3 - <<'PY'
import json
from pathlib import Path
s=json.loads(Path('/home/diver/.claude/settings.json').read_text())
assert s['theme']=='dark' and s['env']['PERSONAL_MARKER']=='keep'
assert s['enabledPlugins']['personal@example'] is False
assert s['enabledPlugins']['miadi-deepdiver@miadi-orchestration-kit'] is True
assert Path('/home/diver/.claude/skills/notebooklm-automation/SKILL.md').is_file()
print('PASS real Claude marketplace, canonical plugin, embedded skill, idempotency and personal-settings preservation from non-home project')
PY
u claude plugin disable miadi-deepdiver@miadi-orchestration-kit --scope user >/dev/null
if u /usr/bin/miadi-deepdiver setup --claude >/tmp/disabled 2>&1; then echo 'FAIL disabled plugin overridden'; exit 1; fi
grep 'PLUGIN DISABLED' /tmp/disabled
/usr/bin/python3 - <<'PY'
import json
from pathlib import Path
assert json.loads(Path('/home/diver/.claude/settings.json').read_text())['enabledPlugins']['miadi-deepdiver@miadi-orchestration-kit'] is False
print('PASS explicitly disabled plugin stays disabled')
PY
# 2.0.76's real answers, until its own `claude install stable` has run.
useradd -m -s /bin/bash olddiver
stub=/home/olddiver/stub
mkdir "$stub"
cat > "$stub/claude" <<'SH'
#!/bin/sh
if [ "$1 $2" = "install stable" ]; then
  if [ -n "${STUB_INSTALL_WORKS:-}" ]; then : > "$HOME/.stub-current"; fi
  exit 0
fi
if [ -e "$HOME/.stub-current" ]; then exec /usr/local/bin/claude "$@"; fi
if [ "$1" = --version ]; then echo '2.0.76 (Claude Code)'; exit 0; fi
if [ "$1 $2" = "plugin list" ]; then echo "error: unknown command 'list'" >&2; exit 1; fi
echo "error: unknown option '--json'" >&2
exit 1
SH
chmod 755 "$stub/claude"
chown -R olddiver:olddiver "$stub"
cd /tmp
o() { runuser -u olddiver -- env HOME=/home/olddiver DISABLE_AUTOUPDATER=1 PATH="$stub:$PATH" "$@"; }
if o /usr/bin/miadi-deepdiver setup --claude >/tmp/old-stuck 2>&1; then echo 'FAIL old Claude that stayed old passed setup'; exit 1; fi
grep 'CLAUDE TOO OLD: .*2.0.76' /tmp/old-stuck
if o /usr/bin/miadi-deepdiver doctor --offline --claude >/tmp/old-doctor 2>&1; then echo 'FAIL doctor passed an old Claude'; exit 1; fi
grep 'CLAUDE TOO OLD: .*setup --claude brings it forward' /tmp/old-doctor
o env STUB_INSTALL_WORKS=1 /usr/bin/miadi-deepdiver setup --claude | tee /tmp/old-moved
grep 'CLAUDE UPDATE: .*2.0.76' /tmp/old-moved
o /usr/bin/miadi-deepdiver doctor --offline --claude
echo 'PASS an old Claude is named, brought forward with its own installer, and then gets the plugin'
