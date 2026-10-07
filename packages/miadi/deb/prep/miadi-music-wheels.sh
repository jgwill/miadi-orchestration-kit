#!/usr/bin/env bash
# prep/miadi-music-wheels.sh <python version> <stage>: the wheels miadi-music-measure builds its
# venv from, for one Python, into /usr/share/miadi-music/wheels/cp<NN>/ with constraints.txt
# and SOURCE. build.sh runs it through prep/miadi-music-wheels-cp<NN>.sh; nothing it adds is
# kept in git. One package per Python keeps each under the apt repository's 100 MB limit.
# Needs python3 with pip, and the network.
set -euo pipefail
version=${1:?usage: prep/miadi-music-wheels.sh <python version> <stage>}
stage=${2:?usage: prep/miadi-music-wheels.sh <python version> <stage>}
here=$(cd "$(dirname "$0")" && pwd)
pins=$here/miadi-music-measure.constraints.txt
dir=$stage/usr/share/miadi-music/wheels/cp${version/./}
mkdir -p "$dir"
python3 -m pip download --quiet --dest "$dir" --only-binary=:all: \
	--python-version "$version" --implementation cp --platform manylinux2014_x86_64 \
	--platform manylinux_2_17_x86_64 --platform manylinux_2_28_x86_64 --platform any \
	-r <(grep -v '^#' "$pins")
install -m 0644 "$pins" "$dir/constraints.txt"
{
	echo "wheels: PyPI, downloaded $(date -u +%Y-%m-%d) for cp${version/./} manylinux x86_64"
	grep -v '^#' "$pins"
} > "$dir/SOURCE"
chmod 0644 "$dir"/*
