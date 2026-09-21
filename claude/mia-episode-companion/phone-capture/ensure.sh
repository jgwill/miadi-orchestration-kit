#!/usr/bin/env bash
# ensure.sh — start phone-capture if it is not answering, and keep tailscale serve in
# front of it. Idempotent and lock-guarded, so every session start may run it.
#
#   ensure.sh          report in plain text (used by /mia-listen phone)
#   ensure.sh --hook   read the SessionStart payload on stdin, print hook JSON
#
# Does nothing on a host without $MIADI_CHRONICLE_ROOT. The service runs detached
# (setsid) and outlives the session that started it. Its log is <state>/service.log.
set -uo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
mode="${1:-}"
port="${MIADI_PHONE_CAPTURE_PORT:-8771}"
https_port="${MIADI_PHONE_CAPTURE_HTTPS_PORT:-8443}"
state="${MIADI_PHONE_CAPTURE_STATE_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/miadi-phone-capture}"
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

answering() {
  curl -s -m 2 "http://127.0.0.1:$port/api/health" 2>/dev/null | grep -q '"capture"'
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

started=""
if ! answering; then
  if curl -s -m 2 -o /dev/null "http://127.0.0.1:$port/" 2>/dev/null; then
    report "📱 phone-capture not started: port $port answers but is not phone-capture" "Port $port is held by another service; phone-capture is not running."
  fi
  if [ ! -d "$here/node_modules/@miadi/capture-service" ]; then
    (cd "$here" && npm ci --omit=dev --no-audit --no-fund >>"$log" 2>&1) \
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
  yes) report "📱 phone-capture started · $link$serve_note" "$context" ;;
  serve) report "📱 phone-capture: tailscale serve restored · $link" "$context" ;;
  *) report "" "$context" ;;
esac
