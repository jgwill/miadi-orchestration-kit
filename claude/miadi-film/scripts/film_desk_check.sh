#!/usr/bin/env bash
# film_desk_check.sh PROJECT.kdenlive [OUT_DIR]
#   Runs every verb of film_desk.py against a copy of the project's folder in Kdenlive on a private X display
#   and a private D-Bus session, so the person's screen and settings are never touched. Prints one line per
#   verb and keeps a screenshot after each drive. Exits 1 when a verb that should work did not, or when a
#   write act ran without --person-asked.
#   Needs Xvfb, dbus-run-session, xdotool, import (ImageMagick), dbus-send and kdenlive.
set -euo pipefail

proj=${1:?usage: film_desk_check.sh PROJECT.kdenlive [OUT_DIR]}
[ -f "$proj" ] || { echo "no such project: $proj" >&2; exit 2; }
for c in Xvfb dbus-run-session xdotool import dbus-send kdenlive python3; do
	command -v "$c" >/dev/null || { echo "missing $c on $(hostname)" >&2; exit 2; }
done
here=$(cd "$(dirname "$0")" && pwd)
out=${2:-$(mktemp -d "${TMPDIR:-/tmp}/film-desk-check-XXXXXX")}
mkdir -p "$out"
src=$(cd "$(dirname "$proj")" && pwd)
cp -r "$src" "$out/project"
copy="$out/project/$(basename "$proj")"

inner="$out/.run.sh"
cat > "$inner" <<'EOF'
#!/usr/bin/env bash
set -u
D="$1"; P="$2"; O="$3"; FD="$4"
W="$O/.kdenlive-home"; mkdir -p "$W/.config" "$W/.local/share" "$W/.cache" "$W/tmp" "$W/state"
export HOME="$W" XDG_CONFIG_HOME="$W/.config" XDG_DATA_HOME="$W/.local/share" XDG_CACHE_HOME="$W/.cache" \
       XDG_STATE_HOME="$W/state" TMPDIR="$W/tmp" MIADI_FILM_DISPLAY="$D" MIADI_FILM_ACTS_LOG="$O/acts.jsonl"
unset SESSION_MANAGER KDE_FULL_SESSION
fail=0
run() { # expect(ok|refused) label args...
	local expect=$1 label=$2; shift 2
	local res; res=$(python3 "$FD" "$@" 2>&1); local rc=$?
	local got=ok; [ $rc -eq 0 ] || got=refused
	printf '%-8s %-28s %s\n' "$([ $got = $expect ] && echo PASS || echo FAIL)" "$label" "$(echo "$res" | tail -1)"
	[ $got = $expect ] || fail=1
}
run ok      "open"                 open "$P" --wait 120
sleep 20   # Kdenlive builds its monitors and thumbnails after the window shows
run ok      "probe"                probe
run ok      "look"                 look --out "$O/1-opened.png"
run ok      "play --from-start"    play --from-start
sleep 4
run ok      "look while playing"   look --out "$O/2-playing.png"
run ok      "pause"                pause
run ok      "seek start"           seek start
run ok      "seek next-guide"      seek next-guide
run ok      "seek next-guide"      seek next-guide
sleep 1
run ok      "look at guide 2"      look --out "$O/3-guide-2.png"
run ok      "seek +5"              seek +5
run ok      "action zoom_fit"      action zoom_fit
run refused "action file_save"     action file_save
run refused "save, not asked"      save
run ok      "open again raises"    open "$P"
cp "$P" "$O/before-save.kdenlive"
run ok      "save --person-asked"  save --person-asked
sleep 6
if cmp -s "$P" "$O/before-save.kdenlive"; then echo "FAIL     save wrote nothing"; fail=1; else echo "PASS     save wrote the copy"; fi
run ok      "acts"                 acts --last 3
pid=$(xdotool search --onlyvisible --name "$(basename "$P" | sed 's/[.]/[.]/g')" getwindowpid 2>/dev/null | head -1)
[ -n "$pid" ] && dbus-send --session --dest="org.kde.kdenlive-$pid" /kdenlive/MainWindow_1 org.kde.KMainWindow.activateAction string:file_quit >/dev/null 2>&1
sleep 4; pkill -u "$(id -u)" -f "kdenlive $P" 2>/dev/null
exit $fail
EOF
chmod +x "$inner"

n=$(( 90 + RANDOM % 400 ))
Xvfb ":$n" -screen 0 1920x1080x24 -nolisten tcp >/dev/null 2>&1 &
xv=$!
trap 'kill $xv 2>/dev/null; rm -rf "$out/.kdenlive-home" "$inner"' EXIT
sleep 2
rc=0
DISPLAY=":$n" dbus-run-session -- "$inner" ":$n" "$copy" "$out" "$here/film_desk.py" || rc=$?
echo "screenshots and acts log: $out"
exit $rc
