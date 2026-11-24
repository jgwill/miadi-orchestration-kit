#!/usr/bin/env bash
# Tells a resumed Mia seat that its listener is gone. `mia-listen.mjs await` runs in the background
# of one Claude Code process and ends with it: an exit, a crash, a reboot. Claude Code then shows
# "Background shell command didn't finish before the previous session ended" as a note that starts
# no reply, so the seat stayed deaf and nothing said so (2026-11-24: five seats after gaia rebooted).
# Silent outside an episode, and in an episode where no seat has listened yet.
input=$(cat 2>/dev/null || true)
read_field() { printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s)[process.argv[1]]??""))}catch{}})' "$1" 2>/dev/null; }
source=$(read_field source)
[ -z "$source" ] || [ "$source" = "resume" ] || exit 0
dir=$(read_field cwd); dir="${dir:-$PWD}"
while [ ! -f "$dir/episode.yaml" ]; do
  parent=$(dirname "$dir")
  [ "$parent" = "$dir" ] && exit 0
  dir="$parent"
done
state_dir="${MIADI_MIA_COMPANION_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/miadi-mia-companion}"
[ -f "$state_dir/$(basename "$dir").json" ] || exit 0
context="This Mia seat was resumed. A listener it had started (mia-listen.mjs await, in the background) ended with the earlier process, so nothing is listening on this episode now. In your first turn, run mia-listen.mjs status, start the listener again with Bash run_in_background: true, and say in one line that Mia is listening and how many takes are unheard. Takes recorded meanwhile wake it at once. Leave it stopped only if the person had asked Mia to stop listening."
CONTEXT="$context" node -e 'process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: process.env.CONTEXT } }))'
