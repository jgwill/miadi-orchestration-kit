#!/usr/bin/env bash
# selftest.sh — prove guard-mkdir-in-chronicle.sh on fixtures, not on the real chronicle.
#
# Builds a throwaway chronicle root in a temp dir, one episode directory inside it that
# already exists, and runs the guard against PreToolUse payloads that must come out
# differently. A check that cannot distinguish the cases is worse than none, so every
# fixture below asserts an exit code AND, where it matters, a string on stderr.
#
# Exit codes:
#   0  every fixture behaved as specified
#   1  at least one fixture did not — the failing ones are named
#
# Run:  ./hooks/selftest.sh   (or  bash hooks/selftest.sh)

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GUARD="$HERE/guard-mkdir-in-chronicle.sh"
[ -x "$GUARD" ] || { echo "not executable: $GUARD" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FAKE_ROOT="$TMP/chronicle"
EXISTING="$FAKE_ROOT/2026-08-16-episode-333-the-fork-arrives"
mkdir -p "$EXISTING"
mkdir -p "$TMP/elsewhere"

PASS=0
FAIL=0
FAILED=""

# payload <command> [tool_name]
payload() {
  python3 -c '
import json, sys
print(json.dumps({
  "session_id": "selftest",
  "hook_event_name": "PreToolUse",
  "cwd": sys.argv[2],
  "tool_name": sys.argv[3],
  "tool_input": {"command": sys.argv[1]},
}))' "$1" "$TMP" "${2:-Bash}"
}

# check <label> <expected-exit> <command> [tool_name] [--stderr-must-contain <text>]
check() {
  local label="$1" want="$2" cmd="$3" tool="${4:-Bash}" needle="${5:-}"
  local err pay rc
  err="$TMP/err.$$"
  pay="$TMP/payload.$$"
  # Write the payload to a FILE first. Piping it in makes the measured exit the
  # PIPELINE's, so a guard that exits before draining stdin reports 120 (SIGPIPE to
  # the producer under `set -o pipefail`) instead of its own code — and every fixture
  # then fails identically, which cannot distinguish a broken guard from a broken
  # harness. Caught by mutation-testing this file on 2026-09-04.
  payload "$cmd" "$tool" > "$pay"
  "$GUARD" < "$pay" >/dev/null 2>"$err"; rc=$?
  rm -f "$pay"
  local ok=1
  [ "$rc" = "$want" ] || ok=0
  if [ -n "$needle" ] && ! grep -qF -- "$needle" "$err"; then ok=0; fi
  if [ "$ok" = 1 ]; then
    PASS=$((PASS + 1))
    printf 'ok    %-58s exit=%s\n' "$label" "$rc"
  else
    FAIL=$((FAIL + 1))
    FAILED="${FAILED}  - ${label} (wanted exit=${want}${needle:+ and stderr containing \"$needle\"}, got exit=${rc})"$'\n'
    printf 'FAIL  %-58s exit=%s (wanted %s)\n' "$label" "$rc" "$want"
    sed 's/^/        | /' "$err" | head -12
  fi
  rm -f "$err"
}

echo "guard fixtures — fake chronicle root: $FAKE_ROOT"
echo

export MIADI_CHRONICLE_ROOT="$FAKE_ROOT"
export MIADI_CHRONICLE_MW_URL="http://127.0.0.1:8040"

# --- the four the brief names ------------------------------------------------------
check "mkdir of a new episode under the root is BLOCKED" \
      2 "mkdir -p $FAKE_ROOT/2026-09-04-episode-999-by-hand" Bash "mkepisode"

check "mkdir outside the chronicle is allowed" \
      0 "mkdir -p $TMP/elsewhere/whatever"

check "ls under the chronicle root is allowed" \
      0 "ls -la $FAKE_ROOT"

(
  unset MIADI_CHRONICLE_ROOT
  err="$TMP/err.unset"
  pay="$TMP/payload.unset"
  payload "mkdir -p $FAKE_ROOT/2026-09-04-episode-998-no-root" Bash > "$pay"
  "$GUARD" < "$pay" >/dev/null 2>"$err"
  rc=$?
  if [ "$rc" = 0 ] && grep -qF "MIADI_CHRONICLE_ROOT is unset" "$err"; then
    printf 'ok    %-58s exit=%s\n' "unset MIADI_CHRONICLE_ROOT does not block, says why" "$rc"
    exit 0
  fi
  printf 'FAIL  %-58s exit=%s (wanted 0 + reason on stderr)\n' "unset MIADI_CHRONICLE_ROOT does not block, says why" "$rc"
  sed 's/^/        | /' "$err" | head -6
  exit 1
)
if [ $? -eq 0 ]; then PASS=$((PASS + 1)); else
  FAIL=$((FAIL + 1)); FAILED="${FAILED}  - unset MIADI_CHRONICLE_ROOT does not block, says why"$'\n'
fi

# --- the rest of the contract ------------------------------------------------------
check "bare mkdir of a new episode is BLOCKED" \
      2 "mkdir $FAKE_ROOT/2026-09-04-episode-997-bare" Bash "born by mkepisode"

check "install -d of a new episode is BLOCKED" \
      2 "install -d $FAKE_ROOT/2026-09-04-episode-996-installed" Bash "install -d"

check "redirect into a non-existent episode dir is BLOCKED" \
      2 "echo hi > $FAKE_ROOT/2026-09-04-episode-995-redirect/notes.md" Bash "redirect"

check "\$MIADI_CHRONICLE_ROOT written as a variable is BLOCKED" \
      2 'mkdir -p "$MIADI_CHRONICLE_ROOT/2026-09-04-episode-994-var"' Bash "mkepisode"

check "compound command hiding a mkdir is BLOCKED" \
      2 "cd /tmp && mkdir -p $FAKE_ROOT/2026-09-04-episode-993-compound && echo done"

check "mkdir INSIDE an episode that already exists is allowed" \
      0 "mkdir -p $EXISTING/rooms/west"

check "redirect into an episode that already exists is allowed" \
      0 "echo note > $EXISTING/NOTES.md"

check "mkepisode itself is never blocked" \
      0 "mkepisode -n 999 -t 'a title' -g 'a goal' -r 'owner/repo#1'"

check "a non-Bash tool is ignored" \
      0 "mkdir -p $FAKE_ROOT/2026-09-04-episode-992-nottool" Write

check "creating the chronicle root itself is allowed" \
      0 "mkdir -p $TMP/chronicle2" 

echo
echo "passed $PASS, failed $FAIL"
if [ "$FAIL" -ne 0 ]; then
  printf '%s' "$FAILED"
  exit 1
fi
exit 0
