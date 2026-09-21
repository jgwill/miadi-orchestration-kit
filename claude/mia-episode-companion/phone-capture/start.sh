#!/usr/bin/env bash
# Launch phone-capture. GROQ_API_KEY comes from the environment, else from the one
# GROQ_API_KEY line of $MIADI_PHONE_CAPTURE_GROQ_ENV_FILE (default /a/src/Miadi/.env).
# The value is never printed.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"

key_file="${MIADI_PHONE_CAPTURE_GROQ_ENV_FILE:-/a/src/Miadi/.env}"
if [ -z "${GROQ_API_KEY:-}" ] && [ -r "$key_file" ]; then
  GROQ_API_KEY="$(sed -n 's/^\(export \)\{0,1\}GROQ_API_KEY=//p' "$key_file" | head -n 1 | tr -d "\"'\r")"
  export GROQ_API_KEY
fi

: "${MIADI_CHRONICLE_ROOT:?MIADI_CHRONICLE_ROOT must name the chronicle root}"
exec node "$here/server.mjs"
