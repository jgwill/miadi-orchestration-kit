#!/usr/bin/env bash
# Session issue: a session that opts in gets one GitHub issue at its first prompt and one
# comment per exit. A session that does not opt in is untouched. The gates of
# rispecs/chronicle-github-sessions-observability/04-export.md, against a stub gh.
# Run: bash tests/session-issue.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS="$HERE/hooks"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected $2, got $3"
        failures=$((failures + 1))
    fi
}

# The stub gh: logs its arguments, keeps each --body-file, answers like gh.
mkdir -p "$WORK/bin"
cat > "$WORK/bin/gh" <<'STUB'
#!/usr/bin/env bash
n=$(( $(cat "$GH_LOG.n" 2>/dev/null || echo 0) + 1 )); echo "$n" > "$GH_LOG.n"
printf '%s\n' "$*" >> "$GH_LOG"
prev=""
for a in "$@"; do
    [ "$prev" = "--body-file" ] && cp "$a" "$GH_LOG.body.$n"
    [ "$prev" = "--title" ] && printf '%s\n' "$a" > "$GH_LOG.title.$n"
    prev=$a
done
[ -z "${GH_DELAY:-}" ] || sleep "$GH_DELAY"
if [ -f "$GH_LOG.fail" ]; then echo "error connecting to api.github.com" >&2; exit 1; fi
case "$1 $2" in
    "repo view") echo "${GH_VISIBILITY:-PRIVATE}" ;;
    "issue create") echo "Creating issue in $4"; echo; echo "https://github.com/acme/sessions/issues/7" ;;
    "issue comment") echo "https://github.com/acme/sessions/issues/7#issuecomment-$n" ;;
esac
STUB
chmod +x "$WORK/bin/gh"
export PATH="$WORK/bin:$PATH"
export HOME="$WORK/home"
mkdir -p "$HOME"
export MIADI_SESSION_ISSUE_SETTLE=0
unset CLAUDE_SESSIONDATA_ROOT MIADI_SESSIONDATA_ROOT SESSION_DATA_ROOT SI_SESSIONDATA_ROOT
unset MIADI_SESSION_ISSUE MIADI_SESSION_ISSUE_HEADLESS MIADI_SESSION_ISSUE_REPO CLAUDE_PID
export CLAUDE_CODE_SESSION_ATTENDED=1
export MIADI_CHRONICLE_SESSION_REPO=acme/sessions

n=0
fresh() {  # a new session folder root, gh log and session id
    n=$((n + 1))
    export MIADI_SESSION_DIR="$WORK/root$n"
    mkdir -p "$MIADI_SESSION_DIR"
    export GH_LOG="$WORK/gh$n.log"
    : > "$GH_LOG"
    sid="$(printf '%08d' $((99990000 + n)))-2222-3333-4444-555555555555"
    out="$MIADI_SESSION_DIR/$sid"
}
calls() { grep -c "^$1" "$GH_LOG" 2>/dev/null || true; }
prompt() {  # <text>: one UserPromptSubmit; its stdout goes to $WORK/stdout
    jq -nc --arg s "$sid" --arg p "$1" --arg cwd "$WORK" --arg tp "${TRANSCRIPT:-}" \
        '{session_id:$s, transcript_path:$tp, cwd:$cwd, hook_event_name:"UserPromptSubmit", prompt:$p}' \
        | bash "$HOOKS/first_prompt_issue.sh" > "$WORK/stdout"
    echo $? > "$WORK/status"
}
session_end() {  # <reason>
    jq -nc --arg s "$sid" --arg r "$1" --arg tp "${TRANSCRIPT:-}" \
        '{session_id:$s, transcript_path:$tp, cwd:"/x", hook_event_name:"SessionEnd", reason:$r}' \
        | bash "$HOOKS/exit_comment.sh" > "$WORK/stdout"
    echo $? > "$WORK/status"
}
settle() {  # the detached opener releases its lock; at most 10 s
    local i
    for i in $(seq 1 100); do [ -d "$out/.issue_lock" ] || return 0; sleep 0.1; done
}
comments_posted() { grep -c 'Session end comment' "$out/trace.log" 2>/dev/null || true; }
await_comment() {  # <count>: the detached commenter wrote its trace line; at most 10 s
    local i
    for i in $(seq 1 100); do [ "$(comments_posted)" -ge "$1" ] && return 0; sleep 0.1; done
}

# G1: no opt-in, a prompt: no gh call, no file.
fresh
prompt "tidy the capture folder names"
settle
expect "G1 a session that did not opt in calls no gh" "0" "$(calls '')"
expect "G1 and writes no file" "0" "$(find "$MIADI_SESSION_DIR" -mindepth 1 | wc -l | tr -d ' ')"
expect "G1 and prints nothing" "0" "$(wc -c < "$WORK/stdout" | tr -d ' ')"

# G2: MIADI_SESSION_ISSUE=1, an interactive session, a first prompt: one issue.
fresh
export MIADI_SESSION_ISSUE=1
prompt "tidy the capture folder names"
settle
expect "G2 one issue create" "1" "$(calls 'issue create')"
expect "G2 in the host's repository" "1" "$(grep -c '^issue create --repo acme/sessions ' "$GH_LOG")"
expect "G2 titled by id and first line" "Session ${sid:0:8}: tidy the capture folder names" "$(cat "$GH_LOG".title.* 2>/dev/null)"
expect "G2 .issue_created holds the URL alone" "https://github.com/acme/sessions/issues/7" "$(cat "$out/.issue_created")"
expect "G2 trace.log names it" "1" "$(grep -c '^Issue created: https://github.com/acme/sessions/issues/7 at ' "$out/trace.log")"
expect "G2 one publication line by the hook" '{"kind":"issue","action":"session issue","by":"hook","number":7}' \
    "$(jq -c '{kind, action, by, number}' "$out/_claude_publications.jsonl")"
expect "G2 the body holds the prompt" "1" "$(grep -c '^tidy the capture folder names$' "$out/_session_issue_body.md")"
expect "G2 and prints nothing" "0" "$(wc -c < "$WORK/stdout" | tr -d ' ')"

# G2b: MIADI_SESSION_ISSUE names the repository.
fresh
export MIADI_SESSION_ISSUE=acme/other
prompt "one"
settle
expect "G2b MIADI_SESSION_ISSUE=owner/repo opens there" "1" "$(grep -c '^issue create --repo acme/other ' "$GH_LOG")"
export MIADI_SESSION_ISSUE=1

# G3: a second and a third prompt, one sent while the first job holds the lock.
fresh
GH_DELAY=1 prompt "first"
prompt "second, while the first job works"
settle
prompt "third"
settle
expect "G3 still one issue create" "1" "$(calls 'issue create')"

# G4: a resumed session (.issue_created present).
fresh
mkdir -p "$out"; echo "https://github.com/acme/sessions/issues/3" > "$out/.issue_created"
prompt "resumed"
settle
expect "G4 a resumed session opens no issue" "0" "$(calls 'issue create')"

# G5: a public repository.
fresh
GH_VISIBILITY=PUBLIC prompt "first"
settle
expect "G5 a public repository gets no issue" "0" "$(calls 'issue create')"
expect "G5 .issue_skipped says why" "public acme/sessions" "$(cat "$out/.issue_skipped")"
expect "G5 trace.log says refused" "1" "$(grep -c '^Session issue refused: acme/sessions is public' "$out/trace.log")"

# G6: a headless session, then the same with MIADI_SESSION_ISSUE_HEADLESS=1.
fresh
CLAUDE_CODE_SESSION_ATTENDED=0 prompt "a decomposition step"
settle
expect "G6 a headless session opens no issue" "0" "$(calls '')"
expect "G6 .issue_skipped holds headless" "headless" "$(cat "$out/.issue_skipped")"
fresh
CLAUDE_CODE_SESSION_ATTENDED=0 MIADI_SESSION_ISSUE_HEADLESS=1 prompt "a decomposition step"
settle
expect "G6 MIADI_SESSION_ISSUE_HEADLESS=1 opens one" "1" "$(calls 'issue create')"
fresh
mkdir -p "$HOME/.claude/sessions"
echo '{"kind":"interactive"}' > "$HOME/.claude/sessions/4242.json"
( unset CLAUDE_CODE_SESSION_ATTENDED; export CLAUDE_PID=4242; prompt "older Claude Code" )
settle
expect "G6 without the attended flag, a registered interactive session opens one" "1" "$(calls 'issue create')"

# G7: a token in the prompt reaches neither title nor body.
fresh
secret="ghp_ABCDefgh1234""IJKLmnop5678QRSTuvwx9012"
prompt "use $secret to push"
settle
expect "G7 the title holds no token" "0" "$(grep -c "$secret" "$GH_LOG".title.* 2>/dev/null | awk -F: '{s+=$NF} END {print s+0}')"
expect "G7 the body holds no token" "0" "$(grep -c "$secret" "$GH_LOG".body.* | awk -F: '{s+=$NF} END {print s+0}')"
expect "G7 the body shows the redaction" "1" "$(grep -c 'ghp_AB\*\*\*' "$out/_session_issue_body.md")"

# G8: three lines, the first 120 characters with an é at character 80.
fresh
first="$(printf 'a%.0s' $(seq 1 79))é$(printf 'b%.0s' $(seq 1 40))"
prompt "$first
second line
third line"
settle
t=$(cat "$GH_LOG".title.*)
expect "G8 the title is cut at 80 characters, é whole, ... appended" \
    "Session ${sid:0:8}: $(printf 'a%.0s' $(seq 1 79))é..." "$t"
fresh
prompt "short
and a second line"
settle
expect "G8 a first line that is not the whole prompt gets ..." "Session ${sid:0:8}: short..." "$(cat "$GH_LOG".title.*)"

# G9: a run of four backticks gets a fence of five.
fresh
prompt 'look at ````this````'
settle
expect "G9 the fence is five backticks" "2" "$(grep -c '^`````$' "$out/_session_issue_body.md")"

# G10: gh fails three times, then the session stops trying.
fresh
touch "$GH_LOG.fail"
for p in one two three four; do prompt "$p"; settle; done
expect "G10 three failed attempts" "3" "$(grep -c '^Issue creation failed: error connecting' "$out/trace.log")"
expect "G10 .issue_skipped holds attempts" "attempts" "$(cat "$out/.issue_skipped")"
expect "G10 the fourth prompt calls nothing" "3" "$(calls '')"
rm -f "$GH_LOG.fail"

# G11: both hooks print nothing and exit 0 (checked in each gate above for the opener).
fresh
prompt "first"; settle
expect "G11 the opener exits 0" "0" "$(cat "$WORK/status")"
session_end prompt_input_exit
expect "G11 the commenter prints nothing" "0" "$(wc -c < "$WORK/stdout" | tr -d ' ')"
expect "G11 the commenter exits 0" "0" "$(cat "$WORK/status")"
await_comment 1

# G12: SessionEnd with .issue_created: one comment, returned in under 1 s.
fresh
prompt "first"; settle
printf '%s\n' '{"prompt":"first"}' '{"prompt":"second"}' > "$out/_claude_user_inputs.jsonl"
printf '%s\n' '{"tool_name":"Bash"}' '{"tool_name":"Edit"}' '{"tool_name":"Read"}' > "$out/_claude_PostToolUse.jsonl"
printf '%s\n' '{"path":"/a"}' '{"path":"/a"}' '{"path":"/b"}' > "$out/_claude_files_written.jsonl"
jq -nc --arg s "$sid" '{session_id:$s, last_assistant_message:"Done: the folders are tidy."}' > "$out/last_claude_AssistantResponse.json"
start=$(date +%s%N)
session_end prompt_input_exit
elapsed=$(( ($(date +%s%N) - start) / 1000000 ))
expect "G12 the hook returns in under 1 s" "yes" "$([ "$elapsed" -lt 1000 ] && echo yes || echo "no (${elapsed} ms)")"
await_comment 1
expect "G12 one issue comment" "1" "$(calls 'issue comment https://github.com/acme/sessions/issues/7 ')"
c="$out/_session_end_comment.md"
expect "G12 the reason reads /exit" "1" "$(grep -c '^\*\*Reason\*\*: /exit · ' "$c")"
expect "G12 user prompts counted" "1" "$(grep -c '^| User prompts | 2 |$' "$c")"
expect "G12 tool uses counted" "1" "$(grep -c '^| Tool uses | 3 |$' "$c")"
expect "G12 distinct files counted" "1" "$(grep -c '^| Files touched | 2 |$' "$c")"
expect "G12 the hooks' own lines are not counted as published" "1" "$(grep -c '^| Published | 0 |$' "$c")"
expect "G12 the last answer" "1" "$(grep -c '^Done: the folders are tidy.$' "$c")"
expect "G12 trace.log names it" "1" "$(grep -c '^Session end comment posted to https://github.com/acme/sessions/issues/7 at ' "$out/trace.log")"
expect "G12 one publication line for the comment" "issue-comment" \
    "$(jq -r 'select(.action == "session end") | .kind' "$out/_claude_publications.jsonl")"

# G13: publications since the previous comment, the hooks' own lines never listed.
printf '%s\n' '{"kind":"commit","sha":"abcdef1234567","subject":"one","repo":"acme/w"}' \
    '{"kind":"push","repo":"acme/w","branch":"main"}' >> "$out/_claude_publications.jsonl"
session_end prompt_input_exit; await_comment 2
expect "G13 the first comment lists two" "2" "$(grep -cE '^- (commit|push) ' "$c")"
expect "G13 a commit line" "1" "$(grep -c '^- commit `abcdef1` one · acme/w$' "$c")"
printf '%s\n' '{"kind":"issue","url":"https://github.com/acme/w/issues/9","repo":"acme/w"}' >> "$out/_claude_publications.jsonl"
session_end clear; await_comment 3
expect "G13 the second comment lists one" "1" "$(grep -cE '^- (commit|push|issue) ' "$c")"
expect "G13 it is the new issue" "1" "$(grep -c '^- issue https://github.com/acme/w/issues/9$' "$c")"
expect "G13 a raw reason is shown as given" "1" "$(grep -c '^\*\*Reason\*\*: clear · ' "$c")"

# G14: SessionEnd without .issue_created.
fresh
session_end prompt_input_exit
sleep 0.5
expect "G14 no issue, no gh call" "0" "$(calls '')"
expect "G14 and no folder" "no" "$([ -e "$out" ] && echo yes || echo no)"

# G15: no last_claude_AssistantResponse.json, a 30 MB transcript.
fresh
prompt "first"; settle
TRANSCRIPT="$WORK/t$n.jsonl"
filler=$(jq -nc '{type:"assistant", message:{content:[{type:"text", text:("early " * 2000)}]}}')
for i in $(seq 1 2500); do printf '%s\n' "$filler"; done > "$TRANSCRIPT"
jq -nc '{type:"assistant", message:{content:[{type:"text", text:"The last answer."}]}}' >> "$TRANSCRIPT"
jq -nc '{type:"user", message:{content:[{type:"tool_result", content:"x"}]}}' >> "$TRANSCRIPT"
expect "G15 the transcript is over 30 MB" "yes" "$([ "$(wc -c < "$TRANSCRIPT")" -gt 30000000 ] && echo yes || echo no)"
start=$(date +%s%N)
session_end prompt_input_exit
await_comment 1
elapsed=$(( ($(date +%s%N) - start) / 1000000 ))
expect "G15 the answer comes from the transcript's end" "1" "$(grep -c '^The last answer.$' "$out/_session_end_comment.md")"
echo "     (G15 comment written in ${elapsed} ms on $(uname -m))"
unset TRANSCRIPT

# G16: /session-issue in a session that did not opt in, after earlier prompts.
unset MIADI_SESSION_ISSUE
fresh
mkdir -p "$out"
printf '%s\n' '{"prompt":"plan the rehearsal"}' '{"prompt":"/session-issue"}' > "$out/_claude_user_inputs.jsonl"
prompt "/session-issue"
expect "G16 one issue create, while the prompt waits" "1" "$(calls 'issue create')"
expect "G16 titled by the session's first prompt" "Session ${sid:0:8}: plan the rehearsal" "$(cat "$GH_LOG".title.*)"
expect "G16 the answer reaches the conversation" \
    "miadi-session-issue: opened https://github.com/acme/sessions/issues/7 in acme/sessions, from the session's first prompt. Each /exit adds a comment to it." \
    "$(head -n 1 "$WORK/stdout")"
expect "G16 a second line tells the model to run nothing" \
    "miadi-session-issue: the hook has done all of it. Tell the user the line above in one line, and run nothing for it." \
    "$(sed -n 2p "$WORK/stdout")"
expect "G16 the lock is released" "no" "$([ -d "$out/.issue_lock" ] && echo yes || echo no)"
prompt "/session-issue"
expect "G16 asked again, it gives the link and opens nothing" "1" "$(calls 'issue create')"
expect "G16 the link" "miadi-session-issue: this session's issue is https://github.com/acme/sessions/issues/7. Each /exit adds a comment to it." "$(head -n 1 "$WORK/stdout")"
session_end prompt_input_exit; await_comment 1
expect "G16 its /exit comments" "1" "$(calls 'issue comment')"

# G17: /session-issue as the first prompt: the next prompt opens the issue.
fresh
prompt "/miadi-session-issue:session-issue acme/named"
expect "G17 nothing opened yet" "0" "$(calls '')"
expect "G17 it says the next prompt opens it" "miadi-session-issue: this session has no prompt yet. Its next prompt opens the issue in acme/named." "$(head -n 1 "$WORK/stdout")"
prompt "write the rehearsal notes"
settle
expect "G17 the next prompt opens it in the named repository" "1" "$(grep -c '^issue create --repo acme/named ' "$GH_LOG")"
expect "G17 titled by that prompt" "Session ${sid:0:8}: write the rehearsal notes" "$(cat "$GH_LOG".title.*)"
expect "G17 the opt-in is spent" "no" "$([ -e "$out/.issue_optin" ] && echo yes || echo no)"

# G18: /session-issue with no repository anywhere.
fresh
MIADI_CHRONICLE_SESSION_REPO= prompt "/session-issue"
expect "G18 no gh call" "0" "$(calls '')"
expect "G18 it says what to do" "miadi-session-issue: no repository is named. Run /session-issue owner/repo, or set MIADI_CHRONICLE_SESSION_REPO." "$(head -n 1 "$WORK/stdout")"

# G19: the first prompt from the transcript, past command and meta entries.
fresh
TRANSCRIPT="$WORK/t$n.jsonl"
{
    jq -nc '{type:"user", message:{content:"<command-message>model</command-message>\n<command-name>/model</command-name>"}}'
    jq -nc '{type:"user", isMeta:true, message:{content:[{type:"text", text:"Caveat: local commands"}]}}'
    jq -nc '{type:"user", message:{content:[{type:"text", text:"compose the circle invitation"}]}}'
    jq -nc '{type:"user", message:{content:"/session-issue"}}'
} > "$TRANSCRIPT"
prompt "/session-issue"
expect "G19 the first real prompt, read from the transcript" "Session ${sid:0:8}: compose the circle invitation" "$(cat "$GH_LOG".title.*)"
unset TRANSCRIPT

# G20: /session-issue on a public repository is refused, and says so.
fresh
mkdir -p "$out"; printf '%s\n' '{"prompt":"one"}' > "$out/_claude_user_inputs.jsonl"
GH_VISIBILITY=PUBLIC prompt "/session-issue acme/open"
expect "G20 no issue" "0" "$(calls 'issue create')"
expect "G20 the refusal reaches the conversation" "miadi-session-issue: refused: acme/open is public. Session issues go only to a private repository." "$(head -n 1 "$WORK/stdout")"

# G21: a prompt that only mentions session-issue is not the command.
fresh
prompt "what does session-issue do?"
expect "G21 no opt-in, no call" "0" "$(calls '')"
expect "G21 and no answer printed" "0" "$(wc -c < "$WORK/stdout" | tr -d ' ')"

# G22: /exit while the opener still works on the first prompt: the comment waits for the issue.
export MIADI_SESSION_ISSUE=1
fresh
GH_DELAY=1 prompt "first, then /exit at once"
start=$(date +%s%N)
session_end prompt_input_exit
elapsed=$(( ($(date +%s%N) - start) / 1000000 ))
expect "G22 the hook returns in under 1 s" "yes" "$([ "$elapsed" -lt 1000 ] && echo yes || echo "no (${elapsed} ms)")"
settle; await_comment 1
expect "G22 one issue create" "1" "$(calls 'issue create')"
expect "G22 one issue comment, after it" "1" "$(calls 'issue comment https://github.com/acme/sessions/issues/7 ')"

# G23: MIADI_SESSION_ISSUE_REPO names the host's repository before MIADI_CHRONICLE_SESSION_REPO.
fresh
MIADI_SESSION_ISSUE_REPO=acme/issues prompt "one"
settle
expect "G23 MIADI_SESSION_ISSUE_REPO opens there" "1" "$(grep -c '^issue create --repo acme/issues ' "$GH_LOG")"
unset MIADI_SESSION_ISSUE

# The bundled sanitizer still passes its own self-test.
expect "the sanitizer self-test" "secret_capture_sanitizer self-test passed" "$(bash "$HOOKS/secret_capture_sanitizer.sh" --self-test 2>&1)"

echo
if [ "$failures" -eq 0 ]; then echo "all session-issue gates pass"; else echo "$failures failure(s)"; fi
[ "$failures" -eq 0 ]
