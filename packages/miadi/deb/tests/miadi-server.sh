#!/usr/bin/env bash
# The miadi-server launcher: what it starts, in which mode, and what it refuses.
#   bash tests/miadi-server.sh                      the installed /usr/bin/miadi-server
#   MIADI_SERVER_BIN=path bash tests/miadi-server.sh   a copy from the source tree
set -euo pipefail
bin=${MIADI_SERVER_BIN:-/usr/bin/miadi-server}
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/stub" "$work/checkout/.next" "$work/lib/app/.next" "$work/lib/app/data" "$work/lib/app/node_modules"
touch "$work/checkout/package.json"
echo seeded > "$work/lib/app/data/modes.json"
echo 'server' > "$work/lib/app/server.js"
echo 'jgwill/Miadi abc' > "$work/lib/SOURCE"
for tool in pnpm node; do
	cat > "$work/stub/$tool" <<STUB
#!/usr/bin/env bash
echo "$tool \$* \$PWD \$PORT \$HOSTNAME" > "$work/ran"
STUB
	chmod +x "$work/stub/$tool"
done

# run KEY=VALUE... -- ARGS: the launcher with only what the test gives it, and no host file
run() {
	local envs=()
	while [ "$1" != -- ]; do envs+=("$1"); shift; done
	shift
	rm -f "$work/ran"
	env -i HOME="$work/home" PATH="$work/stub:$(dirname "$(command -v miadi-config)"):/usr/bin:/bin" MIADI_ETC="$work/noetc" \
		MIADI_SERVER_APP="$work/lib/app" MIADI_SERVER_NODE="$work/stub/node" "${envs[@]}" "$bin" "$@"
}
fail() { echo "FAIL: $*" >&2; exit 1; }
installed="$work/home/.local/state/miadi-server/app"

# The installed app runs with no checkout, on loopback.
run --
[ "$(cat "$work/ran")" = "node server.js $installed 3335 127.0.0.1" ] || fail "installed app ran: $(cat "$work/ran")"
echo "ok the installed app starts with no checkout, on 127.0.0.1:3335"

# A MIADI_SRC on the host does not send it looking for a checkout.
run MIADI_SRC=/nonexistent --
[[ $(cat "$work/ran") == "node server.js $installed "* ]] || fail "MIADI_SRC changed what ran: $(cat "$work/ran")"
echo "ok MIADI_SRC does not replace the installed app"

# The port and address are honoured.
run MIADI_PORT=4000 MIADI_BIND=0.0.0.0 --
[ "$(cat "$work/ran")" = "node server.js $installed 4000 0.0.0.0" ] || fail "port ran: $(cat "$work/ran")"
echo "ok the port and address are honoured"

# What the app saves is writable, and survives a later start.
[ -L "$installed/.next" ] || fail ".next is not linked"
[ ! -L "$installed/data" ] || fail "data is a link"
echo changed > "$installed/data/modes.json"
run --
[ "$(cat "$installed/data/modes.json")" = changed ] || fail "a start overwrote saved data"
echo "ok what the app saves is kept across starts"

# init stores settings privately, and the app finds them.
printf 'KV_REST_API_URL=http://127.0.0.1:9\n' > "$work/given.env"
run -- init "$work/given.env" >/dev/null
settings="$work/home/.config/miadi-server/env"
[ "$(stat -c %a "$settings")" = 600 ] || fail "settings mode is $(stat -c %a "$settings")"
run --
[ "$(readlink "$installed/.env")" = "$settings" ] || fail ".env does not point at the settings"
echo "ok init stores settings at mode 600, and the app finds them"

# check names what is missing, with exit 1.
rm -f "$settings"
set +e; out=$(run -- check 2>&1); rc=$?; set -e
[ "$rc" = 1 ] || fail "check exited $rc"
[[ $out == *"no settings at"* ]] || fail "check said: $out"
echo "ok check names missing settings"

# A package with no app refuses to start: exit 2, nothing runs.
set +e; out=$(run MIADI_SERVER_APP="$work/none" -- 2>&1); rc=$?; set -e
[ "$rc" = 2 ] || fail "no app exited $rc"
[[ $out == *"not installed"* ]] || fail "no app said: $out"
[ ! -e "$work/ran" ] || fail "no app ran something"
echo "ok no installed app is refused"

# Help lists the commands and settings.
out=$(run -- --help)
for word in start check init version MIADI_PORT MIADI_BIND MIADI_PROJECT_DIR KV_REST_API_URL; do
	[[ $out == *"$word"* ]] || fail "help does not name $word"
done
echo "ok --help lists the commands and settings"

# With MIADI_PROJECT_DIR it runs that checkout instead.
set +e; out=$(run MIADI_PROJECT_DIR=/nonexistent -- 2>&1); rc=$?; set -e
[ "$rc" = 2 ] && [[ $out == *"no checkout"* ]] || fail "missing checkout: $rc $out"
set +e; out=$(run MIADI_PROJECT_DIR="$work/checkout" -- 2>&1); rc=$?; set -e
[ "$rc" = 2 ] && [[ $out == *"no production build"* ]] || fail "no build: $rc $out"
touch "$work/checkout/.next/BUILD_ID"
run MIADI_PROJECT_DIR="$work/checkout" --
[ "$(cat "$work/ran")" = "pnpm start $work/checkout 3335 127.0.0.1" ] || fail "checkout ran: $(cat "$work/ran")"
echo dev > "$work/mode"
run MIADI_PROJECT_DIR="$work/checkout" MIADI_MODE_FILE="$work/mode" --
[ "$(cat "$work/ran")" = "pnpm dev $work/checkout 3335 127.0.0.1" ] || fail "dev ran: $(cat "$work/ran")"
echo staging > "$work/mode"
set +e; out=$(run MIADI_PROJECT_DIR="$work/checkout" MIADI_MODE_FILE="$work/mode" -- 2>&1); rc=$?; set -e
[ "$rc" = 2 ] && [[ $out == *"neither dev nor prod"* ]] || fail "unknown mode: $rc $out"
echo "ok MIADI_PROJECT_DIR runs a checkout, in its mode"
