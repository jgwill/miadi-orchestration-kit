#!/usr/bin/env bash
# prep/miadi-music-measure.sh <stage>: add the measuring venv's wheels to its stage.
# build.sh runs it; nothing it adds is kept in git.
#   - /usr/share/miadi-music/wheels/: the wheels pinned in
#     miadi-music-measure.constraints.txt, cp310-cp312, and constraints.txt
#   - /usr/share/miadi-music/SOURCE: the pins the wheels were downloaded for
# Needs python3 with pip, and the network.
set -euo pipefail
stage=${1:?usage: prep/miadi-music-measure.sh <stage>}
here=$(cd "$(dirname "$0")" && pwd)
share=$stage/usr/share/miadi-music
mkdir -p "$share/wheels"
install -m 0644 "$here/miadi-music-measure.constraints.txt" "$share/wheels/constraints.txt"
for v in 3.10 3.11 3.12; do
	python3 -m pip download --quiet --dest "$share/wheels" --only-binary=:all: \
		--python-version "$v" --implementation cp --platform manylinux2014_x86_64 \
		--platform manylinux_2_17_x86_64 --platform manylinux_2_28_x86_64 --platform any \
		-r <(grep -v '^#' "$here/miadi-music-measure.constraints.txt")
done
chmod 0644 "$share/wheels"/*
{
	echo "wheels: PyPI, downloaded $(date -u +%Y-%m-%d) for cp310 cp311 cp312 manylinux x86_64"
	grep -v '^#' "$here/miadi-music-measure.constraints.txt"
} > "$share/SOURCE"
chmod 0644 "$share/SOURCE"
