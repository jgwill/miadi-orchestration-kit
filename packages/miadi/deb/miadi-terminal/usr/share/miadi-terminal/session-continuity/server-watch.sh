#!/usr/bin/env bash
# tmux-server-watch.sh
# Run every minute by tmux-server-watch.timer. A tmux server that ended while the machine stayed up
# comes back, and its restore hands the agents to tide as after a boot. Without this nothing starts
# a server after the boot: on 2026-11-05 at 20:49 a test's kill-server emptied 120 panes, and they
# stayed empty until a person noticed.
#
# `tmux has-session` says what state the server is in:
#   no server running   it is gone: an ended server leaves its socket behind.
#   error connecting, No such file   no socket: no server ran here since /tmp was last cleaned, and
#                       starting the first one is the unit's work at boot. Nothing to do.
#   server exited       it shut down and cannot finish: a client it cannot reach holds it, such as a
#                       phone on a stalled SSH connection. It has no panes left, so it is killed.
#   anything else       left alone and printed: this script cannot tell what it means.
# It asks twice, MIADI_TMUX_WATCH_CONFIRM_SECONDS apart (default 15).
#
# It does nothing when
#   - tide's last snapshot with panes names no running agent, or there is no such snapshot: nothing
#     has work to go back to, and a person who closes their last shell does not want tmux back.
#   - a person stopped the server: `systemctl --user stop tmux-server.service` stops this timer too
#     (PartOf), and `start` brings the timer back (Wants). A server that ended any other way counts
#     as unplanned, and `env -u TMUX tmux kill-server` comes back within two minutes.
#   - tmux-server.service or the user manager is starting or stopping: a boot, a shutdown.
#   - it already started MIADI_TMUX_WATCH_MAX servers in the last hour (default 3): something keeps
#     ending the server, and each start resumes whatever may be doing it. It says so once in
#     server-watch.log. Removing server-watch.starts lets it start again.
#
# tmux-continuum skips its restore when it counts more than one other process whose command begins
# with `tmux`, so the clients the old server left behind are ended first. The server is started as
# `tmux`, through env, so a private server that loads the plugins counts it and restores nothing
# into itself.
#
# tmux-server.service is used when it is inactive. While it is active on processes that outlived
# the server, `start` does nothing and `restart` would kill them, so the same command gets a unit of
# its own. Both run from the user manager, so the panes get its environment and not an agent's.
#
#   MIADI_TMUX_WATCH_SOCKET  the server's socket (default: tmux's default socket for this user)
#   MIADI_HOME               the tide state folder (default ~/.miadi/navigator)
# Installed by 14-tmux-resurrect.sh. Packaged as miadi-terminal's session-continuity/server-watch.sh.

set -u
unset TMUX TMUX_PANE

default_socket="${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)/default"
socket="${MIADI_TMUX_WATCH_SOCKET:-$default_socket}"
confirm="${MIADI_TMUX_WATCH_CONFIRM_SECONDS:-15}"
max="${MIADI_TMUX_WATCH_MAX:-3}"
state="${MIADI_HOME:-$HOME/.miadi/navigator}/restore"
starts="$state/server-watch.starts"
log="$state/server-watch.log"

say() {
    echo "$*"
    mkdir -p "$state"
    echo "$(date -Is) $*" >> "$log"
}

server_state() {
    local answer
    answer="$(tmux -S "$socket" has-session 2>&1)" && { echo running; return; }
    case "$answer" in
        "no server running"*) echo gone ;;
        "error connecting to"*"No such file or directory"*) echo absent ;;
        "server exited"*) echo ending ;;
        *) echo "unknown: $answer" ;;
    esac
}

not_now() {
    systemctl --user is-active --quiet tmux-server-watch.timer || return 0
    case "$(systemctl --user is-system-running 2>/dev/null)" in
        initializing | starting | stopping) return 0 ;;
    esac
    case "$(systemctl --user show -p ActiveState --value tmux-server.service 2>/dev/null)" in
        activating | deactivating) return 0 ;;
    esac
    return 1
}

agents_were_running() {
    python3 - "${MIADI_HOME:-$HOME/.miadi/navigator}/context/snapshots.sqlite3" 2> /dev/null <<'PY_SNAPSHOT'
import json, sqlite3, sys
conn = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True, timeout=5)
for (payload,) in conn.execute("SELECT payload FROM context_snapshots ORDER BY timestamp_epoch DESC LIMIT 3000"):
    terminals = json.loads(payload).get("terminals")
    if terminals:
        sys.exit(0 if any((t.get("agent") or {}).get("state") == "running" for t in terminals) else 1)
sys.exit(1)
PY_SNAPSHOT
}

# A client of this server: named by -S, or through $TMUX, or by default. A client that names another
# server, or whose environment points elsewhere, is not ours to end.
reaches_this_server() {
    local pid="$1" args environment tmux_value tmp_value
    args="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null)" || return 1
    case " $args " in
        *" -S $socket "*) return 0 ;;
        *" -L"* | *" -S"*) return 1 ;;
    esac
    environment="$(tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null)" || return 1
    tmux_value="$(sed -n 's/^TMUX=//p' <<< "$environment")"
    tmp_value="$(sed -n 's/^TMUX_TMPDIR=//p' <<< "$environment")"
    if [ -n "$tmux_value" ]; then
        [ "${tmux_value%%,*}" = "$socket" ]
        return
    fi
    [ "${tmp_value:-/tmp}/tmux-$(id -u)/default" = "$socket" ]
}

end_clients_left_behind() {
    local pid left=()
    sleep 1
    for pid in $(pgrep -u "$(id -u)" -x 'tmux: client'); do
        reaches_this_server "$pid" && left+=("$pid")
    done
    [ "${#left[@]}" -eq 0 ] && return 0
    say "ending ${#left[@]} client(s) the old server left behind: ${left[*]}"
    kill -TERM "${left[@]}" 2>/dev/null
    sleep 3
    for pid in "${left[@]}"; do
        [ -d "/proc/$pid" ] && kill -KILL "$pid" 2>/dev/null
    done
    return 0
}

now_state="$(server_state)"
case "$now_state" in
    running | absent) exit 0 ;;
esac
not_now && exit 0
agents_were_running || exit 0

sleep "$confirm"
now_state="$(server_state)"
not_now && exit 0
case "$now_state" in
    running | absent) exit 0 ;;
    gone | ending) ;;
    *)
        echo "$now_state"
        exit 0
        ;;
esac

mkdir -p "$state"
now="$(date +%s)"
recent="$(awk -v since="$((now - 3600))" '$1 >= since' "$starts" 2>/dev/null | wc -l)"
if [ "$recent" -ge "$max" ]; then
    held="not starting a server: $recent started in the last hour, and something keeps ending it. Find what, then remove $starts."
    [ "$(tail -n 1 "$log" 2>/dev/null | cut -d' ' -f2-)" = "$held" ] || say "$held"
    exit 0
fi

if [ "$now_state" = ending ]; then
    pid="$(ss -xlpH 2>/dev/null | grep -F " $socket " | grep -oE 'pid=[0-9]+' | head -n 1 | cut -d= -f2)"
    if [ -z "$pid" ]; then
        say "the server answers 'server exited', and no process listens on $socket that this user can see"
        exit 1
    fi
    if pgrep -P "$pid" > /dev/null; then
        say "server $pid answers 'server exited' and still has children: left alone"
        exit 1
    fi
    say "server $pid has shut down and a client holds it: killing it"
    kill -KILL "$pid"
    for _ in 1 2 3 4 5 6 7 8 9 10; do
        [ -d "/proc/$pid" ] || break
        sleep 0.5
    done
fi

end_clients_left_behind

save="$(readlink "$HOME/.local/share/tmux/resurrect/last" 2>/dev/null)"
if [ "$(systemctl --user is-active tmux-server.service 2>/dev/null)" = active ]; then
    unit="tmux-server-recover-$(date +%y%m%d%H%M%S)"
    say "the tmux server ended: starting one in $unit, to restore from ${save:-no save}"
    systemd-run --user --unit="$unit" --collect --service-type=forking --working-directory="$HOME" \
        -p TimeoutStartSec=180 --description="tmux server started by tmux-server-watch after the server ended" \
        /usr/bin/env tmux new-session -d -c "$HOME"
else
    say "the tmux server ended: starting tmux-server.service, to restore from ${save:-no save}"
    systemctl --user start tmux-server.service
fi
result=$?
echo "$now" >> "$starts"
if [ "$result" -ne 0 ]; then
    say "starting the server failed, exit $result"
    exit 1
fi
exit 0
