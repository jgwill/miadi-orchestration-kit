#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive DISABLE_AUTOUPDATER=1
apt-get update -qq
apt-get install -y --no-install-recommends /debs/miadi-deepdiver-chromium_1.64.1-1_amd64.deb /debs/miadi-deepdiver_0.1.0-1_amd64.deb >/dev/null
useradd -m -s /bin/bash diver
u() { runuser -u diver -- env HOME=/home/diver DISABLE_AUTOUPDATER=1 "$@"; }
u mkdir -p /home/diver/project /home/diver/.claude
printf '{"theme":"dark","env":{"PERSONAL_MARKER":"keep"},"enabledPlugins":{"personal@example":false}}\n' > /home/diver/.claude/settings.json
chown diver:diver /home/diver/.claude/settings.json
cd /home/diver/project
u /usr/bin/miadi-deepdiver setup --claude
u /usr/bin/miadi-deepdiver setup --claude
u /usr/bin/miadi-deepdiver doctor --offline --claude
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
