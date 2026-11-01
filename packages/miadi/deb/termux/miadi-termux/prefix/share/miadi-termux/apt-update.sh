#!/usr/bin/env bash
# Run by apt before every `apt update` (apt.conf.d/50miadi-termux): build each
# Termux package whose version on the kit's origin/main is not yet in this
# phone's Miadi Termux repository, and index the repository, so that
# `apt update && apt upgrade` installs what agents pushed to the kit.
# The kit checkout is only fetched, its working tree is never touched: the
# packages are built from `git archive origin/main`. It never fails apt: each
# problem is one line, and the repository stays as it was.
#   MIADI_ORCHESTRATION_KIT  the kit checkout (default under files/repos)
#   MIADI_TERMUX_APT_DIR     the repository (default files/srv/apt/miadi-termux)
set -u
kit=${MIADI_ORCHESTRATION_KIT:-/data/data/com.termux/files/repos/jgwill/miadi-orchestration-kit}
repo=${MIADI_TERMUX_APT_DIR:-/data/data/com.termux/files/srv/apt/miadi-termux}
say() { echo "miadi-termux: $*"; }
[ -e "$kit/.git" ] || exit 0
mkdir -p "$repo"
lock=$repo/.update.lock
find "$lock" -maxdepth 0 -mmin +30 -exec rm -rf {} + 2>/dev/null
mkdir "$lock" 2>/dev/null || { say "another update is building; skipped"; exit 0; }
tmp=
trap 'rm -rf "$lock" "$tmp"' EXIT

if ! timeout 60 git -C "$kit" fetch -q origin main 2>/dev/null; then
	say "could not fetch $kit; the repository stays as it is"
	exit 0
fi
rev=$(git -C "$kit" rev-parse --short origin/main)
tmp=$(mktemp -d)
if ! git -C "$kit" archive origin/main packages/miadi/deb | tar -x -C "$tmp"; then
	say "could not read packages/miadi/deb at $rev"
	exit 0
fi
deb=$tmp/packages/miadi/deb

built=()
for control in "$deb"/termux/*/control; do
	package=$(basename "$(dirname "$control")")
	# The version build.sh gives the build: the Ubuntu package's, with any Termux revision.
	version=$(sed -n 's/^Version: //p' "$control")
	if [ -f "$deb/$package/DEBIAN/control" ]; then
		version=${version//@VERSION@/$(sed -n 's/^Version: //p' "$deb/$package/DEBIAN/control")}
	fi
	[ -f "$repo/${package}_${version}_all.deb" ] && continue
	out=$(bash "$deb/build.sh" "termux/$package" 2>&1 | tail -n 1)
	if [ -f "$out" ]; then
		built+=("$out")
		say "built $package $version from the kit at $rev"
	else
		say "could not build $package $version at $rev: $out"
	fi
done
[ ${#built[@]} -gt 0 ] || exit 0
MIADI_TERMUX_APT_DIR=$repo bash "$deb/termux/apt-repo.sh" "${built[@]}" 2>&1 | sed 's/^/miadi-termux: /'
exit 0
