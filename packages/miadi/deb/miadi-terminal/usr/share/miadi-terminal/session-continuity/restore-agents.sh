#!/usr/bin/env bash
# tmux-restore-agents.sh
# tmux-resurrect post-restore-all hook: hand the agents to tide once tmux has restored its panes.
#
# tmux brings back the sessions, their folders and their visible screens. tide brings back the
# agents: `tide agents restore` reads tide's last snapshot from before this tmux server started,
# relaunches the agents that were running there with their launch alias and tools, one at a
# time, and types the resume command for the ones that had been exited (jgwill/Miadi#691).
#
# Runs tide detached so the restore returns at once. The log goes to the tide state folder.
#   MIADI_TIDE_BIN  the tide executable (default: the tide-runtime service venv, then the one
#                   miadi-tide installs, then PATH: a login shell's PATH can name another tide,
#                   such as an older ironsilk without `agents`, jgwill/miadi-orchestration-kit#114)
#   MIADI_HOME      the tide state folder (default: ~/.miadi/navigator)
#   MIADI_TIDE_MEMORY_FLOOR_GB  read by tide itself (0.9.70 and later): below this much available
#                   memory it types the commands instead of running them (default 16). Set it in
#                   ~/.config/environment.d/ so tmux-server.service, and so this hook, has it.
# Installed by 14-tmux-resurrect.sh as @resurrect-hook-post-restore-all. jgwill/gaia#89.

set -u

home="${MIADI_HOME:-$HOME/.miadi/navigator}"
log_dir="$home/restore"
mkdir -p "$log_dir"
log="$log_dir/hook-$(date +%y%m%d-%H%M%S).log"

tide="${MIADI_TIDE_BIN:-}"
if [ -z "$tide" ]; then
    for candidate in "$HOME/.local/share/tide-runtime/venv/bin/tide" /usr/lib/miadi-tide/tide-runtime/bin/tide \
                     "$(command -v tide 2>/dev/null)"; do
        if [ -n "$candidate" ] && [ -x "$candidate" ]; then
            tide="$candidate"
            break
        fi
    done
fi

if [ -z "$tide" ]; then
    echo "$(date -Is) tmux restore finished; no tide executable found, agents not restored" >> "$log"
    exit 0
fi

echo "$(date -Is) tmux restore finished; starting $tide agents restore (TMUX=${TMUX:-unset})" >> "$log"
MIADI_HOME="$home" setsid nohup "$tide" agents restore >> "$log" 2>&1 < /dev/null &
exit 0
