#!/usr/bin/env bash
# Puts the steering extension where Copilot finds it for this account (jgwill/Miadi#942). A session
# loads it only when started with --experimental; the factory runner's launcher passes that.
#   install.sh           install or update
#   install.sh --remove  take it out
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dest="${COPILOT_HOME:-$HOME/.copilot}/extensions/miadi-steering"
if [ "${1:-}" = "--remove" ]; then
  rm -rf -- "$dest"
  echo "removed $dest"
  exit 0
fi
mkdir -p "$dest"
cp "$here/extension.mjs" "$here/steering_inbox.mjs" "$here/package.json" "$dest/"
echo "installed $(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$dest/package.json" | head -1) at $dest"
