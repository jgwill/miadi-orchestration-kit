#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

input=$(cat -)
session_id=$(echo "$input" | jq -r .session_id)

# Capture-output root resolved in lib.sh (portable via env alias / self-location)
output_dir="$CLAUDE_SESSIONDATA_ROOT/$session_id"
mkdir -p "$output_dir"
claude_write_jsonl "$output_dir/_claude_PreToolUse.jsonl" "$input"

# --- Tool-Specific Logic ---
tool_name=$(echo "$input" | jq -r .tool_name)

if [ "$tool_name" = "Bash" ]; then
    bash_command=$(echo "$input" | jq -r '.tool_input.command // empty')
    if [ -n "$bash_command" ]; then
        # Call the centralized git command validator (co-located at the hooks root)
        validator="${MIADI_HOOKS_SCRIPT_DIR:-$_CLAUDE_HOOKS_ROOT}/git_command_validator.sh"
        if [ -x "$validator" ] && ! "$validator" "$bash_command"; then
            exit 2
        fi
    fi
fi

# Mark the start of a Bash or MCP call: the files it writes are found and
# copied to written/ when it ends (lib.sh, claude_files_written_mark_start).
if claude_files_written_scans "$tool_name"; then
    claude_files_written_mark_start "$output_dir" "$input"
fi

if [ "$tool_name" = "ExitPlanMode" ]; then
    # Create plans directory
    plans_dir="$output_dir/plans"
    mkdir -p "$plans_dir"
    
    # Generate timestamp in yyMMddHHmm format
    timestamp=$(date +"%y%m%d%H%M")
    
    # Extract plan content
    plan_content=$(echo "$input" | jq -r '.tool_input.plan // empty')
    
    # Only save if plan content exists
    if [ -n "$plan_content" ]; then
        plan_file="$plans_dir/session_${session_id}_${timestamp}.md"
        claude_sanitize_text "$plan_content" > "$plan_file"
	 #Add the content of the Plan as observation to the trace
	 #/src/miette/claude-plan-insights/miette_claude_plan_perspective_claude.sh
	 #./miette_claude_plan_perspective.sh

        # stdio MUST be detached from the hook's pipes: Claude Code holds the
        # ExitPlanMode tool open until every writer on the hook's stdout/stderr
        # closes — an inherited fd in this background subshell stalls the plan
        # presentation for the whole carriage duration (up to 30 min).
        ((cd /opt/binscripts/plan-insight && \
                ./miette_claude_plan_perspective_claude.sh $plan_file) \
			&& echo "Plan content parsed thru Miette at $(tlid min)" >> "$output_dir/trace.log" || echo "Miette parsing failed at $(tlid min)" >> "$output_dir/trace.log" ) \
			>> "$output_dir/miette_carriage.log" 2>&1 < /dev/null &

    fi
elif [ "$tool_name" = "Write" ]; then
    # Create the 'proposed' directory for storing agent's proposed files
    proposed_dir="$output_dir/proposed"
    mkdir -p "$proposed_dir"

    # Extract file path and content from the tool input
    file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
    file_content=$(echo "$input" | jq -r '.tool_input.content // empty')
    
    # Proceed only if both file_path and file_content are non-empty
    if [ -n "$file_path" ] && [ -n "$file_content" ]; then
        # Extract just the filename from the full path
        filename=$(basename "$file_path")
        
        # Define the full path for the proposed file
        proposed_file_path="$proposed_dir/$filename"
        
        # Save the proposed content to the new file
        claude_sanitize_text "$file_content" > "$proposed_file_path"

        # Log this action for observability
        echo "Saved proposed file content to $proposed_file_path" >> "$output_dir/trace.log"

        # --- Future Enhancement: Launch Gemini Review Agent ---
        # The following line is a placeholder for launching the non-interactive Gemini agent.
        # It would need the correct command and context variables.
        # (geminiid "Review the proposed file at $proposed_file_path" --context-vars ... &)
    fi
elif [ "$tool_name" = "Edit" ]; then
    proposed_dir="$output_dir/proposed"
    mkdir -p "$proposed_dir"

    file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
    old_content=$(echo "$input" | jq -r '.tool_input.old_string // empty')
    new_content=$(echo "$input" | jq -r '.tool_input.new_string // empty')

    if [ -n "$file_path" ] && [ -n "$new_content" ]; then
        filename=$(basename "$file_path")
        proposed_file_path="$proposed_dir/$filename.proposed.md"
        
        # Create markdown content with old and new strings
        {
            echo "# Proposed Edit for \`$filename\`"
            echo ""
            echo "## Original Content"
            echo ""
            echo "\`\`\`"
            echo "$old_content"
            echo "\`\`\`"
            echo ""
            echo "## Proposed New Content"
            echo ""
            echo "\`\`\`"
            echo "$new_content"
            echo "\`\`\`"
        } | hook_secret_sanitize_stream > "$proposed_file_path"

        echo "Saved proposed edit content to $proposed_file_path" >> "$output_dir/trace.log"
    fi
fi
