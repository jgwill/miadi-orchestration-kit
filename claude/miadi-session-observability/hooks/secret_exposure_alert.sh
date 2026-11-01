#!/usr/bin/env bash
# A credential printed in a tool's output reaches the model, and Claude Code's own
# transcript under ~/.claude/projects, before any hook runs. Claude Code lets a
# PostToolUse hook replace only an MCP tool's output, so no hook can take it back.
# What this plugin writes under <root>/<session_id>/ is already redacted
# (secret_capture_sanitizer.sh).
#
# What a hook can still do is say so at once. When a tool's output matches one of the
# sanitizer's credential patterns (the ones that recognise a credential by its own
# shape, HOOK_SECRET_STRONG_ONLY), this hook:
#   - tells the person on screen (systemMessage) and the model (additionalContext),
#     naming the credential only by its redacted prefix;
#   - appends one line to <root>/<session_id>/_claude_secret_exposures.jsonl, the
#     list of what to rotate.
# It never prints, stores or forwards the value itself. Earned 2026-11-01: a probe
# command printed a person token into session 201371c1 and nothing said so.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/claude_hooks/lib.sh"

input=$(cat -)
response=$(printf '%s' "$input" | jq -c '.tool_response // empty' 2>/dev/null)
[ -n "$response" ] || exit 0

redacted=$(printf '%s' "$response" | HOOK_SECRET_STRONG_ONLY=1 hook_secret_sanitize_stream)
[ "$redacted" != "$response" ] || exit 0

# The redacted prefixes this output now carries and did not carry before.
prefixes=$(comm -13 \
    <(printf '%s' "$response" | grep -oE '[A-Za-z0-9_.-]{1,16}\*\*\*' | sort -u) \
    <(printf '%s' "$redacted" | grep -oE '[A-Za-z0-9_.-]{1,16}\*\*\*' | sort -u) | head -5)
[ -n "$prefixes" ] || prefixes="(a private key or URL password)"
list=$(printf '%s\n' "$prefixes" | paste -sd, - | sed 's/,/, /g')

session_id=$(printf '%s' "$input" | jq -r '.session_id // "unknown"')
tool_name=$(printf '%s' "$input" | jq -r '.tool_name // "a tool"')
out="$CLAUDE_SESSIONDATA_ROOT/$session_id"
mkdir -p "$out"
claude_write_jsonl "$out/_claude_secret_exposures.jsonl" "$(jq -nc \
    --arg at "$(date -Iseconds)" --arg sid "$session_id" --arg tool "$tool_name" \
    --arg use "$(printf '%s' "$input" | jq -r '.tool_use_id // empty')" \
    --arg transcript "$(printf '%s' "$input" | jq -r '.transcript_path // empty')" \
    --arg prefixes "$prefixes" \
    '{at:$at, session_id:$sid, tool_name:$tool, tool_use_id:$use, redacted:($prefixes|split("\n")), transcript_path:$transcript, where:["the model context","Claude Code transcript_path"], action:"rotate"}')"

jq -nc --arg tool "$tool_name" --arg list "$list" '{
  systemMessage: ("A credential appeared in the output of " + $tool + " (" + $list + "). It is now in this conversation and in Claude Code'"'"'s transcript: rotate it. Listed in _claude_secret_exposures.jsonl."),
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("The output of this " + $tool + " call contained a credential (" + $list + "). Do not repeat, copy or reuse its value anywhere. Tell the person which credential it was so they can rotate it, and print no more secrets: label values by name, never by expansion.")
  }
}'
exit 0
