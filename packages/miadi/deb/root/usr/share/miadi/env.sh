# /usr/share/miadi/env.sh — the MIADI_* environment of a Miadi host.
#
# Source it from bash, don't execute it. Installed by the `miadi` apt package
# (source: jgwill/miadi-orchestration-kit, packages/miadi/deb).
#
# Where a value comes from, first match wins:
#   1. the environment already has it (a user's ~/.env, a parent shell)
#   2. $MIADI_ETC/miadi.env — this host's values, plain KEY=VALUE
#   3. the defaults below
#
# No secret values live here. Token names are only exported: a user's client
# tokens come from that user's ~/.env, a service's from its own env file.

: "${MIADI_ETC:=/etc/miadi}"
export MIADI_ETC

# This host's values. Plain KEY=VALUE so systemd EnvironmentFile= and docker
# compose env_file read the same file; bash parses each value.
if [ -r "$MIADI_ETC/miadi.env" ]; then
	while IFS= read -r _miadi_line || [ -n "$_miadi_line" ]; do
		case "$_miadi_line" in *=*) ;; *) continue ;; esac
		_miadi_key=${_miadi_line%%=*}
		[[ "$_miadi_key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
		if [ -n "${!_miadi_key+x}" ]; then export "$_miadi_key"; continue; fi
		eval "export $_miadi_line"
	done < "$MIADI_ETC/miadi.env"
	unset _miadi_line _miadi_key
fi

# Layout. Termux has no /opt: set MIADI_OPT_DIR in its miadi.env.
export MIADI_OPT_DIR="${MIADI_OPT_DIR:-/opt}"
export MIADI_WORK_DIR="${MIADI_WORK_DIR:-/workspace}" # where the repositories and wikis we work on are cloned
export MIADI_ORCHESTRATION_KIT_ROOT="${MIADI_ORCHESTRATION_KIT_ROOT:-/workspace/repos/jgwill/miadi-orchestration-kit}"
if [ -z "$MIADI_REPOS_ROOT" ]; then
	if [ -d "/workspace/repos" ]; then
		MIADI_REPOS_ROOT="/workspace/repos"
	else
		MIADI_REPOS_ROOT="/data/data/com.termux/files/repos"
	fi
fi
export MIADI_REPOS_ROOT
export MIADI_INFRA_EURY_DIR="${MIADI_INFRA_EURY_DIR:-$MIADI_OPT_DIR/eury}"
export MIADI_INFRA_GAIA_DIR="${MIADI_INFRA_GAIA_DIR:-$MIADI_OPT_DIR/gaia}"
export MIADI_INFRA_BINSCRIPTS_DIR="${MIADI_INFRA_BINSCRIPTS_DIR:-$MIADI_OPT_DIR/binscripts}"
# Hook scripts, per agent flavor (claude_hooks, codex_hooks, ...). $binroot
# resolves on /opt and on Termux alike.
export MIADI_HOOKS_SCRIPT_DIR="${MIADI_HOOKS_SCRIPT_DIR:-${binroot:-/opt/binscripts}/hooks}"
export MIADI_EPISODES_HOOKS_DIR="${MIADI_EPISODES_HOOKS_DIR:-$MIADI_HOOKS_SCRIPT_DIR}"

# Source checkout. Falls back to the Mighty Eagle checkout on hosts without /src/Miadi.
export MIADI_ROOT="${MIADI_ROOT:-/src/Miadi}"
: "${MIADI_SRC:=/src/Miadi}"
if [ ! -e "$MIADI_SRC/package.json" ]; then
	if [ -e "/usr/local/src/mightyeagle/package.json" ]; then
		MIADI_SRC="/usr/local/src/mightyeagle"
	else
		echo "MIADI_SRC is not defined and /src/Miadi/package.json does not exist.  Please define MIADI_SRC to point to the Miadi source code directory."
	fi
fi
export MIADI_SRC

# Data
export MIADI_DATA_DIR="${MIADI_DATA_DIR:-/srv/miadi}"
export MIADI_EPISODES_VOICE_DIR="${MIADI_EPISODES_VOICE_DIR:-$MIADI_DATA_DIR/voice-audio}"
export MIADI_ASSEMBLY_VOICE_AUDIO_DIR="${MIADI_ASSEMBLY_VOICE_AUDIO_DIR:-$MIADI_EPISODES_VOICE_DIR}"
export MIADI_EPISODES_DIR="${MIADI_EPISODES_DIR:-$MIADI_DATA_DIR/episodes}"
export MIADI_CHRONICLE_ROOT="${MIADI_CHRONICLE_ROOT:-$MIADI_EPISODES_DIR/miadi-chronicle}"
export MIADI_SHAREDSPARK_SYMPHONY_DIR="${MIADI_SHAREDSPARK_SYMPHONY_DIR:-$MIADI_DATA_DIR/sharedspark-symphony}"
export MIADI_CHRONICLE_SESSION_REPO="${MIADI_CHRONICLE_SESSION_REPO:-miadisabelle/chronicle-sessions}"
if [ ! -d "${MIADI_STORIES_ROOT:-}" ]; then
	MIADI_STORIES_ROOT="$MIADI_REPOS_ROOT/jgwill/miadi-passages"
fi
export MIADI_STORIES_ROOT
if [ ! -d "$MIADI_STORIES_ROOT" ]; then echo "Warning: MIADI_STORIES_ROOT not found, please clone repo jgwill/miadi-passages into $MIADI_REPOS_ROOT or set MIADI_STORIES_ROOT in $MIADI_ETC/miadi.env"; fi

# Agent session capture: /src/_sessiondata on hosts that have /src, else
# $HOME/_sessiondata so hooks always have a writable dir.
if [ -z "$MIADI_SESSIONDATA_ROOT" ]; then
	if [ -d "/src" ]; then
		MIADI_SESSIONDATA_ROOT="/src/_sessiondata"
	else
		MIADI_SESSIONDATA_ROOT="$HOME/_sessiondata"
	fi
fi
export MIADI_SESSIONDATA_ROOT
export MIADI_SESSION_DIR="${MIADI_SESSION_DIR:-$MIADI_SESSIONDATA_ROOT}" # MIADI_SESSIONDATA_ROOT goes away later

# Wikis
export MIADI_WIKI_DIR="${MIADI_WIKI_DIR:-$MIADI_WORK_DIR/wikis}"
export MIADI_PASSAGES_WIKI_DIR="${MIADI_PASSAGES_WIKI_DIR:-$MIADI_WIKI_DIR/miadi-passages}"
export MIADI_SRC_WIKI_DIR="${MIADI_SRC_WIKI_DIR:-$MIADI_WIKI_DIR/Miadi}"

# Inquiry (IAIP)
export MIADI_INQUIRY_ROOT="${MIADI_INQUIRY_ROOT:-/src/IAIP/prototypes/artefacts}"
if [ -z "$MIADI_INQUIRY_DIR" ]; then
	MIADI_INQUIRY_DIR="/a/src/IAIP/prototypes/artefacts"
	if [ ! -d "$MIADI_INQUIRY_DIR" ]; then
		MIADI_INQUIRY_DIR="/workspace/repos/miadisabelle/Etuaptmumk-RSM/prototypes/artefacts"
	fi
fi
export MIADI_INQUIRY_DIR
export MIADI_INQUIRY_GITHUB_REPO="${MIADI_INQUIRY_GITHUB_REPO:-miadisabelle/Etuaptmumk-RSM}"
export MIADI_INQUIRY_API_BASE="${MIADI_INQUIRY_API_BASE:-http://127.0.0.1:3335}"

# Services. Local ports are the defaults; public and tailnet URLs belong in miadi.env.
export MIADI_API_URL_DEFAULT="${MIADI_API_URL_DEFAULT:-http://127.0.0.1:3335}"
export MIADI_API_URL="${MIADI_API_URL:-$MIADI_API_URL_DEFAULT}"
export MIADI_CHRONICLE_MW_URL="${MIADI_CHRONICLE_MW_URL:-http://127.0.0.1:8040}" # the chronicle medicine wheel
export MIADI_CHRONICLE_FW_URL="${MIADI_CHRONICLE_FW_URL:-http://127.0.0.1:8031}"
export MIADI_STATELOOM_BRIDGE_URL="${MIADI_STATELOOM_BRIDGE_URL:-${STATELOOM_BRIDGE_URL:-http://127.0.0.1:4599}}"
if [ -n "$MIADI_URL_BASE" ]; then
	export MIADI_PDE_WEBHOOK="${MIADI_PDE_WEBHOOK:-$MIADI_URL_BASE/api/pde/webhook}"
	export MIADI_WEBHOOK_URL="${MIADI_WEBHOOK_URL:-$MIADI_URL_BASE/api/workflow/webhook}"
fi
export MIADI_KHERIX_API_SERVER_PORT="${MIADI_KHERIX_API_SERVER_PORT:-8643}" # distinct from Iris default :8642
export MIADI_KHERIX_API_SERVER_MODEL_NAME="${MIADI_KHERIX_API_SERVER_MODEL_NAME:-hermes-agent}"
export MIADI_PI_NETWORK_NAME="${MIADI_PI_NETWORK_NAME:-miadi}"
export MIADI_PI_NETWORK_PURPOSE="${MIADI_PI_NETWORK_PURPOSE:-}"
export MIADI_PI_EXTENSIONS_ROOT="${MIADI_PI_EXTENSIONS_ROOT:-$MIADI_REPOS_ROOT/miadisabelle/mia-presence}"
export MIADI_MCP_SERVER_CURRENT_VERSION="${MIADI_MCP_SERVER_CURRENT_VERSION:-@miadi/mcp@1.4.13}" # miadi-mcp-server@* is deprecated
export MIADI_TOOLS_ENABLED="${MIADI_TOOLS_ENABLED:-miadi-get-memory,miadi-store-memory,miadi-scan-keys}"

# Names only. Values come from the user's ~/.env or the service's env file.
export MIADI_API_TOKEN_WRITER MIADI_API_TOKEN_READER
export MIADI_API_KEY="${MIADI_API_KEY:-$MIADI_API_TOKEN_WRITER}" # older name of MIADI_API_TOKEN_WRITER
export MIADI_QMD_MCP_TOKEN MIADI_PDE_WEBHOOK_TOKEN MIADI_INQUIRY_GITHUB_TOKEN MIADI_EH_TOKEN MIADI_REVIEW_TOKEN
export MIADI_PI_NETWORK_TOKEN MIADI_PI_NETWORK_PROJECT MIADI_TRUST_TAILNET_SERVICE
export MIADI_KHERIX_API_SERVER_ENABLED MIADI_KHERIX_API_SERVER_HOST MIADI_KHERIX_API_SERVER_KEY
export MIADI_EH_API_URL MIADI_REVIEW_URL
