#!/usr/bin/env bash
# Run by apt after every dpkg run (apt.conf.d/50miadi-termux). When Termux's
# Python has moved to another minor version (3.13 to 3.14), what was built for
# the old one stops working: venvs and pip packages. Each python-moved hook
# rebuilds one such thing, and runs once per move:
#   /usr/share/miadi/python-moved.d/*.sh     from packages (miadi-tide's venv)
#   ~/.config/miadi/python-moved.d/*.sh      this host's (its pip list, other venvs)
# Hooks run in name order. Each records the Python it last ran for in
# ~/.local/state/miadi-termux/python-moved/; a hook seen for the first time
# records the current Python without running. A failed hook runs again after
# the next apt run. It never fails apt. Logs: ~/.cache/miadi-termux/.
set -u
minor=$(/usr/bin/python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])' 2>/dev/null) || exit 0
state=$HOME/.local/state/miadi-termux/python-moved
logs=$HOME/.cache/miadi-termux
mkdir -p "$state" "$logs"
say() { echo "miadi-termux: $*"; }

hooks=$(for f in /usr/share/miadi/python-moved.d/*.sh "$HOME"/.config/miadi/python-moved.d/*.sh; do
	[ -r "$f" ] && printf '%s\t%s\n' "$(basename "$f")" "$f"
done | sort | cut -f2)
for hook in $hooks; do
	name=$(basename "$hook" .sh)
	stamp=$state/$name
	if [ ! -f "$stamp" ]; then echo "$minor" >"$stamp"; continue; fi
	was=$(cat "$stamp")
	[ "$was" = "$minor" ] && continue
	say "Python moved from $was to $minor: running $name (log: $logs/python-moved.log)"
	if { echo "== $(date '+%F %T') $name, Python $was to $minor"; bash "$hook"; } >>"$logs/python-moved.log" 2>&1; then
		echo "$minor" >"$stamp"
		say "$name done"
	else
		say "$name failed; it runs again after the next apt run. See $logs/python-moved.log"
	fi
done
exit 0
