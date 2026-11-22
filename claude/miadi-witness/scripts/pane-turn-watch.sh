#!/usr/bin/env bash
# pane-turn-watch.sh: wait, with no time limit, until a Claude Code pane finishes a new turn.
#
#   pane-turn-watch.sh --target <session[:window]> [--ssh <user@host>] [--every <seconds>]
#
# Run it as a background command. It prints nothing while the pane is quiet, and it never
# exits on a timeout: a witnessed session may move in two days. It exits 0 once the last
# "done <time>" line of the pane changes, printing "PANE TURN <target>: <line>" and the pane's
# last 60 lines. A failed read (ssh down, pane gone for a moment) is retried silently; after
# --gone-after reads in a row fail (default 720, a day at 120 s) it exits 3, "PANE GONE".
# The seat reads the turn, writes only what changed, and runs the same command again.
set -u
target="" ssh="" every=120 gone_after=720
while [ $# -gt 0 ]; do
  case "$1" in
    --target) target="$2"; shift 2;;
    --ssh) ssh="$2"; shift 2;;
    --every) every="$2"; shift 2;;
    --gone-after) gone_after="$2"; shift 2;;
    *) echo "unknown argument: $1" >&2; exit 2;;
  esac
done
[ -n "$target" ] || { echo "usage: pane-turn-watch.sh --target <session[:window]> [--ssh user@host] [--every s]" >&2; exit 2; }
capture() {
  local cmd="tmux capture-pane -p -J -S -3000 -t '$target'"
  if [ -n "$ssh" ]; then timeout 20 ssh -o BatchMode=yes -o ConnectTimeout=10 "$ssh" "$cmd" 2>/dev/null
  else eval "$cmd" 2>/dev/null; fi
}
last_done() { capture | grep -E 'done [0-9]{1,2}:[0-9]{2}( [AP]M)?' | tail -1 | sed 's/[[:space:]]*$//'; }
base="$(last_done)"; fails=0
while :; do
  sleep "$every"
  now="$(last_done)"
  if [ -z "$now" ]; then
    fails=$((fails + 1))
    [ "$fails" -ge "$gone_after" ] && { echo "PANE GONE $target: no readable turn for $fails reads"; exit 3; }
    continue
  fi
  fails=0
  if [ -z "$base" ]; then base="$now"; continue; fi
  if [ "$now" != "$base" ]; then
    echo "PANE TURN $target: $now"
    capture | grep -v '^[[:space:]]*$' | tail -60
    exit 0
  fi
done
