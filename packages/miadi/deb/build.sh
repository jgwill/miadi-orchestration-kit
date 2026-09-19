#!/usr/bin/env bash
# Build the `miadi` .deb from root/ into dist/.
#   bash build.sh            -> dist/miadi_<version>_all.deb
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
version=$(sed -n 's/^Version: //p' "$here/root/DEBIAN/control")
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
cp -a "$here/root/." "$stage/"
find "$stage" -type d -exec chmod 0755 {} +
find "$stage" -type f -exec chmod 0644 {} +
mkdir -p "$here/dist"
out="$here/dist/miadi_${version}_all.deb"
dpkg-deb --root-owner-group --build "$stage" "$out" >/dev/null
echo "$out"
