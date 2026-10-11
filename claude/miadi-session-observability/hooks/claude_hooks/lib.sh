#!/usr/bin/env bash

_CLAUDE_HOOKS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../secret_capture_sanitizer.sh
. "$_CLAUDE_HOOKS_ROOT/secret_capture_sanitizer.sh"

# Portable capture-output root — one source of truth for every claude hook.
# Honors the shared env alias set by etc/bash_env_common (MIADI_SESSION_DIR ->
# MIADI_SESSIONDATA_ROOT -> SESSION_DATA_ROOT). With no env loaded it falls back to
# /src/_sessiondata on hosts that have /src (servers; /src -> /a/src on Eury), else the
# repo-local _sessiondata beside the scripts (Termux/Android, containers without env).
if [ -z "${CLAUDE_SESSIONDATA_ROOT:-}" ]; then
    CLAUDE_SESSIONDATA_ROOT="${MIADI_SESSION_DIR:-${MIADI_SESSIONDATA_ROOT:-${SESSION_DATA_ROOT:-}}}"
    if [ -z "$CLAUDE_SESSIONDATA_ROOT" ]; then
        if [ -d "/src/_sessiondata" ]; then
            CLAUDE_SESSIONDATA_ROOT="/src/_sessiondata"
        else
            CLAUDE_SESSIONDATA_ROOT="$(cd "$_CLAUDE_HOOKS_ROOT/.." && pwd)/_sessiondata"
        fi
    fi
fi
export CLAUDE_SESSIONDATA_ROOT

claude_write_jsonl() {
    local file="$1"
    local text="$2"
    hook_secret_write_line "$file" "$text"
}

claude_write_json() {
    local file="$1"
    local text="$2"
    hook_secret_overwrite_line "$file" "$text"
}

# Atomic: sanitize into a temp file beside dest, then rename over it. Claude
# Code kills hooks on exit; writing dest in place left 0-byte transcript
# copies. The rename also replaces a symlink at dest instead of writing
# through it into its target.
claude_sanitize_file_to() {
    local src="$1"
    local dest="$2"
    [ -f "$src" ] || return 0
    local tmp="$dest.tmp.$$"
    if hook_secret_sanitize_stream < "$src" > "$tmp" && [ -s "$tmp" ]; then
        mv -f "$tmp" "$dest"
    else
        rm -f "$tmp"
    fi
}

claude_sanitize_text() {
    hook_secret_sanitize_text "$1"
}

# --- Transcript archive -----------------------------------------------------
# Claude Code deletes a session's transcript, its subagent transcripts and its
# tool-results after cleanupPeriodDays (default 30). These functions keep
# sanitized copies in the session folder, which outlive that cleanup.

# Run a command detached from Claude Code: the hook returns at once, and the
# command survives Claude Code killing its hooks on exit.
claude_detach() {
    if command -v setsid >/dev/null 2>&1; then
        setsid "$@" </dev/null >/dev/null 2>&1 &
    else
        nohup "$@" </dev/null >/dev/null 2>&1 &
    fi
}

# Run the rest of the arguments holding an exclusive lock on <lockfile>, so a
# Stop, a SubagentStop, a SessionEnd and a sweep never write one copy at once.
# Without flock (Termux) the command runs unlocked.
claude_with_lock() {
    local lock="$1"; shift
    if command -v flock >/dev/null 2>&1; then
        ( flock -w 900 9 || exit 0; "$@" ) 9>"$lock"
    else
        "$@"
    fi
}

_claude_byte_count() {
    local n
    n=$(wc -c 2>/dev/null < "$1") || n=0
    echo "${n//[[:space:]]/}"
}

_claude_line_count() {
    local n
    n=$(wc -l 2>/dev/null < "$1") || n=0
    echo "${n//[[:space:]]/}"
}

# Keep <dest> a sanitized copy of <src>, a JSONL file Claude Code only appends
# to. Each call sanitizes only the lines added since the last call: the hidden
# .<dest>.offset beside it holds how many bytes of <src> are copied and how
# many bytes <dest> had then, so a turn costs the size of the turn, not of the
# transcript (sanitizing a 33 MB transcript whole takes 18 s). A partial last
# line waits for the next call. The copy starts over when <src> shrank, when
# the offset no longer ends a line, or when <dest> changed size since: another
# writer (a hook from 0.1.2 or earlier, still loaded in a running session)
# replaced it, and appending would duplicate lines. A copy made before offsets
# were kept is adopted when it has as many lines as <src>, and copied again
# when it does not (a SessionEnd killed mid-copy).
claude_archive_jsonl() {
    local src="$1" dest="$2"
    [ -f "$src" ] || return 0
    local state size offset=0 dest_size=""
    state="$(dirname "$dest")/.$(basename "$dest").offset"
    size=$(_claude_byte_count "$src")
    [ "$size" -gt 0 ] || return 0

    # Before 2026-09-27 the subagent copy was a symlink to Claude Code's own
    # file. Appending would write through it, so it is replaced.
    if [ -L "$dest" ]; then
        rm -f "$dest" "$state"
    fi

    if [ -f "$state" ]; then
        read -r offset dest_size < "$state"
        case "$offset" in ''|*[!0-9]*) offset=0 ;; esac
        if [ -z "$dest_size" ]; then
            # Kept by the first 0.1.3 sweep, offset only: check by lines.
            [ "$offset" -gt 0 ] && [ "$(_claude_line_count "$dest")" = "$(head -c "$offset" "$src" | wc -l | tr -d '[:space:]')" ] \
                || offset=0
        elif [ "$dest_size" != "$(_claude_byte_count "$dest")" ]; then
            offset=0
        fi
    elif [ -s "$dest" ] && [ -z "$(tail -c 1 "$src")" ] \
        && [ "$(_claude_line_count "$dest")" = "$(_claude_line_count "$src")" ]; then
        printf '%s %s\n' "$size" "$(_claude_byte_count "$dest")" > "$state"
        return 0
    fi

    if [ "$offset" -eq "$size" ]; then
        [ -n "$dest_size" ] || printf '%s %s\n' "$size" "$(_claude_byte_count "$dest")" > "$state"
        return 0
    fi
    if [ ! -s "$dest" ] || [ "$offset" -gt "$size" ] \
        || { [ "$offset" -gt 0 ] && [ -n "$(tail -c +"$offset" "$src" | head -c 1)" ]; }; then
        offset=0
    fi

    local chunk="$dest.chunk.$$" tmp="$dest.tmp.$$" added
    tail -c +"$((offset + 1))" "$src" \
        | perl -0777 -ne 'my $i = rindex($_, "\n"); print substr($_, 0, $i + 1) if $i >= 0' > "$chunk"
    added=$(_claude_byte_count "$chunk")
    if [ "$added" -eq 0 ]; then
        rm -f "$chunk"
        return 0
    fi
    if [ "$offset" -eq 0 ]; then
        if hook_secret_sanitize_stream < "$chunk" > "$tmp" && [ -s "$tmp" ]; then
            mv -f "$tmp" "$dest"
        else
            rm -f "$tmp" "$chunk"
            return 0
        fi
    elif ! hook_secret_sanitize_stream < "$chunk" >> "$dest"; then
        rm -f "$chunk"
        return 0
    fi
    rm -f "$chunk"
    printf '%s %s\n' "$((offset + added))" "$(_claude_byte_count "$dest")" > "$state"
}

# Copy a file Claude Code writes whole (tool-results, session-memory, a
# subagent's meta.json), sanitized, when the copy is missing or older.
claude_archive_file() {
    local src="$1" dest="$2"
    [ -f "$src" ] || return 0
    if [ -f "$dest" ] && [ ! -L "$dest" ] && [ ! "$src" -nt "$dest" ]; then
        return 0
    fi
    mkdir -p "$(dirname "$dest")"
    claude_sanitize_file_to "$src" "$dest"
}

# Archive one session into <output_dir>: its transcript to
# _transcript_final.jsonl, each subagent transcript to
# agents/<agent_id>.transcript.jsonl with agents/<agent_id>.meta.json beside
# it, and every other file Claude Code keeps beside the transcript
# (tool-results/, session-memory/) at the same relative path.
claude_archive_session() {
    local transcript="$1" output_dir="$2"
    [ -n "$transcript" ] && [ -n "$output_dir" ] || return 0
    mkdir -p "$output_dir"
    claude_archive_jsonl "$transcript" "$output_dir/_transcript_final.jsonl"

    local base="${transcript%.jsonl}" f rel name
    [ -d "$base" ] || return 0
    while IFS= read -r -d '' f; do
        rel="${f#"$base"/}"
        case "$rel" in
            subagents/agent-*.jsonl)
                name="${rel#subagents/agent-}"
                mkdir -p "$output_dir/agents"
                claude_archive_jsonl "$f" "$output_dir/agents/${name%.jsonl}.transcript.jsonl"
                ;;
            subagents/agent-*.meta.json)
                name="${rel#subagents/agent-}"
                claude_archive_file "$f" "$output_dir/agents/${name%.meta.json}.meta.json"
                ;;
            *)
                claude_archive_file "$f" "$output_dir/$rel"
                ;;
        esac
    # -type l too: Claude Code links a forked session's subagents to the
    # files of the session it forked from.
    done < <(find "$base" \( -type f -o -type l \) -print0 2>/dev/null)
}

# Archive every session in <projects_dir> (~/.claude/projects) that the hooks
# captured under this root. This catches what no hook copied: sessions killed
# or crashed before SessionEnd, turns after the last Stop, and sessions captured
# by the legacy /opt/binscripts hooks, whose SessionEnd copy was often empty.
# A session whose copies are current costs a few stat calls.
claude_archive_sweep() {
    local projects_dir="$1" t sid out
    [ -d "$projects_dir" ] || return 0
    for t in "$projects_dir"/*/*.jsonl; do
        [ -f "$t" ] || continue
        sid="$(basename "$t" .jsonl)"
        out="$CLAUDE_SESSIONDATA_ROOT/$sid"
        [ -d "$out" ] || continue
        claude_with_lock "$out/.archive.lock" claude_archive_session "$t" "$out"
    done
}

# --- Files written ----------------------------------------------------------
# Write and Edit land in proposed/ before they run. A file written any other
# way (a Bash redirect, cp, mv, a script, an MCP server writing into the
# project) was captured nowhere, and was gone once moved or deleted later in
# the session. PreToolUse marks when a Bash or MCP call starts, PostToolUse and
# PostToolUseFailure mark when it ends, and files_written.sh, detached, copies
# each file whose inode changed between the two marks to
# written/<its absolute path>. Write, Edit and NotebookEdit copy their one file
# the same way, as it stands after the tool. Each file gets one line in
# _claude_files_written.jsonl naming the tool call that touched it and the
# prompt it answered (prompt_id).

CLAUDE_WRITTEN_MAX_BYTES="${CLAUDE_WRITTEN_MAX_BYTES:-524288}"
CLAUDE_WRITTEN_MAX_FILES="${CLAUDE_WRITTEN_MAX_FILES:-40}"
CLAUDE_WRITTEN_MAX_LINES="${CLAUDE_WRITTEN_MAX_LINES:-200}"
CLAUDE_WRITTEN_SCAN_SECONDS="${CLAUDE_WRITTEN_SCAN_SECONDS:-5}"

# Tools whose input names no path: what they wrote is found by scanning.
claude_files_written_scans() {
    case "$1" in Bash|mcp__*) return 0 ;; esac
    return 1
}

# Tools whose input names the one file they write.
claude_files_written_direct() {
    case "$1" in Write|Edit|MultiEdit|NotebookEdit) return 0 ;; esac
    return 1
}

# PreToolUse: mark the start of a scanned call. The mark holds the cwd the
# call starts in.
claude_files_written_mark_start() {
    local output_dir="$1" input="$2" tool_use_id="" cwd=""
    { IFS= read -r tool_use_id; IFS= read -r cwd; } \
        < <(printf '%s' "$input" | jq -r '(.tool_use_id // ""), (.cwd // "")' 2>/dev/null)
    case "$tool_use_id" in ''|*[!A-Za-z0-9_-]*) return 0 ;; esac
    mkdir -p "$output_dir/.tool_marks"
    printf '%s\n' "$cwd" > "$output_dir/.tool_marks/$tool_use_id.start"
}

# PostToolUse and PostToolUseFailure (a failed command can still have written
# files): mark the end of the call, keep what the copy needs in <id>.job,
# sanitized, and copy detached so the next tool call does not wait.
claude_files_written_queue() {
    local output_dir="$1" input="$2" tool_name="$3" job tool_use_id marks
    claude_files_written_scans "$tool_name" || claude_files_written_direct "$tool_name" || return 0
    job=$(printf '%s' "$input" | jq -c '{tool_use_id, tool_name, agent_id: (.agent_id // null), prompt_id: (.prompt_id // null), cwd,
        scratchpad_dir: (.scratchpad_dir // null), command: (.tool_input.command // null),
        file_path: (.tool_input.file_path // .tool_input.notebook_path // null),
        write_type: ((.tool_response | objects | .type) // null)}' 2>/dev/null) || return 0
    [[ $job =~ ^\{\"tool_use_id\":\"([A-Za-z0-9_-]+)\" ]] || return 0
    tool_use_id="${BASH_REMATCH[1]}"
    marks="$output_dir/.tool_marks"
    if claude_files_written_scans "$tool_name"; then
        [ -f "$marks/$tool_use_id.start" ] || return 0
        : > "$marks/$tool_use_id.end"
    fi
    mkdir -p "$marks"
    hook_secret_sanitize_text "$job" > "$marks/$tool_use_id.job"
    claude_detach bash "$(dirname "${BASH_SOURCE[0]}")/files_written.sh" "$output_dir" "$tool_use_id"
}

# True when <path> is one of the <dir>s or inside one.
_claude_path_under() {
    local p="$1" d; shift
    for d in "$@"; do
        [ "$p" = "$d" ] && return 0
        case "$p" in "$d"/*) return 0 ;; esac
    done
    return 1
}

# Print "<mtime> <path>\0" for each file under <dir> whose inode changed after
# <start> was written and not after <end>, <maxdepth> levels deep (all when
# empty), for at most CLAUDE_WRITTEN_SCAN_SECONDS. Returns 124 when it ran out
# of time.
_claude_files_written_scan_dir() {
    local dir="$1" depth="$2" start="$3" end="$4" output_dir="$5"
    local -a cmd=(find -H "$dir" -mindepth 1)
    [ -n "$depth" ] && cmd+=(-maxdepth "$depth")
    cmd+=(-xdev \( -type d \( -name .git -o -name node_modules -o -name .next -o -name .nuxt
        -o -name .svelte-kit -o -name .venv -o -name venv -o -name __pycache__ -o -name .cache
        -o -name .turbo -o -name .pnpm-store -o -name .npm -o -name .yarn -o -name dist
        -o -name build -o -name target -o -name coverage -o -name _sessiondata
        -o -path "$output_dir" -o -path "$CLAUDE_SESSIONDATA_ROOT" -o -path "$HOME/.claude" \) -prune \)
        -o \( -type f -cnewer "$start" ! -cnewer "$end" -printf '%T@ %p\0' \))
    if command -v timeout >/dev/null 2>&1; then
        timeout "$CLAUDE_WRITTEN_SCAN_SECONDS" "${cmd[@]}" 2>/dev/null
    else
        "${cmd[@]}" 2>/dev/null
    fi
}

# Print "<kind> <path>\0" for each file a scanned call wrote: kind is created
# (born during the call), changed (content written during the call) or moved
# (only its inode changed: a rename, a move, a chmod). Scanned whole: the cwd
# the call started in, the cwd it ended in, and the scratchpad. Scanned one
# level deep: the directories the command names, so a write outside the
# project is found too. A root whose scan ran out of time is scanned three
# levels deep for the rest of the session (.files_written.slow_roots).
claude_files_written_find() {
    local output_dir="$1" start="$2" end="$3" post_cwd="$4" scratch="$5" command="$6"
    local LC_ALL=C pre_cwd base r d t start_t count=0
    local slow="$output_dir/.files_written.slow_roots"
    local -a roots=() shallow=()
    pre_cwd=$(head -n 1 "$start")
    for r in "$pre_cwd" "$post_cwd" "$scratch"; do
        [ -n "$r" ] && [ "$r" != "/" ] && [ -d "$r" ] || continue
        [ "${#roots[@]}" -gt 0 ] && _claude_path_under "$r" "${roots[@]}" && continue
        roots+=("$r")
    done
    base="${pre_cwd:-$post_cwd}"
    while IFS= read -r t; do
        [ "$count" -lt 12 ] || break
        case "$t" in
            '~/'*) t="$HOME/${t#\~/}" ;;
            /*) ;;
            *) [ -n "$base" ] || continue; t="$base/$t" ;;
        esac
        if [ -d "$t" ]; then d="$t"; else d="${t%/*}"; fi
        [ -n "$d" ] && [ -d "$d" ] || continue
        d=$(cd "$d" 2>/dev/null && pwd) || continue
        case "$d" in /|/dev|/dev/*|/proc|/proc/*|/sys|/sys/*|/run|/run/*) continue ;; esac
        [ "${#roots[@]}" -gt 0 ] && _claude_path_under "$d" "${roots[@]}" && continue
        printf '%s\n' "${shallow[@]}" | grep -qxF -- "$d" && continue
        shallow+=("$d"); count=$((count + 1))
    done < <(printf '%s\n' "$command" | tr -s "[:space:];|&<>()=\`\"'{}," '\n' \
        | grep '/' | grep -v '[$*?]' | head -n 200)

    start_t=$(find "$start" -maxdepth 0 -printf '%T@' 2>/dev/null)
    [ -n "$start_t" ] || return 0
    {
        for r in "${roots[@]}"; do
            if grep -qxF -- "$r" "$slow" 2>/dev/null; then
                _claude_files_written_scan_dir "$r" 3 "$start" "$end" "$output_dir"
            else
                _claude_files_written_scan_dir "$r" "" "$start" "$end" "$output_dir"
                [ $? -eq 124 ] && printf '%s\n' "$r" >> "$slow"
            fi
        done
        for d in "${shallow[@]}"; do
            _claude_files_written_scan_dir "$d" 1 "$start" "$end" "$output_dir"
        done
    } | head -z -n 1000 | while IFS= read -r -d '' t; do
        local mt="${t%% *}" p="${t#* }" born kind
        if [[ "$mt" > "$start_t" ]]; then
            born=$(stat -c %W "$p" 2>/dev/null)
            case "$born" in ''|*[!0-9]*) born=0 ;; esac
            if [ "$born" -gt 0 ] && [ "$born" -ge "${start_t%%.*}" ]; then kind=created; else kind=changed; fi
        else
            kind=moved
        fi
        printf '%s %s\0' "$kind" "$p"
    done | sort -zu
}

# Copy one file to written/<its absolute path>, sanitized, and append its line
# to _claude_files_written.jsonl. A text file up to CLAUDE_WRITTEN_MAX_BYTES is
# copied, CLAUDE_WRITTEN_MAX_FILES per call. When the last copy of that path
# holds other content, and is not the start of the new content (a log that only
# grew), it is kept beside it as <name>.~N~.
claude_files_written_keep() {
    local output_dir="$1" path="$2" kind="$3" n="$4" tool_use_id="$5" tool_name="$6" agent_id="$7" command="$8" prompt_id="${9:-}"
    local size sha="" copy="" note="" dest tmp v
    size=$(_claude_byte_count "$path")
    if [ "$size" -le 16777216 ] && command -v sha256sum >/dev/null 2>&1; then
        sha=$(sha256sum < "$path" 2>/dev/null | cut -d' ' -f1)
    fi
    if [ "$n" -gt "$CLAUDE_WRITTEN_MAX_FILES" ]; then
        note="not copied: more than $CLAUDE_WRITTEN_MAX_FILES files in one call"
    elif [ "$size" -gt "$CLAUDE_WRITTEN_MAX_BYTES" ]; then
        note="not copied: larger than $CLAUDE_WRITTEN_MAX_BYTES bytes"
    elif [ "$size" -gt 0 ] && ! LC_ALL=C grep -Iq '' "$path" 2>/dev/null; then
        note="not copied: binary"
    else
        dest="$output_dir/written/${path#/}"
        tmp="$dest.tmp.$$"
        if mkdir -p "$(dirname "$dest")" 2>/dev/null && hook_secret_sanitize_stream < "$path" > "$tmp" 2>/dev/null; then
            copy="written/${path#/}"
            if [ -f "$dest" ] && cmp -s "$tmp" "$dest"; then
                rm -f "$tmp"
                note="same as the last copy"
            else
                if [ -s "$dest" ] && ! cmp -s -n "$(_claude_byte_count "$dest")" "$dest" "$tmp"; then
                    v=1
                    while [ -e "$dest.~$v~" ]; do v=$((v + 1)); done
                    mv -f "$dest" "$dest.~$v~"
                    note="the last copy is kept as ${dest##*/}.~$v~"
                fi
                mv -f "$tmp" "$dest"
            fi
        else
            rm -f "$tmp"
            note="not copied: the copy failed"
        fi
    fi
    claude_write_jsonl "$output_dir/_claude_files_written.jsonl" "$(jq -nc \
        --arg session_id "$(basename "$output_dir")" --arg tool_use_id "$tool_use_id" \
        --arg tool_name "$tool_name" --arg agent_id "$agent_id" --arg prompt_id "$prompt_id" --arg kind "$kind" \
        --arg path "$path" --argjson size "${size:-0}" --arg sha256 "$sha" --arg copy "$copy" \
        --arg note "$note" --arg command "${command:0:240}" \
        '{timestamp: (now | todate), $session_id, $tool_use_id, $tool_name,
          agent_id: (if $agent_id == "" then null else $agent_id end),
          prompt_id: (if $prompt_id == "" then null else $prompt_id end), $kind, $path, $size,
          sha256: (if $sha256 == "" then null else $sha256 end),
          copy: (if $copy == "" then null else $copy end),
          note: (if $note == "" then null else $note end),
          command: (if $command == "" then null else $command end)}')"
    [ -n "$copy" ] && [ "${note#not copied}" = "$note" ]
}

# files_written.sh: find and copy what one tool call wrote, then drop its marks.
claude_files_written_capture() {
    local output_dir="$1" tool_use_id="$2"
    local marks="$output_dir/.tool_marks"
    local job="$marks/$tool_use_id.job" start="$marks/$tool_use_id.start" end="$marks/$tool_use_id.end"
    local found="$marks/$tool_use_id.found"
    local tool_name="" agent_id="" prompt_id="" cwd="" scratchpad_dir="" command="" file_path="" write_type=""
    local rec kind path n=0 copied=0
    [ -f "$job" ] || return 0
    eval "$(jq -r '@sh "tool_name=\(.tool_name // "") agent_id=\(.agent_id // "") prompt_id=\(.prompt_id // "") cwd=\(.cwd // "") scratchpad_dir=\(.scratchpad_dir // "") command=\(.command // "") file_path=\(.file_path // "") write_type=\(.write_type // "")"' "$job" 2>/dev/null)"
    : > "$found"
    if claude_files_written_direct "$tool_name"; then
        case "$file_path" in /*) ;; ?*) file_path="$cwd/$file_path" ;; esac
        if [ -n "$file_path" ] && [ -f "$file_path" ]; then
            case "$write_type" in create) kind=created ;; *) kind=changed ;; esac
            printf '%s %s\0' "$kind" "$file_path" > "$found"
        fi
    elif [ -f "$start" ] && [ -f "$end" ]; then
        claude_files_written_find "$output_dir" "$start" "$end" "$cwd" "$scratchpad_dir" "$command" > "$found"
    fi
    while IFS= read -r -d '' rec; do
        n=$((n + 1))
        if [ "$n" -gt "$CLAUDE_WRITTEN_MAX_LINES" ]; then
            claude_write_jsonl "$output_dir/_claude_files_written.jsonl" "$(jq -nc \
                --arg session_id "$(basename "$output_dir")" --arg tool_use_id "$tool_use_id" \
                --arg tool_name "$tool_name" --arg note "more files changed during this call are not listed" \
                '{timestamp: (now | todate), $session_id, $tool_use_id, $tool_name, $note}')"
            break
        fi
        kind="${rec%% *}"; path="${rec#* }"
        claude_files_written_keep "$output_dir" "$path" "$kind" "$n" "$tool_use_id" "$tool_name" "$agent_id" "$command" "$prompt_id" \
            && copied=$((copied + 1))
    done < "$found"
    if [ "$n" -gt 0 ]; then
        echo "Saved $copied of $n file(s) written by $tool_name ($tool_use_id) under $output_dir/written" >> "$output_dir/trace.log"
    fi
    rm -f "$job" "$start" "$end" "$found"
    # Marks left by a call that never ended (denied, interrupted, the session killed).
    find "$marks" -type f -mmin +1440 -delete 2>/dev/null
    return 0
}
