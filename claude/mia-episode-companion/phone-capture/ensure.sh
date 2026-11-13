#!/usr/bin/env bash
# ensure.sh — start phone-capture if it is not answering, and keep tailscale serve in
# front of it. Idempotent and lock-guarded, so every session start may run it.
#
#   ensure.sh          report in plain text (used by /mia-listen phone)
#   ensure.sh --hook   read the SessionStart payload on stdin, print hook JSON
#
# Does nothing on a host without $MIADI_CHRONICLE_ROOT. The service runs detached
# (setsid) and outlives the session that started it. Its log is <state>/service.log.
#
# The port: MIADI_PHONE_CAPTURE_PORT when set (the environment, or the host's
# /etc/miadi/miadi.env through `miadi-config set`), else the one this host chose before
# (<state>/port), else 8771, else the first port after it that is free or already
# phone-capture. The port it answers on is kept in <state>/port, where mia-listen reads
# it. Earned on eury: Gerico's forest-registry defaults to 8771 too.
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
mode="${1:-}"
default_port=8771
https_port="${MIADI_PHONE_CAPTURE_HTTPS_PORT:-8443}"
state="${MIADI_PHONE_CAPTURE_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/miadi-phone-capture}"
port_file="$state/port"
log="$state/service.log"
payload=""
[ "$mode" = "--hook" ] && payload="$(cat 2>/dev/null || true)"

# One line out. In hook mode: context for the model always, a visible message only
# when something changed or failed.
report() { # $1 visible-or-empty  $2 context
  if [ "$mode" = "--hook" ]; then
    VISIBLE="$1" CONTEXT="$2" node -e '
      const out = { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: process.env.CONTEXT } };
      if (process.env.VISIBLE) out.systemMessage = process.env.VISIBLE;
      console.log(JSON.stringify(out));'
  else
    echo "${1:-$2}"
  fi
  exit 0
}

is_capture() { # $1 port
  curl -s -m 2 "http://127.0.0.1:$1/api/health" 2>/dev/null | grep -q '"capture"'
}
answering() { is_capture "$port"; }

# Something listens on loopback port $1, whatever its protocol.
in_use() { (: </dev/tcp/127.0.0.1/"$1") 2>/dev/null; }

# Who listens on port $1: its systemd unit and user, else its process, else nothing.
holder() {
  command -v ss >/dev/null || return 0
  local line unit uid user proc
  line="$(ss -Hltnpe "sport = :$1" 2>/dev/null | head -n 1)"
  [ -n "$line" ] || return 0
  unit="$(printf '%s' "$line" | grep -o 'cgroup:[^ ]*' | grep -o '[^/]*\.service' | grep -v '^user@' | tail -n 1)"
  uid="$(printf '%s' "$line" | grep -o 'uid:[0-9]*' | cut -d: -f2)"
  [ -n "$uid" ] && user="$(getent passwd "$uid" | cut -d: -f1)"
  proc="$(printf '%s' "$line" | grep -o 'users:(("[^"]*",pid=[0-9]*' | sed 's/users:(("\([^"]*\)",pid=\([0-9]*\)/\1 (pid \2)/')"
  printf '%s%s' "${unit:-${proc:-a process}}" "${user:+ of $user}"
}

root="${MIADI_CHRONICLE_ROOT:-}"
if [ -z "$root" ] || [ ! -d "$root" ]; then
  [ "$mode" = "--hook" ] && exit 0
  echo "phone-capture: no MIADI_CHRONICLE_ROOT on this host, nothing to start"; exit 0
fi
command -v node >/dev/null || report "📱 phone-capture not started: node is not on PATH" "phone-capture could not start: node missing."
command -v curl >/dev/null || report "📱 phone-capture not started: curl is not on PATH" "phone-capture could not start: curl missing."

mkdir -p "$state"
exec 9>"$state/ensure.lock"
command -v flock >/dev/null && flock -w 30 9

port="${MIADI_PHONE_CAPTURE_PORT:-}"
port_note=""
if [ -z "$port" ]; then
  port="$(tr -dc 0-9 2>/dev/null <"$port_file")"
  # A kept port another service has taken since is chosen again.
  if [ -z "$port" ] || { ! is_capture "$port" && in_use "$port"; }; then
    port=""
    for candidate in $(seq "$default_port" $((default_port + 19))); do
      if is_capture "$candidate" || ! in_use "$candidate"; then port="$candidate"; break; fi
    done
    [ -n "$port" ] || report "📱 phone-capture not started: ports $default_port–$((default_port + 19)) are all taken. Set MIADI_PHONE_CAPTURE_PORT to a free one" "phone-capture found no free port on this host."
    [ "$port" != "$default_port" ] && port_note=" (port $port: $default_port is held by $(holder "$default_port"))"
  fi
fi

started=""
restarted=""
# A running service whose code differs from disk is restarted, but only while idle,
# so a plugin update reaches the phone without anyone restarting anything.
if answering; then
  health="$(curl -s -m 2 "http://127.0.0.1:$port/api/health")"
  running_build="$(printf '%s' "$health" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const h=JSON.parse(s);process.stdout.write([h.build||"",h.pid||"",h.capture?.state||""].join("|"))}catch{}})')"
  IFS="|" read -r build pid cstate <<<"$running_build"
  disk_build="$(cat "$here/server.mjs" "$here/public/index.html" "$here/package-lock.json" | sha256sum | cut -d' ' -f1)"
  if [ -n "$pid" ] && [ "$build" != "$disk_build" ] && [ "$cstate" = "idle" ]; then
    echo "--- $(date -Is) ensure.sh restarting phone-capture pid $pid for build ${disk_build:0:12}" >>"$log"
    kill "$pid" 2>/dev/null
    for _ in $(seq 1 40); do answering || break; sleep 0.25; done
    restarted="yes"
  fi
fi
if ! answering; then
  # Reached only for a port someone set: a chosen port is free or phone-capture.
  if in_use "$port"; then
    who="$(holder "$port")"
    report "📱 phone-capture not started: MIADI_PHONE_CAPTURE_PORT=$port is held by ${who:-another service}. Unset it and ensure.sh chooses a free port" "Port $port (MIADI_PHONE_CAPTURE_PORT) is held by ${who:-another service}; phone-capture is not running."
  fi
  # Install when the lockfile differs from the one last installed, so a new
  # dependency arrives with the plugin update that needs it.
  lock_sum="$(sha256sum "$here/package-lock.json" | cut -d' ' -f1)"
  if [ "$(cat "$here/node_modules/.phone-capture-lock" 2>/dev/null)" != "$lock_sum" ]; then
    (cd "$here" && npm ci --omit=dev --no-audit --no-fund >>"$log" 2>&1 && echo "$lock_sum" > node_modules/.phone-capture-lock) \
      || report "📱 phone-capture not started: npm ci failed, see $log" "phone-capture dependencies failed to install."
  fi
  dns="$(tailscale status --json 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try { process.stdout.write(JSON.parse(s).Self.DNSName.replace(/\.$/, "")); } catch {}
    });' 2>/dev/null)"
  public="http://127.0.0.1:$port"
  [ -n "$dns" ] && public="https://$dns:$https_port"
  echo "--- $(date -Is) ensure.sh starting phone-capture → $public" >>"$log"
  MIADI_PHONE_CAPTURE_PORT="$port" MIADI_PHONE_CAPTURE_STATE_DIR="$state" MIADI_PHONE_CAPTURE_PUBLIC_URL="$public" \
    setsid -f "$here/start.sh" >>"$log" 2>&1 </dev/null
  for _ in $(seq 1 40); do answering && break; sleep 0.25; done
  answering || report "📱 phone-capture did not answer within 10s, see $log" "phone-capture failed to start; its log is $log."
  started="yes"
fi
[ "$(cat "$port_file" 2>/dev/null)" = "$port" ] || echo "$port" >"$port_file"

# tailscale serve: add the https mapping when absent, never replace someone else's.
url="http://127.0.0.1:$port"
serve_note=""
if command -v tailscale >/dev/null; then
  dns="${dns:-$(tailscale status --json 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try { process.stdout.write(JSON.parse(s).Self.DNSName.replace(/\.$/, "")); } catch {}
    });' 2>/dev/null)}"
  if [ -n "$dns" ]; then
    target="$(tailscale serve status --json 2>/dev/null | DNS="$dns" PORT="$https_port" node -e '
      let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
        try {
          const web = JSON.parse(s).Web || {};
          const site = web[process.env.DNS + ":" + process.env.PORT];
          process.stdout.write(site ? (site.Handlers?.["/"]?.Proxy || "other") : "");
        } catch {}
      });' 2>/dev/null)"
    if [ -z "$target" ]; then
      if tailscale serve --bg --https="$https_port" "http://127.0.0.1:$port" >>"$log" 2>&1; then
        url="https://$dns:$https_port"; started="${started:-serve}"
      else
        serve_note=" (tailscale serve refused; see $log)"
      fi
    elif [ "$target" = "http://127.0.0.1:$port" ]; then
      url="https://$dns:$https_port"
    else
      serve_note=" (https $https_port already serves $target; left untouched)"
    fi
  fi
fi

# The session's own episode, when it sits inside one.
episode=""
cwd="$(printf '%s' "$payload" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).cwd||"")}catch{}})' 2>/dev/null)"
cwd="${cwd:-$PWD}"
dir="$cwd"
while [ -n "$dir" ] && [ "$dir" != "/" ]; do
  if [ -f "$dir/episode.yaml" ]; then episode="$(basename "$dir")"; break; fi
  dir="$(dirname "$dir")"
done
link="$url/"
[ -n "$episode" ] && link="$url/?episode=$episode"

context="phone-capture is running on this host. William can record from the iPhone in Safari at $link$serve_note. Takes land in the chosen episode's captures/ uncommitted; mia-listen wakes on them."
case "$started" in
  yes) report "📱 phone-capture ${restarted:+re}started$port_note · $link$serve_note" "$context" ;;
  serve) report "📱 phone-capture: tailscale serve restored · $link" "$context" ;;
  *) report "" "$context" ;;
esac
