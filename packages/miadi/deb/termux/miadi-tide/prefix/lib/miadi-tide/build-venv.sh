#!/usr/bin/env bash
# Build tide's venv under /usr/lib/miadi-tide from the pins in
# share/miadi-tide/requirements.txt, fetched from PyPI, and restart the daemon
# if it runs. postinst runs it at install, and miadi-termux's python-moved step
# runs it when Termux's Python moves to another minor version.
set -euo pipefail
venv=/usr/lib/miadi-tide/tide-runtime
py=/usr/bin/python3
if ! "$py" -c 'import sys, ensurepip, venv; sys.exit(sys.version_info < (3, 11))' 2>/dev/null; then
	echo "miadi-tide: no Python 3.11+ with venv (pkg install python)" >&2
	exit 1
fi
rm -rf "$venv"
"$py" -m venv "$venv"
PIP_DISABLE_PIP_VERSION_CHECK=1 "$venv/bin/pip" install -q -r /usr/share/miadi-tide/requirements.txt
echo "miadi-tide: tide runtime $("$venv/bin/pip" show ironsilk | sed -n 's/^Version: //p') in $venv ($("$py" -V 2>&1))" >&2
# A daemon still running from the venv just replaced starts again on the new one.
if tmux has-session -t =tide-runtime 2>/dev/null; then
	/usr/bin/miadi-tide-service restart >&2 || true
fi
