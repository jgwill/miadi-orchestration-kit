#!/usr/bin/env bash
# UserPromptSubmit. A session that opted in (MIADI_SESSION_ISSUE at launch, or /session-issue)
# gets one GitHub issue, opened at its first prompt. Claude Code adds this hook's stdout to the
# conversation, so it prints nothing, except its answer to /session-issue. Exits 0 on every path.
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

if [ "${1:-}" = "--job" ]; then  # the detached job: --job <dir> <session_id> <repo>
    si_open "$2" "$3" "$4" "${SI_PROMPT:-}" "${SI_PROMPT_REST:-0}" "${SI_CWD:-}" "the first prompt" || true
    si_unlock "$2"
    exit 0
fi

input=$(cat)
# Cheap checks first: a session that did not opt in costs no jq and no file read but one stat.
[[ $input =~ \"session_id\":\"([A-Za-z0-9_-]+)\" ]] || exit 0
sid=${BASH_REMATCH[1]}
dir="$SI_SESSIONDATA_ROOT/$sid"
command=""
[[ $input == *'"prompt":"'*session-issue* ]] && command=maybe
if [ -z "$command" ]; then
    [ -n "${MIADI_SESSION_ISSUE:-}" ] || [ -f "$dir/.issue_optin" ] || exit 0
    if [ -s "$dir/.issue_created" ] || [ -f "$dir/.issue_skipped" ]; then exit 0; fi
fi

fields=$(printf '%s' "$input" | jq -c '{p: ((.prompt // "")[0:8000]), rest: (((.prompt // "") | length) - 8000),
    cwd: (.cwd // ""), tp: (.transcript_path // "")}' 2>/dev/null) || exit 0
prompt=$(jq -r '.p' <<< "$fields")
rest=$(jq -r '.rest' <<< "$fields")
cwd=$(jq -r '.cwd' <<< "$fields")
tp=$(jq -r '.tp' <<< "$fields")

# The answer, then what to do with it, so the model needs nothing else: a bare /session-issue
# that Claude Code does not resolve to the command still reaches this hook (claude -p, 2.1.299).
say() {
    printf 'miadi-session-issue: %s\n' "$1"
    printf 'miadi-session-issue: the hook has done all of it. Tell the user the line above in one line, and run nothing for it.\n'
}

# /session-issue [owner/repo]: opt this session in now. Runs while the prompt waits, so its
# answer reaches the conversation.
session_issue_command() {
    local arg repo first p r
    arg=$(printf '%s' "$prompt" | sed -E 's#^[[:space:]]*/(miadi-session-issue:)?session-issue[[:space:]]*##' | awk '{print $1; exit}')
    mkdir -p "$dir"
    if [ -s "$dir/.issue_created" ]; then
        say "this session's issue is $(head -n 1 "$dir/.issue_created"). Each /exit adds a comment to it."
        return
    fi
    if si_locked "$dir"; then
        say "this session's issue is being opened now. Run /session-issue again in a moment for its link."
        return
    fi
    if ! repo=$(si_repo "$arg"); then
        say "no repository is named. Run /session-issue owner/repo, or set MIADI_CHRONICLE_SESSION_REPO."
        return
    fi
    rm -f "$dir/.issue_skipped" "$dir/.issue_attempts"
    first=$(si_first_prompt "$dir" "$tp")
    if [ -z "$first" ]; then
        printf '%s\n' "$repo" > "$dir/.issue_optin"
        si_trace "$dir" "Session issue opted in by /session-issue: the next prompt opens it in $repo"
        say "this session has no prompt yet. Its next prompt opens the issue in $repo."
        return
    fi
    p=$(jq -r '.[0:8000]' <<< "$first")
    r=$(jq -r 'length - 8000' <<< "$first")
    si_lock "$dir" || { say "this session's issue is being opened now. Run /session-issue again in a moment for its link."; return; }
    si_open "$dir" "$sid" "$repo" "$p" "$r" "$cwd" "/session-issue"
    case $? in
        0) say "opened $SI_URL in $repo, from the session's first prompt. Each /exit adds a comment to it." ;;
        2) say "refused: $SI_ERROR. Session issues go only to a private repository." ;;
        *) say "could not open the issue in $repo: $SI_ERROR" ;;
    esac
    si_unlock "$dir"
}

if [ -n "$command" ]; then
    if [[ $prompt =~ $SI_COMMAND_RE ]]; then
        session_issue_command
        exit 0
    fi
    [ -n "${MIADI_SESSION_ISSUE:-}" ] || [ -f "$dir/.issue_optin" ] || exit 0
    if [ -s "$dir/.issue_created" ] || [ -f "$dir/.issue_skipped" ]; then exit 0; fi
fi

[[ $prompt =~ [^[:space:]] ]] || exit 0
mkdir -p "$dir"
if ! repo=$(si_repo "$(head -n 1 "$dir/.issue_optin" 2>/dev/null)"); then
    printf 'no repository\n' > "$dir/.issue_skipped"
    si_trace "$dir" "Session issue skipped: no repository (MIADI_SESSION_ISSUE, MIADI_SESSION_ISSUE_REPO, MIADI_CHRONICLE_SESSION_REPO)"
    exit 0
fi
# A session asked by /session-issue is never headless for this rule: someone asked.
if [ ! -f "$dir/.issue_optin" ] && [ "${MIADI_SESSION_ISSUE_HEADLESS:-}" != "1" ] && si_headless; then
    printf 'headless\n' > "$dir/.issue_skipped"
    si_trace "$dir" "Session issue skipped: headless"
    exit 0
fi
si_lock "$dir" || exit 0
SI_PROMPT="$prompt" SI_PROMPT_REST="$rest" SI_CWD="$cwd" \
    si_detach bash "${BASH_SOURCE[0]}" --job "$dir" "$sid" "$repo"
exit 0
