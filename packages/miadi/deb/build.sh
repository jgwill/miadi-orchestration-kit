#!/usr/bin/env bash
# Build every package here (a directory with DEBIAN/control) into dist/.
#   bash build.sh            -> dist/<package>_<version>_all.deb, one path per line
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
stage=
trap 'rm -rf "$stage"' EXIT
mkdir -p "$here/dist"
for control in "$here"/*/DEBIAN/control; do
	root=$(dirname "$(dirname "$control")")
	package=$(sed -n 's/^Package: //p' "$control")
	version=$(sed -n 's/^Version: //p' "$control")
	stage=$(mktemp -d)
	cp -a "$root/." "$stage/"
	find "$stage" -type d -exec chmod 0755 {} +
	find "$stage" -type f -exec chmod 0644 {} +
	if [ -d "$stage/usr/bin" ]; then find "$stage/usr/bin" -type f -exec chmod 0755 {} +; fi
	out="$here/dist/${package}_${version}_all.deb"
	dpkg-deb --root-owner-group --build "$stage" "$out" >/dev/null
	rm -rf "$stage"
	echo "$out"
done
