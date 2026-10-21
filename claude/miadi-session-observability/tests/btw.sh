#!/usr/bin/env bash
# /btw: no hook fires for a side question. Its question is in history.jsonl only, its
# answer only in the panel, unless the person forks it. Each archive pass writes to
# _claude_btw.jsonl every /btw question of the session, and for a fork the question it
# came from, the panel's answer, what the person sent it, its replies, and each time the
# main session was told it stopped or was resumed. An Agent-launched fork writes nothing.
# jgwill/miadi-orchestration-kit#95. Run: bash tests/btw.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS="$HERE/hooks/claude_hooks"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export CLAUDE_SESSIONDATA_ROOT="$WORK/root"
export CLAUDE_CONFIG_DIR="$WORK/config"
mkdir -p "$CLAUDE_SESSIONDATA_ROOT" "$CLAUDE_CONFIG_DIR/paste-cache"

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected $2, got $3"
        failures=$((failures + 1))
    fi
}

sid="99999999-4444-4444-5555-666666666666"
out="$CLAUDE_SESSIONDATA_ROOT/$sid"
index="$out/_claude_btw.jsonl"
projects="$WORK/projects"
transcript="$projects/-srv-episode/$sid.jsonl"
subagents="$projects/-srv-episode/$sid/subagents"
mkdir -p "$out" "$subagents"
secret="ghp_ABCDefgh1234""IJKLmnop5678QRSTuvwx9012"
fork="awhat-is-the-34e01880ef1a2dc7"
launched="a368024e82b1165ac"

pick() { jq -c "select($1)" "$index" 2>/dev/null | head -n 1; }
count() { jq -c "select($1)" "$index" 2>/dev/null | wc -l | tr -d ' '; }
total() { [ -f "$index" ] && wc -l < "$index" | tr -d ' ' || echo 0; }
field() { printf '%s' "$1" | jq -r ".$2 // empty"; }
archive() { bash "$HOOKS/transcript_archive.sh" session "$transcript" "$out"; }

# history.jsonl: a /btw never forked (with a pasted text), the one forked, a prompt,
# and a /btw of another session.
printf 'the pasted notes' > "$CLAUDE_CONFIG_DIR/paste-cache/d35b9f456c429453.txt"
cat > "$CLAUDE_CONFIG_DIR/history.jsonl" <<EOF
{"display":"/btw what does [Pasted text #1 +2 lines] mean?","pastedContents":{"1":{"id":1,"type":"text","contentHash":"d35b9f456c429453"}},"timestamp":1792582000000,"project":"/srv/episode","sessionId":"$sid"}
{"display":"plain prompt","pastedContents":{},"timestamp":1792582500000,"project":"/srv/episode","sessionId":"$sid"}
{"display":"/btw what is the 'threads.yaml' file shortly ?","pastedContents":{},"timestamp":1792583050126,"project":"/srv/episode","sessionId":"$sid"}
{"display":"/btw another session","pastedContents":{},"timestamp":1792583060000,"project":"/x","sessionId":"11111111-0000-0000-0000-000000000000"}
EOF

# The main transcript: a prompt, then the fork's notifications as Claude Code writes them.
cat > "$transcript" <<EOF
{"type":"user","uuid":"m1","promptId":"p-0","timestamp":"2026-10-21T11:40:00.000Z","message":{"role":"user","content":"plain prompt"}}
{"type":"system","subtype":"informational","uuid":"m2","launchedAgentId":"$fork","timestamp":"2026-10-21T11:45:31.836Z","content":"Started in the background: what is the 'threads.yaml' file shortly ?"}
{"type":"queue-operation","operation":"enqueue","timestamp":"2026-10-21T11:45:51.659Z","content":"<task-notification>\n<task-id>$fork</task-id>\n<status>completed</status>\n<summary>Agent \"what is the\" finished</summary>\n</task-notification>"}
{"type":"user","uuid":"m3","promptId":"p-1","origin":{"kind":"task-notification"},"timestamp":"2026-10-21T11:45:51.739Z","message":{"role":"user","content":"<task-notification>\n<task-id>$fork</task-id>\n<status>completed</status>\n</task-notification>"}}
{"type":"queue-operation","operation":"enqueue","timestamp":"2026-10-21T11:45:52.493Z","content":"<task-notification>\n<task-id>$fork</task-id>\n<summary>Agent \"what is the\" was resumed by the user</summary>\n</task-notification>"}
{"type":"queue-operation","operation":"remove","timestamp":"2026-10-21T11:45:57.926Z","content":"<task-notification>\n<task-id>$fork</task-id>\n</task-notification>"}
{"type":"attachment","uuid":"m4","timestamp":"2026-10-21T11:46:09.484Z","attachment":{"type":"queued_command","commandMode":"task-notification","prompt":"<task-notification>\n<task-id>$fork</task-id>\n<status>completed</status>\n</task-notification>"}}
{"type":"queue-operation","operation":"enqueue","timestamp":"2026-10-21T11:47:00.000Z","content":"<task-notification>\n<task-id>bgdd6n1dz</task-id>\n<status>stopped</status>\n</task-notification>"}
EOF

# The /btw fork: question and panel answer before the boilerplate, then a reply after a
# tool call, a message sent while it worked, and one sent after it stopped.
boiler='<fork-boilerplate>\nYou are a worker fork.\n</fork-boilerplate>\n\nYour directive: what is the '"'"'threads.yaml'"'"' file shortly ?'
cat > "$subagents/agent-$fork.jsonl" <<EOF
{"type":"fork-context-ref","agentId":"$fork","parentSessionId":"$sid","parentLastUuid":"m1","contextLength":1734}
{"type":"user","uuid":"f1","isSidechain":true,"promptId":"p-0","timestamp":"2026-10-21T11:45:31.819Z","message":{"role":"user","content":"what is the 'threads.yaml' file shortly ?"}}
{"type":"attachment","uuid":"f2","timestamp":"2026-10-21T11:45:31.819Z","attachment":{"type":"instructions"}}
{"type":"assistant","uuid":"f3","timestamp":"2026-10-21T11:45:31.819Z","message":{"role":"assistant","content":[{"type":"text","text":"It is the table of plot threads."}]}}
{"type":"user","uuid":"f4","timestamp":"2026-10-21T11:45:31.841Z","message":{"role":"user","content":[{"type":"text","text":"$boiler"}]}}
{"type":"assistant","uuid":"f5","timestamp":"2026-10-21T11:45:35.000Z","message":{"role":"assistant","content":[{"type":"thinking","thinking":""},{"type":"tool_use","id":"t1","name":"Bash","input":{}}]}}
{"type":"user","uuid":"f6","timestamp":"2026-10-21T11:45:44.000Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":"PT1 PT2"}]}}
{"type":"assistant","uuid":"f7","timestamp":"2026-10-21T11:45:50.566Z","message":{"role":"assistant","content":[{"type":"text","text":"  It holds eight threads.  "}]}}
{"type":"user","uuid":"f8","origin":{"kind":"human"},"promptId":"p-1","timestamp":"2026-10-21T11:45:52.484Z","message":{"role":"user","content":"The user sent a new message while you were working:\npeek at tmux 'desk', the token is $secret\n\nThis is how Claude Code surfaces messages the user sends mid-turn, and more."}}
{"type":"assistant","uuid":"f9","timestamp":"2026-10-21T11:46:08.425Z","message":{"role":"assistant","content":[{"type":"text","text":"That session is idle."},{"type":"tool_use","id":"t2","name":"Read","input":{}},{"type":"tool_use","id":"t3","name":"Artifact","input":{}}]}}
{"type":"user","uuid":"f10","timestamp":"2026-10-21T11:46:09.000Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t2","content":"x"},{"type":"tool_result","tool_use_id":"t3","content":"y"}]}}
{"type":"assistant","uuid":"f11","timestamp":"2026-10-21T11:46:10.000Z","message":{"role":"assistant","content":[{"type":"text","text":"Published."}]}}
{"type":"user","uuid":"f12","origin":{"kind":"human"},"promptId":"p-2","timestamp":"2026-10-21T11:54:17.017Z","message":{"role":"user","content":"things were decided already"}}
EOF
printf '{"agentType":"fork","isFork":true,"description":"what is the '"'"'threads.yaml'"'"' file…","name":"what-is-the"}\n' > "$subagents/agent-$fork.meta.json"

# A fork the Agent tool launched: the parent's tool call before the boilerplate.
cat > "$subagents/agent-$launched.jsonl" <<EOF
{"type":"fork-context-ref","agentId":"$launched","parentSessionId":"$sid","parentLastUuid":"m1","contextLength":10}
{"type":"assistant","uuid":"l1","timestamp":"2026-10-21T11:50:00.000Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"a1","name":"Agent","input":{}}]}}
{"type":"user","uuid":"l2","timestamp":"2026-10-21T11:50:00.100Z","message":{"role":"user","content":[{"type":"text","text":"$boiler"}]}}
{"type":"assistant","uuid":"l3","timestamp":"2026-10-21T11:50:05.000Z","message":{"role":"assistant","content":[{"type":"text","text":"done"}]}}
EOF
printf '{"agentType":"fork","isFork":true,"description":"a launched fork"}\n' > "$subagents/agent-$launched.meta.json"

archive

asked=$(pick '.kind == "asked" and .btw_id == "btw-1792583050126"')
expect "the forked /btw question is asked" "what is the 'threads.yaml' file shortly ?" "$(field "$asked" question)"
expect "asked is timed from history, to the millisecond" "2026-10-21T11:44:10.126Z" "$(field "$asked" at)"
plain=$(pick '.kind == "asked" and .btw_id == "btw-1792582000000"')
expect "a /btw never forked is asked too" "what does [Pasted text #1 +2 lines] mean?" "$(field "$plain" question)"
expect "its pasted text comes from paste-cache" "the pasted notes" "$(printf '%s' "$plain" | jq -r '.pasted[0] // empty')"
expect "a never-forked /btw has no fork lines" 0 "$(count '.btw_id == "btw-1792582000000" and .kind != "asked"')"
expect "another session's /btw is not here" 0 "$(count '.question == "another session"')"
expect "a plain prompt is not a /btw" 0 "$(count '.question == "plain prompt"')"

forked=$(pick '.kind == "forked"')
expect "forked names the fork" "$fork what-is-the" "$(field "$forked" agent_id) $(field "$forked" name)"
expect "forked links to its question" "btw-1792583050126" "$(field "$forked" btw_id)"
expect "forked keeps the directive" "what is the 'threads.yaml' file shortly ?" "$(field "$forked" directive)"
expect "forked names where it branched" "m1 1734" "$(field "$forked" parent_last_uuid) $(field "$forked" context_length)"
expect "answered is the panel's answer" "It is the table of plot threads." "$(field "$(pick '.kind == "answered"')" text)"

expect "two person messages" 2 "$(count '.kind == "person"')"
first=$(pick '.kind == "person"')
expect "a message sent mid-turn loses Claude Code's wrapper" "0 0 peek" \
    "$(field "$first" text | grep -c 'The user sent\|This is how') $(field "$first" text | grep -c 'more\.') $(field "$first" text | cut -c1-4)"
expect "the person message is sanitized" 0 "$(grep -c "$secret" "$index")"
expect "the person message keeps its prompt_id" "p-1" "$(field "$first" prompt_id)"
expect "a message sent after it stopped is a person message" "things were decided already" "$(field "$(pick '.kind == "person" and .prompt_id == "p-2"')" text)"

expect "three replies" 3 "$(count '.kind == "reply"')"
expect "a reply is trimmed and names the tools before it" 'It holds eight threads. ["Bash"]' \
    "$(field "$(pick '.kind == "reply" and .at == "2026-10-21T11:45:50.566Z"')" text) $(pick '.kind == "reply" and .at == "2026-10-21T11:45:50.566Z"' | jq -c .tools_before)"
expect "tools called after a reply count for the next one" '["Read","Artifact"]' "$(pick '.kind == "reply" and .text == "Published."' | jq -c .tools_before)"

expect "one completion and one resume notified" "completed resumed" \
    "$(jq -r 'select(.kind == "notified") | .status' "$index" | sort | tr '\n' ' ' | sed 's/ $//')"
expect "a dequeued notice is not notified" 0 "$(count '.kind == "notified" and .at == "2026-10-21T11:45:57.926Z"')"
expect "another task's notice is not here" 0 "$(count '.agent_id == "bgdd6n1dz"')"
expect "delivered as a prompt carries the main prompt_id" "prompt p-1" \
    "$(pick '.kind == "delivered" and .via == "prompt"' | jq -r '"\(.via) \(.prompt_id)"')"
expect "delivered inside a running turn is an attachment" "attachment completed" \
    "$(pick '.kind == "delivered" and .via == "attachment"' | jq -r '"\(.via) \(.status)"')"
expect "every fork line carries the btw_id" 0 "$(count '.agent_id and .btw_id != "btw-1792583050126"')"
expect "the Agent-launched fork writes nothing" 0 "$(count ".agent_id == \"$launched\"")"
expect "the lines are in time order" "$(jq -r .at "$index" | sort | tr '\n' ' ')" "$(jq -r .at "$index" | tr '\n' ' ')"
expect "every line names the session" "$(total)" "$(count ".session_id == \"$sid\"")"
expect "trace.log says what was saved" 1 "$(grep -c "Saved $(total) /btw line(s)" "$out/trace.log")"

n=$(total)
archive
expect "an unchanged session adds nothing" "$n" "$(total)"
rm -f "$out/.btw.stamp"
archive
expect "reading every source again adds nothing" "$n" "$(total)"

printf '%s\n' '{"type":"user","uuid":"f13","origin":{"kind":"human"},"promptId":"p-3","timestamp":"2026-10-21T12:00:00.000Z","message":{"role":"user","content":"one more"}}' >> "$subagents/agent-$fork.jsonl"
archive
expect "a new message to the fork adds one line" "$((n + 1))" "$(total)"

# The sweep, for a session no Stop archived: history is read once for all of them.
sid2="99999999-5555-4444-5555-666666666666"
out2="$CLAUDE_SESSIONDATA_ROOT/$sid2"
mkdir -p "$out2"
printf '{"type":"user","uuid":"x","timestamp":"2026-10-21T13:00:00.000Z","message":{"role":"user","content":"hi"}}\n' > "$projects/-srv-episode/$sid2.jsonl"
printf '{"display":"/btw swept?","pastedContents":{},"timestamp":1792590000000,"project":"/srv/episode","sessionId":"%s"}\n' "$sid2" >> "$CLAUDE_CONFIG_DIR/history.jsonl"
bash "$HOOKS/transcript_archive.sh" sweep "$projects"
expect "the sweep writes a session's /btw" "swept?" "$(jq -r 'select(.kind == "asked") | .question' "$out2/_claude_btw.jsonl" 2>/dev/null)"
expect "the sweep removes its history extract" 0 "$(ls -A "$CLAUDE_SESSIONDATA_ROOT/data" | grep -c btw_history)"

# SubagentStop names a /btw fork by its question, not "unknown".
o=$(jq -nc --arg s "$sid" --arg a "$fork" --arg t "$subagents/agent-$fork.jsonl" --arg tp "$transcript" \
    '{session_id:$s, hook_event_name:"SubagentStop", agent_id:$a, agent_type:"fork", agent_transcript_path:$t, transcript_path:$tp, last_assistant_message:"Published."}' \
    | bash "$HOOKS/subagent_stop_hook.sh")
expect "SubagentStop prints nothing" "" "$o"
expect "the fork's output.md is named by its question" "# what is the 'threads.yaml' file…" "$(grep '^# ' "$out/agents/$fork.output.md")"
expect "trace.log names the fork by its question" 1 "$(grep -c "Agent 'what is the 'threads.yaml' file…' ($fork)" "$out/trace.log")"

echo
if [ "$failures" -eq 0 ]; then
    echo "all /btw checks passed"
else
    echo "$failures check(s) failed"
    exit 1
fi
