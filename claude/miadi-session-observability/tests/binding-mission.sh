#!/usr/bin/env bash
# The binding line names the miadi-run mission that started a session: from MIADI_RUN_MISSION
# at session start, else from the first prompt that names a mission's prompt.md. A session
# with neither carries no mission field, so its lines are as before.
# Run: bash tests/binding-mission.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS="$HERE/hooks/claude_hooks"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export HOME="$WORK/home" CLAUDE_SESSIONDATA_ROOT="$WORK/root"
mkdir -p "$HOME/.claude/sessions" "$CLAUDE_SESSIONDATA_ROOT"
unset TMUX TMUX_PANE MIADI_RUN_MISSION MIADI_RUN_HOME MIADI_TEAM

failures=0
expect() {  # <label> <expected> <actual>
    if [ "$2" = "$3" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected $2, got $3"
        failures=$((failures + 1))
    fi
}

missions="$WORK/missions"
mission="miadiRun-2610111030-kit-capture.v3"
mkdir -p "$missions/$mission"
printf 'Read the kit.\n' > "$missions/$mission/prompt.md"
jq -n --arg id "$mission" '{schema: "miadi-run/mission@1", id: $id,
    prompt: {domain: "eng", name: "miadiRun-2610111030-kit-capture", version: 3,
             reference: "miadi-tracing:eng/prompt/miadiRun-2610111030-kit-capture@3", sha256: "abc"},
    trace: {reference: "miadi-tracing:eng/trace/d87a4c119eb24fb4a718c29e130bd642"},
    episode: {ref: "2026-10-11-episode-600"}}' > "$missions/$mission/mission.json"

stdout_bytes=0
hook() {  # <script> <json> [env assignments...]
    local script="$1" json="$2" o; shift 2
    o=$(printf '%s' "$json" | env "$@" bash "$HOOKS/$script")
    stdout_bytes=$((stdout_bytes + ${#o}))
}
lines() { cat "$CLAUDE_SESSIONDATA_ROOT/$1/_terminal_binding.jsonl" 2>/dev/null; }

# Launched with the mission in its environment.
hook session_start_hook.sh '{"session_id":"s-env","cwd":"/tmp","source":"startup"}' \
    MIADI_RUN_MISSION="$mission" MIADI_RUN_HOME="$missions"
l=$(lines s-env | head -n 1)
expect "the start line names the mission" "$mission" "$(printf '%s' "$l" | jq -r '.mission.id')"
expect "with its pinned prompt" "miadi-tracing:eng/prompt/miadiRun-2610111030-kit-capture@3" "$(printf '%s' "$l" | jq -r '.mission.prompt')"
expect "its version" "3" "$(printf '%s' "$l" | jq -r '.mission.version')"
expect "its trace" "miadi-tracing:eng/trace/d87a4c119eb24fb4a718c29e130bd642" "$(printf '%s' "$l" | jq -r '.mission.trace')"
expect "its episode" "2026-10-11-episode-600" "$(printf '%s' "$l" | jq -r '.mission.episode')"
expect "and how it was known" "env" "$(printf '%s' "$l" | jq -r '.mission.source')"
expect "the root's binding line holds it too" "$mission" \
    "$(jq -r 'select(.session_id == "s-env") | .mission.id' "$CLAUDE_SESSIONDATA_ROOT/data/terminal_bindings.jsonl" | head -n 1)"

# An ordinary session.
hook session_start_hook.sh '{"session_id":"s-plain","cwd":"/tmp","source":"startup"}'
expect "a session without a mission has no mission field" "false" "$(lines s-plain | head -n 1 | jq 'has("mission")')"

# A seat told to read the mission's prompt.md first.
prompt=$(jq -nc --arg p "Read $missions/$mission/prompt.md whole first; it says why you are opened." \
    '{session_id:"s-plain", cwd:"/tmp", hook_event_name:"UserPromptSubmit", prompt:$p}')
hook user_prompt_submit_hook.sh "$prompt"
l=$(lines s-plain | jq -c 'select(.event == "session.mission")')
expect "a prompt naming the mission's prompt.md adds a session.mission line" "$mission" "$(printf '%s' "$l" | jq -r '.mission.id')"
expect "known from the prompt" "prompt" "$(printf '%s' "$l" | jq -r '.mission.source')"
hook user_prompt_submit_hook.sh "$prompt"
expect "a second prompt adds no second line" 1 "$(lines s-plain | jq -c 'select(.event == "session.mission")' | wc -l | tr -d ' ')"

# MIADI_RUN_HOME elsewhere: no "missions" segment in the path, and the path in a later prompt.
home2="$WORK/run-home"
mkdir -p "$home2/$mission"
cp "$missions/$mission/mission.json" "$missions/$mission/prompt.md" "$home2/$mission/"
hook session_start_hook.sh '{"session_id":"s-home","cwd":"/tmp","source":"startup"}'
hook user_prompt_submit_hook.sh '{"session_id":"s-home","cwd":"/tmp","hook_event_name":"UserPromptSubmit","prompt":"/mia-listen"}'
hook user_prompt_submit_hook.sh "$(jq -nc --arg p "Read /tmp/notes/prompt.md whole first. Read $home2/$mission/prompt.md whole first; it says why you are opened." \
    '{session_id:"s-home", cwd:"/tmp", hook_event_name:"UserPromptSubmit", prompt:$p}')"
expect "the mission is found under MIADI_RUN_HOME, past a prompt.md that is not one" "$mission" \
    "$(lines s-home | jq -r 'select(.event == "session.mission") | .mission.id')"

mkdir -p "$WORK/plain/notmission"
printf '{"id":"x"}' > "$WORK/plain/notmission/mission.json"
hook session_start_hook.sh '{"session_id":"s-json","cwd":"/tmp","source":"startup"}'
hook user_prompt_submit_hook.sh "$(jq -nc --arg p "Read $WORK/plain/notmission/prompt.md whole first" '{session_id:"s-json", cwd:"/tmp", hook_event_name:"UserPromptSubmit", prompt:$p}')"
expect "a mission.json that is not miadi-run's adds nothing" 0 "$(lines s-json | jq -c 'select(.event == "session.mission")' | wc -l | tr -d ' ')"

other=$(jq -nc --arg p "Read $WORK/elsewhere/missions/nothing.v1/prompt.md whole first" \
    '{session_id:"s-other", cwd:"/tmp", hook_event_name:"UserPromptSubmit", prompt:$p}')
hook session_start_hook.sh '{"session_id":"s-other","cwd":"/tmp","source":"startup"}'
hook user_prompt_submit_hook.sh "$other"
expect "a path with no mission.json adds nothing" 0 "$(lines s-other | jq -c 'select(.event == "session.mission")' | wc -l | tr -d ' ')"
# Review cycle 3.
hook session_start_hook.sh '{"session_id":"s-review","cwd":"/tmp","source":"startup"}'
hook user_prompt_submit_hook.sh "$(jq -nc --arg p "Is the brief at $missions/$mission/prompt.md clear enough? Do not run it." '{session_id:"s-review", cwd:"/tmp", hook_event_name:"UserPromptSubmit", prompt:$p}')"
expect "a session that only mentions a brief is not its seat" 0 "$(lines s-review | jq -c 'select(.event == "session.mission")' | wc -l | tr -d ' ')"

spaced="$WORK/run home/mia@ops-review.v1"
mkdir -p "$spaced"
jq -n '{schema: "miadi-run/mission@1", id: "mia@ops-review.v1", prompt: {reference: "miadi-tracing:eng/prompt/mia@1", version: 1}}' > "$spaced/mission.json"
hook session_start_hook.sh '{"session_id":"s-at","cwd":"/tmp","source":"startup"}'
hook user_prompt_submit_hook.sh "$(jq -nc --arg p "Read $spaced/prompt.md whole first; it says why you are opened." '{session_id:"s-at", cwd:"/tmp", hook_event_name:"UserPromptSubmit", prompt:$p}')"
expect "an id with @ under a path with a space is found" "mia@ops-review.v1" "$(lines s-at | jq -r 'select(.event == "session.mission") | .mission.id')"

mkdir -p "$WORK/broken/$mission"
printf '{"schema":"miadi-run/mission@1","id":"a"}\n{"id":"b"}\n' > "$WORK/broken/$mission/mission.json"
hook session_start_hook.sh '{"session_id":"s-broken","cwd":"/tmp","source":"startup"}' MIADI_RUN_MISSION="$mission" MIADI_RUN_HOME="$WORK/broken"
expect "a malformed mission.json does not drop the start line" 1 "$(lines s-broken | wc -l | tr -d ' ')"
expect "and records no mission" "false" "$(lines s-broken | head -n 1 | jq 'has("mission")')"

expect "the hooks print nothing" 0 "$stdout_bytes"

echo
if [ "$failures" -eq 0 ]; then
    echo "all binding mission checks passed"
else
    echo "$failures check(s) failed"
    exit 1
fi
