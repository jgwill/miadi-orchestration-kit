# Ported capture helpers from Claude miadi-session-observability 0.1.18; see README provenance.
#!/usr/bin/env bash

_CODEX_HOOKS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../secret_capture_sanitizer.sh
. "$_CODEX_HOOKS_ROOT/secret_capture_sanitizer.sh"

# Portable capture-output root — one source of truth for every codex hook.
# Honors the shared env alias set by etc/bash_env_common (MIADI_SESSION_DIR ->
# MIADI_SESSIONDATA_ROOT -> SESSION_DATA_ROOT). With no env loaded it falls back to
# /src/_sessiondata on hosts that have /src (servers; /src -> /a/src on Eury), else the
# plugin writable data (or a directory in CODEX_HOME when run directly).
if [ -z "${CODEX_SESSIONDATA_ROOT:-}" ]; then
    CODEX_SESSIONDATA_ROOT="${MIADI_SESSION_DIR:-${MIADI_SESSIONDATA_ROOT:-${SESSION_DATA_ROOT:-}}}"
    if [ -z "$CODEX_SESSIONDATA_ROOT" ]; then
        if [ -d "/src/_sessiondata" ]; then
            CODEX_SESSIONDATA_ROOT="/src/_sessiondata"
        else
            CODEX_SESSIONDATA_ROOT="${PLUGIN_DATA:-${CODEX_HOME:-$HOME/.codex}/miadi-session-observability}/_sessiondata"
        fi
    fi
fi
export CODEX_SESSIONDATA_ROOT

codex_write_jsonl() {
    local file="$1"
    local text="$2"
    hook_secret_write_line "$file" "$text"
}

codex_write_json() {
    local file="$1"
    local text="$2"
    hook_secret_overwrite_line "$file" "$text"
}

# Atomic: sanitize into a temp file beside dest, then rename over it. Claude
# Code kills hooks on exit; writing dest in place left 0-byte transcript
# copies. The rename also replaces a symlink at dest instead of writing
# through it into its target.
codex_sanitize_file_to() {
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

codex_sanitize_text() {
    hook_secret_sanitize_text "$1"
}

# Archive traversal and incremental copies are in native.py.

# Run a command detached from Codex: the hook returns at once, and the
# command survives Codex cancelling its hooks on exit.
codex_detach() {
    if command -v setsid >/dev/null 2>&1; then
        setsid "$@" </dev/null >/dev/null 2>&1 &
    else
        nohup "$@" </dev/null >/dev/null 2>&1 &
    fi
}

# Run the rest of the arguments holding an exclusive lock on <lockfile>, so a
# Stop, a SubagentStop, a SessionEnd and a sweep never write one copy at once.
# Without flock (Termux) the command runs unlocked.
codex_with_lock() {
    local lock="$1"; shift
    if command -v flock >/dev/null 2>&1; then
        ( flock -w 900 9 || exit 0; "$@" ) 9>"$lock"
    else
        "$@"
    fi
}

_codex_byte_count() {
    local n
    n=$(wc -c 2>/dev/null < "$1") || n=0
    echo "${n//[[:space:]]/}"
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
# _codex_files_written.jsonl naming the tool call that touched it and the
# prompt it answered (prompt_id).

CODEX_WRITTEN_MAX_BYTES="${CODEX_WRITTEN_MAX_BYTES:-524288}"
CODEX_WRITTEN_MAX_FILES="${CODEX_WRITTEN_MAX_FILES:-40}"
CODEX_WRITTEN_MAX_LINES="${CODEX_WRITTEN_MAX_LINES:-200}"
CODEX_WRITTEN_SCAN_SECONDS="${CODEX_WRITTEN_SCAN_SECONDS:-5}"

# Tools whose input names no path: what they wrote is found by scanning.
codex_files_written_scans() {
    case "$1" in Bash|mcp__*) return 0 ;; esac
    return 1
}

# Tools whose input names the one file they write.
codex_files_written_direct() {
    case "$1" in Write|Edit|MultiEdit|NotebookEdit) return 0 ;; esac
    return 1
}

# PreToolUse: mark the start of a scanned call. The mark holds the cwd the
# call starts in.
codex_files_written_mark_start() {
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
codex_files_written_queue() {
    local output_dir="$1" input="$2" tool_name="$3" job tool_use_id marks
    codex_files_written_scans "$tool_name" || codex_files_written_direct "$tool_name" || return 0
    job=$(printf '%s' "$input" | jq -c '{tool_use_id, tool_name, agent_id: (.agent_id // null), prompt_id: (.prompt_id // null), cwd,
        scratchpad_dir: (.scratchpad_dir // null), command: (.tool_input.command // null),
        file_path: (.tool_input.file_path // .tool_input.notebook_path // null),
        write_type: ((.tool_response | objects | .type) // null)}' 2>/dev/null) || return 0
    [[ $job =~ ^\{\"tool_use_id\":\"([A-Za-z0-9_-]+)\" ]] || return 0
    tool_use_id="${BASH_REMATCH[1]}"
    marks="$output_dir/.tool_marks"
    if codex_files_written_scans "$tool_name"; then
        [ -f "$marks/$tool_use_id.start" ] || return 0
        : > "$marks/$tool_use_id.end"
    fi
    mkdir -p "$marks"
    hook_secret_sanitize_text "$job" > "$marks/$tool_use_id.job"
    codex_detach bash "$(dirname "${BASH_SOURCE[0]}")/files_written.sh" "$output_dir" "$tool_use_id"
}

# True when <path> is one of the <dir>s or inside one.
_codex_path_under() {
    local p="$1" d; shift
    for d in "$@"; do
        [ "$p" = "$d" ] && return 0
        case "$p" in "$d"/*) return 0 ;; esac
    done
    return 1
}

# Print "<mtime> <path>\0" for each file under <dir> whose inode changed after
# <start> was written and not after <end>, <maxdepth> levels deep (all when
# empty), for at most CODEX_WRITTEN_SCAN_SECONDS. Returns 124 when it ran out
# of time.
_codex_files_written_scan_dir() {
    local dir="$1" depth="$2" start="$3" end="$4" output_dir="$5"
    local -a cmd=(find -H "$dir" -mindepth 1)
    [ -n "$depth" ] && cmd+=(-maxdepth "$depth")
    cmd+=(-xdev \( -type d \( -name .git -o -name node_modules -o -name .next -o -name .nuxt
        -o -name .svelte-kit -o -name .venv -o -name venv -o -name __pycache__ -o -name .cache
        -o -name .turbo -o -name .pnpm-store -o -name .npm -o -name .yarn -o -name dist
        -o -name build -o -name target -o -name coverage -o -name _sessiondata
        -o -path "$output_dir" -o -path "$CODEX_SESSIONDATA_ROOT" -o -path "$HOME/.codex" \) -prune \)
        -o \( -type f -cnewer "$start" ! -cnewer "$end" -printf '%T@ %p\0' \))
    if command -v timeout >/dev/null 2>&1; then
        timeout "$CODEX_WRITTEN_SCAN_SECONDS" "${cmd[@]}" 2>/dev/null
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
codex_files_written_find() {
    local output_dir="$1" start="$2" end="$3" post_cwd="$4" scratch="$5" command="$6"
    local LC_ALL=C pre_cwd base r d t start_t count=0
    local slow="$output_dir/.files_written.slow_roots"
    local -a roots=() shallow=()
    pre_cwd=$(head -n 1 "$start")
    for r in "$pre_cwd" "$post_cwd" "$scratch"; do
        [ -n "$r" ] && [ "$r" != "/" ] && [ -d "$r" ] || continue
        [ "${#roots[@]}" -gt 0 ] && _codex_path_under "$r" "${roots[@]}" && continue
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
        [ "${#roots[@]}" -gt 0 ] && _codex_path_under "$d" "${roots[@]}" && continue
        printf '%s\n' "${shallow[@]}" | grep -qxF -- "$d" && continue
        shallow+=("$d"); count=$((count + 1))
    done < <(printf '%s\n' "$command" | tr -s "[:space:];|&<>()=\`\"'{}," '\n' \
        | grep '/' | grep -v '[$*?]' | head -n 200)

    start_t=$(find "$start" -maxdepth 0 -printf '%T@' 2>/dev/null)
    [ -n "$start_t" ] || return 0
    {
        for r in "${roots[@]}"; do
            if grep -qxF -- "$r" "$slow" 2>/dev/null; then
                _codex_files_written_scan_dir "$r" 3 "$start" "$end" "$output_dir"
            else
                _codex_files_written_scan_dir "$r" "" "$start" "$end" "$output_dir"
                [ $? -eq 124 ] && printf '%s\n' "$r" >> "$slow"
            fi
        done
        for d in "${shallow[@]}"; do
            _codex_files_written_scan_dir "$d" 1 "$start" "$end" "$output_dir"
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

# Files whose name says they hold credentials: .env files (not their .example),
# keys and certificates, .netrc, .pgpass, .npmrc, .pypirc, .git-credentials,
# cloud credentials and Terraform state. The sanitizer redacts known token shapes,
# not a password on a line of its own, so these are listed and never copied.
_codex_may_hold_credentials() {
    local path="$1" name="${1##*/}"
    case "$name" in
        *.example|*.sample|*.template|*.dist) return 1 ;;
        .env|.env.*|*.env|.netrc|_netrc|.pgpass|.npmrc|.pypirc|.git-credentials|.htpasswd \
            |*.pem|*.key|*.p12|*.pfx|*.jks|*.keystore|*.kdbx|*.ppk|*.asc|*.gpg \
            |id_rsa*|id_dsa*|id_ecdsa*|id_ed25519*|credentials|credentials.json|*credentials*.json \
            |service-account*.json|secrets.*|*.secret|*.secrets|*.tfvars|*.tfstate|*.tfstate.backup \
            |kubeconfig|.dockercfg|wp-config.php|rclone.conf|.my.cnf|.s3cfg) return 0 ;;
    esac
    case "$path" in
        */.docker/config.json|*/.kube/config|*/.aws/*|*/.ssh/*|*/.gnupg/*|*/.config/gcloud/*) return 0 ;;
    esac
    return 1
}

# Copy one file to written/<its absolute path>, sanitized, and append its line
# to _codex_files_written.jsonl. A text file up to CODEX_WRITTEN_MAX_BYTES is
# copied, CODEX_WRITTEN_MAX_FILES per call. When the last copy of that path
# holds other content, and is not the start of the new content (a log that only
# grew), it is kept beside it as <name>.~N~.
codex_files_written_keep() {
    local output_dir="$1" path="$2" kind="$3" n="$4" tool_use_id="$5" tool_name="$6" agent_id="$7" command="$8" prompt_id="${9:-}"
    local size sha="" copy="" note="" dest tmp v
    size=$(_codex_byte_count "$path")
    if _codex_may_hold_credentials "$path"; then
        note="not copied: its name says it may hold credentials"
    elif [ "$size" -le 16777216 ] && command -v sha256sum >/dev/null 2>&1; then
        sha=$(sha256sum < "$path" 2>/dev/null | cut -d' ' -f1)
    fi
    if [ -n "$note" ]; then
        :
    elif [ "$n" -gt "$CODEX_WRITTEN_MAX_FILES" ]; then
        note="not copied: more than $CODEX_WRITTEN_MAX_FILES files in one call"
    elif [ "$size" -gt "$CODEX_WRITTEN_MAX_BYTES" ]; then
        note="not copied: larger than $CODEX_WRITTEN_MAX_BYTES bytes"
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
                if [ -s "$dest" ] && ! cmp -s -n "$(_codex_byte_count "$dest")" "$dest" "$tmp"; then
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
    codex_write_jsonl "$output_dir/_codex_files_written.jsonl" "$(jq -nc \
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
codex_files_written_capture() {
    local output_dir="$1" tool_use_id="$2"
    local marks="$output_dir/.tool_marks"
    local job="$marks/$tool_use_id.job" start="$marks/$tool_use_id.start" end="$marks/$tool_use_id.end"
    local found="$marks/$tool_use_id.found"
    local tool_name="" agent_id="" prompt_id="" cwd="" scratchpad_dir="" command="" file_path="" write_type=""
    local rec kind path n=0 copied=0
    [ -f "$job" ] || return 0
    eval "$(jq -r '@sh "tool_name=\(.tool_name // "") agent_id=\(.agent_id // "") prompt_id=\(.prompt_id // "") cwd=\(.cwd // "") scratchpad_dir=\(.scratchpad_dir // "") command=\(.command // "") file_path=\(.file_path // "") write_type=\(.write_type // "")"' "$job" 2>/dev/null)"
    : > "$found"
    if codex_files_written_direct "$tool_name"; then
        case "$file_path" in /*) ;; ?*) file_path="$cwd/$file_path" ;; esac
        if [ -n "$file_path" ] && [ -f "$file_path" ]; then
            case "$write_type" in create) kind=created ;; *) kind=changed ;; esac
            printf '%s %s\0' "$kind" "$file_path" > "$found"
        fi
    elif [ -f "$start" ] && [ -f "$end" ]; then
        codex_files_written_find "$output_dir" "$start" "$end" "$cwd" "$scratchpad_dir" "$command" > "$found"
    fi
    while IFS= read -r -d '' rec; do
        n=$((n + 1))
        if [ "$n" -gt "$CODEX_WRITTEN_MAX_LINES" ]; then
            codex_write_jsonl "$output_dir/_codex_files_written.jsonl" "$(jq -nc \
                --arg session_id "$(basename "$output_dir")" --arg tool_use_id "$tool_use_id" \
                --arg tool_name "$tool_name" --arg note "more files changed during this call are not listed" \
                '{timestamp: (now | todate), $session_id, $tool_use_id, $tool_name, $note}')"
            break
        fi
        kind="${rec%% *}"; path="${rec#* }"
        codex_files_written_keep "$output_dir" "$path" "$kind" "$n" "$tool_use_id" "$tool_name" "$agent_id" "$command" "$prompt_id" \
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

# --- Publications -----------------------------------------------------------
# What a session put where other people can see it: an Artifact page, a GitHub
# issue, pull request, comment or release, a commit and its push, an npm
# release. Each one is a line in _codex_publications.jsonl naming the tool call
# and the prompt that produced it, so an observer finds what a prompt led to
# without reading the tool ledgers. Claude Code records commits, pushes and pull
# requests in tool_response.gitOperation (not a quiet `git commit -q`); the rest
# is read from the command and its output. A commit read from output must be in
# a tree the command worked in and made during the call.

# PostToolUse and PostToolUseFailure (a chain can publish, then fail): most calls
# publish nothing, so the first test is a match on the raw input. A call that may
# have published is projected, sanitized, and parsed by a detached publications.sh.
codex_publications_queue() {
    local output_dir="$1" input="$2" tool_name="$3" head job tool_use_id
    case "$tool_name" in
        Artifact)
            [[ $input == *'"url":"http'* ]] || return 0
            ;;
        Bash)
            # The raw input is JSON: a command's newline is the two characters \n.
            head="${input:0:65536}"
            [[ $input == *'"gitOperation"'* || $head =~ (^|[^A-Za-z]|\\[nt])gh\ (issue|pr|release|gist|api)\  \
                || $head =~ (npm|pnpm|yarn)\ publish || $head =~ git\ ([^\"]*\ )?(commit|push) \
                || $head =~ inquiry-weave\ (open|issue|inquire) ]] || return 0
            ;;
        *) return 0 ;;
    esac
    job=$(printf '%s' "$input" | jq -c --argjson queued_at "$(date +%s)" '{tool_use_id, tool_name,
        agent_id: (.agent_id // null), prompt_id: (.prompt_id // null), cwd,
        command: (.tool_input.command // null), action: (.tool_input.action // null),
        asset: (.tool_input.asset // false), duration_ms: (.duration_ms // null), queued_at: $queued_at,
        response: (if .tool_response == null then {out: ((.error // "") | tostring | .[0:65536])}
          else (.tool_response | if type == "object" then
            {url, path, artifact_id, title, updated, gitOperation,
             out: ([.stdout, .stderr] | map(strings) | join("\n") | .[0:65536])}
          else {out: (tostring | .[0:65536])} end) end)}' 2>/dev/null) || return 0
    [[ $job =~ ^\{\"tool_use_id\":\"([A-Za-z0-9_-]+)\" ]] || return 0
    tool_use_id="${BASH_REMATCH[1]}"
    mkdir -p "$output_dir/.tool_marks"
    hook_secret_sanitize_text "$job" > "$output_dir/.tool_marks/$tool_use_id.pub"
    codex_detach bash "$(dirname "${BASH_SOURCE[0]}")/publications.sh" "$output_dir" "$tool_use_id"
}

# One JSON object per publication the job holds, before the git checks.
#   gh: only a URL that ends its line (a gh write prints what it made on a line of
#       its own, and a batch prints it after a label), and only when the command ran
#       the gh write that makes that kind of URL.
#   commit: git's `[branch sha] subject`, else, after `git log` or `git show`, its
#       first `sha subject` line (source stdout-log, checked hardest by the caller).
#   push, npm: only when one push or publish in the command is not a --dry-run.
_CODEX_PUBLICATIONS_JQ='
def ghrepo: (capture("github\\.com[:/](?<r>[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+?)(\\.git)?(/|$)").r) // null;
def urlkind: if test("/(issues|pull)/[0-9]+#(issuecomment|discussion_r|pullrequestreview)")
    then (if test("/pull/") then "pr-comment" else "issue-comment" end)
  elif test("/issues/[0-9]+") then "issue" elif test("/pull/[0-9]+") then "pr"
  elif test("/releases/tag/") then "release" elif test("gist\\.github\\.com") then "gist"
  else "github" end;
def ghwrite($kind): {"issue-comment": "issue comment", "pr-comment": "pr (comment|review)",
    "issue": "issue (create|edit|reopen|transfer)", "pr": "pr (create|edit|ready|reopen|merge)",
    "release": "release (create|edit|upload)", "gist": "gist (create|edit)"}[$kind];
def gitsub($sub): "\\bgit(\\s+(-C\\s+\\S+|-c\\s+\\S+|--[A-Za-z-]+(=\\S+)?))*\\s+" + $sub + "\\b";
def number: (capture("/(issues|pull)/(?<n>[0-9]+)").n | tonumber) // null;
# The push or publish commands of a command line, each up to the next | ; & or newline.
def segments($re): [match($re + "[^|;&\n]*"; "g").string];
def real($segs): ($segs | length) > 0 and ($segs | any(test("--dry-run|\\s-n(\\s|$)") | not));
. as $j
| ($j.response.out // "") as $out
| ($j.command // "") as $cmd
| ($j.response.gitOperation // {}) as $op
| ($out | split("\n")) as $lines
| [
    (if $j.tool_name == "Artifact" and ($j.response.url | type) == "string"
        and (($j.action // "publish") == "publish")
     then {kind: (if $j.asset == true then "artifact-asset" else "artifact" end), source: "tool_response",
           url: $j.response.url, path: $j.response.path, title: $j.response.title,
           artifact_id: $j.response.artifact_id, updated: $j.response.updated}
     else empty end),
    ($op.commit // empty | {kind: "commit", sha, branch, commit_kind: .kind, source: "gitOperation"}),
    (if ($op.commit // null) == null and ($cmd | test(gitsub("commit"))) then
        ([$lines[] | capture("^\\[(?<branch>[^\\]\\s]+)( \\(root-commit\\))? (?<sha>[0-9a-f]{7,40})\\] (?<subject>.+)$")]) as $c
        | if ($c | length) > 0 then ($c[] | {kind: "commit", sha, branch, subject, source: "stdout"})
          elif ($out | test("nothing to commit|nothing added to commit|no changes added to commit")) then empty
          elif ($cmd | test(gitsub("(log|show)"))) then
            ([$lines[] | capture("^(?<sha>[0-9a-f]{7,12}) (?<subject>.+)$")][0] // empty
             | {kind: "commit", sha, branch: null, subject, source: "stdout-log"})
          else empty end
     else empty end),
    (($cmd | segments(gitsub("push"))) as $pushes
     | if real($pushes) or (($op.push // null) != null and (($pushes | length) == 0 or real($pushes))) then
        ([foreach $lines[] as $l ({remote: null, out: null};
            if ($l | test("^To ")) then {remote: ($l | sub("^To\\s+"; "")), out: null}
            else .out = ($l | capture("^\\s*[+*!=-]?\\s*(?<from>[0-9a-f]{7,40})\\.\\.\\.?(?<to>[0-9a-f]{7,40})\\s+(?<src>\\S+)\\s+->\\s+(?<dst>\\S+)")
                         // ($l | capture("^\\s*\\*\\s+\\[new (branch|tag)\\]\\s+(?<src>\\S+)\\s+->\\s+(?<dst>\\S+)"))
                         // null) end;
            if .out and .remote then .out + {remote: .remote} else empty end)]) as $p
        | if ($p | length) > 0 then
            ($p[] | {kind: "push", branch: .dst, remote, from: (.from // null), to: (.to // null),
                     repo: ((.remote // "") | ghrepo), source: (if $op.push then "gitOperation" else "stdout" end)})
          elif $op.push then {kind: "push", branch: $op.push.branch, remote: null, from: null, to: null, repo: null, source: "gitOperation"}
          else empty end
       else empty end),
    ($op.pr // empty | {kind: "pr", url, number, action, repo: ((.url // "") | ghrepo), source: "gitOperation"}),
    (if ($cmd | test("\\bgh\\s+((issue|pr)\\s+(create|comment|edit|reopen|transfer|merge|review|ready)|(release|gist)\\s+(create|edit|upload))\\b")) then
        $lines[]
        | (capture("(^|[\\s|=>:(\\[,])(?<u>https://(github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/((issues|pull)/[0-9]+(#(issuecomment-|discussion_r|pullrequestreview-)[0-9]+)?|releases/tag/[^\\s\"<>]+)|gist\\.github\\.com/[^\\s\"<>]+))\\s*$").u // empty)
        | . as $u | urlkind as $k
        | ([$cmd | match("\\bgh\\s+(" + ghwrite($k) + ")\\b"; "g") | .captures[0].string]) as $m
        | select(($m | length) > 0)
        | {kind: $k, url: $u, repo: ($u | ghrepo), number: ($u | number), action: ($m[0] | gsub("\\s+"; " ")), source: "stdout"}
     else empty end),
    (if ($cmd | test("\\bgh\\s+api\\b")) and ($cmd | test("(-X|--method)[\\s=]*GET\\b") | not)
        and ($cmd | test("(-X|--method)[\\s=]*(POST|PATCH|PUT)\\b|\\s-[fF]\\s|--(raw-)?field\\b|--input\\b")) then
        ($out | capture("\"html_url\"\\s*:\\s*\"(?<u>https://[^\"]+)\"").u // empty)
        | {kind: urlkind, url: ., repo: ghrepo, number: number, action: "api", source: "stdout"}
     else empty end),
    # inquiry-weave opens issues through its own gh call: `open` prints
    # `  inquiry:  owner/repo#N [created] …` and `  actions:  … [created]`, `inquire`
    # prints `  issue:    owner/repo#N [created]`, `issue create` prints `created: owner/repo#N`.
    (if ($cmd | test("\\binquiry-weave\\s+(open|issue|inquire)\\b")) and ($cmd | test("--dry-run") | not) then
        $lines[]
        | (capture("^\\s+(?<role>inquiry|actions|issue):\\s+(?<repo>[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)#(?<n>[0-9]+) \\[created\\]")
           // capture("^(?<role>created): (?<repo>[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)#(?<n>[0-9]+)$")
           // empty)
        | {kind: "issue", url: "https://github.com/\(.repo)/issues/\(.n)", repo, number: (.n | tonumber),
           action: ("inquiry-weave " + (if .role == "created" then "issue" else .role end)), source: "stdout"}
     else empty end),
    (if real($cmd | segments("\\b(npm|pnpm|yarn)\\s+publish\\b")) then
        ($lines[] | capture("^\\+ (?<package>@?[^@\\s]+)@(?<version>[0-9][^\\s]*)$") // empty
         | {kind: "npm", package, version, url: "https://www.npmjs.com/package/\(.package)/v/\(.version)", source: "stdout"})
     else empty end)
  ]
| unique_by([.kind, (.url // ""), (.sha // ""), (.branch // ""), (.to // "")])
| .[]
'

# The trees a command worked in, in order: each `git -C <dir>` and `cd <dir>`,
# then the cwd.
_codex_publication_dirs() {
    local command="$1" cwd="$2" d
    {
        printf '%s\n' "$command" | grep -oE '(git[[:space:]]+-C|(^|&&|;|\|\||\()[[:space:]]*cd)[[:space:]]+("[^"]+"|'"'"'[^'"'"']+'"'"'|[^[:space:];&|)]+)' \
            | sed -E 's/^.*(-C|cd)[[:space:]]+//; s/^["'"'"']//; s/["'"'"']$//'
        printf '%s\n' "$cwd"
    } | while IFS= read -r d; do
        case "$d" in /*) ;; '~/'*) d="$HOME/${d#\~/}" ;; *) d="$cwd/$d" ;; esac
        [ -d "$d" ] && printf '%s\n' "$d"
    done | awk '!seen[$0]++'
}

_codex_origin_repo() {  # <dir>: owner/repo of its origin, or nothing
    local url
    url=$(git -C "$1" remote get-url origin 2>/dev/null) || return 0
    [[ $url =~ [:/]([^/:]+/[^/]+)$ ]] || return 0
    printf '%s' "${BASH_REMATCH[1]%.git}"
}

# publications.sh: parse one job into lines of _codex_publications.jsonl.
codex_publications_capture() {
    local output_dir="$1" tool_use_id="$2"
    local job="$output_dir/.tool_marks/$tool_use_id.pub"
    [ -f "$job" ] || return 0
    local cwd command meta stub kind sha source dir full repo subject branch dirs since ct head n=0
    cwd=$(jq -r '.cwd // ""' "$job" 2>/dev/null)
    command=$(jq -r '.command // ""' "$job" 2>/dev/null)
    # The call began no earlier than this, less two minutes for clocks and slow hooks.
    since=$(jq -r '((.queued_at // now) - ((.duration_ms // 0) / 1000) - 120) | floor' "$job" 2>/dev/null)
    case "$since" in ''|*[!0-9]*) since=0 ;; esac
    meta=$(jq -c --arg session_id "$(basename "$output_dir")" \
        '{session_id: $session_id, tool_use_id, tool_name, agent_id, prompt_id}' "$job" 2>/dev/null) || meta='{}'
    dirs=$(_codex_publication_dirs "$command" "$cwd")
    while IFS= read -r stub; do
        [ -n "$stub" ] || continue
        kind=$(printf '%s' "$stub" | jq -r '.kind')
        case "$kind" in
            commit)
                sha=$(printf '%s' "$stub" | jq -r '.sha // ""')
                source=$(printf '%s' "$stub" | jq -r '.source // ""')
                full="" dir="" repo="" subject=""
                while IFS= read -r d; do
                    [ -n "$d" ] || continue
                    full=$(git -C "$d" rev-parse --verify -q "$sha^{commit}" 2>/dev/null) || full=""
                    if [ -n "$full" ]; then dir="$d"; break; fi
                done <<< "$dirs"
                if [ "$source" != "gitOperation" ]; then
                    # Read from output, so it must be a commit this call made: in a tree the
                    # command worked in, committed during the call, and after `git log` the
                    # tree's HEAD. Otherwise it is a sha the command printed.
                    [ -n "$full" ] || continue
                    ct=$(git -C "$dir" log -1 --format=%ct "$full" 2>/dev/null)
                    case "$ct" in ''|*[!0-9]*) continue ;; esac
                    [ "$ct" -ge "$since" ] || continue
                    if [ "$source" = "stdout-log" ]; then
                        head=$(git -C "$dir" rev-parse -q --verify HEAD 2>/dev/null)
                        [ "$head" = "$full" ] || continue
                    fi
                fi
                if [ -n "$full" ]; then
                    repo=$(_codex_origin_repo "$dir")
                    subject=$(git -C "$dir" log -1 --format=%s "$full" 2>/dev/null)
                fi
                stub=$(printf '%s' "$stub" | jq -c --arg full "$full" --arg dir "$dir" --arg repo "$repo" --arg subject "$subject" '
                    .sha = (if $full != "" then $full else .sha end)
                    | .dir = (if $dir != "" then $dir else null end)
                    | .repo = (if $repo != "" then $repo else null end)
                    | .subject = ((.subject // null) // (if $subject != "" then $subject else null end))
                    | .verified = ($full != "")
                    | .url = (if $repo != "" and $full != "" then "https://github.com/\($repo)/commit/\($full)" else null end)')
                ;;
            push)
                repo=$(printf '%s' "$stub" | jq -r '.repo // ""')
                branch=$(printf '%s' "$stub" | jq -r '.branch // ""')
                dir=$(head -n 1 <<< "$dirs")
                [ -n "$repo" ] || { [ -n "$dir" ] && repo=$(_codex_origin_repo "$dir"); }
                full=""
                if [ -n "$dir" ] && [ -n "$branch" ]; then
                    full=$(git -C "$dir" rev-parse --verify -q "refs/remotes/origin/${branch#refs/heads/}" 2>/dev/null) || full=""
                fi
                stub=$(printf '%s' "$stub" | jq -c --arg repo "$repo" --arg head "$full" '
                    .repo = (if $repo != "" then $repo else null end)
                    | .to = (.to // (if $head != "" then $head else null end))
                    | .url = (if $repo != "" and .from and .to then "https://github.com/\($repo)/compare/\(.from)...\(.to)" else null end)')
                ;;
        esac
        codex_write_jsonl "$output_dir/_codex_publications.jsonl" \
            "$(jq -nc --argjson meta "$meta" --argjson stub "$stub" '{timestamp: (now | todate)} + $meta + $stub')"
        n=$((n + 1))
    done < <(jq -c "$_CODEX_PUBLICATIONS_JQ" "$job" 2>/dev/null)
    if [ "$n" -gt 0 ]; then
        echo "Saved $n publication(s) by $(jq -r '.tool_name' "$job") ($tool_use_id) in _codex_publications.jsonl" >> "$output_dir/trace.log"
    fi
    rm -f "$job"
    return 0
}

# --- Artifact comments ------------------------------------------------------
# The threads people open on a published Artifact page, one comment at a time.
# A comment reaches a session three ways: a prompt headed `[Artifact comment sent
# to Claude]` (one comment, its thread and its anchor), an `artifact-auto-react`
# task notification (the background auto-reply posted in a thread), and the
# ArtifactComments tool (read returns every thread with its full text, even when
# the model is shown a capped list; reply and resolve answer one thread). Each
# one becomes lines of _codex_artifact_comments.jsonl, keyed by artifact url and
# thread id, so a session's threads can be followed without the tool ledgers.
# A comment nobody reads or sends to Claude never reaches the session.

# PostToolUse: read, reply and resolve calls of the ArtifactComments tool.
codex_artifact_comments_queue() {
    local output_dir="$1" input="$2" tool_name="$3" job
    [ "$tool_name" = "ArtifactComments" ] || return 0
    [[ $input =~ \"action\":\"(read|reply|resolve)\" ]] || return 0
    job=$(printf '%s' "$input" | jq -c --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{source: "tool",
        tool_use_id, tool_name, agent_id: (.agent_id // null), prompt_id: (.prompt_id // null), at: $at,
        action: .tool_input.action, url: (.tool_input.url // null), thread_id: (.tool_input.thread_id // null),
        text: (.tool_input.text // null),
        response: (.tool_response | if type == "object" then . else null end)}' 2>/dev/null) || return 0
    _codex_artifact_comments_detach "$output_dir" "$job"
}

# UserPromptSubmit: a comment sent to Claude, or the notice of an auto-reply.
codex_artifact_comments_prompt_queue() {
    local output_dir="$1" input="$2" job
    [[ $input == *'[Artifact comment sent to Claude]'* || $input == *'<task-type>artifact-auto-react</task-type>'* ]] || return 0
    job=$(printf '%s' "$input" | jq -c --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg n "$(date +%s%N)" '{source: "prompt",
        tool_use_id: ("prompt-" + (.prompt_id // $n)), tool_name: null, agent_id: (.agent_id // null),
        prompt_id: (.prompt_id // null), at: $at, prompt: (.prompt // "")}' 2>/dev/null) || return 0
    _codex_artifact_comments_detach "$output_dir" "$job"
}

_codex_artifact_comments_detach() {
    local output_dir="$1" job="$2" id
    [[ $job =~ \"tool_use_id\":\"([A-Za-z0-9_-]+)\" ]] || return 0
    id="${BASH_REMATCH[1]}"
    mkdir -p "$output_dir/.tool_marks"
    hook_secret_sanitize_text "$job" > "$output_dir/.tool_marks/$id.ac"
    codex_detach bash "$(dirname "${BASH_SOURCE[0]}")/artifact_comments.sh" "$output_dir" "$id"
}

# One line per thread state, comment, sent comment or auto-reply the job holds.
#   thread: the anchor and state, when first seen and when resolved or activation changes.
#   comment: each comment once, by thread and comment id, with its author and text.
#   sent: a comment sent to Claude, as the prompt quoted it (the prompt has no comment id).
#   auto-reply: the background auto-reply's comment id and the artifact's title.
_CODEX_ARTIFACT_COMMENTS_JQ='
def entities: gsub("&gt;"; ">") | gsub("&lt;"; "<") | gsub("&quot;"; "\"") | gsub("&#39;"; "'"'"'") | gsub("&amp;"; "&");
def unquote: split("\n") | map(sub("^> ?"; "")) | join("\n");
. as $j
| ($j.url // null) as $url
| if $j.source == "prompt" then
    ($j.prompt // "") as $p
    | (($p | split("[Artifact comment sent to Claude]") | .[1:][]
        | (capture("^\\s*Artifact: (?<url>\\S+)\\s*\\nComment thread: (?<thread>\\S+)(\\s*\\nSent to Claude at: (?<sent>\\S+))?") // null) as $h
        | select($h != null)
        | {kind: "sent", artifact_url: $h.url, thread_id: $h.thread, sent_at: $h.sent,
           text: ((capture("=== BEGIN ARTIFACT COMMENT \\S+ ===\\n(?<b>[\\s\\S]*?)\\n=== END ARTIFACT COMMENT ").b // null) | if . then unquote else . end),
           anchor: ((capture("<comment-anchor-context[^>]*>\\n(?<c>[\\s\\S]*?)\\n</comment-anchor-context>").c // null) | if . then entities else . end)}),
       ($p | split("<task-notification>") | .[1:][]
        | select(test("<task-type>artifact-auto-react</task-type>"))
        | (capture("Auto-replied to thread (?<thread>[0-9A-Za-z-]+) on artifact (?<url>https://[^\\s]+)[\\s\\S]*?\\(comment (?<comment>[0-9A-Za-z-]+)\\)") // null) as $a
        | select($a != null)
        | {kind: "auto-reply", artifact_url: $a.url, thread_id: $a.thread, comment_id: $a.comment,
           artifact_title: (capture("<summary>Auto-replied to comment thread on Artifact: \"(?<t>.*)\"</summary>").t // null)}))
    | {source: "prompt"} + .
  elif $j.action == "read" then
    ($j.response.names // {}) as $names
    | $j.response.threads[]? as $t
    | ({kind: "thread", artifact_url: $url, thread_id: $t.id, created_at: ($t.created_at // null),
        resolved: ($t.resolved // false), resolved_by_codex: ($t.resolved_by_codex // false),
        codex_activated: ($t.codex_activated // false), anchor_label: ($t.anchor_label // null),
        anchor_path: ($t.anchor_path // null), anchor_snippet: ($t.anchor_snippet // null),
        span_quote: ($t.span_quote // null), comments: ($t.comments // [] | length)},
       ($t.comments[]? | {kind: "comment", artifact_url: $url, thread_id: $t.id, comment_id: .id,
        role: (if .role == "assistant" then "assistant" else "viewer" end),
        author: (if .role == "assistant" then "Claude" else ($names[.account // ""] // .account // null) end),
        access: (.access // null), sent_to_codex: (.sent_to_codex // false),
        created_at: (.created_at // null), text: (.text // null)}))
    | {source: "read"} + .
  elif $j.action == "reply" and $j.response.replied == true then
    {source: "reply", kind: "comment", artifact_url: $url, thread_id: ($j.response.thread_id // $j.thread_id),
     comment_id: $j.response.comment_id, role: "assistant", author: "Claude", access: null,
     sent_to_codex: false, created_at: $j.at, text: $j.text}
  elif $j.action == "resolve" and $j.response.thread_resolved == true then
    {source: "resolve", kind: "thread", artifact_url: $url, thread_id: ($j.response.thread_id // $j.thread_id),
     resolved: true, resolved_by_codex: true, codex_activated: true}
  else empty end
| {kind, source, artifact_url, artifact_id: ((.artifact_url // "") | capture("/artifact/(?<i>[A-Za-z0-9-]+)").i // null)}
  + del(.kind, .source, .artifact_url)
'

# Drop what the index already holds: a comment already written, a thread whose
# state has not changed, a sent comment or an auto-reply already recorded.
_CODEX_ARTIFACT_COMMENTS_NEW_JQ='
def key: if .kind == "comment" then "c|\(.thread_id)|\(.comment_id)"
    elif .kind == "sent" then "s|\(.thread_id)|\(.sent_at)|\(.text)"
    elif .kind == "auto-reply" then "a|\(.comment_id)" else null end;
def state: "\(.resolved)|\(.codex_activated)";
reduce ($old[] | select(type == "object")) as $o ({seen: {}, state: {}};
    if $o.kind == "thread" then .state[$o.thread_id // ""] = ($o | state)
    else .seen[($o | key) // ""] = true end)
| reduce $new[] as $n (. + {out: []};
    if $n.kind == "thread" then
        if .state[$n.thread_id // ""] == ($n | state) then . else .out += [$n] | .state[$n.thread_id // ""] = ($n | state) end
    elif .seen[($n | key)] then .
    else .out += [$n] | .seen[($n | key)] = true end)
| .out[]
'

# artifact_comments.sh: write one job's new lines to _codex_artifact_comments.jsonl.
codex_artifact_comments_capture() {
    local output_dir="$1" id="$2"
    local job="$output_dir/.tool_marks/$id.ac" index="$output_dir/_codex_artifact_comments.jsonl"
    [ -f "$job" ] || return 0
    local new old lines meta n
    new="$job.lines"
    jq -c "$_CODEX_ARTIFACT_COMMENTS_JQ" "$job" > "$new" 2>/dev/null || : > "$new"
    meta=$(jq -c --arg session_id "$(basename "$output_dir")" \
        '{session_id: $session_id, tool_use_id: (if .source == "tool" then .tool_use_id else null end), prompt_id, agent_id}' "$job" 2>/dev/null) || meta='{}'
    old="$index"
    [ -s "$old" ] || old=/dev/null
    lines=$(jq -nc --slurpfile old "$old" --slurpfile new "$new" --argjson meta "$meta" \
        "$_CODEX_ARTIFACT_COMMENTS_NEW_JQ"' | {timestamp: (now | todate)} + $meta + .' 2>/dev/null)
    if [ -n "$lines" ]; then
        printf '%s\n' "$lines" | hook_secret_sanitize_stream >> "$index"
        n=$(printf '%s\n' "$lines" | wc -l | tr -d ' ')
        echo "Saved $n artifact comment line(s) from $(jq -r '.tool_name // "a prompt"' "$job") ($id) in _codex_artifact_comments.jsonl" >> "$output_dir/trace.log"
    fi
    rm -f "$job" "$new"
    return 0
}
