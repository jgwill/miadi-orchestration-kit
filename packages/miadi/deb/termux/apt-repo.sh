#!/usr/bin/env bash
# Add Termux builds to a flat apt repository on the phone and index it, so
# the Miadi Termux packages install and upgrade with apt.
#   bash termux/apt-repo.sh dist/termux/<package>_<version>_all.deb ...
#   bash termux/apt-repo.sh            # index only
# The repository is $MIADI_TERMUX_APT_DIR, by default
# /data/data/com.termux/files/srv/apt/miadi-termux. Older versions stay
# beside newer ones; apt picks the newest. (termux/README.md)
set -euo pipefail
PREFIX=${PREFIX:-/data/data/com.termux/files/usr}
dir=${MIADI_TERMUX_APT_DIR:-/data/data/com.termux/files/srv/apt/miadi-termux}
list="$PREFIX/etc/apt/sources.list.d/miadi-termux.list"
mkdir -p "$dir"

for deb in "$@"; do
	arch=$(dpkg-deb -f "$deb" Architecture)
	case "$arch" in
	all | aarch64) cp -f "$deb" "$dir/" && echo "added $(basename "$deb")" ;;
	*) echo "skipped $(basename "$deb"): Architecture $arch is not for Termux" >&2 ;;
	esac
done

hashes() { # hashes <tool> <file>...: the Release lines for one checksum
	local tool=$1 f
	shift
	for f in "$@"; do
		printf ' %s %s %s\n' "$($tool <"$dir/$f" | cut -d' ' -f1)" "$(stat -c %s "$dir/$f")" "$f"
	done
}

tmp=$(mktemp "$dir/.Packages.XXXXXX")
for deb in "$dir"/*.deb; do
	[ -f "$deb" ] || continue
	dpkg-deb -f "$deb"
	printf 'Filename: ./%s\nSize: %s\nMD5sum: %s\nSHA256: %s\n\n' "$(basename "$deb")" \
		"$(stat -c %s "$deb")" "$(md5sum <"$deb" | cut -d' ' -f1)" "$(sha256sum <"$deb" | cut -d' ' -f1)"
done >"$tmp"
mv -f "$tmp" "$dir/Packages"
gzip -9nkf "$dir/Packages"
{
	printf 'Origin: Miadi\nLabel: miadi-termux\nDate: %s\nArchitectures: all aarch64\n' "$(date -Ru)"
	printf 'MD5Sum:\n'
	hashes md5sum Packages Packages.gz
	printf 'SHA256:\n'
	hashes sha256sum Packages Packages.gz
} >"$dir/Release"
echo "indexed $(grep -c '^Package: ' "$dir/Packages") package versions in $dir"

line="deb [trusted=yes] file://$dir ./"
if ! grep -qsF "$line" "$list"; then
	echo "add the repository once:  echo '$line' > $list && apt update"
fi
