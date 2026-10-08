#!/usr/bin/env bash
# prep/miadi-node.sh <stage>: the Node.js runtime miadi-node carries, at /usr/lib/miadi-node.
# Only bin/node and the release's LICENSE: no npm, npx or corepack, and nothing on PATH, so a
# system or nvm node is never shadowed. Ref: jgwill/miadi-orchestration-kit#77
set -euo pipefail
stage=${1:?usage: prep/miadi-node.sh <stage>}
. "$(dirname "$0")/node-release.sh"
trap 'rm -rf "$node_dir"' EXIT
install -D -m 0755 "$node_dir/bin/node" "$stage/usr/lib/miadi-node/bin/node"
install -D -m 0644 "$node_dir/LICENSE" "$stage/usr/share/doc/miadi-node/LICENSE.node"
printf 'Node.js %s, linux-x64, from https://nodejs.org/dist/%s/ (sha256 checked against SHASUMS256.txt)\n' \
	"$node_release" "$node_release" > "$stage/usr/share/doc/miadi-node/SOURCE"
chmod 0644 "$stage/usr/share/doc/miadi-node/SOURCE"
echo "miadi-node: node $node_release" >&2
