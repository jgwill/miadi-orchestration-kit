#!/usr/bin/env bash
# Work in progress: a session that took a prompt and has not finished its reply.
#
# UserPromptSubmit writes <state>/miadi/working/<session_id>.json; Stop and SessionEnd remove it.
# A file still there after a power-off names a session that was cut off mid-reply: tide brings
# it back first and tells it what it was working on (jgwill/gaia#97, jgwill/Miadi#869).
# The prompt is kept as one line of at most 600 characters, sanitized like every capture.
# Sourced by the hooks; needs lib.sh (hook_secret_sanitize_stream).

miadi_working_dir() {
    printf '%s/miadi/working' "${XDG_STATE_HOME:-$HOME/.local/state}"
}

claude_work_started() {  # <hook input json>
    local input="$1" dir sid tmp
    sid=$(jq -r '.session_id // empty' <<< "$input" 2>/dev/null)
    [ -n "$sid" ] || return 0
    dir=$(miadi_working_dir)
    (umask 077 && mkdir -p "$dir") || return 0
    tmp="$dir/.$sid.json.$$"
    if (umask 077 && jq -c --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            '{session_id, started_at: $at, cwd, transcript_path,
              prompt: ((.prompt // "") | gsub("\\s+"; " ") | .[0:600])}' <<< "$input" \
            | hook_secret_sanitize_stream > "$tmp") && [ -s "$tmp" ]; then
        mv -f "$tmp" "$dir/$sid.json"
    fi
    rm -f "$tmp"
}

# The real path of the nearest folder holding a .git, or the folder itself when there is none.
miadi_repo_of() {  # <folder>
    local here d
    here=$(cd -P "$1" 2>/dev/null && pwd) || return 1
    d="$here"
    while [ -n "$d" ] && [ "$d" != "/" ]; do
        [ -e "$d/.git" ] && { printf '%s' "$d"; return 0; }
        d="${d%/*}"
    done
    printf '%s' "$here"
}

# True while the session can still be working. A Claude Code session is held by a process in its
# live registry (~/.claude/sessions/<pid>.json). A Codex session's marker carries its agent pid
# (codex_hooks/work_in_progress.sh); one written under Codex's shared app-server has none and
# counts as live for the 12 hours the scan already allows.
miadi_session_live() {  # <session id> [agent pid] [harness]
    local file
    if [ -n "${2:-}" ]; then
        kill -0 "$2" 2>/dev/null
        return
    fi
    [ "${3:-}" = codex ] && return 0
    file=$(grep -ls "\"sessionId\":\"$1\"" "$HOME"/.claude/sessions/*.json 2>/dev/null | head -n 1)
    [ -n "$file" ] && kill -0 "$(basename "$file" .json)" 2>/dev/null
}

# Prints, for the agent, the other live sessions with a reply in progress in this session's
# repository: what each was asked and the last files it wrote there. Nothing when there are none.
# A person should not have to say "another agent is working here". One jq reads every marker
# and a repository is worked out once per folder: this runs on every prompt.
claude_work_neighbours() {  # <hook input json>
    local sid cwd repo dir other other_cwd started prompt pid harness where files shown=0 extra=0 lines=""
    local -A repo_of_cwd=()
    IFS=$'\t' read -r sid cwd < <(jq -r '[.session_id // "", .cwd // ""] | @tsv' <<< "$1" 2>/dev/null)
    [ -n "$sid" ] && [ -n "$cwd" ] || return 0
    dir=$(miadi_working_dir)
    [ -d "$dir" ] || return 0
    repo=$(miadi_repo_of "$cwd") || return 0
    while IFS=$'\t' read -r other other_cwd started prompt pid harness; do
        [ "$other" != "$sid" ] && [ -n "$other_cwd" ] || continue
        [ -n "${repo_of_cwd[$other_cwd]+x}" ] || repo_of_cwd[$other_cwd]=$(miadi_repo_of "$other_cwd" 2>/dev/null)
        [ "${repo_of_cwd[$other_cwd]}" = "$repo" ] || continue
        if [ "$shown" -ge 3 ]; then extra=$((extra + 1)); continue; fi
        miadi_session_live "$other" "$pid" "$harness" || continue
        shown=$((shown + 1))
        where=$(tail -n 1 "$CLAUDE_SESSIONDATA_ROOT/$other/_terminal_binding.jsonl" 2>/dev/null | jq -r '.tmux.session // empty' 2>/dev/null)
        files=$(cat "$CLAUDE_SESSIONDATA_ROOT/$other/_claude_files_written.jsonl" "$CLAUDE_SESSIONDATA_ROOT/$other/_codex_files_written.jsonl" 2>/dev/null | tail -n 60 | jq -r '.path // empty' 2>/dev/null \
            | grep -F "$repo/" | sed "s#^$repo/##" | tac | awk '!seen[$0]++' | head -n 5 | paste -sd, - | sed 's/,/, /g')
        lines+="- ${where:-a ${harness:-claude} session} ($other), since $started: \"${prompt:0:120}\"${files:+. Recent files: $files}"$'\n'
    done < <(find "$dir" -maxdepth 1 -name '*.json' -mmin -720 -exec jq -r '[.session_id // "", .cwd // "", .started_at // "", .prompt // "", (.agent_pid // "" | tostring), .harness // ""] | @tsv' {} + 2>/dev/null)
    [ "$shown" -gt 0 ] || return 0
    printf 'Other sessions have a reply in progress in this repository (%s). Keep off what they hold. For what one did: miadi-hooks-interpret digest <id>\n%s' "$repo" "$lines"
    [ "$extra" -eq 0 ] || printf 'And %d more.\n' "$extra"
    return 0
}

claude_work_finished() {  # <hook input json>
    local sid
    sid=$(jq -r '.session_id // empty' <<< "$1" 2>/dev/null)
    [ -n "$sid" ] || return 0
    rm -f "$(miadi_working_dir)/$sid.json"
}
