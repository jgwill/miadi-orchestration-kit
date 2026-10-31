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

claude_work_finished() {  # <hook input json>
    local sid
    sid=$(jq -r '.session_id // empty' <<< "$1" 2>/dev/null)
    [ -n "$sid" ] || return 0
    rm -f "$(miadi_working_dir)/$sid.json"
}
