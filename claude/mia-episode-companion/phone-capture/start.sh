#!/usr/bin/env bash
# Launch phone-capture. Two secrets come from the environment, else from their one line
# of $MIADI_PHONE_CAPTURE_ENV_FILE (default /a/src/Miadi/.env): GROQ_API_KEY for
# transcription, MIADI_API_TOKEN_WRITER for Mia's voice. Values are never printed.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"

env_file="${MIADI_PHONE_CAPTURE_ENV_FILE:-${MIADI_PHONE_CAPTURE_GROQ_ENV_FILE:-/a/src/Miadi/.env}}"
for name in GROQ_API_KEY MIADI_API_TOKEN_WRITER; do
  if [ -z "${!name:-}" ] && [ -r "$env_file" ]; then
    value="$(sed -n "s/^\(export \)\{0,1\}$name=//p" "$env_file" | head -n 1 | tr -d "\"'\r")"
    [ -n "$value" ] && export "$name=$value"
  fi
done

: "${MIADI_CHRONICLE_ROOT:?MIADI_CHRONICLE_ROOT must name the chronicle root}"
exec node "$here/server.mjs"
