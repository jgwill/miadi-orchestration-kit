#!/usr/bin/env bash
# Work in progress: a Codex session that took a prompt and has not finished its reply.
#
# The same marker the Claude plugin writes (claude_hooks/work_in_progress.sh, 0.1.27), in the
# same folder, so tide's restore and every session's neighbour notice read both harnesses:
# UserPromptSubmit writes <state>/miadi/working/<session_id>.json; Stop, Interrupt and SessionEnd
# remove it. The marker adds `harness` and `agent_pid`, because a Codex session has no
# ~/.claude/sessions registry to prove it is alive. Codex ends the turn when it proposes a plan,
# so a marker never stands for a plan waiting on the person.
# Sourced by dispatch.sh after lib.sh and terminal_binding.sh. Prints only the neighbour notice.

codex_working_dir() {
    printf '%s/miadi/working' "${XDG_STATE_HOME:-$HOME/.local/state}"
}

codex_work_started() {  # <normalized hook input json>
    local input="$1" dir sid tmp pid
    sid=$(jq -r '.session_id // empty' <<< "$input" 2>/dev/null)
    [ -n "$sid" ] || return 0
    dir=$(codex_working_dir)
    (umask 077 && mkdir -p "$dir") || return 0
    pid=$(_tb_agent_pid "$sid" 2>/dev/null)
    tmp="$dir/.$sid.json.$$"
    if (umask 077 && jq -c --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg pid "$pid" \
            '{session_id, started_at: $at, cwd, transcript_path, harness: "codex",
              agent_pid: ($pid | tonumber? // null), turn_id,
              prompt: ((.prompt // "") | gsub("\\s+"; " ") | .[0:600])}' <<< "$input" \
            | hook_secret_sanitize_stream > "$tmp") && [ -s "$tmp" ]; then
        mv -f "$tmp" "$dir/$sid.json"
    fi
    rm -f "$tmp"
}

codex_work_finished() {  # <normalized hook input json>
    local sid
    sid=$(jq -r '.session_id // empty' <<< "$1" 2>/dev/null)
    [ -n "$sid" ] || return 0
    rm -f "$(codex_working_dir)/$sid.json"
}

# The real path of the nearest folder holding a .git, or the folder itself when there is none.
codex_repo_of() {  # <folder>
    local here d
    here=$(cd -P "$1" 2>/dev/null && pwd) || return 1
    d="$here"
    while [ -n "$d" ] && [ "$d" != "/" ]; do
        [ -e "$d/.git" ] && { printf '%s' "$d"; return 0; }
        d="${d%/*}"
    done
    printf '%s' "$here"
}

# True while the session can still be working: its recorded agent pid runs, or, with no pid,
# a Claude Code process holds it. A Codex marker written under the shared app-server has no
# pid of its own and counts as live for the 12 hours the scan already allows.
codex_session_live() {  # <session id> <agent pid or empty> <harness>
    local file
    if [ -n "$2" ]; then
        kill -0 "$2" 2>/dev/null
        return
    fi
    [ "$3" = codex ] && return 0
    file=$(grep -ls "\"sessionId\":\"$1\"" "$HOME"/.claude/sessions/*.json 2>/dev/null | head -n 1)
    [ -n "$file" ] && kill -0 "$(basename "$file" .json)" 2>/dev/null
}

# The text, for the agent, naming the other live sessions with a reply in progress in this
# session's repository, whichever harness runs them. Nothing when there are none.
codex_work_neighbours() {  # <normalized hook input json>
    local sid cwd repo dir other other_cwd started prompt pid harness where files root shown=0 extra=0 lines=""
    local -A repo_of_cwd=()
    IFS=$'\t' read -r sid cwd < <(jq -r '[.session_id // "", .cwd // ""] | @tsv' <<< "$1" 2>/dev/null)
    [ -n "$sid" ] && [ -n "$cwd" ] || return 0
    dir=$(codex_working_dir)
    [ -d "$dir" ] || return 0
    repo=$(codex_repo_of "$cwd") || return 0
    while IFS=$'\t' read -r other other_cwd started prompt pid harness; do
        [ "$other" != "$sid" ] && [ -n "$other_cwd" ] || continue
        [ -n "${repo_of_cwd[$other_cwd]+x}" ] || repo_of_cwd[$other_cwd]=$(codex_repo_of "$other_cwd" 2>/dev/null)
        [ "${repo_of_cwd[$other_cwd]}" = "$repo" ] || continue
        if [ "$shown" -ge 3 ]; then extra=$((extra + 1)); continue; fi
        codex_session_live "$other" "$pid" "$harness" || continue
        shown=$((shown + 1))
        root="$CODEX_SESSIONDATA_ROOT/$other"
        where=$(tail -n 1 "$root/_terminal_binding.jsonl" 2>/dev/null | jq -r '.tmux.session // empty' 2>/dev/null)
        files=$(cat "$root/_claude_files_written.jsonl" "$root/_codex_files_written.jsonl" 2>/dev/null | tail -n 60 \
            | jq -r '.path // empty' 2>/dev/null | grep -F "$repo/" | sed "s#^$repo/##" | tac | awk '!seen[$0]++' \
            | head -n 5 | paste -sd, - | sed 's/,/, /g')
        lines+="- ${where:-a ${harness:-claude} session} ($other), since $started: \"${prompt:0:120}\"${files:+. Recent files: $files}"$'\n'
    done < <(find "$dir" -maxdepth 1 -name '*.json' -mmin -720 -exec jq -r \
        '[.session_id // "", .cwd // "", .started_at // "", .prompt // "", (.agent_pid // "" | tostring), .harness // ""] | @tsv' {} + 2>/dev/null)
    [ "$shown" -gt 0 ] || return 0
    printf 'Other sessions have a reply in progress in this repository (%s). Keep off what they hold. For what one did: miadi-hooks-interpret digest <id>\n%s' "$repo" "$lines"
    [ "$extra" -eq 0 ] || printf 'And %d more.\n' "$extra"
    return 0
}
