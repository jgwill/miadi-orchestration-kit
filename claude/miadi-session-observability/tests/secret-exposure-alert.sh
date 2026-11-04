#!/usr/bin/env bash
# The alert says only what it knows. The value of a credential this host holds, in a
# tool's output, is announced by variable name and listed to rotate. A string shaped like
# a vendor credential that this host does not hold is announced by kind and redacted
# prefix and listed to check. A session is told once per finding. Fixtures and ordinary
# output stay quiet.
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
yes_if() { if [ "$1" = "true" ]; then echo yes; else echo no; fi; }

use_session() { sid="$1"; ledger="$CLAUDE_SESSIONDATA_ROOT/$sid/_claude_secret_exposures.jsonl"; }
use_session "99999999-7777-3333-4444-555555555555"
lines() { [ -f "$ledger" ] && wc -l < "$ledger" | tr -d ' ' || echo 0; }
# Random at run time, so this file holds no credential and no two runs share one.
random() { head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
bash_out() {  # <stdout of a Bash call>
    jq -nc --arg sid "$sid" --arg out "$1" '{session_id:$sid, tool_name:"Bash", tool_use_id:"toolu_test", transcript_path:"/tmp/t.jsonl", tool_input:{command:"curl …"}, tool_response:{stdout:$out, stderr:"", interrupted:false}}' | bash "$HOOK"
}
edit_out() {  # <the file as it was before an Edit>
    jq -nc --arg sid "$sid" --arg file "$1" '{session_id:$sid, tool_name:"Edit", tool_use_id:"toolu_edit", tool_input:{file_path:"/x/test/connector.test.mjs"}, tool_response:{filePath:"/x/test/connector.test.mjs", oldString:"a", newString:"b", originalFile:$file}}' | bash "$HOOK"
}

# held: the value of a credential in this environment.
export EXAMPLE_SERVICE_TOKEN="$(random 40)"
said=$(bash_out "probe answered with $EXAMPLE_SERVICE_TOKEN: 403")
expect "a held credential is named by its variable" "yes" "$(yes_if "$(printf '%s' "$said" | jq '.systemMessage | test("\\$EXAMPLE_SERVICE_TOKEN") and test("miadi-scrub-secrets")')")"
expect "and the model is told not to repeat it" "yes" "$(yes_if "$(printf '%s' "$said" | jq '.hookSpecificOutput.additionalContext | test("Do not repeat")')")"
expect "the announcement never carries the value" "0" "$(printf '%s' "$said" | grep -cF "$EXAMPLE_SERVICE_TOKEN")"
expect "one line is listed" "1" "$(lines)"
expect "listed to rotate, by name" "rotate EXAMPLE_SERVICE_TOKEN" "$(jq -r '.action + " " + .held[0]' "$ledger" | tail -1)"
expect "the list never carries the value" "0" "$(grep -cF "$EXAMPLE_SERVICE_TOKEN" "$ledger")"

before=$(lines)
expect "the same credential is told once a session" "" "$(bash_out "again: $EXAMPLE_SERVICE_TOKEN")"
expect "and the list still gets the call" "$((before + 1))" "$(lines)"

said=$(bash_out "EXAMPLE_SERVICE_TOKEN=\"$EXAMPLE_SERVICE_TOKEN\"" )
expect "a repeat on another line is quiet too" "" "$said"

use_session "99999999-7777-3333-4444-666666666666"
said=$(bash_out "first line
EXAMPLE_SERVICE_TOKEN=\"$EXAMPLE_SERVICE_TOKEN\"
next line")
expect "the word before the value is shown, to check the claim" "yes" "$(yes_if "$(printf '%s' "$said" | jq '.systemMessage | contains("EXAMPLE_SERVICE_TOKEN=\"***")')")"
expect "a word never holds another line" "0" "$(printf '%s' "$said" | grep -c "first line")"

use_session "99999999-7777-3333-4444-777777777777"
said=$(edit_out "const db = \"postgres://app:$EXAMPLE_SERVICE_TOKEN@db.internal/app\";")
expect "a held credential in a file an Edit read is named too" "yes" "$(yes_if "$(printf '%s' "$said" | jq '.systemMessage | test("\\$EXAMPLE_SERVICE_TOKEN") and (test("shaped") | not)')")"
expect "listed to rotate" "rotate" "$(jq -r '.action' "$ledger" | tail -1)"

# shaped: a vendor-shaped string no credential here has.
mwt="mwt_$(random 40)"
said=$(bash_out "foundation route, token=$mwt: 403")
expect "a shaped string is named by kind and prefix" "yes" "$(yes_if "$(printf '%s' "$said" | jq --arg p "${mwt:0:6}***" '.systemMessage | test("Miadi person token") and contains($p) and test("check which before rotating")')")"
expect "and is not called a credential held here" "no" "$(yes_if "$(printf '%s' "$said" | jq '.systemMessage | test("held on this host")')")"
expect "the announcement never carries the value" "0" "$(printf '%s' "$said" | grep -cF "$mwt")"
expect "listed to check" "check Miadi person token" "$(jq -r '.action + " " + .shaped[0].kind' "$ledger" | tail -1)"
expect "the list never carries the value" "0" "$(grep -cF "$mwt" "$ledger")"

ghp="ghp_$(random 36)"
said=$(bash_out "first line
$ghp")
expect "a GitHub-shaped token after a newline is named by kind" "yes" "$(yes_if "$(printf '%s' "$said" | jq '.systemMessage | test("GitHub token")')")"

pw="$(random 18)"
said=$(bash_out "DATABASE_URL=postgres://neondb_owner:$pw@ep-cool-1.neon.tech/neondb")
expect "a password in a URL is named by the URL up to its user" "yes" "$(yes_if "$(printf '%s' "$said" | jq '.systemMessage | contains("URL password postgres://neondb_owner:***")')")"
expect "and by none of the password" "0" "$(printf '%s' "$said" | grep -cF "${pw:0:4}")"

# Variables named like credentials that hold none.
export GIT_AUTHOR_EMAIL="someone-long-enough@example.org" MIADI_AUTH_URL="https://auth.internal/login" MIADI_TOKEN_NAME="a-long-enough-name"
expect "quiet: an author, a url and a name in credential-like variables" "" "$(bash_out "$GIT_AUTHOR_EMAIL $MIADI_AUTH_URL $MIADI_TOKEN_NAME")"
unset GIT_AUTHOR_EMAIL MIADI_AUTH_URL MIADI_TOKEN_NAME

before=$(lines)
# Fixtures and ordinary output: the 2026-11-04 Edit, the sanitizer's own self-test
# samples, paths held in credential-named variables, templates.
fixture_file=$(printf '%s\n' \
    '    if (u.pathname === "/api/reviews/search") {' \
    '      assert.equal(init.headers.authorization, "Bearer review-token");' \
    '    reviewToken: "review-token",')
expect "quiet: an Edit of a test file with a Bearer fixture" "" "$(edit_out "$fixture_file")"
for quiet in \
    'const fixture = { token: "person-token-admin-0123456789abcdef" }' \
    "sha256 9eb31ffecc41e5e85fcf95e9fad5e49d9ce44ba6a8b0bd8b38191eb3f3c706d7" \
    "foundation route, token=testmwt_Zq***: 403" \
    'curl -H "authorization: Bearer $MIADI_ACCOUNT_TOKEN"' \
    "Authorization: Bearer abcdefghijklmnopqrstuvwxyz" \
    'anthropic="sk-ant-api03-ABCDEFGHIJKLM""NOPQRSTUVWX"' \
    'slack="xoxb-1234567890-""abcdefghijklmno"' \
    'aws="AKIAIOSFODNN7""EXAMPLE"  AKIAIOSFODNN7EXAMPLE' \
    "miadi=\"mwt_Qn5pB2ctOgl0-xY_\"\"abcdefghijklmnopqrstuvwxyz0\"" \
    "token=mwt_fake$(random 36)" \
    $'-----BEGIN OPENSSH PRIVATE KEY-----\nsecret-material\n-----END OPENSSH PRIVATE KEY-----' \
    "postgres://postgres:postgres@localhost:5432/app" \
    'redis://default:${REDIS_PASSWORD}@redis:6379' \
    "socket at ${SSH_AUTH_SOCK:-/run/user/1000/ssh-agent.socket}" \
    "nepisode-560-the-author-s-desk-data-structure-view-2610231440: 1 windows" \
    "2026-10-20-episode-560-the-author-s-desk-receives-what-the-ceremonies-made/desk"; do
    label="${quiet//$'\n'/ }"; expect "quiet: ${label:0:44}" "" "$(bash_out "$quiet")"
done
expect "nothing more was listed" "$before" "$(lines)"
expect "a call with no output is quiet" "" "$(jq -nc --arg sid "$sid" '{session_id:$sid, tool_name:"Read"}' | bash "$HOOK")"

[ "$failures" -eq 0 ] && echo "secret-exposure-alert: all passed" || { echo "secret-exposure-alert: $failures failed"; exit 1; }
