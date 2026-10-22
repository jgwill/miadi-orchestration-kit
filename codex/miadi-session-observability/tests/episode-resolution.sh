#!/usr/bin/env bash
# Every session's binding line names the chronicle episode it works in, and says which rule
# found it: a directory given with --add-dir, then the agent's folder, then
# MIADI_CHRONICLE_PROD_EPISODE, which every shell exports. Run: bash tests/episode-resolution.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
unset MIADI_CHRONICLE_PROD_EPISODE TMUX TMUX_PANE MIADI_TEAM
export CODEX_SESSIONDATA_ROOT="$WORK/root" MIADI_TEAMS_FILE=/nonexistent
. "$HERE/hooks/codex_hooks/lib.sh"
. "$HERE/hooks/codex_hooks/terminal_binding.sh"

C="$WORK/chronicle"; A=2026-06-28-episode-103-film-preprod-report-phase-2; B=2026-09-27-episode-548-before-choosing
mkdir -p "$C/$A" "$C/$B/chapters" "$C/_staging_for_new_episodes/x"
ln -s "$C" "$WORK/chronicle-link"
export MIADI_CHRONICLE_ROOT="$C"

failures=0
expect() {  # <label> <expected compact json> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected $2, got $3"
        failures=$((failures + 1))
    fi
}

expect "a directory given with --add-dir" "{\"id\":\"$A\",\"source\":\"add-dir\"}" \
    "$(_tb_episode_json /elsewhere "[\"codex\",\"--add-dir\",\"$C/$A\",\"--model\",\"haiku\"]")"
expect "--add-dir with several directories" "{\"id\":\"$B\",\"source\":\"add-dir\"}" \
    "$(_tb_episode_json /elsewhere "[\"codex\",\"--add-dir\",\"/tmp\",\"$C/$B/chapters/\"]")"
expect "--add-dir=<dir>" "{\"id\":\"$A\",\"source\":\"add-dir\"}" \
    "$(_tb_episode_json /elsewhere "[\"codex\",\"--add-dir=$C/$A\"]")"
expect "--add-dir before the folder" "{\"id\":\"$A\",\"source\":\"add-dir\"}" \
    "$(_tb_episode_json "$C/$B" "[\"codex\",\"--add-dir\",\"$C/$A\"]")"
expect "the agent's folder, below the episode" "{\"id\":\"$B\",\"source\":\"cwd\"}" \
    "$(_tb_episode_json "$C/$B/chapters" '["codex"]')"
expect "the folder through a link to the root" "{\"id\":\"$B\",\"source\":\"cwd\"}" \
    "$(MIADI_CHRONICLE_ROOT="$WORK/chronicle-link" _tb_episode_json "$C/$B" '["codex"]')"
expect "a staging folder is no episode" 'null' "$(_tb_episode_json "$C/_staging_for_new_episodes/x" '["codex"]')"
expect "the root itself is no episode" 'null' "$(_tb_episode_json "$C" '["codex"]')"
expect "the exported variable, last" "{\"id\":\"$A\",\"source\":\"declared\"}" \
    "$(MIADI_CHRONICLE_PROD_EPISODE="$A" _tb_episode_json /elsewhere '["codex"]')"
expect "the folder before the exported variable" "{\"id\":\"$B\",\"source\":\"cwd\"}" \
    "$(MIADI_CHRONICLE_PROD_EPISODE="$A" _tb_episode_json "$C/$B" '["codex"]')"
expect "nothing names an episode" 'null' "$(_tb_episode_json /elsewhere '["codex"]')"
expect "no chronicle root" "{\"id\":\"$A\",\"source\":\"declared\"}" \
    "$(MIADI_CHRONICLE_ROOT= MIADI_CHRONICLE_PROD_EPISODE="$A" _tb_episode_json "$C/$B" '["codex"]')"

# The whole binding line carries the episode.
codex_write_terminal_binding "session.start" "{\"session_id\":\"test-episode\",\"cwd\":\"$C/$B\",\"source\":\"startup\"}"
expect "the binding line carries the episode" "{\"id\":\"$B\",\"source\":\"cwd\"}" \
    "$(jq -c '.episode' "$WORK/root/data/terminal_bindings.jsonl" | tail -1)"

[ "$failures" -eq 0 ] && echo "all episode checks pass" || echo "$failures episode checks fail"
exit "$failures"
