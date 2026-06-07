#!/usr/bin/env bash
# Storyweaver CLI Bash Wrapper

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$(which python3)"

if [ -z "$PYTHON_BIN" ]; then
    echo "Error: python3 is required to run the Storyweaver CLI." >&2
    exit 1
fi

exec "$PYTHON_BIN" "$SCRIPT_DIR/storyweaver-cli.py" "$@"
