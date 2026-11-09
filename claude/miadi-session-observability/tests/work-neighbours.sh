#!/usr/bin/env bash
# At each prompt the agent is told which other sessions are in the middle of a reply in its
# repository, what they were asked and which files they last wrote there.
# Run: bash tests/work-neighbours.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS="$HERE/hooks/claude_hooks"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export HOME="$WORK/home" CLAUDE_SESSIONDATA_ROOT="$WORK/root" XDG_STATE_HOME="$WORK/state"
mkdir -p "$HOME/.claude/sessions" "$CLAUDE_SESSIONDATA_ROOT"
unset TMUX TMUX_PANE MIADI_RUN_MISSION MIADI_TEAM

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected $2, got $3"; failures=$((failures + 1)); fi
}
contains() {  # <label> <needle> <text>
    case "$3" in *"$2"*) echo "ok   $1" ;; *) echo "FAIL $1: no \"$2\" in: $3"; failures=$((failures + 1)) ;; esac
}
prompt() {  # <session> <cwd> <text>; prints what the agent is told
    jq -nc --arg s "$1" --arg c "$2" --arg p "$3" '{session_id: $s, cwd: $c, prompt: $p, hook_event_name: "UserPromptSubmit"}' \
        | bash "$HOOKS/user_prompt_submit_hook.sh" 2>/dev/null
}
repo="$WORK/repo"; other_repo="$WORK/other"
mkdir -p "$repo/.git" "$repo/app/deep" "$other_repo/.git"
repo=$(cd -P "$repo" && pwd); other_repo=$(cd -P "$other_repo" && pwd)
# The live registry: session a is held by this test's own process, b by one that has ended.
printf '{"pid":%d,"sessionId":"a"}' "$$" > "$HOME/.claude/sessions/$$.json"
printf '{"pid":999999,"sessionId":"b"}' > "$HOME/.claude/sessions/999999.json"

expect "alone in a repository, nothing is said" "" "$(prompt a "$repo" 'first')"
contains "another session in the repository is named" "(a), since" "$(prompt b "$repo/app/deep" 'second')"
contains "with what it was asked" '"first"' "$(prompt b "$repo/app/deep" 'second')"
expect "a session in another repository is not named" "" "$(prompt c "$other_repo" 'third')"

mkdir -p "$CLAUDE_SESSIONDATA_ROOT/a"
printf '%s\n' "{\"path\":\"$repo/app/one.ts\"}" "{\"path\":\"$other_repo/not-here.ts\"}" "{\"path\":\"$repo/app/two.ts\"}" > "$CLAUDE_SESSIONDATA_ROOT/a/_claude_files_written.jsonl"
printf '%s\n' '{"tmux":{"session":"t8-bug-console"}}' > "$CLAUDE_SESSIONDATA_ROOT/a/_terminal_binding.jsonl"
told=$(prompt d "$repo" 'fourth')
contains "its tmux session is named" "t8-bug-console (a)" "$told"
contains "with its last files, newest first" "Recent files: app/two.ts, app/one.ts" "$told"
case "$told" in *not-here*) echo "FAIL a file outside the repository was listed"; failures=$((failures + 1)) ;; *) echo "ok   a file outside the repository is left out" ;; esac

touch -d '13 hours ago' "$XDG_STATE_HOME/miadi/working/a.json"
case "$told" in *"(b)"*) echo "FAIL a session whose process ended was named"; failures=$((failures + 1)) ;; *) echo "ok   a session whose process ended is left out" ;; esac

case "$(prompt d "$repo" 'fifth')" in *"(a)"*) echo "FAIL a marker a crash left behind was named"; failures=$((failures + 1)) ;; *) echo "ok   a marker older than 12 hours is left out" ;; esac

[ "$failures" -eq 0 ] && echo "all passed" || { echo "$failures failed"; exit 1; }
