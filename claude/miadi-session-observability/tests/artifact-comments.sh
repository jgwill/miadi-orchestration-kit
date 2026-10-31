#!/usr/bin/env bash
# Artifact comments: the threads people open on a published Artifact page are lines of
# _claude_artifact_comments.jsonl, keyed by artifact url and thread id. A comment sent
# to Claude, the notice of an auto-reply, and the ArtifactComments tool's read, reply
# and resolve each add what the index does not hold yet.
# Run: bash tests/artifact-comments.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS="$HERE/hooks/claude_hooks"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export CLAUDE_SESSIONDATA_ROOT="$WORK/root"
export XDG_STATE_HOME="$WORK/state"  # the work-in-progress marker stays in the test (0.1.27)
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

sid="99999999-3333-4444-5555-666666666666"
out="$CLAUDE_SESSIONDATA_ROOT/$sid"
index="$out/_claude_artifact_comments.jsonl"
url="https://claude.ai/artifact/AbC123"
secret="ghp_ABCDefgh1234""IJKLmnop5678QRSTuvwx9012"

settle() {  # <job id>
    local i
    for i in $(seq 1 100); do
        [ -e "$out/.tool_marks/$1.ac" ] || break
        sleep 0.1
    done
    flock "$out/.artifact_comments.lock" true 2>/dev/null || sleep 0.5
}
post() {  # <tool_use_id> <tool_name> <tool_input json> <tool_response json>
    local input o
    input=$(jq -nc --arg s "$sid" --arg id "$1" --arg t "$2" --argjson ti "$3" --argjson tr "$4" \
        '{session_id:$s, hook_event_name:"PostToolUse", tool_name:$t, tool_use_id:$id, prompt_id:"prompt-7", cwd:"/", tool_input:$ti, tool_response:$tr}')
    o=$(printf '%s' "$input" | bash "$HOOKS/post_tool_use_hook.sh")
    [ -z "$o" ] || { echo "FAIL the hook printed: $o"; failures=$((failures + 1)); }
    settle "$1"
}
prompt() {  # <prompt_id> <prompt text>
    local input o
    input=$(jq -nc --arg s "$sid" --arg id "$1" --arg p "$2" \
        '{session_id:$s, hook_event_name:"UserPromptSubmit", prompt_id:$id, cwd:"/", prompt:$p}')
    o=$(printf '%s' "$input" | bash "$HOOKS/user_prompt_submit_hook.sh")
    [ -z "$o" ] || { echo "FAIL the prompt hook printed: $o"; failures=$((failures + 1)); }
    settle "prompt-$1"
}
total() { [ -f "$index" ] && wc -l < "$index" | tr -d ' ' || echo 0; }
pick() { jq -c "select($1)" "$index" 2>/dev/null | head -n 1; }
count() { jq -c "select($1)" "$index" 2>/dev/null | wc -l | tr -d ' '; }
field() { printf '%s' "$1" | jq -r ".$2 // empty"; }

# A comment sent to Claude from its thread.
sent=$(cat <<EOF
[Artifact comment sent to Claude]
Artifact: $url
Comment thread: t-1
Sent to Claude at: 2026-10-20T09:26:36Z

I sent you this comment from the artifact's comment thread. It is quoted below.

=== BEGIN ARTIFACT COMMENT 9095ddfe043eac73 ===
> Please open a thread for each step.
>
> The token is $secret
=== END ARTIFACT COMMENT 9095ddfe043eac73 ===

The comment is anchored to the part of the artifact described below.
<comment-anchor-context source="artifact content: entry document">
Location: Decisions › D1
Selected text:  the dates
Element: span
Element path: #d1 &gt; div:nth-of-type(1) &gt; span
</comment-anchor-context>

Answer this comment in its thread, not here.
EOF
)
prompt p-sent "$sent"
l=$(pick '.kind == "sent"')
expect "a comment sent to Claude is recorded" "sent" "$(field "$l" kind)"
expect "with its artifact" "$url" "$(field "$l" artifact_url)"
expect "and the artifact id" "AbC123" "$(field "$l" artifact_id)"
expect "and its thread" "t-1" "$(field "$l" thread_id)"
expect "and when it was sent" "2026-10-20T09:26:36Z" "$(field "$l" sent_at)"
expect "the quote marks are taken off the text" "Please open a thread for each step." "$(field "$l" text | head -n 1)"
expect "a quoted empty line stays empty" "" "$(field "$l" text | sed -n 2p)"
expect "a token in the comment is redacted" "no" "$(grep -q "$secret" "$index" && echo yes || echo no)"
expect "the anchor is kept, with its entities decoded" "Element path: #d1 > div:nth-of-type(1) > span" "$(field "$l" anchor | grep '^Element path')"
expect "a prompt line names its prompt" "p-sent" "$(field "$l" prompt_id)"
expect "and no tool call" "" "$(field "$l" tool_use_id)"

# The notice of a background auto-reply.
notice='<task-notification>
<task-type>artifact-auto-react</task-type>
<summary>Auto-replied to comment thread on Artifact: "Delayed Resolution Results"</summary>
Auto-replied to thread t-1 on artifact https://claude.ai/artifact/AbC123 — a reply only. The auto-posted reply (comment c-auto) is already in the thread — do NOT post another.
</task-notification>'
prompt p-auto "$notice"
l=$(pick '.kind == "auto-reply"')
expect "an auto-reply notice is recorded" "c-auto" "$(field "$l" comment_id)"
expect "with the thread it answered" "t-1" "$(field "$l" thread_id)"
expect "and the artifact's title" "Delayed Resolution Results" "$(field "$l" artifact_title)"
prompt p-auto2 "$notice"
expect "the same notice twice is one line" 1 "$(count '.kind == "auto-reply"')"

before=$(total)
prompt p-plain "Make sure we capture the comments on the page."
expect "a prompt about comments is not a comment" "$before" "$(total)"

# A read returns every thread, with its anchor and its comments.
read1=$(jq -nc '{names: {"u_1": "Guillaume"}, threads: [
    {id: "t-1", created_at: "2026-10-20T09:26:36Z", resolved: false, claude_activated: true,
     anchor_path: "#d1", anchor_label: "Decisions › D1", span_quote: "the dates",
     comments: [
        {id: "c-1", account: "u_1", text: "Please open a thread for each step.", created_at: "2026-10-20T09:26:36Z", access: "owner", sent_to_claude: true, sent_by_viewer: true},
        {id: "c-auto", account: "u_1", role: "assistant", text: "On it.", created_at: "2026-10-20T09:26:50Z"}]},
    {id: "t-2", created_at: "2026-10-20T09:29:02Z", resolved: false, claude_activated: false,
     anchor_path: "#d2", anchor_label: "Decisions › D2",
     comments: [{id: "c-2", account: "u_1", text: "One candidate.", created_at: "2026-10-20T09:29:02Z", access: "owner"}]}]}')
post toolu_read1 ArtifactComments "{\"action\":\"read\",\"url\":\"$url\"}" "$read1"
expect "each thread read is recorded" 2 "$(count '.kind == "thread"')"
l=$(pick '.kind == "thread" and .thread_id == "t-1"')
expect "with its anchor" "Decisions › D1" "$(field "$l" anchor_label)"
expect "the text it quotes" "the dates" "$(field "$l" span_quote)"
expect "and its number of comments" 2 "$(field "$l" comments)"
expect "each comment read is recorded" 3 "$(count '.kind == "comment"')"
l=$(pick '.kind == "comment" and .comment_id == "c-1"')
expect "a viewer's comment names its author" "Guillaume" "$(field "$l" author)"
expect "and says it was sent to Claude" "true" "$(field "$l" sent_to_claude)"
expect "with the tool call that read it" "toolu_read1" "$(field "$l" tool_use_id)"
l=$(pick '.kind == "comment" and .comment_id == "c-auto"')
expect "Claude's reply in a thread is Claude's" "Claude" "$(field "$l" author)"
expect "with the assistant role" "assistant" "$(field "$l" role)"

before=$(total)
post toolu_read2 ArtifactComments "{\"action\":\"read\",\"url\":\"$url\",\"thread_id\":\"t-1\"}" "$read1"
expect "reading the same threads again adds nothing" "$before" "$(total)"

# A reply carries its text in the call, its id in the response.
post toolu_reply ArtifactComments "{\"action\":\"reply\",\"url\":\"$url\",\"thread_id\":\"t-2\",\"text\":\"Done: one thread per step.\"}" \
    '{"replied":true,"thread_id":"t-2","comment_id":"c-3"}'
l=$(pick '.kind == "comment" and .comment_id == "c-3"')
expect "a reply is recorded as Claude's comment" "Claude" "$(field "$l" author)"
expect "with the text it posted" "Done: one thread per step." "$(field "$l" text)"
expect "in its thread" "t-2" "$(field "$l" thread_id)"
expect "from the reply" "reply" "$(field "$l" source)"

before=$(total)
post toolu_dup ArtifactComments "{\"action\":\"reply\",\"url\":\"$url\",\"thread_id\":\"t-2\",\"text\":\"Again.\"}" \
    '{"replied":false,"thread_id":"t-2","already_answered":true,"standing_reply_id":"c-3"}'
expect "a refused reply is not a comment" "$before" "$(total)"

post toolu_resolve ArtifactComments "{\"action\":\"resolve\",\"url\":\"$url\",\"thread_id\":\"t-1\"}" \
    '{"thread_resolved":true,"thread_id":"t-1"}'
l=$(jq -c 'select(.kind == "thread" and .thread_id == "t-1")' "$index" | tail -n 1)
expect "resolving a thread records its new state" "true" "$(field "$l" resolved)"
expect "from the resolve" "resolve" "$(field "$l" source)"

# Later, the commenter answers in t-2; the read shows t-1 resolved and the reply.
read3=$(printf '%s' "$read1" | jq -c '.threads[0].resolved = true | .threads[0].resolved_by_claude = true
    | .threads[1].comments += [{id: "c-3", account: "u_1", role: "assistant", text: "Done: one thread per step.", created_at: "2026-10-20T09:31:00Z"},
                               {id: "c-4", account: "u_1", text: "Thank you, following up here.", created_at: "2026-10-20T09:40:00Z", access: "owner"}]')
before=$(total)
post toolu_read3 ArtifactComments "{\"action\":\"read\",\"url\":\"$url\"}" "$read3"
expect "a later read adds only the new comment" 1 "$(( $(total) - before ))"
expect "which is the commenter's answer" "Thank you, following up here." "$(field "$(pick '.comment_id == "c-4"')" text)"
expect "a reply already recorded is not recorded again" 1 "$(count '.kind == "comment" and .comment_id == "c-3"')"
expect "a thread already resolved is not recorded again" 2 "$(count '.kind == "thread" and .thread_id == "t-1"')"

before=$(total)
post toolu_watch ArtifactComments "{\"action\":\"watch\",\"url\":\"$url\"}" '{"watching":true}'
post toolu_art Artifact '{"action":"read","url":"https://claude.ai/artifact/AbC123"}' '{"url":"https://claude.ai/artifact/AbC123","content":"..."}'
expect "a watch or an Artifact read records no comment" "$before" "$(total)"

expect "every line is one JSON object" "$(total)" "$(jq -c . "$index" | wc -l | tr -d ' ')"
expect "every line names its session" "$(total)" "$(count ".session_id == \"$sid\"")"
expect "no job is left behind" 0 "$(find "$out/.tool_marks" -name '*.ac*' | wc -l | tr -d ' ')"
expect "trace.log names the capture" "yes" "$(grep -q 'artifact comment line(s) from ArtifactComments (toolu_read1)' "$out/trace.log" && echo yes || echo no)"

echo
if [ "$failures" -eq 0 ]; then
    echo "all artifact comment checks passed"
else
    echo "$failures check(s) failed"
    exit 1
fi
