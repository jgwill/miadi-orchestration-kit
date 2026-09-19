#!/usr/bin/env bash
# Build every package here (a directory with DEBIAN/control) into dist/.
# Each gets /usr/share/doc/<package>/copyright from LICENSE.
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
	mkdir -p "$stage/usr/share/doc/$package"
	{
		printf 'Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/\n'
		printf 'Upstream-Name: %s\nSource: https://github.com/jgwill/miadi-orchestration-kit\n\n' "$package"
		printf 'Files: *\nCopyright: %s\nLicense: Expat\n' "$(sed -n 's/^Copyright (c) //p' "$here/LICENSE")"
		sed -n '/^Permission/,$p' "$here/LICENSE" | sed 's/^$/./; s/^/ /'
	} > "$stage/usr/share/doc/$package/copyright"
	chmod 0755 "$stage/usr/share/doc" "$stage/usr/share/doc/$package"
	chmod 0644 "$stage/usr/share/doc/$package/copyright"
	out="$here/dist/${package}_${version}_all.deb"
	dpkg-deb --root-owner-group --build "$stage" "$out" >/dev/null
	rm -rf "$stage"
	echo "$out"
done
