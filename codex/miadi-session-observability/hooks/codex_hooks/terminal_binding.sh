#!/usr/bin/env bash
# terminal_binding.sh — join an agent session to the terminal it runs in.
#
# One line per session start, end, rename and first sighting, with the session's team and episode, appended to
#   $CODEX_SESSIONDATA_ROOT/data/terminal_bindings.jsonl     every session, one file
#   $CODEX_SESSIONDATA_ROOT/<session_id>/_terminal_binding.jsonl
#
# Readers: the tmux save and restore hooks (jgwill/gaia), tide (jgwill/Miadi) and the
# session inventory (Mino). The tmux address is session:window.pane, because pane ids (%N)
# are renumbered every time the tmux server starts; pane_id is kept for joins while the
# server runs. argv is the agent's own command line with the flags its launch alias
# expanded to; launch_alias is MIADI_LAUNCH_ALIAS when a launcher exported it.
# jgwill/binscripts#158.
#
# Sourced after lib.sh (CODEX_SESSIONDATA_ROOT, codex_sanitize_text). Hooks inject their
# stdout into the conversation, so nothing here may print to stdout.

# The nearest Codex ancestor owns this hook, including nested Codex processes.
# Detached end jobs preserve its pid and argv before leaving that ancestry.
_tb_agent_pid() {
    [ -n "${_TB_AGENT_PID:-}" ] && { printf '%s' "$_TB_AGENT_PID"; return; }
    local pid="$PPID" comm i
    for i in {1..16}; do
        case "$pid" in ''|0|1) break ;; esac
        comm=$(cat "/proc/$pid/comm" 2>/dev/null)
        case "$comm" in codex|codex-*) printf '%s' "$pid"; return ;; esac
        pid=$(awk '/^PPid:/ {print $2}' "/proc/$pid/status" 2>/dev/null)
    done
}

# {session, window, pane, pane_id, socket} for $TMUX_PANE, or null outside tmux and when
# the environment names a tmux server that is no longer the one listening on the socket.
_tb_tmux_json() {
    if [ -z "${TMUX_PANE:-}" ] || [ -z "${TMUX:-}" ] || ! command -v tmux >/dev/null 2>&1; then
        printf 'null'
        return 0
    fi
    local socket="${TMUX%%,*}" env_pid fields
    env_pid="${TMUX#*,}"
    env_pid="${env_pid%%,*}"
    fields=$(tmux -S "$socket" display-message -p -t "$TMUX_PANE" \
        "#{pid}"$'\t'"#{session_name}"$'\t'"#{window_index}"$'\t'"#{pane_index}"$'\t'"#{pane_id}" 2>/dev/null)
    if [ -z "$fields" ]; then
        printf 'null'
        return 0
    fi
    local t_pid t_session t_window t_pane t_pane_id
    IFS=$'\t' read -r t_pid t_session t_window t_pane t_pane_id <<< "$fields"
    if [ -n "$env_pid" ] && [ "$t_pid" != "$env_pid" ]; then
        printf 'null'
        return 0
    fi
    jq -cn --arg session "$t_session" --arg window "$t_window" --arg pane "$t_pane" \
        --arg pane_id "$t_pane_id" --arg socket "$socket" \
        '{session: $session, window: ($window | tonumber? // $window),
          pane: ($pane | tonumber? // $pane), pane_id: $pane_id, socket: $socket}' 2>/dev/null \
        || printf 'null'
}

# Optional thread name from Codex's read-only state database, or null.
_tb_name_json() {
    python3 "$(dirname "${BASH_SOURCE[0]}")/native.py" name "${CODEX_SESSION_ID:-}"
}

# {id, source} for the session's team (jgwill/miadi-orchestration-kit#56, D9 and D10 on its page).
# Order: a declared team (MIADI_TEAM, or the tmux session option @miadi-team), then the list's
# session names, then its folders (the longest prefix wins), then its name patterns, else
# unassigned. The list is teams/teams.json in the kit: MIADI_TEAMS_FILE, else
# $MIADI_ORCHESTRATION_KIT_ROOT/teams/teams.json. An installed plugin is a copy of this folder,
# so it cannot reach the kit by a relative path. `source` says which rule answered.
_tb_team_json() {
    local cwd="$1" tmux_session="$2" agent_name="$3" declared="${MIADI_TEAM:-}" teams_file
    if [ -z "$declared" ] && [ -n "${TMUX_PANE:-}" ] && [ -n "${TMUX:-}" ] && command -v tmux >/dev/null 2>&1; then
        declared=$(tmux -S "${TMUX%%,*}" show-options -qv -t "$TMUX_PANE" @miadi-team 2>/dev/null)
    fi
    if [ -n "$declared" ]; then
        jq -cn --arg id "$declared" '{id: $id, source: "declared"}' 2>/dev/null || printf 'null'
        return 0
    fi
    teams_file="${MIADI_TEAMS_FILE:-}"
    if [ -z "$teams_file" ] && [ -n "${MIADI_ORCHESTRATION_KIT_ROOT:-}" ]; then
        teams_file="$MIADI_ORCHESTRATION_KIT_ROOT/teams/teams.json"
    fi
    if [ -z "$teams_file" ] || [ ! -r "$teams_file" ]; then
        printf '{"id":"unassigned","source":"no teams file"}'
        return 0
    fi
    jq -c --arg s "$tmux_session" --arg n "$agent_name" --arg cwd "$cwd" '
        ([$s, $n] | map(select(. != ""))) as $names
        | ([.teams[] | select(any(.sessions[]?; . as $x | $names | index($x)))] | first) as $by_session
        | ([.teams[] as $t | $t.folders[]? as $f
            | select($cwd != "" and ($cwd == $f or ($cwd | startswith($f + "/"))))
            | {team: $t, length: ($f | length)}] | sort_by(-.length) | first | .team?) as $by_folder
        | ([.teams[] | select(any(.name_patterns[]?; . as $p | any($names[]; test($p))))] | first) as $by_name
        | if $by_session then {id: $by_session.id, source: "session"}
          elif $by_folder then {id: $by_folder.id, source: "folder"}
          elif $by_name then {id: $by_name.id, source: "name"}
          else {id: "unassigned", source: "no rule matched"} end' "$teams_file" 2>/dev/null \
        || printf '{"id":"unassigned","source":"unreadable teams file"}'
}

# {id, source} for the chronicle episode the session works in, or null. This is how an
# episode knows its terminals (Q1 on the Tmux Agent Restore page). An episode is a directory
# directly under MIADI_CHRONICLE_ROOT named <yyyy-mm-dd>-episode-<n>-<slug>. Order: a
# directory the agent was given with --add-dir, then the agent's folder, then
# MIADI_CHRONICLE_PROD_EPISODE. The variable comes last because it is exported in every
# shell: alone it names the episode in production, not the one this session works in.
_tb_episode_json() {
    local cwd="$1" argv_json="${2:-[]}" root="${MIADI_CHRONICLE_ROOT:-}" real=""
    [ -n "$root" ] && real=$(realpath -m "$root" 2>/dev/null)
    jq -cn --arg cwd "$cwd" --argjson argv "$argv_json" --arg root "${root%/}" --arg real "${real%/}" \
        --arg declared "${MIADI_CHRONICLE_PROD_EPISODE:-}" '
        def episode($path): ($path | sub("/+$"; "")) as $p
            | [$root, $real][] | select(. != "") as $r
            | select($p | startswith($r + "/"))
            | $p | ltrimstr($r + "/") | split("/")[0]
            | select(test("^[0-9]{4}-[0-9]{2}-[0-9]{2}-episode-[0-9]+"));
        ($argv | reduce .[] as $a ({on: false, dirs: []};
            if $a == "--add-dir" then .on = true
            elif ($a | startswith("--add-dir=")) then .dirs += [$a | ltrimstr("--add-dir=")] | .on = false
            elif ($a | startswith("-")) then .on = false
            elif .on then .dirs += [$a]
            else . end) | .dirs
          | map(if startswith("/") then . else $cwd + "/" + . end)) as $dirs
        | ([$dirs[] | episode(.)] | first) as $by_dir
        | ([episode($cwd)] | first) as $by_cwd
        | ($declared | split("/") | map(select(. != "")) | last) as $by_name
        | if $by_dir then {id: $by_dir, source: "add-dir"}
          elif $by_cwd then {id: $by_cwd, source: "cwd"}
          elif $by_name then {id: $by_name, source: "declared"}
          else null end' 2>/dev/null || printf 'null'
}

# The agent's command line as a JSON array, [] when the process is gone.
_tb_argv_json() {
    if [ -n "$1" ] && [ -r "/proc/$1/cmdline" ]; then
        jq -Rsc 'split("\u0000") | map(select(length > 0))' < "/proc/$1/cmdline" 2>/dev/null \
            || printf '[]'
    else
        printf '[]'
    fi
}

_tb_append() {
    local session_id="$1" line
    line=$(codex_sanitize_text "$2")
    [ -n "$line" ] || return 0
    mkdir -p "$CODEX_SESSIONDATA_ROOT/data" "$CODEX_SESSIONDATA_ROOT/$session_id"
    printf '%s\n' "$line" >> "$CODEX_SESSIONDATA_ROOT/data/terminal_bindings.jsonl"
    printf '%s\n' "$line" >> "$CODEX_SESSIONDATA_ROOT/$session_id/_terminal_binding.jsonl"
}

# What the rename check compares against: the agent pid and the name last written.
_tb_remember() {
    local state="$CODEX_SESSIONDATA_ROOT/$1/_terminal_binding.state"
    jq -cn --arg pid "$2" --argjson name "${3:-null}" \
        '{pid: ($pid | tonumber? // null), name: ($name.name // ""), since: ($name.since // null)}' \
        > "$state.tmp.$$" 2>/dev/null && mv -f "$state.tmp.$$" "$state"
    rm -f "$state.tmp.$$"
}

# The miadi-run mission that started this agent: {id, prompt, name, version, sha256, trace,
# episode, source} read from <mission dir>/mission.json, or null. miadi-run (kit
# skills/miadi-run) pins one prompt version from the tracing provider into
# ~/.miadi/missions/<prompt>.v<N>/ and launches a seat on it. source: "env" when the agent's
# environment names the mission (MIADI_RUN_MISSION, under MIADI_RUN_HOME), "prompt" when a
# prompt named the mission's prompt.md. jgwill/miadi-orchestration-kit#82.
_tb_mission_json() {  # <mission dir> <source>
    local dir="$1" source="$2" id="${1##*/}"
    case "$id" in ''|.|..) printf 'null'; return 0 ;; esac
    if [ ! -r "$dir/mission.json" ]; then
        jq -cn --arg id "$id" --arg source "$source" --arg dir "$dir" \
            '{id: $id, source: $source, note: "no mission.json in \($dir)"}' 2>/dev/null || printf 'null'
        return 0
    fi
    # -s and one document only: a second document would print a second line, and the
    # binding line's --argjson would then fail and drop the line.
    jq -c -s --arg source "$source" 'if length == 1 and (.[0] | type) == "object" then .[0]
        | {id, prompt: (.prompt.reference // null), name: (.prompt.name // null),
           version: (.prompt.version // null), sha256: (.prompt.sha256 // null),
           trace: (.trace.reference // null), episode: (.episode.ref // null), source: $source}
        else null end' "$dir/mission.json" 2>/dev/null || printf 'null'
}

_tb_env_mission_json() {
    case "${MIADI_RUN_MISSION:-}" in ''|*/*|.|..) printf 'null'; return 0 ;; esac
    _tb_mission_json "${MIADI_RUN_HOME:-$HOME/.miadi/missions}/$MIADI_RUN_MISSION" env
}

# UserPromptSubmit: the starter prompt tide types for a miadi-run seat, `Read <brief> whole
# first`, in a session whose binding line names no mission yet, adds one session.mission
# line. It comes after `/mia-listen`, so it is the second prompt, and the path is absolute:
# <MIADI_RUN_HOME or ~/.miadi/missions>/<id>/prompt.md, with a miadi-run mission.json beside
# it. Only that form counts: a session that mentions a brief (a reviewer reading it) is not
# the mission's seat.
codex_check_terminal_binding_mission() {
    local input="$1" rest session_id dir i
    [[ $input == *'/prompt.md whole first'* ]] || return 0
    [[ $input =~ \"session_id\":\"([A-Za-z0-9_-]+)\" ]] || return 0
    session_id="${BASH_REMATCH[1]}"
    grep -q '"mission":' "$CODEX_SESSIONDATA_ROOT/$session_id/_terminal_binding.jsonl" 2>/dev/null && return 0
    rest="$input"
    for i in 1 2 3 4 5; do
        # Each `Read /…` in turn, cut at its own `/prompt.md whole first`, so a path with a
        # space is kept whole and one starter form never swallows the next.
        [[ $rest == *'Read /'*'/prompt.md whole first'* ]] || return 0
        rest="${rest#*Read /}"
        dir="/${rest%%/prompt.md whole first*}"
        case "$dir" in *'"'*|*'Read /'*|*'\n'*) continue ;; esac
        [[ ${dir##*/} =~ ^[A-Za-z0-9._@-]+$ ]] || continue
        [ -r "$dir/mission.json" ] || continue
        [ "$(jq -r '.schema // ""' "$dir/mission.json" 2>/dev/null)" = "miadi-run/mission@1" ] || continue
        _TB_MISSION_JSON=$(_tb_mission_json "$dir" prompt) codex_write_terminal_binding "session.mission" "$input"
        return 0
    done
}

# codex_write_terminal_binding <event> <hook input json>
# event: session.start | session.end | session.rename | session.observed | session.mission
codex_write_terminal_binding() {
    local event="$1" input="$2" session_id
    session_id=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)
    [ -n "$session_id" ] || return 0

    local agent_pid tmux_json name_json argv_json="[]" line
    agent_pid=$(_tb_agent_pid "$session_id")
    tmux_json=$(_tb_tmux_json)
    name_json=$(_tb_name_json "$agent_pid")
    # A missing optional thread record keeps the last name observed.
    local state="$CODEX_SESSIONDATA_ROOT/$session_id/_terminal_binding.state"
    if [ "$name_json" = "null" ] && [ -r "$state" ]; then
        name_json=$(jq -c 'if (.name // "") == "" then null
            else {name: .name, source: "last-known", since: (.since // null), former: []} end' \
            "$state" 2>/dev/null)
        [ -n "$name_json" ] || name_json="null"
    fi
    if [ -n "${_TB_ARGV_JSON:-}" ]; then
        argv_json="$_TB_ARGV_JSON"
    else
        argv_json=$(_tb_argv_json "$agent_pid")
    fi
    local team_json episode_json cwd
    cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
    team_json=$(_tb_team_json \
        "$cwd" \
        "$(printf '%s' "${tmux_json:-null}" | jq -r '.session? // empty' 2>/dev/null)" \
        "$(printf '%s' "${name_json:-null}" | jq -r '.name? // empty' 2>/dev/null)")
    episode_json=$(_tb_episode_json "$cwd" "${argv_json:-[]}")
    local mission_json="${_TB_MISSION_JSON:-}"
    [ -n "$mission_json" ] || mission_json=$(_tb_env_mission_json)

    line=$(printf '%s' "$input" | jq -c \
        --arg at "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" \
        --arg event "$event" \
        --arg host "$(hostname -s 2>/dev/null)" \
        --arg pid "$agent_pid" \
        --argjson argv "${argv_json:-[]}" \
        --arg launch_alias "${MIADI_LAUNCH_ALIAS:-}" \
        --argjson name "${name_json:-null}" \
        --argjson tmux "${tmux_json:-null}" \
        --argjson team "${team_json:-null}" \
        --argjson episode "${episode_json:-null}" \
        --argjson mission "${mission_json:-null}" \
        '{at: $at, event: $event, source: (.source // .reason // ""), agent: "codex",
          session_id: .session_id, cwd: (.cwd // ""), transcript_path: (.transcript_path // ""),
          host: $host, pid: ($pid | tonumber? // null), argv: $argv,
          launch_alias: $launch_alias, name: $name, tmux: $tmux, team: $team,
          episode: $episode} + (if $mission then {mission: $mission} else {} end)' 2>/dev/null) || return 0
    [ -n "$line" ] || return 0

    _tb_append "$session_id" "$line"
    _tb_remember "$session_id" "$agent_pid" "$name_json"
    return 0
}

# codex_check_terminal_binding_rename <hook input json>
# Called from UserPromptSubmit and Stop, this compares the Codex
# thread's current name with the last one written, and appends a
# session.rename line when it changed. A session with no binding yet (started before this
# file existed) gets one session.observed line at its first turn.
codex_check_terminal_binding_rename() {
    local input="$1" session_id state pid verdict
    session_id=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)
    [ -n "$session_id" ] || return 0
    state="$CODEX_SESSIONDATA_ROOT/$session_id/_terminal_binding.state"
    if [ ! -r "$state" ]; then
        codex_write_terminal_binding "session.observed" "$input"
        return 0
    fi
    local name_json
    name_json=$(_tb_name_json "")
    [ "$name_json" != null ] || return 0
    verdict=$(jq -rn --slurpfile st "$state" --argjson pf "$name_json" \
        'if ($st[0].name // "") == ($pf.name // "") then "same" else "renamed" end')
    [ "$verdict" != renamed ] || codex_write_terminal_binding "session.rename" "$input"
    return 0
}
