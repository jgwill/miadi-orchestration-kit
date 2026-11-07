#!/usr/bin/env bash
# Puts the steering extension where Copilot finds it for this account (jgwill/Miadi#942), and turns on
# the one feature flag Copilot loads extensions under. --experimental would load it too, and would
# write experimental: true into settings.json for every later session, so this does not use it.
#   install.sh           install or update
#   install.sh --remove  take it out, and the flag with it when no other extension remains
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
home="${COPILOT_HOME:-$HOME/.copilot}"
dest="$home/extensions/miadi-steering"
settings="$home/settings.json"

set_flag() {
  node - "$settings" "$1" <<'JS'
const { existsSync, readFileSync, renameSync, writeFileSync } = require("node:fs");
const [file, want] = process.argv.slice(2);
const value = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const flags = { ...(value.enabledFeatureFlags ?? {}) };
if (want === "on") flags.EXTENSIONS = true;
else delete flags.EXTENSIONS;
if (Object.keys(flags).length) value.enabledFeatureFlags = flags;
else delete value.enabledFeatureFlags;
const tmp = `${file}.tmp-${process.pid}`;
writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
renameSync(tmp, file);
JS
}

if [ "${1:-}" = "--remove" ]; then
  rm -rf -- "$dest"
  if [ -z "$(ls -A "$home/extensions" 2>/dev/null)" ]; then set_flag off; fi
  echo "removed $dest"
  exit 0
fi
mkdir -p "$dest"
cp "$here/extension.mjs" "$here/steering_inbox.mjs" "$here/package.json" "$dest/"
set_flag on
echo "installed $(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$dest/package.json" | head -1) at $dest, with enabledFeatureFlags.EXTENSIONS on in $settings"
