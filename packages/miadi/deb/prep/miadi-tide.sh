#!/usr/bin/env bash
# prep/miadi-tide.sh <stage>: add miadi-tide's built parts to its stage.
# build.sh runs it; nothing it adds is kept in git.
#   - /usr/bin/plannotator-tui, built from the fork at jgwill/Miadi's
#     runtime/plannotator-tui pin (the submodule commit, not the fork's main)
#   - /usr/lib/miadi-tide/: the review script, its pane-write guard, and the
#     daemon store's pruner (run by tide-store-prune.timer)
#   - /usr/share/miadi-tide/wheels/: ironsilk from runtime/tide-runtime and the
#     dependency wheels pinned in miadi-tide.constraints.txt, cp311-cp313
#   - /usr/share/miadi-tide/node/@miadi/{tide,tide-contract}: what `pnpm pack`
#     would publish, unpacked (the package is not an npm release)
#   - /usr/share/miadi-tide/SOURCE: where each part came from
# Sources: MIADI_SRC (/a/src/Miadi), GAIA_SRC (/a/src/gaia),
# PANE_WRITE_GUARD_SRC (the dispatch-discipline skill's guard).
# Build cache: MIADI_DEB_CACHE (~/.cache/miadi-deb). Needs git, rustup's cargo,
# python3 with pip, pnpm, tar. Ref: jgwill/miadi-orchestration-kit#55
set -euo pipefail
stage=${1:?usage: prep/miadi-tide.sh <stage>}
here=$(cd "$(dirname "$0")" && pwd)
MIADI_SRC=${MIADI_SRC:-/a/src/Miadi}
GAIA_SRC=${GAIA_SRC:-/a/src/gaia}
PANE_WRITE_GUARD_SRC=${PANE_WRITE_GUARD_SRC:-/etc/claude-code/skills/dispatch-discipline/pane-write-guard.sh}
cache=${MIADI_DEB_CACHE:-$HOME/.cache/miadi-deb}/miadi-tide
lib=$stage/usr/lib/miadi-tide
share=$stage/usr/share/miadi-tide
mkdir -p "$cache" "$lib" "$share/wheels" "$share/node/@miadi" "$stage/usr/bin"

# where <repo> <path>: "<commit>" plus "+local changes" when the path is dirty
where() {
	local c
	c=$(git -C "$1" rev-parse --short=12 HEAD)
	if [ -n "$(git -C "$1" status --porcelain -- "$2")" ]; then c="$c+local changes"; fi
	echo "$c"
}

# 1. plannotator-tui at the pin
pin=$(git -C "$MIADI_SRC" ls-tree HEAD runtime/plannotator-tui | awk '{print $3}')
url=$(git -C "$MIADI_SRC" config -f .gitmodules submodule.runtime/plannotator-tui.url)
[ -n "$pin" ] && [ -n "$url" ] || { echo "prep: no runtime/plannotator-tui pin in $MIADI_SRC" >&2; exit 1; }
cargo_path=$PATH
[ -x "$HOME/.cargo/bin/cargo" ] && cargo_path=$HOME/.cargo/bin:$PATH
echo "prep: plannotator-tui $url @ ${pin:0:7}" >&2
PATH=$cargo_path cargo install --quiet --locked --ignore-rust-version \
	--git "$url" --rev "$pin" --root "$cache/cargo-$pin" plannotator-tui
install -m 0755 "$cache/cargo-$pin/bin/plannotator-tui" "$stage/usr/bin/plannotator-tui"

# 2. the review loop and its guard, side by side, and the daemon store's pruner
install -m 0755 "$GAIA_SRC/linux_migration/11-plannotator-tmux-review.sh" "$lib/plannotator-tmux-review.sh"
install -m 0755 "$PANE_WRITE_GUARD_SRC" "$lib/pane-write-guard.sh"
install -m 0755 "$MIADI_SRC/scripts/ops/tide-store-prune.sh" "$lib/tide-store-prune.sh"

# 3. the tide runtime's wheels: ironsilk plus the pinned dependencies
python3 -m pip wheel --quiet --no-deps --wheel-dir "$share/wheels" "$MIADI_SRC/runtime/tide-runtime"
install -m 0644 "$here/miadi-tide.constraints.txt" "$share/wheels/constraints.txt"
for v in 3.11 3.12 3.13; do
	python3 -m pip download --quiet --dest "$share/wheels" --only-binary=:all: \
		--python-version "$v" --implementation cp --platform manylinux2014_x86_64 \
		--platform manylinux_2_17_x86_64 --platform any \
		-r <(grep -v '^#' "$here/miadi-tide.constraints.txt")
done
chmod 0644 "$share/wheels"/*

# 4. the @miadi/tide sources, as they would be published
for p in tide-contract tide; do
	d=$share/node/@miadi/$p
	mkdir -p "$d"
	tgz=$(cd "$MIADI_SRC/packages/$p" && pnpm pack --pack-destination "$cache" 2>/dev/null | tail -1)
	tar -xzf "$tgz" -C "$d" --strip-components=1 --no-same-owner
	rm -f "$tgz"
done
find "$share/node" -type d -exec chmod 0755 {} +
find "$share/node" -type f -exec chmod 0644 {} +

# 5. provenance
ironsilk=$(ls "$share/wheels"/ironsilk-*.whl | sed 's#.*/ironsilk-\([^-]*\)-.*#\1#')
{
	echo "plannotator-tui: $url @ $pin ($("$stage/usr/bin/plannotator-tui" --version 2>/dev/null))"
	echo "plannotator-tmux-review.sh: jgwill/gaia linux_migration/11-plannotator-tmux-review.sh @ $(where "$GAIA_SRC" linux_migration/11-plannotator-tmux-review.sh)"
	echo "pane-write-guard.sh: $PANE_WRITE_GUARD_SRC"
	echo "tide-store-prune.sh: jgwill/Miadi scripts/ops/tide-store-prune.sh @ $(where "$MIADI_SRC" scripts/ops/tide-store-prune.sh)"
	echo "ironsilk $ironsilk: jgwill/Miadi runtime/tide-runtime @ $(where "$MIADI_SRC" runtime/tide-runtime)"
	for p in tide-contract tide; do
		echo "@miadi/$p $(sed -n 's/^  "version": "\(.*\)",/\1/p' "$share/node/@miadi/$p/package.json"): jgwill/Miadi packages/$p @ $(where "$MIADI_SRC" "packages/$p")"
	done
} > "$share/SOURCE"
chmod 0644 "$share/SOURCE"
cat "$share/SOURCE" >&2
