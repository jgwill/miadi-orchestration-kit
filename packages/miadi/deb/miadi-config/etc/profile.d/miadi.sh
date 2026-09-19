# Load the Miadi host settings into bash login shells. Installed by miadi-config.
if [ -n "${BASH_VERSION:-}" ] && [ -r /usr/share/miadi/env.sh ]; then
	. /usr/share/miadi/env.sh
fi
