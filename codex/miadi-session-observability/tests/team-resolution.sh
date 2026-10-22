#!/usr/bin/env bash
# Every session's binding line names its team, and says which rule found it (D9 and D10 on
# the A9 page, jgwill/miadi-orchestration-kit#56). Run: bash tests/team-resolution.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'tmux -L team-resolution-test kill-server 2>/dev/null; rm -rf "$WORK"' EXIT
unset MIADI_TEAM MIADI_ORCHESTRATION_KIT_ROOT TMUX TMUX_PANE
export CODEX_SESSIONDATA_ROOT="$WORK/root"
. "$HERE/hooks/codex_hooks/lib.sh"
. "$HERE/hooks/codex_hooks/terminal_binding.sh"

cat > "$WORK/teams.json" <<'JSON'
{"version": 1, "teams": [
  {"id": "T1", "sessions": ["gaia-var-disk-space"], "folders": ["/work"], "name_patterns": ["^gaia-"]},
  {"id": "T2", "sessions": ["kafka"], "folders": ["/work/deep"], "name_patterns": ["eda-broker"]},
  {"id": "T3", "sessions": ["mino-260928-fork-01"], "folders": [], "name_patterns": ["^mino-"]}
]}
JSON

failures=0
expect() {  # <label> <expected compact json> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected $2, got $3"
        failures=$((failures + 1))
    fi
}

export MIADI_TEAMS_FILE="$WORK/teams.json"
expect "a tmux session name in the list" '{"id":"T1","source":"session"}' "$(_tb_team_json /elsewhere gaia-var-disk-space '')"
expect "an agent session name in the list" '{"id":"T3","source":"session"}' "$(_tb_team_json /elsewhere other mino-260928-fork-01)"
expect "a folder, the longest prefix wins" '{"id":"T2","source":"folder"}' "$(_tb_team_json /work/deep/x unlisted '')"
expect "a folder itself" '{"id":"T1","source":"folder"}' "$(_tb_team_json /work unlisted '')"
expect "a folder that only shares a prefix" '{"id":"unassigned","source":"no rule matched"}' "$(_tb_team_json /workshop unlisted '')"
expect "a name pattern" '{"id":"T2","source":"name"}' "$(_tb_team_json /elsewhere new-eda-broker-lab '')"
expect "the session list before the folder" '{"id":"T2","source":"session"}' "$(_tb_team_json /work/x kafka '')"
expect "nothing matches" '{"id":"unassigned","source":"no rule matched"}' "$(_tb_team_json /elsewhere unlisted '')"
expect "declared in the environment" '{"id":"T9","source":"declared"}' "$(MIADI_TEAM=T9 _tb_team_json /work gaia-var-disk-space '')"

unset MIADI_TEAMS_FILE
expect "no teams file" '{"id":"unassigned","source":"no teams file"}' "$(_tb_team_json /work gaia-var-disk-space '')"
expect "the kit root finds the list" '{"id":"T1","source":"folder"}' \
    "$(mkdir -p "$WORK/kit/teams" && cp "$WORK/teams.json" "$WORK/kit/teams/" && MIADI_ORCHESTRATION_KIT_ROOT="$WORK/kit" _tb_team_json /work/a unlisted '')"

# A tmux session option declares the team for every pane of that session.
if command -v tmux >/dev/null 2>&1; then
    tmux -L team-resolution-test -f /dev/null new-session -d -s declared-by-option "sleep 60"
    tmux -L team-resolution-test set-option -t declared-by-option @miadi-team T2
    pane=$(tmux -L team-resolution-test display -p -t declared-by-option '#{pane_id}')
    socket=$(tmux -L team-resolution-test display -p '#{socket_path}')
    server_pid=$(tmux -L team-resolution-test display -p '#{pid}')
    expect "declared with the tmux session option @miadi-team" '{"id":"T2","source":"declared"}' \
        "$(TMUX="$socket,$server_pid,0" TMUX_PANE="$pane" MIADI_TEAMS_FILE="$WORK/teams.json" _tb_team_json /work gaia-var-disk-space '')"
fi

# The whole binding line carries the team.
export MIADI_TEAMS_FILE="$WORK/teams.json"
codex_write_terminal_binding "session.start" '{"session_id":"test-team","cwd":"/work/deep/project","source":"startup"}'
expect "the binding line carries the team" '{"id":"T2","source":"folder"}' \
    "$(jq -c '.team' "$WORK/root/data/terminal_bindings.jsonl" | tail -1)"

[ "$failures" -eq 0 ] && echo "all team checks pass" || echo "$failures team checks fail"
exit "$failures"
