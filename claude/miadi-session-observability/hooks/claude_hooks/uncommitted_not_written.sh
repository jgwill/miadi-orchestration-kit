#!/bin/bash
# Stop: name the uncommitted files this session did not write, so its report does not count
# them (R6 of requirements-261019: "Agent reports leave out uncommitted changes the agent did
# not make"). Lane K6e of the Factory's next step.
#
# The repositories looked at: the one the session runs in, and every one it wrote a file into
# (_claude_files_written.jsonl). In each, `git status` lists what is uncommitted; a file this
# session or one of its subagents wrote is its own, everything else is not. The session's own
# capture folder is left out. The list is written each turn to
# <root>/<session_id>/_claude_uncommitted_not_written.json for the digest and the inventory.
#
# When the reply that ends the turn names one of those files, the hook stops the turn once
# ({"decision":"block"}) and names them. The agent then ends the turn without a word or with one
# line laughing at its urge to justify itself, or writes its reply again without them. It never
# explains itself. It never stops a turn twice in a row
# (stop_hook_active) and prints nothing otherwise.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

session_id="" cwd="" active=false message=""
eval "$(jq -r '@sh "session_id=\(.session_id // "") cwd=\(.cwd // "") active=\(.stop_hook_active // false) message=\(.last_assistant_message // "")"' 2>/dev/null)"
[ -n "$session_id" ] || exit 0
output_dir="$CLAUDE_SESSIONDATA_ROOT/$session_id"
index="$output_dir/_claude_files_written.jsonl"
mkdir -p "$output_dir" 2>/dev/null || exit 0

work=$(mktemp -d 2>/dev/null) || exit 0
trap 'rm -rf "$work"' EXIT
if [ -f "$index" ]; then
    jq -r 'select(.path != null) | .path' "$index" 2>/dev/null | sort -u > "$work/mine"
else
    : > "$work/mine"
fi

# The repositories: the one the session runs in, and those of the folders it wrote into. The
# nearest folder holding a .git (a directory, or a worktree's file) is the repository, found
# without a git process. One repository reached through a link (/src and /a/src) is one: it is
# named by its real path, and each written path is kept as <real repository>/<path in it>.
repo_of() {
    REPO=""
    local d="$1"
    while [ -n "$d" ] && [ "$d" != "/" ]; do
        [ -e "$d/.git" ] && { REPO="$d"; return; }
        d="${d%/*}"
    done
}
declare -A real_of=() dir_repo=() repos=()
real() {
    [ -n "${real_of[$1]+x}" ] || real_of[$1]=$(cd -P "$1" 2>/dev/null && pwd)
    REAL="${real_of[$1]}"
}
cwd_repo=""
if [ -n "$cwd" ] && [ -d "$cwd" ]; then
    repo_of "$cwd"
    [ -n "$REPO" ] && { real "$REPO"; cwd_repo="$REAL"; [ -n "$cwd_repo" ] && repos["$cwd_repo"]=1; }
fi
while IFS= read -r p; do
    d="${p%/*}"
    [ -n "${dir_repo[$d]+x}" ] || { repo_of "$d"; dir_repo[$d]="$REPO"; }
    u="${dir_repo[$d]}"
    [ -n "$u" ] || continue
    real "$u"
    [ -n "$REAL" ] || continue
    repos["$REAL"]=1
    printf '%s\n' "$REAL/${p#"$u"/}"
done < "$work/mine" > "$work/own"
[ "${#repos[@]}" -gt 0 ] || exit 0
real "$output_dir"
capture="$REAL/"

# One TSV line per uncommitted file this session did not write: repo, status, path. The
# repositories are read side by side. An untracked folder is one line (`?? dir/`) and is the
# session's when it wrote a file inside it. A rename's second record (its old path) is skipped.
i=0
for repo in "${!repos[@]}"; do
    i=$((i + 1))
    { timeout 10 git -C "$repo" status --porcelain=v1 -z --untracked-files=normal --ignore-submodules=dirty 2>/dev/null | tr '\0' '\n' \
        | awk -v repo="$repo" -v capture="$capture" -v ownfile="$work/own" '
            BEGIN {
                while ((getline l < ownfile) > 0) {
                    own[l] = 1
                    while (sub(/\/[^\/]*$/, "", l) && l != "") ownDir[l] = 1
                }
            }
            skip { skip = 0; next }
            {
                xy = substr($0, 1, 2); rel = substr($0, 4)
                if (xy ~ /^[RC]/) skip = 1
                if (rel == "") next
                abs = repo "/" rel
                if (abs in own || index(abs, capture) == 1) next
                if (abs ~ /\/$/ && ((substr(abs, 1, length(abs) - 1) in ownDir) || index(capture, abs) == 1)) next
                printf "%s\t%s\t%s\n", repo, xy, rel
            }' > "$work/status.$i"; } &
done
wait
cat "$work"/status.* > "$work/foreign" 2>/dev/null

claude_write_json "$output_dir/_claude_uncommitted_not_written.json" "$(jq -Rnc \
    --arg session_id "$session_id" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
    [inputs | select(length > 0) | split("\t") | {repo: .[0], status: .[1], path: .[2]}] as $all
    | {at: $at, session_id: $session_id, count: ($all | length),
       note: "uncommitted in the repositories this session ran in or wrote to, and not written by it or its subagents",
       repos: ($all | group_by(.repo) | map({repo: .[0].repo, count: length, files: (.[:200] | map({status, path}))}))}' < "$work/foreign")"

[ "$active" = "true" ] && exit 0
[ -n "$message" ] && [ -s "$work/foreign" ] || exit 0

# Which of them the reply names: by absolute path, by repository path (a file at the root of
# the session's own repository by its name), or by a file name that only one uncommitted file
# carries (five characters or more). A name counts only where it stands whole: STC.md is not
# named by STCISSUE.md.
printf '%s\n' "$message" > "$work/message"
mapfile -t named < <(awk -F'\t' -v msgfile="$work/message" -v cwd_repo="$cwd_repo" '
    BEGIN { while ((getline l < msgfile) > 0) msg = msg l "\n" }
    function names(n, before_re,   start, s, i, p, b, a) {
        start = 1
        while (start <= length(msg)) {
            s = substr(msg, start); i = index(s, n)
            if (i == 0) return 0
            p = start + i - 1
            b = p > 1 ? substr(msg, p - 1, 1) : ""
            a = substr(msg, p + length(n), 1)
            if ((b == "" || b !~ before_re) && (a == "" || a !~ /[A-Za-z0-9_-]/)) return 1
            start = p + 1
        }
        return 0
    }
    { repo[NR] = $1; xy[NR] = $2; rel[NR] = $3; b = $3; sub(/.*\//, "", b); base[NR] = b; if (b != "") count[b]++ }
    END {
        for (k = 1; k <= NR; k++) {
            if (names(repo[k] "/" rel[k], "[A-Za-z0-9_.-]") || ((rel[k] ~ /\// || (repo[k] == cwd_repo && length(rel[k]) >= 5)) && names(rel[k], "[A-Za-z0-9_./-]")) \
                || (base[k] != "" && count[base[k]] == 1 && length(base[k]) >= 5 && names(base[k], "[A-Za-z0-9_./-]"))) {
                print xy[k] " " repo[k] "/" rel[k]
                if (++c >= 12) exit
            }
        }
    }' "$work/foreign")
[ "${#named[@]}" -gt 0 ] || exit 0

reason="Uncommitted, written by another session or the person:"
for f in "${named[@]}"; do reason+=$'\n'"  $f"; done
reason+=$'\n'"If your reply did not present them as this session's work, end the turn without writing anything, or with one short line that laughs at your urge to justify yourself. If it did, write the reply again without them. Do not explain yourself."
jq -nc --arg reason "$reason" '{decision: "block", reason: $reason}'
