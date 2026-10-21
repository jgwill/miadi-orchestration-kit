#!/usr/bin/env bash
# Publications: what a session put where other people can see it is one line in
# _claude_publications.jsonl with the tool call and the prompt behind it. An Artifact
# page, a GitHub issue, comment or pull request, a commit checked against its tree, a
# push, an npm release. A command that only reads publishes nothing.
# Run: bash tests/publications.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS="$HERE/hooks/claude_hooks"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export CLAUDE_SESSIONDATA_ROOT="$WORK/root"
mkdir -p "$CLAUDE_SESSIONDATA_ROOT"

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected $2, got $3"
        failures=$((failures + 1))
    fi
}

sid="99999999-2222-3333-4444-555555555555"
out="$CLAUDE_SESSIONDATA_ROOT/$sid"
index="$out/_claude_publications.jsonl"
repo="$WORK/repo"
mkdir -p "$repo"
git -C "$repo" init -q -b main
git -C "$repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m "first: the kit learns to publish"
git -C "$repo" remote add origin git@github.com:acme/widgets.git
sha=$(git -C "$repo" rev-parse HEAD)
short=${sha:0:7}
secret="ghp_ABCDefgh1234""IJKLmnop5678QRSTuvwx9012"

post() {  # <tool_use_id> <tool_name> <tool_input json> <tool_response json>
    local input o
    input=$(jq -nc --arg s "$sid" --arg id "$1" --arg t "$2" --arg cwd "$repo" \
        --argjson ti "$3" --argjson tr "$4" \
        '{session_id:$s, hook_event_name:"PostToolUse", tool_name:$t, tool_use_id:$id, prompt_id:"prompt-7", cwd:$cwd, tool_input:$ti, tool_response:$tr}')
    o=$(printf '%s' "$input" | (cd "$repo" && bash "$HOOKS/post_tool_use_hook.sh"))
    [ -z "$o" ] || { echo "FAIL the hook printed: $o"; failures=$((failures + 1)); }
    local i
    for i in $(seq 1 100); do
        [ -e "$out/.tool_marks/$1.pub" ] || break
        sleep 0.1
    done
    flock "$out/.publications.lock" true 2>/dev/null || sleep 0.5
}
line_of() { jq -c --arg id "$1" 'select(.tool_use_id == $id)' "$index" 2>/dev/null | head -n 1; }
count_of() { jq -c --arg id "$1" 'select(.tool_use_id == $id)' "$index" 2>/dev/null | wc -l | tr -d ' '; }
field() { printf '%s' "$1" | jq -r ".$2 // empty"; }

post toolu_art Artifact '{"file_path":"/x/page.html"}' \
    '{"url":"https://claude.ai/artifact/AbC123","path":"/x/page.html","artifact_id":"85702ebd","title":"What the Notes Imply","updated":false}'
l=$(line_of toolu_art)
expect "an Artifact publish is recorded" "artifact" "$(field "$l" kind)"
expect "with its url" "https://claude.ai/artifact/AbC123" "$(field "$l" url)"
expect "with its source file" "/x/page.html" "$(field "$l" path)"
expect "with the prompt it answered" "prompt-7" "$(field "$l" prompt_id)"

post toolu_artread Artifact '{"action":"read","url":"https://claude.ai/artifact/AbC123"}' \
    '{"url":"https://claude.ai/artifact/AbC123","content":"..."}'
expect "an Artifact read publishes nothing" 0 "$(count_of toolu_artread)"

post toolu_issue Bash '{"command":"gh issue create --repo acme/widgets --title T --body-file b.md"}' \
    '{"stdout":"https://github.com/acme/widgets/issues/82","stderr":""}'
l=$(line_of toolu_issue)
expect "gh issue create is recorded as an issue" "issue" "$(field "$l" kind)"
expect "with its repo" "acme/widgets" "$(field "$l" repo)"
expect "with its number" "82" "$(field "$l" number)"
expect "with the gh action" "issue create" "$(field "$l" action)"

post toolu_open Bash '{"command":"inquiry-weave open --artefact . --actions-file /tmp/a.md --actions-label enhancement"}' \
    "$(jq -nc '{stdout:"opened: ep295-a-folder\n  episode:  2026-07-23-episode-295-x (miadi-chronicle:295) [prefix]\n  inquiry:  acme/widgets#276 [created] labels: inquiry · 25801 chars — The inquiry\n  actions:  acme/widgets#277 [created] labels: enhancement · 900 chars — The actions\n", stderr:""}')"
expect "inquiry-weave open records both issues it created" 2 "$(count_of toolu_open)"
l=$(jq -c 'select(.tool_use_id == "toolu_open" and .number == 277)' "$index" | head -n 1)
expect "the actions issue, with its url" "https://github.com/acme/widgets/issues/277" "$(field "$l" url)"
expect "and the inquiry-weave role that made it" "inquiry-weave actions" "$(field "$l" action)"

post toolu_reopen Bash '{"command":"inquiry-weave open --artefact ."}' \
    '{"stdout":"opened: ep295-a-folder\n  inquiry:  acme/widgets#276 [existing]\n","stderr":""}'
expect "an issue open reused is not a publication" 0 "$(count_of toolu_reopen)"

post toolu_wissue Bash '{"command":"inquiry-weave issue --title T"}' \
    '{"stdout":"created: acme/widgets#278\n  artefact: /x\n  url:      https://github.com/acme/widgets/issues/278\n","stderr":""}'
expect "inquiry-weave issue records the issue it created" "278" "$(field "$(line_of toolu_wissue)" number)"

post toolu_comment Bash '{"command":"gh issue comment 82 --repo acme/widgets --body-file c.md"}' \
    "$(jq -nc --arg s "$secret" '{stdout:"https://github.com/acme/widgets/issues/82#issuecomment-123456\n", stderr:("token " + $s)}')"
expect "gh issue comment is recorded as an issue comment" "issue-comment" "$(field "$(line_of toolu_comment)" kind)"
expect "the index is sanitized" 0 "$(grep -c "$secret" "$index")"

post toolu_view Bash '{"command":"gh issue view 82 --repo acme/widgets"}' \
    '{"stdout":"title: T\nurl: https://github.com/acme/widgets/issues/82","stderr":""}'
expect "gh issue view publishes nothing" 0 "$(count_of toolu_view)"

post toolu_pr Bash '{"command":"git push -u origin feat && gh pr create --fill"}' \
    '{"stdout":"https://github.com/acme/widgets/pull/9","stderr":"","gitOperation":{"pr":{"number":9,"url":"https://github.com/acme/widgets/pull/9","action":"created"}}}'
expect "a pull request is recorded once" 1 "$(jq -c 'select(.tool_use_id == "toolu_pr" and .kind == "pr")' "$index" | wc -l | tr -d ' ')"

post toolu_commit Bash "$(jq -nc --arg c "git -C $repo commit -q -m first && git -C $repo log --oneline -1" '{command:$c}')" \
    "$(jq -nc --arg s "$short" '{stdout:($s + " first: the kit learns to publish"), stderr:""}')"
l=$(line_of toolu_commit)
expect "a quiet commit is read from git's output" "commit" "$(field "$l" kind)"
expect "and checked in its tree: the full sha" "$sha" "$(field "$l" sha)"
expect "its repo from the tree's origin" "acme/widgets" "$(field "$l" repo)"
expect "its commit url" "https://github.com/acme/widgets/commit/$sha" "$(field "$l" url)"
expect "it is marked verified" "true" "$(field "$l" verified)"

post toolu_op Bash "$(jq -nc --arg c "cd $repo && git commit -m first && git push" '{command:$c}')" \
    "$(jq -nc --arg s "$short" '{stdout:"", stderr:("To github.com:acme/widgets.git\n   1234567..\($s)  main -> main"), gitOperation:{commit:{sha:$s, kind:"committed", branch:"main"}, push:{branch:"main"}}}')"
expect "the harness's commit record is used" "gitOperation" "$(jq -r 'select(.tool_use_id == "toolu_op" and .kind == "commit") | .source' "$index")"
l=$(jq -c 'select(.tool_use_id == "toolu_op" and .kind == "push")' "$index")
expect "a push names its repo from git's output" "acme/widgets" "$(field "$l" repo)"
expect "and its compare url" "https://github.com/acme/widgets/compare/1234567...$short" "$(field "$l" url)"

post toolu_ghost Bash '{"command":"git commit -q -m x; git log --oneline -1"}' \
    '{"stdout":"deadbee a sha that is in no tree here","stderr":""}'
expect "a sha from output that no tree holds is not a commit" 0 "$(count_of toolu_ghost)"

post toolu_npm Bash '{"command":"cd packages/x && npm publish --access public"}' \
    '{"stdout":"npm notice Publishing to https://registry.npmjs.org/\n+ @miadi/hooks-interpreter@0.5.0","stderr":""}'
l=$(line_of toolu_npm)
expect "npm publish is recorded" "@miadi/hooks-interpreter" "$(field "$l" package)"
expect "with its npm url" "https://www.npmjs.com/package/@miadi/hooks-interpreter/v/0.5.0" "$(field "$l" url)"

post toolu_api Bash '{"command":"gh api repos/acme/widgets/issues/82/comments -f body=hi"}' \
    '{"stdout":"{\"url\":\"https://api.github.com/x\",\"html_url\":\"https://github.com/acme/widgets/issues/82#issuecomment-99\",\"user\":{\"html_url\":\"https://github.com/someone\"}}","stderr":""}'
expect "gh api that writes records the object it made" "https://github.com/acme/widgets/issues/82#issuecomment-99" "$(field "$(line_of toolu_api)" url)"

# Review cycle 1 (jgwill/miadi-orchestration-kit#82): what reads must not be recorded as a publication.
post toolu_nl Bash "$(jq -nc '{command:"cat > c.md <<'"'"'EOF'"'"'\nhello\nEOF\ngh issue comment 82 --repo acme/widgets --body-file c.md"}')" \
    '{"stdout":"https://github.com/acme/widgets/issues/82#issuecomment-777","stderr":""}'
expect "a gh write on the line after a heredoc is recorded" "issue-comment" "$(field "$(line_of toolu_nl)" kind)"

post toolu_mixed Bash '{"command":"gh issue comment 82 --body x && gh issue view 82 --comments"}' \
    '{"stdout":"https://github.com/acme/widgets/issues/82#issuecomment-778\nhttps://github.com/acme/other/issues/5\nhttps://github.com/acme/widgets/pull/7\nsee https://github.com/acme/widgets/issues/9 for more","stderr":""}'
expect "only the URL the gh write made is recorded" 1 "$(count_of toolu_mixed)"
expect "and it is the comment" "https://github.com/acme/widgets/issues/82#issuecomment-778" "$(field "$(line_of toolu_mixed)" url)"

post toolu_grep Bash "$(jq -nc --arg c "git -C $repo log --oneline --grep commit -3" '{command:$c}')" \
    "$(jq -nc --arg s "$short" '{stdout:($s + " first: the kit learns to publish"), stderr:""}')"
expect "git log --grep commit is not a commit" 0 "$(count_of toolu_grep)"

post toolu_nothing Bash "$(jq -nc --arg c "git -C $repo commit -m x; git -C $repo log --oneline -1" '{command:$c}')" \
    "$(jq -nc --arg s "$short" '{stdout:("On branch main\nnothing to commit, working tree clean\n" + $s + " first: the kit learns to publish"), stderr:""}')"
expect "nothing to commit records nothing" 0 "$(count_of toolu_nothing)"

old_repo="$WORK/old"
mkdir -p "$old_repo"
git -C "$old_repo" init -q -b main
GIT_COMMITTER_DATE="2020-01-01T00:00:00Z" git -C "$old_repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m "an old commit"
old_short=$(git -C "$old_repo" rev-parse --short HEAD)
post toolu_old Bash "$(jq -nc --arg c "cd $old_repo && git commit -q -m y; git log --oneline -1" '{command:$c}')" \
    "$(jq -nc --arg s "$old_short" '{stdout:($s + " an old commit"), stderr:""}')"
expect "a commit made before the call is not this call's" 0 "$(count_of toolu_old)"

post toolu_get Bash '{"command":"gh api -X GET search/issues -f q=repo:acme/widgets"}' \
    '{"stdout":"{\"items\":[{\"html_url\":\"https://github.com/acme/widgets/issues/3\"}]}","stderr":""}'
expect "gh api -X GET with fields publishes nothing" 0 "$(count_of toolu_get)"

post toolu_dry Bash '{"command":"git push --dry-run origin main"}' \
    '{"stdout":"","stderr":"To github.com:acme/widgets.git\n   1234567..89abcde  main -> main"}'
expect "git push --dry-run publishes nothing" 0 "$(count_of toolu_dry)"

post toolu_npmdry Bash '{"command":"npm publish --dry-run"}' \
    '{"stdout":"+ @miadi/x@1.0.0","stderr":""}'
expect "npm publish --dry-run publishes nothing" 0 "$(count_of toolu_npmdry)"

input=$(jq -nc --arg s "$sid" --arg cwd "$repo" '{session_id:$s, hook_event_name:"PostToolUseFailure", tool_name:"Bash", tool_use_id:"toolu_failed", prompt_id:"prompt-7", cwd:$cwd, tool_input:{command:"gh issue create --title T --body b && false"}, error:"Exit code 1\nhttps://github.com/acme/widgets/issues/90"}')
printf '%s' "$input" | (cd "$repo" && bash "$HOOKS/post_tool_use_failure_hook.sh") >/dev/null
for i in $(seq 1 100); do [ -e "$out/.tool_marks/toolu_failed.pub" ] || break; sleep 0.1; done
flock "$out/.publications.lock" true 2>/dev/null || sleep 0.5
expect "a chain that published, then failed, is recorded" "https://github.com/acme/widgets/issues/90" "$(field "$(line_of toolu_failed)" url)"

# Review cycle 2: what the stricter rules must still keep.
post toolu_show Bash "$(jq -nc --arg c "git -C $repo commit -q -m first && git -C $repo show --stat --oneline HEAD" '{command:$c}')" \
    "$(jq -nc --arg s "$short" '{stdout:($s + " first: the kit learns to publish\n README.md | 2 +-"), stderr:""}')"
expect "a quiet commit shown with git show is recorded" "$sha" "$(field "$(line_of toolu_show)" sha)"

post toolu_batch Bash '{"command":"for f in a.md b.md; do printf \"%s|\" $f; gh issue create --repo acme/widgets --body-file $f; done"}' \
    '{"stdout":"a.md|https://github.com/acme/widgets/issues/161\nb.md -> https://github.com/acme/widgets/issues/162\nA=https://github.com/acme/widgets/issues/163","stderr":""}'
expect "a batch that prints a label before each URL keeps every issue" 3 "$(count_of toolu_batch)"

post toolu_pushn Bash "$(jq -nc --arg c "cd $repo && git push origin main 2>&1 | grep -n main" '{command:$c}')" \
    '{"stdout":"2:   1234567..89abcde  main -> main","stderr":"To github.com:acme/widgets.git\n   1234567..89abcde  main -> main"}'
expect "a push followed by grep -n is still a push" "push" "$(field "$(line_of toolu_pushn)" kind)"

post toolu_npm2 Bash '{"command":"npm publish --dry-run && npm publish --access public"}' \
    '{"stdout":"+ @miadi/x@1.0.1","stderr":""}'
expect "a dry run followed by a real publish records the publish" "npm" "$(field "$(line_of toolu_npm2)" kind)"

post toolu_dryop Bash '{"command":"git push --dry-run origin main"}' \
    '{"stdout":"","stderr":"","gitOperation":{"push":{"branch":"main"}}}'
expect "a dry-run push is not a push even when the harness says push" 0 "$(count_of toolu_dryop)"

post toolu_ls Bash '{"command":"ls -la"}' '{"stdout":"total 0","stderr":""}'
expect "a command that publishes nothing writes nothing" 0 "$(count_of toolu_ls)"
expect "no job is left behind" 0 "$(find "$out/.tool_marks" -name '*.pub' | wc -l | tr -d ' ')"
expect "trace.log names the publications" "yes" "$(grep -q 'publication(s) by Bash (toolu_issue)' "$out/trace.log" && echo yes || echo no)"

echo
if [ "$failures" -eq 0 ]; then
    echo "all publication checks passed"
else
    echo "$failures check(s) failed"
    exit 1
fi
