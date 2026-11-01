#!/usr/bin/env bash
# The Termux miadi-tide installs what the Ubuntu one carries: every pin of
# prep/miadi-tide.constraints.txt and, given MIADI_SRC, the ironsilk of its
# runtime/tide-runtime (jgwill/miadi-orchestration-kit#118).
#   MIADI_SRC=/a/src/Miadi bash tests/termux-tide-pins.sh
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
req=$here/termux/miadi-tide/prefix/share/miadi-tide/requirements.txt
pins() { grep -v '^#' "$1" | sed '/^$/d' | tr '[:upper:]' '[:lower:]' | sort; }
fail=0
missing=$(comm -23 <(pins "$here/prep/miadi-tide.constraints.txt") <(pins "$req"))
if [ -n "$missing" ]; then
	echo "requirements.txt lacks these pins of the constraints:" $missing
	fail=1
fi
if [ -n "${MIADI_SRC:-}" ]; then
	v=$(sed -n 's/^version = "\(.*\)"/\1/p' "$MIADI_SRC/runtime/tide-runtime/pyproject.toml")
	if ! grep -qx "ironsilk==$v" "$req"; then
		echo "requirements.txt has $(grep '^ironsilk' "$req"), $MIADI_SRC/runtime/tide-runtime is $v"
		fail=1
	fi
fi
[ "$fail" -ne 0 ] || echo "ok: the Termux miadi-tide pins match"
exit "$fail"
