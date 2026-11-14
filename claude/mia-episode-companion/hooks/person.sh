#!/usr/bin/env bash
# Tells Mia, at session start, who she companions. The name is the host's, never the
# plugin's: MIADI_MIA_COMPANION_PERSON_NAME, set where the seat starts (~/.bashrc, the
# miadi env, or the alias that opens the seat). Unset, Mia is told to ask.
name="${MIADI_MIA_COMPANION_PERSON_NAME:-}"
name="${name#"${name%%[![:space:]]*}"}"; name="${name%"${name##*[![:space:]]}"}"
if [ -n "$name" ]; then
  context="The person Mia companions in this seat is $name (MIADI_MIA_COMPANION_PERSON_NAME). Address them as $name."
else
  context="MIADI_MIA_COMPANION_PERSON_NAME is not set on this host, so Mia does not know the name of the person she companions. Do not guess one; use the name they give, and the scripts say \"the person\"."
fi
CONTEXT="$context" node -e 'process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: process.env.CONTEXT } }))'
