#!/usr/bin/env bash
# install-nightly-inventory — the user timer that runs nightly-inventory.sh at 03:30 each night.
# Runs as the user whose inventory it is (mia on gaia); linger keeps it running with nobody logged in.
# usage: install-nightly-inventory.sh [--at HH:MM] [--uninstall]
set -eu
here=$(dirname "$(readlink -f "$0")")
at=03:30
units=$HOME/.config/systemd/user
if [ "${1:-}" = --uninstall ]; then
	systemctl --user disable --now miadi-inventory-nightly.timer 2>/dev/null || true
	rm -f "$units/miadi-inventory-nightly.service" "$units/miadi-inventory-nightly.timer"
	systemctl --user daemon-reload
	echo "miadi-inventory-nightly: removed"
	exit 0
fi
[ "${1:-}" = --at ] && at=$2
mkdir -p "$units"
node_bin=$(command -v node)
# tide lives in another account's environment on gaia (jgi's anaconda); the drafts step needs it.
tide_bin=$(command -v tide || true)
cat >"$units/miadi-inventory-nightly.service" <<EOF
[Unit]
Description=Nightly session inventory (T1): a record for every session of the last day, committed
After=network-online.target

[Service]
Type=oneshot
Environment=PATH=$(dirname "$node_bin"):${tide_bin:+$(dirname "$tide_bin"):}$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=$here/nightly-inventory.sh
EOF
cat >"$units/miadi-inventory-nightly.timer" <<EOF
[Unit]
Description=Nightly session inventory at $at

[Timer]
OnCalendar=*-*-* $at:00
Persistent=true

[Install]
WantedBy=timers.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now miadi-inventory-nightly.timer
systemctl --user list-timers miadi-inventory-nightly.timer --no-pager
