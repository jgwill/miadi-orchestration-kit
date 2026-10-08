#!/usr/bin/env bash
# prep/node-release.sh: source me. Sets node_dir to the Node.js release miadi-node's Version names
# (24.21.0-1 -> v24.21.0), unpacked from the nodejs.org linux-x64 tarball after its sha256 matches
# the release's SHASUMS256.txt. The tarball is cached in MIADI_DEB_CACHE (~/.cache/miadi-deb).
# Used by prep/miadi-node.sh and prep/miadi-chronicle-npm.sh, so both halves are installed with the
# npm of the Node that runs them. The caller removes $node_dir. Ref: jgwill/miadi-orchestration-kit#77
node_version=$(sed -n 's/^Version: //p' "$(dirname "${BASH_SOURCE[0]}")/../miadi-node/DEBIAN/control")
node_release="v${node_version%%-*}"
node_cache=${MIADI_DEB_CACHE:-$HOME/.cache/miadi-deb}
node_tarball="$node_cache/node-$node_release-linux-x64.tar.xz"
mkdir -p "$node_cache"
[ -s "$node_tarball" ] || curl -fsSL -o "$node_tarball" "https://nodejs.org/dist/$node_release/node-$node_release-linux-x64.tar.xz"
curl -fsSL -o "$node_cache/node-$node_release-SHASUMS256.txt" "https://nodejs.org/dist/$node_release/SHASUMS256.txt"
(cd "$node_cache" && grep " node-$node_release-linux-x64.tar.xz\$" "node-$node_release-SHASUMS256.txt" | sha256sum -c --quiet -) \
	|| { echo "prep: node-$node_release-linux-x64.tar.xz does not match nodejs.org's SHASUMS256.txt" >&2; exit 1; }
node_dir=$(mktemp -d)
tar -xJf "$node_tarball" -C "$node_dir" --strip-components=1
[ "$("$node_dir/bin/node" --version)" = "$node_release" ] || { echo "prep: unpacked node is not $node_release" >&2; exit 1; }
