#!/usr/bin/env bash
# tmux-server-watch: a tmux server that ended while the machine stayed up comes back, and one a
# person stopped stays down (2026-11-05). Every server here is private: -S in a temporary folder,
# -f /dev/null so no plugin restores anything into it. systemctl and systemd-run are stand-ins that
# record their calls and start a private server, and nothing reaches the user manager.
#   bash tests/tmux-server-watch.sh
set -u
unset TMUX TMUX_PANE
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
watch="$here/miadi-terminal/usr/share/miadi-terminal/session-continuity/server-watch.sh"
work="$(mktemp -d)"
sock="$work/s"
other="$work/o"
held_pids=()
cleanup() {
    tmux -S "$sock" kill-server 2>/dev/null
    tmux -S "$other" kill-server 2>/dev/null
    for pid in "${held_pids[@]:-}"; do [ -n "$pid" ] && kill -KILL "$pid" 2>/dev/null; done
    pid="$(ss -xlpH 2>/dev/null | grep -F " $sock " | grep -oE 'pid=[0-9]+' | head -n 1 | cut -d= -f2)"
    [ -n "$pid" ] && kill -KILL "$pid" 2>/dev/null
    rm -rf "$work"
}
trap cleanup EXIT

mkdir -p "$work/bin" "$work/home"
cat > "$work/bin/systemctl" <<EOF
#!/usr/bin/env bash
echo "systemctl \$*" >> "$work/calls"
case "\$*" in
    *"is-active --quiet tmux-server-watch.timer"*) [ "\$(cat "$work/timer")" = active ] ;;
    *is-system-running*) cat "$work/manager" ;;
    *"show -p ActiveState"*) cat "$work/unit" ;;
    *"is-active tmux-server.service"*) cat "$work/unit" ;;
    *"start tmux-server.service"*) tmux -S "$sock" -f /dev/null new-session -d -s restored "sleep 120" ;;
esac
EOF
cat > "$work/bin/systemd-run" <<EOF
#!/usr/bin/env bash
echo "systemd-run \$*" >> "$work/calls"
tmux -S "$sock" -f /dev/null new-session -d -s restored "sleep 120"
EOF
chmod +x "$work/bin/systemctl" "$work/bin/systemd-run"

set_states() { echo "$1" > "$work/timer"; echo "$2" > "$work/manager"; echo "$3" > "$work/unit"; : > "$work/calls"; }
run_watch() {
    PATH="$work/bin:$PATH" HOME="$work/home" MIADI_HOME="$work/home/state" MIADI_TMUX_WATCH_SOCKET="$sock" \
        MIADI_TMUX_WATCH_CONFIRM_SECONDS="${CONFIRM:-0}" MIADI_TMUX_WATCH_MAX="${MAX:-100}" bash "$watch" > "$work/out" 2>&1
}
up() { tmux -S "$sock" -f /dev/null new-session -d -s "${1:-x}" "${2:-sleep 120}"; }
down() { tmux -S "$sock" kill-server 2>/dev/null; sleep 0.3; }

failures=0
ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; failures=$((failures + 1)); }
check() {  # <label> <command...>
    local label="$1"; shift
    if "$@" > /dev/null 2>&1; then ok "$label"; else bad "$label"; fi
}
started() { grep -qE "$1" "$work/calls"; }
not_started() { ! grep -qE "start tmux-server.service|^systemd-run" "$work/calls"; }
running() { tmux -S "$sock" has-session 2>/dev/null; }
ended() { case "$(ps -o stat= -p "$1" 2>/dev/null)" in "" | Z*) return 0 ;; esac; return 1; }

set_states active degraded inactive
up; run_watch
check "a running server: nothing starts" not_started
down

set_states active degraded inactive
run_watch
check "gone, the unit inactive: tmux-server.service is started" started "start tmux-server.service"
check "  the server is back" running
down

set_states active running active
run_watch
check "gone, the unit active on what outlived the server: a unit of its own" started "^systemd-run --user --unit=tmux-server-recover-"
check "  and not a restart, which would kill what outlived it" bash -c "! grep -q 'restart' '$work/calls'"
check "  started as tmux through env, so continuum counts it" started "/usr/bin/env tmux new-session -d -c $work/home"
check "  the server is back" running
down

set_states inactive degraded inactive
run_watch
check "a person stopped it (the timer is stopped): stays down" not_started

set_states active degraded activating
run_watch
check "the unit is starting: left to it" not_started

set_states active stopping inactive
run_watch
check "the user manager is stopping: nothing starts" not_started

set_states active starting inactive
run_watch
check "the user manager is starting: nothing starts" not_started

set_states active degraded inactive
(sleep 0.3; up) &
CONFIRM=1 run_watch
wait
check "back before the second question: nothing starts" not_started
down

mkdir -p "$work/stub"
cat > "$work/stub/tmux" <<'EOF'
#!/usr/bin/env bash
echo "error connecting to /tmp/x (Permission denied)" >&2
exit 1
EOF
chmod +x "$work/stub/tmux"
set_states active degraded inactive
PATH="$work/stub:$PATH" run_watch
check "an answer it cannot read: nothing starts" not_started
check "  and it prints the answer" grep -q "unknown: error connecting" "$work/out"

rm -f "$work/home/state/restore/server-watch."*
set_states active degraded inactive
for i in 1 2; do MAX=2 run_watch; down; done
: > "$work/calls"
MAX=2 run_watch
check "the limit: no more than MIADI_TMUX_WATCH_MAX an hour" not_started
check "  and it says why" grep -q "not starting a server: 2 started in the last hour" "$work/home/state/restore/server-watch.log"
MAX=2 run_watch; MAX=2 run_watch
check "  once, not every minute" test "$(grep -c 'not starting a server' "$work/home/state/restore/server-watch.log")" = 1
rm -f "$work/home/state/restore/server-watch."*

# The state of 20:49: a client whose terminal nobody reads holds a server that has shut down. A
# client attached to another server must survive all of this.
cat > "$work/hold.py" <<'EOF'
import os, pty, sys, time
sock = sys.argv[1]
pid, fd = pty.fork()
if pid == 0:
    os.environ["TERM"] = "xterm"
    os.execvp("tmux", ["tmux", "-S", sock, "attach", "-t", "x"])
print(pid, flush=True)
time.sleep(300)
EOF
tmux -S "$other" -f /dev/null new-session -d -s x "sleep 300"
python3 "$work/hold.py" "$other" > "$work/other-client" &
held_pids+=("$!")
up x "yes"
python3 "$work/hold.py" "$sock" > "$work/stalled-client" &
held_pids+=("$!")
sleep 2
server="$(tmux -S "$sock" display -p '#{pid}')"
tmux -S "$sock" kill-server
sleep 1
answer="$(tmux -S "$sock" has-session 2>&1)"
stalled="$(cat "$work/stalled-client")"
other_client="$(cat "$work/other-client")"
case "$answer" in
    "server exited"*)
        if [ -d "/proc/$server" ]; then ok "a stalled client holds a server that shut down: '$answer'"; else bad "the held server exited by itself"; fi
        set_states active degraded inactive
        run_watch
        check "  the held server is killed" test ! -d "/proc/$server"
        sleep 0.5
        check "  the stalled client is ended, so continuum does not count it" ended "$stalled"
        check "  tmux-server.service is started" started "start tmux-server.service"
        check "  the server is back" running
        check "  the client of another server is left alone" test -d "/proc/$other_client"
        ;;
    *)
        bad "could not hold the server with a stalled client: tmux answered '$answer'"
        ;;
esac

if [ "$failures" -gt 0 ]; then
    echo "$failures failed"
    exit 1
fi
echo "all passed"
