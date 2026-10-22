#!/usr/bin/env bash
# terminal_binding.sh — join a session of any agent to the terminal it runs in.
#
# The same line claude_hooks/terminal_binding.sh writes for Claude Code, for the other agents'
# suites (hermes, pi, and the rest as their wiring reaches /opt/binscripts). One line per
# session start, end and first sighting in a process, appended to
#   <root>/data/terminal_bindings.jsonl        every session, one file
#   <root>/<session_id>/_terminal_binding.jsonl
# `agent` names the agent. Readers: tide (jgwill/Miadi), the tmux restore hooks (jgwill/gaia)
# and the session inventory. jgwill/binscripts#158.
#
# The tmux, team and episode rules are the same as in the Claude copy, whose canonical text lives in
# the miadi-session-observability plugin (jgwill/miadi-orchestration-kit). Change them together.
#
# Sourced by a suite's hook script, after its lib.sh:
#   . "$HOOKS_ROOT/terminal_binding.sh"
#   miadi_write_terminal_binding   <agent> <event> <fields json> <root>
#   miadi_observe_terminal_binding <agent> <fields json> <root>
# Run by an agent whose hooks are not bash:
#   bash terminal_binding.sh <agent> <event|observe> <root> <<< '<fields json>'
#
# <fields json>: {session_id, cwd, source, transcript_path, pid, argv, name}. Only session_id
# is required. pid is the agent's process when the caller knows it, else the nearest ancestor
# whose program is the agent. argv is the agent's command line when the agent renames its
# process (pi sets process.title, so /proc shows only "pi"), else /proc/<pid>/cmdline.
# name is the agent's own name for the session.
# Nothing is printed to stdout: several agents read a hook's stdout.

_MTB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

_mtb_load_sanitizer() {
    declare -F hook_secret_write_line >/dev/null 2>&1 && return 0
    # shellcheck source=secret_capture_sanitizer.sh
    . "$_MTB_DIR/secret_capture_sanitizer.sh"
}

# The agent's process: the nearest ancestor whose process name is the agent, or whose program
# is, when an interpreter runs it (python3 .../bin/hermes, node .../bin/gemini).
_mtb_agent_pid() {
    local agent="$1" pid="$PPID" i comm arg n
    for i in 1 2 3 4 5 6 7 8 9 10; do
        case "$pid" in ''|0|1) break ;; esac
        comm=$(cat "/proc/$pid/comm" 2>/dev/null)
        if [ "$comm" = "$agent" ]; then
            printf '%s' "$pid"
            return 0
        fi
        n=0
        while IFS= read -r -d '' arg; do
            n=$((n + 1))
            if [ "$n" -gt 1 ] && [ "${arg#-}" != "$arg" ]; then
                continue
            fi
            if [ "${arg##*/}" = "$agent" ]; then
                printf '%s' "$pid"
                return 0
            fi
            [ "$n" -gt 1 ] && break
        done < "/proc/$pid/cmdline" 2>/dev/null
        pid=$(awk '/^PPid:/ {print $2}' "/proc/$pid/status" 2>/dev/null)
    done
    return 0
}

# {session, window, pane, pane_id, socket} for $TMUX_PANE, or null outside tmux and when the
# environment names a tmux server that is no longer the one listening on the socket.
_mtb_tmux_json() {
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

# {id, source} for the session's team: a declared team (MIADI_TEAM, or the tmux session option
# @miadi-team), then the list's session names, then its folders (the longest prefix wins), then
# its name patterns, else unassigned. The list is MIADI_TEAMS_FILE, else
# $MIADI_ORCHESTRATION_KIT_ROOT/teams/teams.json.
_mtb_team_json() {
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
_mtb_episode_json() {
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

# miadi_write_terminal_binding <agent> <event> <fields json> <root>
# event: session.start | session.end | session.observed
miadi_write_terminal_binding() {
    local agent="$1" event="$2" fields="$3" root="$4" session_id
    session_id=$(printf '%s' "$fields" | jq -r '.session_id // empty' 2>/dev/null)
    [ -n "$session_id" ] && [ -n "$root" ] || return 0
    case "$session_id" in */*|.|..) return 0 ;; esac
    _mtb_load_sanitizer || return 0

    local agent_pid tmux_json argv_json name team_json episode_json cwd line
    agent_pid=$(printf '%s' "$fields" | jq -r '.pid // empty' 2>/dev/null)
    [ -n "$agent_pid" ] || agent_pid=$(_mtb_agent_pid "$agent")
    tmux_json=$(_mtb_tmux_json)
    argv_json=$(printf '%s' "$fields" | jq -c \
        'if (.argv | type) == "array" and (.argv | length) > 0 then .argv | map(tostring) else empty end' 2>/dev/null)
    if [ -z "$argv_json" ] && [ -n "$agent_pid" ] && [ -r "/proc/$agent_pid/cmdline" ]; then
        argv_json=$(jq -Rsc 'split("\u0000") | map(select(length > 0))' \
            < "/proc/$agent_pid/cmdline" 2>/dev/null)
    fi
    [ -n "$argv_json" ] || argv_json="[]"
    name=$(printf '%s' "$fields" | jq -r '.name // empty' 2>/dev/null)
    cwd=$(printf '%s' "$fields" | jq -r '.cwd // empty' 2>/dev/null)
    team_json=$(_mtb_team_json \
        "$cwd" \
        "$(printf '%s' "${tmux_json:-null}" | jq -r '.session? // empty' 2>/dev/null)" \
        "$name")
    episode_json=$(_mtb_episode_json "$cwd" "$argv_json")

    line=$(printf '%s' "$fields" | jq -c \
        --arg at "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" \
        --arg event "$event" \
        --arg agent "$agent" \
        --arg host "$(hostname -s 2>/dev/null)" \
        --arg pid "$agent_pid" \
        --argjson argv "${argv_json:-[]}" \
        --arg launch_alias "${MIADI_LAUNCH_ALIAS:-}" \
        --argjson tmux "${tmux_json:-null}" \
        --argjson team "${team_json:-null}" \
        --argjson episode "${episode_json:-null}" \
        '{at: $at, event: $event, source: (.source // ""), agent: $agent,
          session_id: .session_id, cwd: (.cwd // ""), transcript_path: (.transcript_path // ""),
          host: $host, pid: ($pid | tonumber? // null), argv: $argv, launch_alias: $launch_alias,
          name: (if (.name // "") == "" then null
                 else {name: .name, source: $agent, since: null, former: []} end),
          tmux: $tmux, team: $team, episode: $episode}' 2>/dev/null) || return 0
    [ -n "$line" ] || return 0

    mkdir -p "$root/data" "$root/$session_id" 2>/dev/null || return 0
    hook_secret_write_line "$root/data/terminal_bindings.jsonl" "$line"
    hook_secret_write_line "$root/$session_id/_terminal_binding.jsonl" "$line"

    local state="$root/$session_id/_terminal_binding.state"
    jq -cn --arg pid "$agent_pid" --arg name "$name" \
        '{pid: ($pid | tonumber? // null), name: $name, since: null}' \
        > "$state.tmp.$$" 2>/dev/null && mv -f "$state.tmp.$$" "$state"
    rm -f "$state.tmp.$$"
    return 0
}

# miadi_observe_terminal_binding <agent> <fields json> <root>
# For agents with no start event on every launch (hermes fires none on --resume). Called each
# turn, it writes one session.observed line when the session has no line yet, or when a new
# process of the agent holds it: a resume, or a relaunch in another pane.
miadi_observe_terminal_binding() {
    local agent="$1" fields="$2" root="$3" session_id state pid last
    session_id=$(printf '%s' "$fields" | jq -r '.session_id // empty' 2>/dev/null)
    [ -n "$session_id" ] && [ -n "$root" ] || return 0
    state="$root/$session_id/_terminal_binding.state"
    if [ -r "$state" ]; then
        pid=$(printf '%s' "$fields" | jq -r '.pid // empty' 2>/dev/null)
        [ -n "$pid" ] || pid=$(_mtb_agent_pid "$agent")
        last=$(jq -r '.pid // empty' "$state" 2>/dev/null)
        [ -n "$pid" ] && [ "$pid" != "$last" ] || return 0
    fi
    miadi_write_terminal_binding "$agent" "session.observed" "$fields" "$root"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    _mtb_fields="$(cat)"
    case "${2:-}" in
        observe) miadi_observe_terminal_binding "${1:-}" "$_mtb_fields" "${3:-}" ;;
        session.*) miadi_write_terminal_binding "${1:-}" "$2" "$_mtb_fields" "${3:-}" ;;
    esac >/dev/null
    exit 0
fi
