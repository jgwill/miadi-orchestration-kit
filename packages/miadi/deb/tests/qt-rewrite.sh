#!/bin/sh
# Konsole opens a link through Qt's QUrl, which rewrites miadi-chronicle://560
# as miadi-chronicle://0.0.2.48 (jgwill/Miadi#595). Each input is what Qt 5.15
# produced on gaia; the handler reads the number back when it has one reading.
#
#     sh tests/qt-rewrite.sh [miadi-chronicle-open]
opener=${1:-$(dirname "$0")/../miadi-terminal/usr/bin/miadi-chronicle-open}
export MIADI_CHRONICLE_OPEN_URL=https://front.test
door=https://front.test/api/chronicle/open?uri=
fail=0

check() {
	got=$(python3 "$opener" "$1")
	if [ "$got" = "$door$2" ]; then echo "ok   $1"; else echo "FAIL $1 -> $got (want $door$2)"; fail=1; fi
}

check miadi-chronicle://0.0.2.48 miadi-chronicle%3A%2F%2F560
check miadi-chronicle://0.0.2.51/notes.md miadi-chronicle%3A%2F%2F563%2Fnotes.md
check miadi-chronicle://0.0.3.232 miadi-chronicle%3A%2F%2F1000
check miadi-chronicle://0.0.0.5 miadi-chronicle%3A%2F%2F5
# 52 and 064 both arrive as 0.0.0.52: the door offers both readings.
check miadi-chronicle://0.0.0.52 miadi-chronicle%3A%2F%2F0.0.0.52
# What Qt leaves alone passes through.
check miadi-chronicle://098 miadi-chronicle%3A%2F%2F098
check miadi-chronicle://560 miadi-chronicle%3A%2F%2F560
check miadi-chronicle://0.0.2.256 miadi-chronicle%3A%2F%2F0.0.2.256
exit $fail
