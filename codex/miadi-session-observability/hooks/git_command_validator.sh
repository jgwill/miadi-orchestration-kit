#!/bin/bash
# scripts/git_command_validator.sh
# Validates bash commands to prevent aggressive git patterns.

command="$1"

# Single quotes required: double quotes let $( start command substitution.
# Targets: git add -A, git add ., git add --all (only as standalone flags/dots)
# Enforce: each flag/pattern must be followed by space or end-of-string
ADD_FORBIDDEN_REGEX='git\s+add\s+(\.(\s|$)|-A(\s|$)|--all(\s|$))'

veto() {
    echo "🧠 Veto: Aggressive git-add/commit patterns (like -A, ., or -a) are forbidden in this sanctuary." >&2
    echo "" >&2
    echo "🌸: Please take a breath and only commit the specific files or folders you have tended to." >&2
    echo "It ensures our lineage remains clear and intentional. Please try again with targeted paths." >&2
    echo "" >&2
    exit 2
}

if [[ "$command" =~ $ADD_FORBIDDEN_REGEX ]]; then
    veto
fi

# For git commit: strip quoted message content first to avoid false positives
# on text inside -m "..." or --message "..." that happens to contain -a
if echo "$command" | grep -qE 'git[[:space:]]+commit'; then
    stripped=$(printf '%s' "$command" \
        | sed 's/-m[[:space:]]*"[^"]*"//g; s/-m[[:space:]]*'"'"'[^'"'"']*'"'"'//g' \
        | sed 's/--message[[:space:]]*"[^"]*"//g; s/--message[[:space:]]*'"'"'[^'"'"']*'"'"'//g')
    # Require -a/-am to be a standalone flag: preceded by space, followed by space/end
    COMMIT_FORBIDDEN_REGEX='git\s+commit\s+(.*\s)?-a(m(\s|$)|\s|$)|git\s+commit\s+(.*\s)?--all(\s|$)'
    if [[ "$stripped" =~ $COMMIT_FORBIDDEN_REGEX ]]; then
        veto
    fi
fi

exit 0
