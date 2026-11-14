#!/usr/bin/env bash
# A call that would print a credential is refused before it runs. A call that prints no value
# stays open, whatever it names. Only fake credentials are in the environment here.
# Run: bash tests/secret-print-guard.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$HERE/hooks/secret_print_guard.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
FAKE_VALUE="$(head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)"

mkdir -p "$WORK/repo" "$WORK/other"
cat > "$WORK/repo/.env" <<ENV
# a comment
PORT=3000
EXAMPLE_TOKEN="$FAKE_VALUE"
export EXAMPLE_API_KEY=$FAKE_VALUE
DATABASE_URL=postgres://app:$FAKE_VALUE@db.internal/app
PUBLIC_URL=https://example.org
ENV
printf 'ISSUE=270\nREPO=owner/repo\n' > "$WORK/repo/plain.env"
printf 'EXAMPLE_TOKEN=put-yours-here\n' > "$WORK/repo/.env.example"
printf '//registry.npmjs.org/:_authToken=%s\nminimumReleaseAge=3\n' "$FAKE_VALUE" > "$WORK/repo/.npmrc"
printf -- '-----BEGIN PRIVATE KEY-----\n%s\n-----END PRIVATE KEY-----\n' "$FAKE_VALUE" > "$WORK/repo/id_ed25519"
printf 'ssh-ed25519 AAAA someone\n' > "$WORK/repo/id_ed25519.pub"

run() {  # <json payload> [guard env]: the exit code, with the refusal in $said
    said=$(printf '%s' "$1" | env -i PATH="$PATH" HOME="$WORK" EXAMPLE_TOKEN="$FAKE_VALUE" EXAMPLE_API_KEY="$FAKE_VALUE" \
        MIADI_PORT=3000 ${2:+"$2"} bash "$HOOK" 2>&1 >/dev/null)
    return $?
}
bash_call() { jq -nc --arg c "$1" --arg d "$WORK/repo" '{tool_name:"Bash", tool_input:{command:$c}, cwd:$d}'; }

failures=0; checks=0
refused() {
    checks=$((checks + 1)); run "$(bash_call "$1")"; code=$?
    if [ "$code" = 2 ]; then echo "ok   refused: $1"
    else echo "FAIL should refuse (exit $code): $1"; failures=$((failures + 1)); fi
    if printf '%s' "$said" | grep -qF "$FAKE_VALUE"; then echo "FAIL the refusal carries the value: $1"; failures=$((failures + 1)); fi
}
open() {
    checks=$((checks + 1)); run "$(bash_call "$1")"; code=$?
    if [ "$code" = 0 ]; then echo "ok   open: $1"
    else echo "FAIL should stay open (exit $code, $said): $1"; failures=$((failures + 1)); fi
}
tool() {  # <expected exit> <label> <payload>
    checks=$((checks + 1)); run "$3"; code=$?
    if [ "$code" = "$1" ]; then echo "ok   $2"; else echo "FAIL $2: expected $1, got $code"; failures=$((failures + 1)); fi
}

# The shapes that printed a credential on this host between 2026-10-05 and 2026-11-04.
refused 'env | grep -E "^EXAMPLE"'
refused 'env | grep -iE "EXAMPLE|PORT" | sort'
refused 'grep -E "EXAMPLE" .env 2>/dev/null | cut -c1-80'
refused 'grep -rn "EXAMPLE_API\|EXAMPLE_TOKEN" .env 2>/dev/null | head'
refused 'env | grep -E "^EXAMPLE" | sed -E "s/(KEY)=.*/\1=<set>/"'
refused 'env | grep -E "^EXAMPLE" | sed "s/=\(.\{0,60\}\).*/=\1/"'
refused 'tr "\0" "\n" < /proc/1/environ 2>/dev/null | grep -E "EXAMPLE"'
refused 'cd /tmp; ls; grep EXAMPLE /proc/1/environ'
# Their neighbours.
refused 'env'
refused 'printenv'
refused 'printenv EXAMPLE_TOKEN'
refused 'env | sort'
refused 'export -p | grep EXAMPLE'
refused 'cat .env'
refused 'head -5 .env'
refused 'sed -n 1,3p .env'
refused 'cat .env | base64'
refused 'cat .env | tee copy.txt'
refused 'grep DATABASE_URL .env'
refused 'cat .npmrc'
refused 'cat id_ed25519'
refused "cd $WORK/other && cat ../repo/.env"
refused "cd $WORK/repo && grep EXAMPLE .env"
refused 'cat "$NOT_SET_HERE/.env"'
refused 'echo "$EXAMPLE_TOKEN"'
refused 'echo "Bearer ${EXAMPLE_TOKEN}"'
refused 'printf "%s\n" "$EXAMPLE_API_KEY"'
refused 'gh auth token'
refused 'gh auth status --show-token'
refused 'if true; then cat .env; fi'
refused 'sudo cat .env'

# Prints no value: a capture, names only, a count, a test, a value handed on.
open 'T=$(grep ^EXAMPLE_TOKEN= .env | cut -d= -f2-)'
open 'T=$(grep ^EXAMPLE_TOKEN= .env | tr -d '"'"'"'"'"'"); echo done'
open 'curl -H "Authorization: Bearer $(grep ^EXAMPLE_TOKEN= .env | cut -d= -f2-)" https://x'
open 'envval() { grep -E "^$1=" .env | cut -d= -f2-; }; T=$(envval EXAMPLE_TOKEN)'
open 'env | cut -d= -f1'
open 'env | grep -E "^EXAMPLE" | cut -d= -f1'
open 'env | grep -oE "^EXAMPLE_[A-Z_]*"'
open 'env | sed "s/=.*//" | sort'
open 'env | awk -F= "/EXAMPLE/ {print \$1}"'
open 'env | grep ^MIADI_PORT'
open 'env | grep -c EXAMPLE'
open 'cut -d= -f1 .env'
open 'sed "s/=.*//" .env'
open 'awk -F= '"'"'{print $1}'"'"' .env'
open 'grep -c EXAMPLE .env'
open 'grep -q EXAMPLE .env && echo yes'
open 'grep -qE "^$k=" .env'
open 'grep -l EXAMPLE .env'
open 'grep ^PORT= .env'
open 'grep -n "minimumReleaseAge" package.json .npmrc 2>/dev/null'
open 'wc -l .env'
open 'cat plain.env'
open 'cat .env.example'
open 'cat id_ed25519.pub'
open 'cat missing-here.env'
open 'cat .env > copy.txt'
open 'cat .env.example > .env'
open 'sed -i "s/a/b/" .env'
open 'ls -la .env'
open 'source .env'
open '. .env >/dev/null 2>&1'
open 'grep ".env" README.md'
open '[ -n "$EXAMPLE_TOKEN" ] && echo set'
open 'echo "${#EXAMPLE_TOKEN}"'
open 'echo "${EXAMPLE_TOKEN:0:4}"'
open 'echo "set: $([ -n "$EXAMPLE_TOKEN" ] && echo yes)"'
open "echo 'use \$EXAMPLE_TOKEN by name'"
open 'echo "$EXAMPLE_TOKEN" | gh auth login --with-token'
open 'curl -s -H "Authorization: Bearer $EXAMPLE_TOKEN" https://x'
open 'env FOO=1 node x.js'
open 'set -euo pipefail'
open 'export FOO=1'
open 'ls -la'
open $'cat > notes.md <<NOTES\nenv | grep EXAMPLE\ncat .env\nNOTES'
open '# env | grep EXAMPLE'
open 'grep -E "unbalanced'

# The other tools.
tool 2 "refused: Read of a .env with a credential" "$(jq -nc --arg p "$WORK/repo/.env" '{tool_name:"Read", tool_input:{file_path:$p}}')"
tool 0 "open: Read of a .env without one" "$(jq -nc --arg p "$WORK/repo/plain.env" '{tool_name:"Read", tool_input:{file_path:$p}}')"
tool 0 "open: Read of a source file" "$(jq -nc '{tool_name:"Read", tool_input:{file_path:"/x/README.md"}}')"
tool 2 "refused: Grep content of a credential line" "$(jq -nc --arg p "$WORK/repo/.env" '{tool_name:"Grep", tool_input:{path:$p, pattern:"EXAMPLE", output_mode:"content"}}')"
tool 0 "open: Grep content of another line" "$(jq -nc --arg p "$WORK/repo/.env" '{tool_name:"Grep", tool_input:{path:$p, pattern:"^PORT", output_mode:"content"}}')"
tool 0 "open: Grep for file names" "$(jq -nc --arg p "$WORK/repo/.env" '{tool_name:"Grep", tool_input:{path:$p, pattern:"EXAMPLE"}}')"
tool 0 "open: not JSON falls open" 'env | not json'

# The refusal is short, names the variable, and the guard has an off switch.
run "$(bash_call 'env | grep ^EXAMPLE_TOKEN')"
checks=$((checks + 1)); if printf '%s' "$said" | grep -qF '$EXAMPLE_TOKEN' && [ "$(printf '%s\n' "$said" | wc -l)" -le 2 ]; then echo "ok   the refusal names the variable in two lines"; else echo "FAIL refusal: $said"; failures=$((failures + 1)); fi
checks=$((checks + 1)); run "$(bash_call 'env')" "MIADI_SECRET_PRINT_GUARD=off"; if [ $? = 0 ]; then echo "ok   off in the session environment"; else echo "FAIL off switch"; failures=$((failures + 1)); fi
checks=$((checks + 1)); run "$(bash_call 'MIADI_SECRET_PRINT_GUARD=off env')"; if [ $? = 2 ]; then echo "ok   a prefix in the command does not count"; else echo "FAIL prefix counted"; failures=$((failures + 1)); fi

[ "$failures" -eq 0 ] && echo "secret-print-guard: all $checks passed" || { echo "secret-print-guard: $failures failed of $checks"; exit 1; }
