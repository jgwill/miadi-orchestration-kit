#!/usr/bin/env bash
# The wheels for Python 3.10: see miadi-music-wheels.sh.
exec bash "$(dirname "$0")/miadi-music-wheels.sh" 3.10 "$@"
