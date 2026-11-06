#!/usr/bin/env bash
# The tmux server guard: an agent's command does not end the server that holds every session
# (2026-11-05 20:49). This test starts one private server, with -S and no configuration, to
# prove the refusal of a kill by pid. Nothing here reaches the live server: the guard only reads.
# Run: bash tests/tmux-server-guard.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="$HERE/hooks/tmux_server_guard.sh"
WORK="$(mktemp -d)"
SOCKET="$WORK/s"
trap 'tmux -S "$SOCKET" kill-server 2>/dev/null; rm -rf "$WORK"' EXIT
unset MIADI_TMUX_SERVER_GUARD

failures=0
expect() {  # <label> <expected exit> <command>
    python3 -c 'import json,sys;print(json.dumps({"tool_name":"Bash","cwd":sys.argv[1],"tool_input":{"command":sys.argv[2]}}))' \
        "$WORK" "$3" | bash "$GUARD" 2>/dev/null
    local got=$?
    if [ "$2" = "$got" ]; then
        echo "ok   $1"
    else
        echo "FAIL $1: expected exit $2, got $got"
        failures=$((failures + 1))
    fi
}

expect "tmux kill-server is refused" 2 "tmux kill-server"
expect "with a path" 2 "/usr/bin/tmux kill-server"
expect "abbreviated" 2 "tmux kill-ser"
expect "after other commands" 2 "cd /tmp && echo hi; tmux kill-server"
expect "on a later line" 2 $'echo hi\ntmux kill-server'
expect "across a line continuation" 2 $'tmux \\\n  kill-server'
expect "with a configuration file" 2 "tmux -f /dev/null kill-server"
expect "through a shell" 2 "bash -c 'tmux kill-server'"
expect "through a login shell" 2 "bash -lc 'cd /tmp; tmux kill-server'"
expect "through a wrapper" 2 "timeout 5 tmux kill-server"
expect "as another user" 2 "sudo -u tushell tmux kill-server"
expect "in a command substitution" 2 'echo $(tmux kill-server)'
expect "the shape of 20:49: TMUX_TMPDIR alone does not move the client" 2 "TMUX_TMPDIR=/tmp/x tmux kill-server"
expect "tmux kill-session -a is refused" 2 "tmux kill-session -a"
expect "kill-session -a keeping one" 2 "tmux kill-session -a -t keep"
expect "pkill tmux" 2 "pkill tmux"
expect "pkill -x tmux" 2 "pkill -x tmux"
expect "pkill -f on the server's title" 2 "pkill -f 'tmux: server'"
expect "killall -9 tmux" 2 "killall -9 tmux"
expect "systemctl stop" 2 "systemctl --user stop tmux-server"
expect "systemctl restart" 2 "systemctl --user restart tmux-server.service"

expect "a server of its own, -L" 0 "tmux -L t1 kill-server"
expect "a server of its own, -L attached" 0 "tmux -Lt1 kill-server"
expect "a server of its own, -S" 0 "tmux -S /tmp/x/s kill-server"
expect "a server of its own, -L after -f" 0 "tmux -f /dev/null -L t1 kill-server"
expect "TMUX cleared and TMUX_TMPDIR set" 0 "TMUX= TMUX_TMPDIR=/tmp/x tmux kill-server"
expect "env -u TMUX and TMUX_TMPDIR set" 0 "env -u TMUX TMUX_TMPDIR=/tmp/x tmux kill-server"
expect "one session" 0 "tmux kill-session -t one"
expect "reading" 0 "tmux ls; tmux list-panes -a"
expect "the words in a commit message" 0 "git commit -m 'tmux kill-server took the sessions down'"
expect "the words in a grep" 0 "grep -rn 'tmux kill-server' packages/"
expect "the words in an echo" 0 "echo tmux kill-server"
expect "the words in a comment" 0 $'# tmux kill-server\nls'
expect "the words in a heredoc body" 0 $'cat > notes.md <<\'EOF\'\ntmux kill-server\nEOF\nls'
expect "the test that was written at 20:48, written to a file" 0 $'cat > t.mjs <<\'EOF\'\ntry { tmux("kill-server") } catch {}\nEOF'
expect "a command after a heredoc is still read" 2 $'cat > n <<EOF\nx\nEOF\ntmux kill-server'
expect "pkill of something else" 0 "pkill -f some-other-thing"
expect "a pkill naming a word that holds tmux" 0 "pkill -f miadi-tmux-builder"
expect "systemctl status" 0 "systemctl --user status tmux-server"
expect "systemctl start" 0 "systemctl --user start tmux-server"
expect "systemctl restart of another unit" 0 "systemctl --user restart tide-runtime"
expect "a program that calls tmux itself is not seen: the limit of this guard" 0 "node --test test/teams.test.mjs"

tmux -S "$SOCKET" -f /dev/null new-session -d -s private "sleep 60"
pid="$(tmux -S "$SOCKET" display-message -p '#{pid}')"
expect "kill of the server's pid" 2 "kill $pid"
expect "kill -9 of the server's pid" 2 "kill -9 $pid"
expect "kill of another pid" 0 "kill $$"

got=0
python3 -c 'import json;print(json.dumps({"tool_name":"Bash","tool_input":{"command":"tmux kill-server"}}))' \
    | MIADI_TMUX_SERVER_GUARD=off bash "$GUARD" 2>/dev/null || got=$?
if [ "$got" = 0 ]; then echo "ok   off in the session environment"; else echo "FAIL off: got $got"; failures=$((failures + 1)); fi
expect "a prefix in the command text does not turn it off" 2 "MIADI_TMUX_SERVER_GUARD=off tmux kill-server"

got=0
printf 'not json' | bash "$GUARD" 2>/dev/null || got=$?
if [ "$got" = 0 ]; then echo "ok   an internal failure allows"; else echo "FAIL internal failure: got $got"; failures=$((failures + 1)); fi

if [ "$failures" -gt 0 ]; then
    echo "$failures failed"
    exit 1
fi
echo "all passed"
