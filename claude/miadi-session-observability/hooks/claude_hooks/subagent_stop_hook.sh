#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

input=$(cat -)
session_id=$(echo "$input" | jq -r .session_id)

# Capture-output root resolved in lib.sh (portable via env alias / self-location)
output_dir="$CLAUDE_SESSIONDATA_ROOT/$session_id"
mkdir -p "$output_dir"

# Save last_assistant_message as its own event stream for ceremony-session-observer
last_msg=$(echo "$input" | jq -r '.last_assistant_message // empty')
if [ -n "$last_msg" ]; then
  claude_write_jsonl "$output_dir/_claude_AssistantResponse.jsonl" "$input"
  claude_write_json "$output_dir/last_claude_AssistantResponse.json" "$input"
fi

claude_write_jsonl "$output_dir/_claude_SubagentStop.jsonl" "$input"
claude_write_json "$output_dir/last_claude_SubagentStop.jsonl" "$input"

# --- Per-Agent Output Capture ---
agent_id=$(echo "$input" | jq -r '.agent_id // empty')
agent_type=$(echo "$input" | jq -r '.agent_type // "unknown"')
agent_transcript=$(echo "$input" | jq -r '.agent_transcript_path // empty')

if [ -n "$agent_id" ] && [ -n "$last_msg" ]; then
    agents_dir="$output_dir/agents"
    mkdir -p "$agents_dir"
    timestamp=$(date +"%y%m%d%H%M")

    # Try to load launch manifest (saved by post_tool_use_hook on Agent PostToolUse)
    launch_file="$agents_dir/$agent_id.launch.json"
    if [ -f "$launch_file" ]; then
        description=$(jq -r '.description // "unknown"' "$launch_file")
        prompt=$(jq -r '.prompt // ""' "$launch_file")
    elif [ -n "$agent_transcript" ] && [ -f "${agent_transcript%.jsonl}.meta.json" ]; then
        # No Agent call launched it (a /btw question the person forked):
        # Claude Code's meta.json beside its transcript holds its description.
        description=$(jq -r '.description // "unknown"' "${agent_transcript%.jsonl}.meta.json")
        prompt=""
    else
        description="unknown"
        prompt=""
    fi

    # Write readable per-agent output markdown
    output_file="$agents_dir/$agent_id.output.md"
    {
        echo "---"
        echo "agent_id: $agent_id"
        echo "agent_type: $agent_type"
        echo "description: \"${description//\"/\\\"}\""
        echo "completed_at: $(date -Iseconds)"
        echo "session_id: $session_id"
        [ -n "$agent_transcript" ] && echo "transcript: $agent_transcript"
        echo "---"
        echo ""
        echo "# $description"
        echo ""
        echo "## Agent Output"
        echo ""
        echo "$last_msg"
    } | hook_secret_sanitize_stream > "$output_file"

    # Save prompt separately if available (can be large)
    if [ -n "$prompt" ]; then
        claude_sanitize_text "$prompt" > "$agents_dir/$agent_id.prompt.txt"
    fi


    echo "[$timestamp] Agent '$description' ($agent_id) completed → $output_file" >> "$output_dir/trace.log"
fi

# Keep a sanitized copy of the subagent transcript. Claude Code deletes it
# after cleanupPeriodDays; a symlink here used to die with it, and with it
# the subagent's token usage (scripts/token_counter.py reads these copies).
# The session archive writes agents/<agent_id>.transcript.jsonl, detached so
# the parent's turn does not wait for it.
transcript_path=$(echo "$input" | jq -r '.transcript_path // empty')
if [ -n "$agent_id" ] && [ -n "$transcript_path" ]; then
    claude_detach bash "$SCRIPT_DIR/transcript_archive.sh" session "$transcript_path" "$output_dir"
fi
