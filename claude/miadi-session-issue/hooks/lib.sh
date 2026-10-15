#!/usr/bin/env bash
# miadi-session-issue: the functions both hooks share. Specified in
# rispecs/chronicle-github-sessions-observability/03-specify.md (jgwill/miadi-orchestration-kit#89).

_SI_HOOKS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=secret_capture_sanitizer.sh
. "$_SI_HOOKS/secret_capture_sanitizer.sh"

# The session folder root. The first four names are the capture plugin's chain
# (miadi-session-observability lib.sh), so both plugins use one folder per session and the
# exit comment can read what the capture wrote. Without any of them the state goes to the
# plugin's data folder, which survives plugin updates.
if [ -z "${SI_SESSIONDATA_ROOT:-}" ]; then
    SI_SESSIONDATA_ROOT="${CLAUDE_SESSIONDATA_ROOT:-${MIADI_SESSION_DIR:-${MIADI_SESSIONDATA_ROOT:-${SESSION_DATA_ROOT:-}}}}"
    if [ -z "$SI_SESSIONDATA_ROOT" ]; then
        if [ -d "/src/_sessiondata" ]; then
            SI_SESSIONDATA_ROOT="/src/_sessiondata"
        elif [ -n "${CLAUDE_PLUGIN_DATA:-}" ]; then
            SI_SESSIONDATA_ROOT="$CLAUDE_PLUGIN_DATA/sessions"
        else
            SI_SESSIONDATA_ROOT="$HOME/.claude/miadi-session-issue/sessions"
        fi
    fi
fi

# The prompt that is the /session-issue command, typed bare or with the plugin's name.
SI_COMMAND_RE='^[[:space:]]*/(miadi-session-issue:)?session-issue([[:space:]]|$)'

si_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

si_lines() {  # <file>: its line count, 0 when it does not exist
    if [ -f "$1" ]; then wc -l < "$1" | tr -d ' '; else echo 0; fi
}

si_trace() {  # <dir> <message>
    printf '%s at %s\n' "$2" "$(si_now)" >> "$1/trace.log"
}

# Run a command detached from Claude Code: the hook returns at once, and the command
# survives Claude Code killing its hooks on exit.
si_detach() {
    if command -v setsid >/dev/null 2>&1; then
        setsid "$@" </dev/null >/dev/null 2>&1 &
    else
        nohup "$@" </dev/null >/dev/null 2>&1 &
    fi
}

# mkdir is atomic on every host, Termux included. A lock older than 120 s is stale.
si_lock() {  # <dir>
    mkdir "$1/.issue_lock" 2>/dev/null && return 0
    local made
    made=$(stat -c %Y "$1/.issue_lock" 2>/dev/null) || return 1
    [ $(( $(date +%s) - made )) -gt 120 ] || return 1
    rmdir "$1/.issue_lock" 2>/dev/null
    mkdir "$1/.issue_lock" 2>/dev/null
}

si_unlock() { rmdir "$1/.issue_lock" 2>/dev/null || true; }

si_locked() {  # <dir>: a job holds the lock and it is not stale
    local made
    made=$(stat -c %Y "$1/.issue_lock" 2>/dev/null) || return 1
    [ $(( $(date +%s) - made )) -le 120 ]
}

# The repository: the /session-issue argument, else MIADI_SESSION_ISSUE when it names one,
# else the host's session repository (MIADI_SESSION_ISSUE_REPO, then MIADI_CHRONICLE_SESSION_REPO).
si_repo() {  # [explicit]
    local re='^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' c
    for c in "${1:-}" "${MIADI_SESSION_ISSUE:-}" "${MIADI_SESSION_ISSUE_REPO:-}" "${MIADI_CHRONICLE_SESSION_REPO:-}"; do
        if [[ $c =~ $re ]]; then printf '%s' "$c"; return 0; fi
    done
    return 1
}

# Headless: claude -p, and every step a decomposition starts. Claude Code says so in
# CLAUDE_CODE_SESSION_ATTENDED. Without it, an interactive session is the one that
# registered ~/.claude/sessions/<pid>.json with kind "interactive".
si_headless() {
    case "${CLAUDE_CODE_SESSION_ATTENDED:-}" in
        0) return 0 ;;
        1) return 1 ;;
    esac
    [ -n "${CLAUDE_PID:-}" ] && [ -f "$HOME/.claude/sessions/$CLAUDE_PID.json" ] \
        && [ "$(jq -r '.kind // ""' "$HOME/.claude/sessions/$CLAUDE_PID.json" 2>/dev/null)" = "interactive" ] \
        && return 1
    return 0
}

si_publication() {  # <dir> <kind> <action> <url> <repo>
    local line
    line=$(jq -nc --arg sid "$(basename "$1")" --arg kind "$2" --arg action "$3" --arg url "$4" --arg repo "$5" \
        '{timestamp: (now | todate), session_id: $sid, kind: $kind, action: $action, url: $url, repo: $repo,
          number: (($url | capture("/issues/(?<n>[0-9]+)").n | tonumber) // null), by: "hook"}') || return 0
    if command -v flock >/dev/null 2>&1; then
        ( flock -w 30 9 || exit 0; printf '%s\n' "$line" >> "$1/_claude_publications.jsonl" ) 9>"$1/.publications.lock"
    else
        printf '%s\n' "$line" >> "$1/_claude_publications.jsonl"
    fi
}

# The session's first prompt that is not /session-issue, as a JSON string: from the
# capture plugin's _claude_user_inputs.jsonl, else from the start of the transcript.
si_first_prompt() {  # <dir> <transcript>
    local p=""
    if [ -s "$1/_claude_user_inputs.jsonl" ]; then
        p=$(jq -Rcn --arg re "$SI_COMMAND_RE" \
            'first(inputs | fromjson? | .prompt? | strings | select(test("\\S")) | select(test($re) | not)) // empty' \
            "$1/_claude_user_inputs.jsonl" 2>/dev/null)
    fi
    if [ -z "$p" ] && [ -f "${2:-}" ]; then
        p=$(head -c 4000000 "$2" | jq -Rcn --arg re "$SI_COMMAND_RE" '
            first(inputs | fromjson?
              | select(.type == "user" and (.isMeta | not) and (.isCompactSummary | not))
              | .message.content
              | if type == "string" then . elif type == "array" then (map(select(.type == "text") | .text) | join("\n")) else "" end
              | select(test("\\S"))
              | select(test("^\\s*<(command-|local-command|bash-|system-reminder)") | not)
              | select(test($re) | not)) // empty' 2>/dev/null)
    fi
    printf '%s' "$p"
}

# Session <id8>: <first line>, cut at 80 characters (jq counts characters, not bytes).
si_title() {  # <session_id> <sanitized prompt>
    jq -rn --arg id8 "${1:0:8}" --arg p "$2" '
        ($p | split("\n") | map(gsub("\\s+"; " ") | sub("^ "; "") | sub(" $"; "")) | map(select(length > 0))) as $lines
        | ($lines[0] // "") as $first
        | ($first[0:80]) as $t
        | "Session \($id8): \($t)" + (if $t == $first and ($lines | length) <= 1 then "" else "..." end)'
}

si_fence() {  # <text>: one backtick more than its longest run, at least three
    jq -rn --arg p "$1" '([$p | scan("`+") | length] | max // 0) as $m | "`" * ([$m + 1, 3] | max)'
}

# The binding line's pane, team and episode, as body lines. Nothing when there is none.
si_binding_lines() {  # <dir>
    [ -s "$1/_terminal_binding.jsonl" ] || return 0
    tail -n 1 "$1/_terminal_binding.jsonl" | jq -r '
        (if .tmux.session then "- **Pane**: \(.tmux.session):\(.tmux.window).\(.tmux.pane)" else empty end),
        (if ((.team.id // "unassigned") != "unassigned") then "- **Team**: \(.team.id)" else empty end),
        ((.episode.id // empty) as $e
         | (($e | capture("-episode-(?<n>[0-9]+)").n) // null) as $n
         | "- **Episode**: " + (if $n then "miadi-chronicle://\($n) (`\($e)`)" else "`\($e)`" end))' 2>/dev/null
}

si_fail() {  # <dir> <first line of the failure>
    local n
    n=$(( $(cat "$1/.issue_attempts" 2>/dev/null || echo 0) + 1 ))
    printf '%s\n' "$n" > "$1/.issue_attempts"
    si_trace "$1" "Issue creation failed: $2"
    SI_ERROR=$2
    [ "$n" -lt 3 ] || printf 'attempts\n' > "$1/.issue_skipped"
}

# Open the session's issue. Returns 0 with SI_URL, 1 on a failed attempt, 2 when the
# repository is refused, with SI_ERROR. The caller holds the lock.
si_open() {  # <dir> <session_id> <repo> <prompt> <characters cut> <cwd> <opened by>
    local dir=$1 sid=$2 repo=$3 prompt=$4 rest=$5 cwd=$6 how=$7 vis out url clean title fence body host
    SI_URL="" SI_ERROR=""
    mkdir -p "$dir"
    if ! vis=$(gh repo view "$repo" --json visibility -q .visibility 2>&1); then
        si_fail "$dir" "$(head -n 1 <<< "$vis")"
        return 1
    fi
    case "$vis" in
        PRIVATE|INTERNAL) ;;
        PUBLIC)
            printf 'public %s\n' "$repo" > "$dir/.issue_skipped"
            si_trace "$dir" "Session issue refused: $repo is public"
            SI_ERROR="$repo is public"
            return 2 ;;
        *)
            printf 'visibility %s\n' "$repo" > "$dir/.issue_skipped"
            si_trace "$dir" "Session issue refused: $repo has visibility '$(head -n 1 <<< "$vis")'"
            SI_ERROR="$repo is not known to be private"
            return 2 ;;
    esac
    clean=$(hook_secret_sanitize_text "$prompt")
    title=$(si_title "$sid" "$clean")
    fence=$(si_fence "$clean")
    body="$dir/_session_issue_body.md"
    {
        printf '## Session\n\n'
        printf -- '- **ID**: `%s`\n' "$sid"
        printf -- '- **Opened**: %s, by %s\n' "$(si_now)" "$how"
        printf -- '- **CWD**: %s\n' "$cwd"
        host=$(hostname -s 2>/dev/null || uname -n)
        [ "$host" = "localhost" ] || printf -- '- **Host**: %s\n' "$host"  # Android names every phone localhost
        si_binding_lines "$dir"
        printf '\n## First Prompt\n\n%s\n%s\n%s\n' "$fence" "$clean" "$fence"
        [ "${rest:-0}" -le 0 ] || printf '\n(truncated: %s more characters in the session'"'"'s capture)\n' "$rest"
    } > "$body"
    if ! out=$(gh issue create --repo "$repo" --title "$title" --body-file "$body" 2>&1); then
        si_fail "$dir" "$(head -n 1 <<< "$out")"
        return 1
    fi
    url=$(printf '%s\n' "$out" | grep -E '^https://github\.com/[^/]+/[^/]+/issues/[0-9]+$' | tail -n 1)
    if [ -z "$url" ]; then
        si_fail "$dir" "no issue URL in: $(head -n 1 <<< "$out")"
        return 1
    fi
    printf '%s\n' "$url" > "$dir/.issue_created"
    rm -f "$dir/.issue_attempts" "$dir/.issue_optin"
    si_trace "$dir" "Issue created: $url"
    si_publication "$dir" issue "session issue" "$url" "$repo"
    SI_URL=$url
    return 0
}

# The session's last answer: the capture's last_claude_AssistantResponse.json, else the
# last assistant text in the final 2 MB of the transcript. The whole transcript is never read.
si_last_answer() {  # <dir> <session_id> <transcript>
    local f="$1/last_claude_AssistantResponse.json" a=""
    if [ -s "$f" ]; then
        a=$(jq -r --arg sid "$2" 'select((.session_id // $sid) == $sid) | .last_assistant_message // empty | strings' "$f" 2>/dev/null)
    fi
    if [ -z "$a" ] && [ -f "${3:-}" ]; then
        a=$(tail -c 2000000 "$3" | jq -Rrn '[inputs | fromjson? | select(.type == "assistant")
            | (.message.content | if type == "array" then (map(select(.type == "text") | .text) | join("\n"))
                                  elif type == "string" then . else "" end)
            | select(test("\\S"))] | last // empty' 2>/dev/null)
    fi
    printf '%s' "$a"
}

# The detached job of SessionEnd: one comment, what the session did since the last one.
si_comment() {  # <dir> <session_id> <reason> <transcript>
    local dir=$1 sid=$2 reason=$3 tp=$4 url repo total offset answer file out curl waited=0
    sleep "${MIADI_SESSION_ISSUE_SETTLE:-2}"
    # An exit soon after the first prompt finds the opener still at work: wait for its issue.
    while si_locked "$dir" && [ "$waited" -lt 60 ]; do sleep 1; waited=$((waited + 1)); done
    url=$(head -n 1 "$dir/.issue_created" 2>/dev/null)
    [ -n "$url" ] || return 0
    repo=$(printf '%s' "$url" | sed -E 's#^https://github\.com/([^/]+/[^/]+)/.*#\1#')
    [ "$reason" = "prompt_input_exit" ] && reason="/exit"
    offset=$(cat "$dir/.issue_comment_offset" 2>/dev/null || echo 0)
    case "$offset" in ''|*[!0-9]*) offset=0 ;; esac
    total=$(si_lines "$dir/_claude_publications.jsonl")
    answer=$(si_last_answer "$dir" "$sid" "$tp")
    if [ -n "$answer" ]; then
        answer=$(hook_secret_sanitize_text "$answer")
        answer=$(jq -rn --arg a "$answer" 'if ($a | length) > 3000 then $a[0:3000] + "\n\n_(truncated)_" else $a end')
    else
        answer="_(no final message captured)_"
    fi
    file="$dir/_session_end_comment.md"
    {
        printf '## Session End\n\n**Reason**: %s · **Ended**: %s\n' "$reason" "$(si_now)"
        if [ -f "$dir/_claude_user_inputs.jsonl" ]; then
            printf '\n### Summary\n\n| Metric | Count |\n|--------|-------|\n'
            printf '| User prompts | %s |\n' "$(si_lines "$dir/_claude_user_inputs.jsonl")"
            printf '| Tool uses | %s |\n' "$(si_lines "$dir/_claude_PostToolUse.jsonl")"
            printf '| Files touched | %s |\n' "$(jq -r '.path // empty' "$dir/_claude_files_written.jsonl" 2>/dev/null | sort -u | wc -l | tr -d ' ')"
            printf '| Published | %s |\n' "$(jq -c 'select(.by != "hook")' "$dir/_claude_publications.jsonl" 2>/dev/null | wc -l | tr -d ' ')"
        fi
        if [ "$total" -gt "$offset" ]; then
            sed -n "$((offset + 1)),${total}p" "$dir/_claude_publications.jsonl" | jq -rn '
                [inputs | select(.by != "hook")
                 | if .kind == "commit" then "- commit `\((.sha // "")[0:7])` \(.subject // "") · \(.repo // "")"
                   elif .kind == "push" then "- push \(.repo // .remote // "") `\(.branch // "")`"
                   elif .kind == "npm" then "- npm \(.package)@\(.version)"
                   elif (.kind | startswith("artifact")) then "- \(.kind) \(.title // "") \(.url // "")"
                   else "- \(.kind) \(.url // "")" end] as $l
                | if ($l | length) == 0 then empty
                  else "\n### Published since the previous comment\n", ($l[0:30][]),
                       (if ($l | length) > 30 then "- and \(($l | length) - 30) more" else empty end) end' 2>/dev/null
        fi
        printf '\n### Last Agent Response\n\n%s\n' "$answer"
    } > "$file"
    if out=$(gh issue comment "$url" --body-file "$file" 2>&1); then
        curl=$(printf '%s\n' "$out" | grep -E '^https://github\.com/.+#issuecomment-[0-9]+$' | tail -n 1)
        si_trace "$dir" "Session end comment posted to $url"
        si_publication "$dir" issue-comment "session end" "${curl:-$url}" "$repo"
        printf '%s\n' "$total" > "$dir/.issue_comment_offset"
    else
        si_trace "$dir" "Session end comment failed: $(head -n 1 <<< "$out")"
    fi
}
