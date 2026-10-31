#!/usr/bin/env bash
# Uncommitted, not written (R6): at each Stop, the uncommitted files of the repositories a
# session ran in or wrote to that the session did not write are listed in
# _claude_uncommitted_not_written.json. When the reply counts one of them as work done, the turn
# is stopped once with their names; otherwise the hook prints nothing.
# Run: bash tests/uncommitted-not-written.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$HERE/hooks/claude_hooks/uncommitted_not_written.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export CLAUDE_SESSIONDATA_ROOT="$WORK/root"
export XDG_STATE_HOME="$WORK/state"  # the work-in-progress marker stays in the test (0.1.27)
mkdir -p "$CLAUDE_SESSIONDATA_ROOT"

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected $2, got $3"
        failures=$((failures + 1))
    fi
}

sid="77777777-2222-3333-4444-555555555555"
out="$CLAUDE_SESSIONDATA_ROOT/$sid"
mkdir -p "$out"
repo="$WORK/repo"; other="$WORK/other"
for r in "$repo" "$other"; do
    git -C "$WORK" init -q -b main "$r"
    git -C "$r" config user.email t@example.com; git -C "$r" config user.name t
done
mkdir -p "$repo/docs" "$other/src"
printf 'a\n' > "$repo/docs/plan.md"; printf 'b\n' > "$repo/STC.md"; printf 'c\n' > "$repo/mine.md"
printf 'd\n' > "$other/src/lib.mjs"
git -C "$repo" add -A >/dev/null; git -C "$repo" commit -qm init
git -C "$other" add -A >/dev/null; git -C "$other" commit -qm init
# Uncommitted: two files the session wrote, three it did not (one in a repository it only wrote to).
printf 'mine\n' >> "$repo/mine.md"
printf 'new\n' > "$repo/docs/new-by-me.md"
printf 'theirs\n' >> "$repo/STC.md"
printf 'theirs\n' > "$repo/docs/notes-by-another.md"
printf 'mine\n' >> "$other/src/lib.mjs"
printf 'theirs\n' > "$other/src/their-draft.mjs"
index="$out/_claude_files_written.jsonl"
for p in "$repo/mine.md" "$repo/docs/new-by-me.md" "$other/src/lib.mjs"; do
    jq -nc --arg path "$p" --arg sid "$sid" '{session_id: $sid, tool_name: "Write", kind: "changed", path: $path}' >> "$index"
done

stop() {  # <last message> [stop_hook_active]
    jq -nc --arg sid "$sid" --arg cwd "$repo" --arg msg "$1" --argjson active "${2:-false}" \
        '{hook_event_name: "Stop", session_id: $sid, cwd: $cwd, transcript_path: "/none", stop_hook_active: $active, last_assistant_message: $msg}' \
        | bash "$HOOK"
}

o=$(stop "Wrote mine.md and docs/new-by-me.md. Tests pass.")
expect "a reply that names only its own files prints nothing" "" "$o"
list="$out/_claude_uncommitted_not_written.json"
expect "the list is written" "yes" "$([ -f "$list" ] && echo yes || echo no)"
expect "three files are not this session's" "3" "$(jq -r .count "$list")"
expect "the repository it ran in, by path" " M STC.md|?? docs/notes-by-another.md" "$(jq -r --arg r "$repo" '.repos[] | select(.repo == $r) | .files | map("\(.status) \(.path)") | sort | join("|")' "$list")"
expect "a repository it only wrote to is looked at too" "?? src/their-draft.mjs" "$(jq -r --arg r "$other" '.repos[] | select(.repo == $r) | .files | map("\(.status) \(.path)") | join("|")' "$list")"
expect "files it wrote are never listed" "0" "$(jq '[.repos[].files[].path | select(. == "mine.md" or . == "docs/new-by-me.md" or . == "src/lib.mjs")] | length' "$list")"

o=$(stop "Done: updated STC.md and docs/notes-by-another.md, plus mine.md.")
expect "a reply naming files it did not write stops the turn once" "block" "$(jq -r .decision <<<"$o" 2>/dev/null)"
reason=$(jq -r .reason <<<"$o" 2>/dev/null)
expect "the reason names STC.md" "yes" "$(grep -qF " M $repo/STC.md" <<<"$reason" && echo yes || echo no)"
expect "the reason names the other note" "yes" "$(grep -qF "?? $repo/docs/notes-by-another.md" <<<"$reason" && echo yes || echo no)"
expect "the reason does not name its own file" "no" "$(grep -qF "mine.md" <<<"$reason" && echo yes || echo no)"

o=$(stop "Done: updated STC.md." true)
expect "a turn already stopped by a Stop hook is never stopped again" "" "$o"
o=$(stop "See src/their-draft.mjs in the other repository.")
expect "a mention that claims no work does not stop the turn" "" "$o"
o=$(stop "Updated src/their-draft.mjs in the other repository.")
expect "a repository path in a claim is named" "block" "$(jq -r .decision <<<"$o" 2>/dev/null)"
o=$(stop "F2: STC.md holds a duplicate record. This session did not write it.")
expect "a finding about a file is not a claim" "" "$o"
o=$(stop "STC.md was updated by another session.")
expect "a sentence that gives the work to another is not a claim" "" "$o"
o=$(stop "The STCISSUE.md notes and docs/plan.md were updated.")
expect "a longer name or a committed file is not a mention" "" "$o"
printf 'theirs\n' > "$repo/docs/Miadi"
o=$(stop "Updated the Miadi notes.")
expect "a bare name without an extension is a word, not a file" "" "$o"

MIADI_UNCOMMITTED_IGNORE="*/docs/notes-by-*:*/src/their-*" stop "Updated docs/notes-by-another.md and src/their-draft.mjs." > "$WORK/ignored"
expect "an ignored file never stops a turn" "" "$(cat "$WORK/ignored")"
expect "an ignored file is left out of the list" "STC.md|docs/Miadi" "$(jq -r '[.repos[].files[].path] | sort | join("|")' "$list")"
stop "" >/dev/null

# When the capture root sits inside the repository (gaia: /a/src/_sessiondata in /a/src), the
# hooks' own files for this session are not counted.
before=$(jq .count "$list")
export CLAUDE_SESSIONDATA_ROOT="$repo/_sessiondata"
mkdir -p "$CLAUDE_SESSIONDATA_ROOT/$sid/written"
cp "$index" "$CLAUDE_SESSIONDATA_ROOT/$sid/"
printf 'copy\n' > "$CLAUDE_SESSIONDATA_ROOT/$sid/written/x.md"
stop "" >/dev/null; stop "" >/dev/null
expect "the session's own capture folder is left out" "$before" "$(jq .count "$CLAUDE_SESSIONDATA_ROOT/$sid/_claude_uncommitted_not_written.json")"

if [ "$failures" -eq 0 ]; then echo "all uncommitted-not-written checks passed"; else echo "$failures failed"; exit 1; fi
