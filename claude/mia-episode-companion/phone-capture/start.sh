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

# Where the page's links lead: the stateloom loom that opens a drawing, and the Miadi room of
# an episode. An empty value (set, but empty) means that link is not shown.
export MIADI_PHONE_CAPTURE_LOOM_URL="${MIADI_PHONE_CAPTURE_LOOM_URL-https://loomino.tail3b11eb.ts.net}"
export MIADI_PHONE_CAPTURE_ROOM_URL="${MIADI_PHONE_CAPTURE_ROOM_URL-https://miadi.tail3b11eb.ts.net}"

: "${MIADI_CHRONICLE_ROOT:?MIADI_CHRONICLE_ROOT must name the chronicle root}"
exec node "$here/server.mjs"
