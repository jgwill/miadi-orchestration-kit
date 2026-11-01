#!/usr/bin/env bash
# A credential in a tool's output is announced at once and listed for rotation, by its
# redacted prefix only; ordinary output stays quiet.
# Run: bash tests/secret-exposure-alert.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$HERE/hooks/secret_exposure_alert.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export CLAUDE_SESSIONDATA_ROOT="$WORK/root"
mkdir -p "$CLAUDE_SESSIONDATA_ROOT"

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected $2, got $3"; failures=$((failures + 1)); fi
}

sid="99999999-7777-3333-4444-555555555555"
ledger="$CLAUDE_SESSIONDATA_ROOT/$sid/_claude_secret_exposures.jsonl"
# Built from pieces, so no scanner reads a credential in this file.
token="testmwt_Zq9fake0Kp2Lm4Nn""6Oo8Pp0Qq2Rr4Ss6Tt8Uu0Vv2Ww4Xx"
run() {  # <stdout of a Bash call>
    jq -nc --arg sid "$sid" --arg out "$1" '{session_id:$sid, tool_name:"Bash", tool_use_id:"toolu_test", transcript_path:"/tmp/t.jsonl", tool_input:{command:"curl …"}, tool_response:{stdout:$out, stderr:"", interrupted:false}}' | bash "$HOOK"
}

said=$(run "foundation route, token=$token: 403")
expect "a person token in the output is announced to the person" "yes" "$(printf '%s' "$said" | jq -r '.systemMessage | test("mwt_Zq\\*\\*\\*") and test("rotate") | if . then "yes" else "no" end')"
expect "and to the model" "PostToolUse" "$(printf '%s' "$said" | jq -r '.hookSpecificOutput.hookEventName')"
expect "the announcement never carries the value" "0" "$(printf '%s' "$said" | grep -cF "$token")"
expect "one line is listed for rotation" "1" "$(wc -l < "$ledger" | tr -d ' ')"
expect "the list names the redacted prefix" "mwt_Zq***" "$(jq -r '.redacted[0]' "$ledger" | grep -oE 'mwt_Zq\*\*\*')"
expect "the list never carries the value" "0" "$(grep -cF "$token" "$ledger")"

for quiet in \
    'const fixture = { token: "person-token-admin-0123456789abcdef" }' \
    "sha256 9eb31ffecc41e5e85fcf95e9fad5e49d9ce44ba6a8b0bd8b38191eb3f3c706d7" \
    "foundation route, token=testmwt_Zq***: 403" \
    'curl -H "authorization: Bearer $MIADI_ACCOUNT_TOKEN"'; do
    expect "quiet: ${quiet:0:40}" "" "$(run "$quiet")"
done
expect "nothing more was listed" "1" "$(wc -l < "$ledger" | tr -d ' ')"
expect "a call with no output is quiet" "" "$(jq -nc --arg sid "$sid" '{session_id:$sid, tool_name:"Read"}' | bash "$HOOK")"

[ "$failures" -eq 0 ] && echo "secret-exposure-alert: all passed" || { echo "secret-exposure-alert: $failures failed"; exit 1; }
