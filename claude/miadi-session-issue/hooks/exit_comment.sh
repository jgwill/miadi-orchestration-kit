#!/usr/bin/env bash
# SessionEnd. A session that has an issue, or whose issue is being opened, gets one comment per
# exit: the reason, the counts, what it published since the previous comment, and its last
# answer. The work is detached, so the hook returns well inside the 1.5 s Claude Code allows a
# SessionEnd hook. Prints nothing.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

if [ "${1:-}" = "--job" ]; then  # the detached job: --job <dir> <session_id> <reason> <transcript>
    si_comment "$2" "$3" "$4" "$5"
    exit 0
fi

input=$(cat)
[[ $input =~ \"session_id\":\"([A-Za-z0-9_-]+)\" ]] || exit 0
sid=${BASH_REMATCH[1]}
dir="$SI_SESSIONDATA_ROOT/$sid"
[ -s "$dir/.issue_created" ] || si_locked "$dir" || exit 0
reason=$(printf '%s' "$input" | jq -r '.reason // "other"' 2>/dev/null)
tp=$(printf '%s' "$input" | jq -r '.transcript_path // ""' 2>/dev/null)
si_detach bash "${BASH_SOURCE[0]}" --job "$dir" "$sid" "${reason:-other}" "$tp"
exit 0
