#!/usr/bin/env bash
# One handler per event: prompt aliases and the tool mark are ordered, not racing.
set -o pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for dependency in python3 jq perl; do
    command -v "$dependency" >/dev/null || { echo "Miadi capture needs $dependency" >&2; exit 1; }
done
. "$SCRIPT_DIR/lib.sh"
. "$SCRIPT_DIR/terminal_binding.sh"

if [ "${2:-}" = --job ]; then
    raw=$(cat "$3")
    rm -f "$3"
else
    raw=$(cat)
fi
input=$(printf '%s' "$raw" | python3 "$SCRIPT_DIR/native.py" normalize)
[ -n "$input" ] || exit 0
event="${1:-$(jq -r '.hook_event_name // empty' <<< "$input")}"
CODEX_SESSION_ID=$(jq -r '.session_id' <<< "$input")
export CODEX_SESSION_ID
output_dir="$CODEX_SESSIONDATA_ROOT/$CODEX_SESSION_ID"
mkdir -p "$output_dir" "$CODEX_SESSIONDATA_ROOT/data"
if { [ "$event" = SessionEnd ] || [ "$event" = Interrupt ]; } && [ "${2:-}" != --job ]; then
    # Codex caps these hooks at three seconds. Preserve process identity before
    # detaching, and leave only sanitized data in the short-lived job file.
    export _TB_AGENT_PID="$(_tb_agent_pid "$CODEX_SESSION_ID")"
    export _TB_ARGV_JSON="$(_tb_argv_json "$_TB_AGENT_PID")"
    job=$(mktemp "$output_dir/.end-event.XXXXXX")
    hook_secret_sanitize_text "$raw" > "$job"
    codex_detach bash "$SCRIPT_DIR/dispatch.sh" "$event" --job "$job"
    exit 0
fi
raw=$(jq -c --arg event "$event" '. + {hook_event_name:$event,captured_at:(now|todate),captured_by:"miadi-session-observability"}' <<< "$raw")
codex_write_jsonl "$output_dir/_codex_${event}.jsonl" "$raw"
codex_write_json "$output_dir/last_codex_${event}.json" "$raw"
codex_write_jsonl "$output_dir/_codex_hooks_all.jsonl" "$raw"

alias_event() {
    codex_write_jsonl "$output_dir/_codex_$1.jsonl" "${2:-$raw}"
    codex_write_json "$output_dir/last_codex_$1.json" "${2:-$raw}"
}
archive_turn() {
    local transcript
    transcript=$(jq -r '.transcript_path // empty' <<< "$input")
    [ -f "$transcript" ] || return 0
    codex_detach python3 "$SCRIPT_DIR/native.py" archive "$transcript" "$output_dir"
}
case "$event" in
    SessionStart)
        alias_event session_starts
        codex_write_jsonl "$CODEX_SESSIONDATA_ROOT/data/session_starts_all.jsonl" "$raw"
        codex_write_terminal_binding session.start "$input"
        codex_detach python3 "$SCRIPT_DIR/native.py" sweep "$CODEX_SESSIONDATA_ROOT"
        ;;
    UserPromptSubmit)
        alias_event user_inputs
        codex_check_terminal_binding_rename "$input"
        codex_check_terminal_binding_mission "$input"
        codex_artifact_comments_prompt_queue "$output_dir" "$input"
        # Best-effort prompt classification is retained from the legacy Codex hooks.
        # It records words; it never grants approval or drives an action.
        prompt=$(jq -r '.prompt // empty' <<< "$input")
        kind="" stream=""
        if printf '%s' "$prompt" | grep -Eiq "^(no|do not|don't|stop|instead|wrong|reject|not that|hold on)\\b"; then
            kind=CorrectiveFeedback; stream=PreToolUse
        elif printf '%s' "$prompt" | grep -Eiq '^(yes|yep|ok|okay|go ahead|continue|approved|do it|please proceed)\b'; then
            kind=AcceptedRedirection; stream=PostToolUse
        fi
        if [ -n "$kind" ]; then
            latest=$(tail -n 1 "$output_dir/_codex_${stream}.jsonl" 2>/dev/null)
            feedback=$(jq -c --arg kind "$kind" --argjson previous "${latest:-null}" \
                '. + {hook_event_name:$kind,source:"codex_user_prompt_submit_best_effort",previous_tool:$previous}' <<< "$raw")
            alias_event "$kind" "$feedback"
        fi
        ;;
    PreToolUse)
        tool=$(jq -r '.tool_name // empty' <<< "$input")
        if [ "$tool" = Bash ]; then
            command=$(jq -r '.tool_input.command // empty' <<< "$input")
            bash "$_CODEX_HOOKS_ROOT/git_command_validator.sh" "$command" || exit 2
            alias_event bash_commands
        fi
        printf '%s' "$input" | bash "$_CODEX_HOOKS_ROOT/workspace_clone_guard.sh" || exit 2
        if codex_files_written_scans "$tool"; then
            codex_files_written_mark_start "$output_dir" "$input"
        fi
        case "$tool" in
            apply_patch|Edit|Write|update_plan|ExitPlanMode)
                id=$(jq -r '.tool_use_id // empty' <<< "$input")
                if [[ "$id" =~ ^[A-Za-z0-9_-]+$ ]]; then
                    mkdir -p "$output_dir/proposed"
                    jq -r 'if (.tool_input.command // "") != "" then .tool_input.command else (.tool_input.content // (.tool_input|tojson)) end' <<< "$input" \
                        | hook_secret_sanitize_stream > "$output_dir/proposed/$id.patch"
                fi
                if [ "$tool" = Write ]; then
                    path=$(jq -r '.tool_input.file_path // empty' <<< "$input")
                    if [ -n "$path" ] && ! _codex_may_hold_credentials "$path"; then
                        jq -r '.tool_input.content // empty' <<< "$input" | hook_secret_sanitize_stream \
                            > "$output_dir/proposed/$(basename "$path")"
                    fi
                fi
                ;;
        esac
        ;;
    PostToolUse|PostToolUseFailure)
        tool=$(jq -r '.tool_name // empty' <<< "$input")
        if [ "$(jq -r '.codex_tool_exit_code // empty' <<< "$input")" != "" ]; then
            codex_write_jsonl "$output_dir/_codex_PostToolUse_status.jsonl" "$input"
        fi
        if [ "$event" = PostToolUse ] && [ "$(jq -r '.codex_tool_failed' <<< "$input")" = true ]; then
            alias_event PostToolUseFailure "$(jq -c '. + {hook_event_name:"PostToolUseFailure",source:"derived_from_PostToolUse"}' <<< "$input")"
        fi
        codex_files_written_queue "$output_dir" "$input" "$tool"
        codex_publications_queue "$output_dir" "$input" "$tool"
        printf '%s' "$input" | python3 "$SCRIPT_DIR/native.py" publications "$output_dir"
        codex_artifact_comments_queue "$output_dir" "$input" "$tool"
        if [ "$tool" = apply_patch ]; then
            # Explicit patch targets also cover files outside cwd and moves.
            codex_detach bash "$SCRIPT_DIR/patch_written.sh" "$output_dir" "$(hook_secret_sanitize_text "$input")"
        elif [ "$tool" = update_plan ] || [ "$tool" = ExitPlanMode ]; then
            mkdir -p "$output_dir/plans"
            id=$(jq -r '.tool_use_id // empty' <<< "$input")
            if [[ "$id" =~ ^[A-Za-z0-9_-]+$ ]]; then
                jq '.tool_input' <<< "$input" | hook_secret_sanitize_stream > "$output_dir/plans/$id.json"
            fi
        fi
        ;;
    SubagentStart|SubagentStop)
        agent=$(jq -r '.agent_id // empty' <<< "$input")
        if [[ "$agent" =~ ^[A-Za-z0-9_-]+$ ]]; then
            mkdir -p "$output_dir/agents"
            codex_write_json "$output_dir/agents/$agent.meta.json" "$raw"
            codex_write_jsonl "$output_dir/agents/$agent.events.jsonl" "$raw"
            transcript=$(jq -r '.agent_transcript_path // empty' <<< "$input")
            [ ! -f "$transcript" ] || codex_detach python3 "$SCRIPT_DIR/native.py" archive "$transcript" "$output_dir" "$agent"
        fi
        archive_turn
        ;;
    Stop|Interrupt|PreCompact|PostCompact|SessionEnd)
        codex_check_terminal_binding_rename "$input"
        if [ -n "$(jq -r '.last_assistant_message // empty' <<< "$input")" ]; then
            alias_event AssistantResponse
        fi
        [ "$event" != SessionEnd ] || codex_write_terminal_binding session.end "$input"
        archive_turn
        ;;
esac
exit 0
