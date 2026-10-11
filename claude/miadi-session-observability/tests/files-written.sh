#!/usr/bin/env bash
# Files written: a file a tool call creates, changes or moves is copied to
# written/<its absolute path>, sanitized, with one line in
# _claude_files_written.jsonl naming the call. Bash and MCP calls are found by
# scanning between the PreToolUse and PostToolUse marks, Write and Edit copy
# their one file, a failed call is scanned too, and the hooks print nothing.
# Run: bash tests/files-written.sh
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

sid="11111111-2222-3333-4444-555555555555"
out="$CLAUDE_SESSIONDATA_ROOT/$sid"
proj="$WORK/proj"; scratch="$WORK/scratch"; other="$WORK/other"
mkdir -p "$proj/.pde" "$proj/node_modules/pkg" "$proj/.git" "$scratch" "$other"
index="$out/_claude_files_written.jsonl"
secret="sk-ant-api03-ABCDEFGHIJKLM""NOPQRSTUVWX"
stdout_bytes=0

event() {  # <hook script> <json>: run one hook as Claude Code does, count its stdout
    local o
    o=$(printf '%s' "$2" | (cd "$proj" && bash "$HOOKS/$1"))
    stdout_bytes=$((stdout_bytes + ${#o}))
}

settle() {  # wait for the detached copy of <tool_use_id>
    local i
    for i in $(seq 1 100); do
        [ -e "$out/.tool_marks/$1.job" ] || break
        sleep 0.1
    done
    flock "$out/.files_written.lock" true 2>/dev/null || sleep 0.5
}

bash_call() {  # <tool_use_id> <command> [post|failure]: PreToolUse, run it in $proj, PostToolUse
    local id="$1" cmd="$2" ev="${3:-post}" pre post
    pre=$(jq -nc --arg s "$sid" --arg id "$id" --arg c "$cmd" --arg cwd "$proj" --arg sp "$scratch" \
        '{session_id:$s, hook_event_name:"PreToolUse", tool_name:"Bash", tool_use_id:$id, prompt_id:"prompt-1", cwd:$cwd, scratchpad_dir:$sp, tool_input:{command:$c}}')
    event pre_tool_use_hook.sh "$pre"
    sleep 0.05
    (cd "$proj" && bash -c "$cmd") >/dev/null 2>&1
    sleep 0.05
    post=$(printf '%s' "$pre" | jq -c '.hook_event_name = "PostToolUse" | .tool_response = {stdout:"", stderr:""}')
    if [ "$ev" = failure ]; then
        post=$(printf '%s' "$pre" | jq -c '.hook_event_name = "PostToolUseFailure" | .error = "Exit code 1"')
        event post_tool_use_failure_hook.sh "$post"
    else
        event post_tool_use_hook.sh "$post"
    fi
    settle "$id"
}

line_of() {  # <tool_use_id> <path>: that file's index line
    jq -c --arg id "$1" --arg p "$2" 'select(.tool_use_id == $id and .path == $p)' "$index" 2>/dev/null | tail -n 1
}
field() { printf '%s' "$1" | jq -r ".$2 // empty"; }
copy_of() { printf '%s/written%s' "$out" "$1"; }

# An earlier file, outside every call's window.
printf 'old\n' > "$proj/before.md"
sleep 0.05

# The reported case: a heredoc writes the input prompt into .pde/, then mv moves it.
bash_call toolu_heredoc "mkdir -p .pde && { cat <<'EOS'
# Request
key: $secret
EOS
} > .pde/input-prompt-x.md && printf 'dep\n' > node_modules/pkg/i.js && printf 'ref\n' > .git/HEAD2"
p="$proj/.pde/input-prompt-x.md"
l=$(line_of toolu_heredoc "$p")
expect "a heredoc's file is copied" "yes" "$([ -f "$(copy_of "$p")" ] && echo yes || echo no)"
expect "its index line says created" "created" "$(field "$l" kind)"
expect "its index line names the Bash call" "Bash" "$(field "$l" tool_name)"
expect "its index line names the prompt it answered" "prompt-1" "$(field "$l" prompt_id)"
expect "the copy is sanitized" 0 "$(grep -c "$secret" "$(copy_of "$p")" 2>/dev/null)"
expect "the copy keeps the rest" "# Request" "$(head -n 1 "$(copy_of "$p")" 2>/dev/null)"
expect "the index line carries the command head" "yes" \
    "$(field "$l" command | grep -q 'input-prompt-x.md' && echo yes || echo no)"
expect "the index line is sanitized" 0 "$(grep -c "$secret" "$index")"
expect "node_modules is not scanned" 0 "$(jq -r '.path // empty' "$index" | grep -c 'node_modules')"
expect ".git is not scanned" 0 "$(jq -r '.path // empty' "$index" | grep -c '/.git/')"
expect "a file older than the call is not listed" 0 "$(jq -r '.path // empty' "$index" | grep -c 'before.md')"
expect "the marks are dropped" 0 "$(find "$out/.tool_marks" -type f | wc -l | tr -d ' ')"

bash_call toolu_mv 'd=.pde/2610--abc && mkdir -p $d && mv .pde/input-prompt-x.md $d/input-prompt.md'
p2="$proj/.pde/2610--abc/input-prompt.md"
expect "a moved file is copied at its new path" "yes" "$([ -f "$(copy_of "$p2")" ] && echo yes || echo no)"
expect "its kind is moved" "moved" "$(field "$(line_of toolu_mv "$p2")" kind)"
expect "the copy at the old path stays" "yes" "$([ -f "$(copy_of "$p")" ] && echo yes || echo no)"

# Versions: a log that only grew replaces its copy, other content keeps the last copy.
bash_call toolu_log1 'printf "a\n" > log.txt'
bash_call toolu_log2 'printf "b\n" >> log.txt'
expect "a log that grew replaces its copy" "a b" "$(tr '\n' ' ' < "$(copy_of "$proj/log.txt")" | sed 's/ $//')"
expect "and keeps no version" "no" "$([ -e "$(copy_of "$proj/log.txt").~1~" ] && echo yes || echo no)"
bash_call toolu_log3 'printf "rewritten\n" > log.txt'
expect "a rewritten file keeps the last copy as .~1~" "a b" \
    "$(tr '\n' ' ' < "$(copy_of "$proj/log.txt").~1~" 2>/dev/null | sed 's/ $//')"
expect "and the copy is the new content" "rewritten" "$(cat "$(copy_of "$proj/log.txt")")"

# Outside the project: a directory the command names, and the scratchpad.
bash_call toolu_out "printf 'x\n' > $other/elsewhere.md && printf 'y\n' > $scratch/notes.md"
expect "a file in a directory the command names is copied" "yes" \
    "$([ -f "$(copy_of "$other/elsewhere.md")" ] && echo yes || echo no)"
expect "a scratchpad file is copied" "yes" "$([ -f "$(copy_of "$scratch/notes.md")" ] && echo yes || echo no)"

bash_call toolu_bin "head -c 64 /dev/zero > blob.bin"
l=$(line_of toolu_bin "$proj/blob.bin")
expect "a binary file is listed" "not copied: binary" "$(field "$l" note)"
expect "and not copied" "no" "$([ -e "$(copy_of "$proj/blob.bin")" ] && echo yes || echo no)"
expect "it carries its sha256" "$(sha256sum < "$proj/blob.bin" | cut -d' ' -f1)" "$(field "$l" sha256)"

bash_call toolu_fail 'printf "partial\n" > failed-run.md; exit 1' failure
expect "a failed call's file is copied" "partial" "$(cat "$(copy_of "$proj/failed-run.md")" 2>/dev/null)"

bash_call toolu_many 'for i in $(seq 1 45); do printf "%s\n" $i > many-$i.txt; done'
expect "every file of a large call is listed" 45 "$(jq -r 'select(.tool_use_id == "toolu_many") | .path' "$index" | wc -l | tr -d ' ')"
expect "at most 40 are copied" 40 "$(find "$out/written$proj" -maxdepth 1 -name 'many-*.txt' | wc -l | tr -d ' ')"

# A call whose PreToolUse never ran (denied before the hook, or an older hook) copies nothing.
post=$(jq -nc --arg s "$sid" --arg cwd "$proj" '{session_id:$s, hook_event_name:"PostToolUse", tool_name:"Bash", tool_use_id:"toolu_nostart", cwd:$cwd, tool_input:{command:"true"}}')
printf 'z\n' > "$proj/unmarked.md"
event post_tool_use_hook.sh "$post"
settle toolu_nostart
expect "no start mark, nothing listed" 0 "$(jq -r '.path // empty' "$index" | grep -c 'unmarked.md')"

# An MCP call is scanned like Bash.
pre=$(jq -nc --arg s "$sid" --arg cwd "$proj" '{session_id:$s, hook_event_name:"PreToolUse", tool_name:"mcp__pde__pde_parse_response", tool_use_id:"toolu_mcp", cwd:$cwd, tool_input:{}}')
event pre_tool_use_hook.sh "$pre"
sleep 0.05; printf '{"pde":1}\n' > "$proj/.pde/pde-1.json"; sleep 0.05
event post_tool_use_hook.sh "$(printf '%s' "$pre" | jq -c '.hook_event_name = "PostToolUse" | .tool_response = "saved"')"
settle toolu_mcp
expect "an MCP server's file is copied" '{"pde":1}' "$(cat "$(copy_of "$proj/.pde/pde-1.json")" 2>/dev/null)"

# Write and Edit copy their file as it stands after the tool.
printf 'line one\nline two\n' > "$proj/page.md"
post=$(jq -nc --arg s "$sid" --arg cwd "$proj" --arg f "$proj/page.md" '{session_id:$s, hook_event_name:"PostToolUse", tool_name:"Write", tool_use_id:"toolu_write", cwd:$cwd, tool_input:{file_path:$f, content:"line one\nline two\n"}, tool_response:{type:"create", filePath:$f}}')
event post_tool_use_hook.sh "$post"
settle toolu_write
expect "a Write is copied" "line one" "$(head -n 1 "$(copy_of "$proj/page.md")" 2>/dev/null)"
expect "its kind follows the tool response" "created" "$(field "$(line_of toolu_write "$proj/page.md")" kind)"
printf 'line one\nline 2\n' > "$proj/page.md"
post=$(jq -nc --arg s "$sid" --arg cwd "$proj" --arg f "$proj/page.md" '{session_id:$s, hook_event_name:"PostToolUse", tool_name:"Edit", tool_use_id:"toolu_edit", cwd:$cwd, tool_input:{file_path:$f, old_string:"line two", new_string:"line 2"}, tool_response:{filePath:$f}}')
event post_tool_use_hook.sh "$post"
settle toolu_edit
expect "an Edit copies the whole file after the edit" "line one line 2" "$(tr '\n' ' ' < "$(copy_of "$proj/page.md")" | sed 's/ $//')"
expect "an Edit's kind is changed" "changed" "$(field "$(line_of toolu_edit "$proj/page.md")" kind)"

pre=$(jq -nc --arg s "$sid" --arg cwd "$proj" --arg f "$proj/next.md" '{session_id:$s, hook_event_name:"PreToolUse", tool_name:"Write", tool_use_id:"toolu_w2", cwd:$cwd, tool_input:{file_path:$f, content:"proposed body\n"}}')
event pre_tool_use_hook.sh "$pre"
expect "a Write still lands in proposed/ before it runs" "proposed body" "$(cat "$out/proposed/next.md" 2>/dev/null)"
expect "a Write sets no scan mark" "no" "$([ -e "$out/.tool_marks/toolu_w2.start" ] && echo yes || echo no)"
expect "the hooks print nothing" 0 "$stdout_bytes"
expect "trace.log names the copies" "yes" "$(grep -q 'written by Bash (toolu_heredoc)' "$out/trace.log" && echo yes || echo no)"

echo
if [ "$failures" -eq 0 ]; then
    echo "all files written checks passed"
else
    echo "$failures check(s) failed"
    exit 1
fi
