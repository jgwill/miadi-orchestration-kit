#!/usr/bin/env bash
# Build every package here (a directory with DEBIAN/control) into dist/.
# Each gets /usr/share/doc/<package>/copyright from LICENSE.
#   bash build.sh            -> dist/<package>_<version>_all.deb, one path per line
# A package with a directory under termux/ also gets a Termux build,
#   -> dist/termux/<package>_<version>_all.deb (termux/README.md).
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
stage=
trap 'rm -rf "$stage"' EXIT
mkdir -p "$here/dist"

copyright() { # copyright <package>: the Debian copyright file, from LICENSE
	printf 'Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/\n'
	printf 'Upstream-Name: %s\nSource: https://github.com/jgwill/miadi-orchestration-kit\n\n' "$1"
	printf 'Files: *\nCopyright: %s\nLicense: Expat\n' "$(sed -n 's/^Copyright (c) //p' "$here/LICENSE")"
	sed -n '/^Permission/,$p' "$here/LICENSE" | sed 's/^$/./; s/^/ /'
}

for control in "$here"/*/DEBIAN/control; do
	root=$(dirname "$(dirname "$control")")
	package=$(sed -n 's/^Package: //p' "$control")
	version=$(sed -n 's/^Version: //p' "$control")
	stage=$(mktemp -d)
	cp -a "$root/." "$stage/"
	find "$stage" -type d -exec chmod 0755 {} +
	find "$stage" -type f -exec chmod 0644 {} +
	if [ -d "$stage/usr/bin" ]; then find "$stage/usr/bin" -type f -exec chmod 0755 {} +; fi
	for script in preinst postinst prerm postrm; do
		if [ -f "$stage/DEBIAN/$script" ]; then chmod 0755 "$stage/DEBIAN/$script"; fi
	done
	mkdir -p "$stage/usr/share/doc/$package"
	copyright "$package" > "$stage/usr/share/doc/$package/copyright"
	chmod 0755 "$stage/usr/share/doc" "$stage/usr/share/doc/$package"
	chmod 0644 "$stage/usr/share/doc/$package/copyright"
	out="$here/dist/${package}_${version}_all.deb"
	dpkg-deb --root-owner-group --build "$stage" "$out" >/dev/null
	rm -rf "$stage"
	echo "$out"
done

# Termux builds: the same tree, the paths termux/<package>/include names,
# relocated under the Termux prefix.
PREFIX=/data/data/com.termux/files/usr
for control in "$here"/termux/*/control; do
	[ -f "$control" ] || continue
	variant=$(dirname "$control")
	package=$(basename "$variant")
	version=$(sed -n 's/^Version: //p' "$here/$package/DEBIAN/control")
	stage=$(mktemp -d)
	mkdir -p "$stage/DEBIAN" "$stage$PREFIX"
	sed "s/@VERSION@/$version/" "$control" > "$stage/DEBIAN/control"
	if [ -f "$variant/postinst" ]; then install -m 0755 "$variant/postinst" "$stage/DEBIAN/postinst"; fi
	while IFS= read -r path; do
		[ -n "$path" ] || continue
		mkdir -p "$stage$PREFIX/$(dirname "${path#usr/}")"
		cp -a "$here/$package/$path" "$stage$PREFIX/${path#usr/}"
	done < "$variant/include"
	find "$stage$PREFIX" -type f -exec sed -i "s#/usr/#$PREFIX/#g; s#/etc/miadi#$PREFIX/etc/miadi#g" {} +
	find "$stage" -type d -exec chmod 0755 {} +
	find "$stage$PREFIX" -type f -exec chmod 0644 {} +
	if [ -d "$stage$PREFIX/bin" ]; then find "$stage$PREFIX/bin" -type f -exec chmod 0755 {} +; fi
	mkdir -p "$stage$PREFIX/share/doc/$package"
	copyright "$package" > "$stage$PREFIX/share/doc/$package/copyright"
	chmod 0644 "$stage$PREFIX/share/doc/$package/copyright"
	mkdir -p "$here/dist/termux"
	out="$here/dist/termux/${package}_${version}_all.deb"
	dpkg-deb --root-owner-group --build "$stage" "$out" >/dev/null
	rm -rf "$stage"
	echo "$out"
done
