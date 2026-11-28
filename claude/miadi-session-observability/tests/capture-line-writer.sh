#!/usr/bin/env bash
# Hooks fired at once append to one ledger, and every record stays on a line of its own.
# A Code Mode script's parallel calls (Promise.all) fire their hooks together. The record and its
# newline used to be two appends: 10 of 569 PreToolUse lines of one session held two records,
# each followed by an empty line (jgwill/Miadi#1113).
# Usage: bash tests/capture-line-writer.sh [path to secret_capture_sanitizer.sh]
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sanitizer="${1:-$here/../hooks/secret_capture_sanitizer.sh}"
# shellcheck source=/dev/null
. "$sanitizer"
# A hook process is slower than this test's: widen the moment after the record is sanitized, so
# a writer that puts the record and its newline in two appends is caught every time.
eval "orig_$(declare -f hook_secret_sanitize_text)"
hook_secret_sanitize_text() { orig_hook_secret_sanitize_text "$@"; sleep 0.05; }
dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
ledger="$dir/_claude_PreToolUse.jsonl"
pad="$(head -c 1200 /dev/zero | tr '\0' 'x')"
writers=48
# Every writer holds its record, then all start at once, as the hooks of one parallel batch do.
go="$dir/go"
for i in $(seq "$writers"); do
    (
        record="$(jq -nc --arg i "$i" --arg pad "$pad" '{session_id:"S",tool_use_id:("repl_"+$i),pad:$pad}')"
        while [ ! -e "$go" ]; do sleep 0.01; done
        hook_secret_write_line "$ledger" "$record"
    ) &
done
sleep 1
touch "$go"
wait
# jq reads two glued objects as two values, so the lines are checked by their shape.
lines="$(grep -c '^{"session_id"' "$ledger")"
glued="$(grep -c '}{' "$ledger")"
empty="$(grep -c '^$' "$ledger")"
ids="$(jq -r .tool_use_id "$ledger" 2>/dev/null | sort -u | wc -l)"
if [ "$lines" -ne "$writers" ] || [ "$glued" -ne 0 ] || [ "$empty" -ne 0 ] || [ "$ids" -ne "$writers" ]; then
    echo "FAIL: $writers writers gave $lines record lines, $glued glued, $empty empty, $ids distinct records"
    exit 1
fi
snapshot="$dir/last_claude_PostToolUse.json"
for i in $(seq 16); do hook_secret_overwrite_line "$snapshot" "{\"n\":$i,\"pad\":\"$pad\"}" & done
wait
if ! jq -e . "$snapshot" >/dev/null 2>&1 || [ "$(wc -l < "$snapshot")" -ne 1 ]; then
    echo "FAIL: concurrent overwrites left a snapshot that is not one record"
    exit 1
fi
echo "ok: $writers concurrent records, one per line; concurrent overwrites leave one record"
