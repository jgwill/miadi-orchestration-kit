#!/usr/bin/env bash
# kdenlive_check.sh PROJECT.kdenlive [OUT_DIR]
#   Opens a copy of the project in Kdenlive on a private X display, takes a screenshot, saves the copy
#   through Kdenlive's own Save action and counts what Kdenlive kept on each track, guides and groups.
#   The project itself is never written. Kdenlive gets its own home and its own temp folder, so the
#   person's settings are untouched and no /tmp/kdenlivelock is left behind (Kdenlive reads that file
#   as "crashed on last startup" and offers to reset the person's configuration).
#   Needs xvfb-run, dbus-run-session, import (ImageMagick) and kdenlive. OUT_DIR keeps the screenshot,
#   the saved copy and Kdenlive's log (default: a new temporary folder, printed).
set -euo pipefail

proj=${1:?usage: kdenlive_check.sh PROJECT.kdenlive [OUT_DIR]}
[ -f "$proj" ] || { echo "no such project: $proj" >&2; exit 2; }
for c in xvfb-run dbus-run-session import kdenlive python3; do
	command -v "$c" >/dev/null || {
		echo "missing $c on $(hostname)." >&2
		[ "$c" = xvfb-run ] && echo "Install xvfb, or run this on a host that has it (gaia has it). On hu, Xvnc is RealVNC and needs a license, and Kdenlive 21.12 crashes on Qt's vnc and offscreen platforms." >&2
		exit 2
	}
done
out=${2:-$(mktemp -d "${TMPDIR:-/tmp}/kdenlive-check-XXXXXX")}
mkdir -p "$out"
name=$(basename "$proj")
cp "$proj" "$out/$name"
inner="$out/.run.sh"
cat > "$inner" <<'EOF'
#!/usr/bin/env bash
P="$1"; W="$(dirname "$P")/.kdenlive-home"
mkdir -p "$W/.config" "$W/.local/share" "$W/.cache" "$W/tmp"
export HOME="$W" XDG_CONFIG_HOME="$W/.config" XDG_DATA_HOME="$W/.local/share" XDG_CACHE_HOME="$W/.cache" TMPDIR="$W/tmp"
unset SESSION_MANAGER KDE_FULL_SESSION
/usr/bin/kdenlive -qwindowgeometry 1600x900+0+0 "$P" > "$P.log" 2>&1 &
K=$!; SVC="org.kde.kdenlive-$K"
for i in $(seq 1 40); do dbus-send --session --print-reply --dest="$SVC" /kdenlive/MainWindow_1 org.freedesktop.DBus.Peer.Ping >/dev/null 2>&1 && break; sleep 2; done
sleep 35
import -window root "$P.png" 2>/dev/null
dbus-send --session --print-reply --dest="$SVC" /kdenlive/MainWindow_1 org.kde.KMainWindow.activateAction string:file_save >/dev/null 2>&1
sleep 8
dbus-send --session --print-reply --dest="$SVC" /kdenlive/MainWindow_1 org.kde.KMainWindow.activateAction string:file_quit >/dev/null 2>&1
sleep 5; kill "$K" 2>/dev/null; sleep 1; kill -9 "$K" 2>/dev/null
exit 0
EOF
chmod +x "$inner"
xvfb-run -a -s "-screen 0 1600x900x24" dbus-run-session -- "$inner" "$out/$name" >/dev/null 2>&1 || true
rm -rf "$out/.kdenlive-home" "$inner"

if cmp -s "$proj" "$out/$name"; then
	echo "NOT SAVED: Kdenlive did not save the copy. Look at $out/$name.png and $out/$name.log." >&2
	exit 1
fi
python3 - "$out/$name" <<'EOF'
import json, sys, xml.etree.ElementTree as ET
t = ET.parse(sys.argv[1]).getroot()
pl = {p.get("id"): p for p in t.iter("playlist")}
props = lambda e: {p.get("name"): p.text for p in e.findall("property")}
for tr in t.iter("tractor"):
    pr = props(tr)
    if "kdenlive:trackheight" in pr:
        n = sum(len(pl[k.get("producer")].findall("entry")) for k in tr.findall("track"))
        print(f"track {pr.get('kdenlive:track_name') or tr.get('id')}: {n} clips")
b = props(pl["main_bin"])
media = [p for p in t.iter("producer") if p.get("id") != "black_track" and props(p).get("kdenlive:clipname")]
folders = sorted(v for k, v in b.items() if k.startswith("kdenlive:folder."))
print(f"bin: {len(pl['main_bin'].findall('entry'))} entries, {len(media)} named clips, "
      f"{sum(1 for p in media if props(p).get('kdenlive:description'))} with a description, "
      f"{sum(len(json.loads(props(p).get('kdenlive:markers') or '[]')) for p in media)} markers, folders {folders}")
count = lambda k: len(json.loads(b.get(k) or "[]"))
print(f"format {b.get('kdenlive:docproperties.version')}, Kdenlive {b.get('kdenlive:docproperties.kdenliveversion')}, "
      f"{count('kdenlive:docproperties.guides')} guides, {count('kdenlive:docproperties.groups')} groups")
EOF
echo "screenshot $out/$name.png"
echo "saved copy $out/$name"
