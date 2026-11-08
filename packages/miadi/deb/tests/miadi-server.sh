#!/usr/bin/env bash
# The miadi-server launcher: what it starts, in which mode, and what it refuses.
#   bash tests/miadi-server.sh                      the installed /usr/bin/miadi-server
#   MIADI_SERVER_BIN=path bash tests/miadi-server.sh   a copy from the source tree
set -euo pipefail
bin=${MIADI_SERVER_BIN:-/usr/bin/miadi-server}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/stub" "$work/app/.next"
touch "$work/app/package.json"
# A stand-in pnpm: records its arguments, its folder and the port it was given.
cat > "$work/stub/pnpm" <<EOF
#!/usr/bin/env bash
echo "\$* \$PWD \$PORT" > "$work/ran"
EOF
cat > "$work/stub/node" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$work/stub/pnpm" "$work/stub/node"

# run KEY=VALUE... -- ARGS: the launcher with only what the test gives it, and no host file
run() {
	local envs=()
	while [ "$1" != -- ]; do envs+=("$1"); shift; done
	shift
	rm -f "$work/ran"
	env -i HOME="$work" PATH="$work/stub:$(dirname "$(command -v miadi-config)"):/usr/bin:/bin" MIADI_ETC="$work/noetc" \
		MIADI_SRC=/nonexistent "${envs[@]}" "$bin" "$@"
}
fail() { echo "FAIL: $*" >&2; exit 1; }

# No checkout: exit 2, and nothing runs.
set +e; out=$(run MIADI_PROJECT_DIR=/nonexistent -- 2>&1); rc=$?; set -e
[ "$rc" = 2 ] || fail "no checkout exited $rc"
[[ $out == *"no checkout"* ]] || fail "no checkout said: $out"
[ ! -e "$work/ran" ] || fail "no checkout ran pnpm"
echo "ok no checkout is refused"

# Production with no build: exit 2, and nothing runs.
set +e; out=$(run MIADI_PROJECT_DIR="$work/app" -- 2>&1); rc=$?; set -e
[ "$rc" = 2 ] || fail "no build exited $rc"
[[ $out == *"no production build"* ]] || fail "no build said: $out"
[ ! -e "$work/ran" ] || fail "no build ran pnpm"
echo "ok production with no build is refused"

# check says so too, with exit 1.
set +e; out=$(run MIADI_PROJECT_DIR="$work/app" -- check 2>&1); rc=$?; set -e
[ "$rc" = 1 ] || fail "check exited $rc"
[[ $out == *"missing   no production build"* ]] || fail "check said: $out"
echo "ok check names what stops it"

touch "$work/app/.next/BUILD_ID"

# No mode file means prod, on the default port.
run MIADI_PROJECT_DIR="$work/app" --
[ "$(cat "$work/ran")" = "start $work/app 3335" ] || fail "prod ran: $(cat "$work/ran")"
echo "ok no mode file starts production on 3335"

# The mode file and the port are honoured.
echo dev > "$work/mode"
run MIADI_PROJECT_DIR="$work/app" MIADI_MODE_FILE="$work/mode" MIADI_PORT=4000 --
[ "$(cat "$work/ran")" = "dev $work/app 4000" ] || fail "dev ran: $(cat "$work/ran")"
echo "ok the mode file and port are honoured"

# An unknown mode is refused.
echo staging > "$work/mode"
set +e; out=$(run MIADI_PROJECT_DIR="$work/app" MIADI_MODE_FILE="$work/mode" -- 2>&1); rc=$?; set -e
[ "$rc" = 2 ] || fail "unknown mode exited $rc"
[[ $out == *"neither dev nor prod"* ]] || fail "unknown mode said: $out"
echo "ok an unknown mode is refused"

# MIADI_SRC stands in for the checkout.
rm -f "$work/mode"
run MIADI_SRC="$work/app" --
[ "$(cat "$work/ran")" = "start $work/app 3335" ] || fail "MIADI_SRC ran: $(cat "$work/ran")"
echo "ok MIADI_SRC stands in for the checkout"

# check passes when nothing is missing.
out=$(run MIADI_PROJECT_DIR="$work/app" -- check)
[[ $out == *"ready to start"* ]] || fail "check said: $out"
echo "ok check passes on a ready host"
