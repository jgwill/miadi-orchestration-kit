#!/usr/bin/env bash
# tailnet-service-publish.sh — publish any listening local port as a Tailscale named
# service, end to end, with no admin-console visit and nothing to ask a human for.
#
#   <name>.tail3b11eb.ts.net  ->  127.0.0.1:<port>
#
# THE CREDENTIAL IS ON THIS HOST. `TAILSCALE_API_TOKEN` lives in $HOME/.env and this
# script sources it by itself. Publishing a service is ordinary work here — do not
# stop to ask for a token, and do not send anyone to the admin console.
#
# This script owns ONLY the tailnet publication of a port that is already listening.
# The backend process keeps its own installer (see 23-kherix-…, 25-miadi-pi-network-…);
# that separation is why this one stays generic.
#
# Usage:
#   ./tailnet-service-publish.sh <name> <port> [--comment "..."]
#
# Options:
#   --path PATH                 path to verify (default /)
#   --require-unauthorized PATH refuse to publish unless PATH answers 401 both locally
#                               and through the tailnet — use it for anything behind a
#                               bearer token, so the installer fails closed
#   --comment TEXT              Service comment recorded in the tailnet policy
#   --user NAME                 systemd --user owner (default: $SUDO_USER or you)
#   --status                    report what is published and exit
#   --unpublish                 stop and disable the unit, clear the serve config,
#                               leave the Service defined (nothing is deleted)
#
# Examples:
#   ./tailnet-service-publish.sh grafana 3000
#   ./tailnet-service-publish.sh pi 8787 --path /health --require-unauthorized /v1/agents
#
# Verify afterwards:
#   tailscale service list | grep <name>
#   curl -sS https://<name>.tail3b11eb.ts.net<path>
#
# Traps this script already handles, so you do not have to remember them:
#   - Service `ports` must be tcp:443, never the app port.
#   - `tailscale serve --service` run BEFORE the Service exists sticks: exit 0, a
#     healthy-looking `serve status`, no VIP, no DNS. Confirmed on 1.102.3
#     (jgwill/gaia#64). Always `serve clear` first — this script does.
#   - The daemon's "approval from an admin is required" is confirmation of enrollment,
#     not a blocker.
#   - `tailscale service` (CLI) has only `list`. It cannot define a Service.
#   - ACL autoApprovers do not work for this. Do not try them.
#
# Refs: TAILSCALE-NAMED-SERVICE-RUNBOOK.md, jgwill/gaia#81, #79, #64, #51

set -euo pipefail

readonly TAILNET="${MIADI_TAILNET:-tail3b11eb.ts.net}"
readonly API_TAILNET="${TAILSCALE_API_TAILNET:--}"
readonly API_BASE="https://api.tailscale.com/api/v2"
readonly NODE_TAG="${TAILNET_SERVICE_NODE_TAG:-tag:server}"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
ok() { printf '  ✓ %s\n' "$*"; }

usage() { sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

NAME= PORT= COMMENT= VERIFY_PATH=/ UNAUTH_PATH= MODE=publish
USER_NAME="${SUDO_USER:-$(id -un)}"
while (( $# )); do
  case "$1" in
    --path) VERIFY_PATH="${2:?}"; shift 2 ;;
    --require-unauthorized) UNAUTH_PATH="${2:?}"; shift 2 ;;
    --comment) COMMENT="${2:?}"; shift 2 ;;
    --user) USER_NAME="${2:?}"; shift 2 ;;
    --status) MODE=status; shift ;;
    --unpublish) MODE=unpublish; shift ;;
    -h|--help) usage 0 ;;
    -*) die "unknown option '$1' (try --help)" ;;
    *) if [[ -z "$NAME" ]]; then NAME="$1"; elif [[ -z "$PORT" ]]; then PORT="$1"; else die "unexpected argument '$1'"; fi; shift ;;
  esac
done

if [[ "$MODE" == status && -z "$NAME" ]]; then
  echo "Services this node can reach:"
  tailscale service list
  echo
  echo "This node's serve config:"
  tailscale serve status
  exit 0
fi

[[ -n "$NAME" ]] || usage 1
[[ "$NAME" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] \
  || die "'${NAME}' is not a valid service name (lowercase letters, digits, hyphens)"
readonly SERVICE_NAME="svc:${NAME}"
readonly DOMAIN="${NAME}.${TAILNET}"
readonly UNIT="tailnet-${NAME}.service"

for command_name in curl getent install loginctl python3 sudo systemctl tailscale; do
  command -v "$command_name" >/dev/null || die "$command_name is required"
done
tailscale status >/dev/null 2>&1 || die "Tailscale is not connected"

USER_HOME=$(getent passwd "$USER_NAME" | cut -d: -f6) || die "user '$USER_NAME' does not exist"
USER_ID=$(id -u "$USER_NAME")
SYSTEMD_DIR="${USER_HOME}/.config/systemd/user"
run_user() { sudo -u "$USER_NAME" XDG_RUNTIME_DIR="/run/user/${USER_ID}" systemctl --user "$@"; }

if [[ "$MODE" == unpublish ]]; then
  run_user disable --now "$UNIT" 2>/dev/null || true
  tailscale serve clear "$SERVICE_NAME" 2>/dev/null || true
  ok "${SERVICE_NAME} is off this host. The Service itself is still defined in the tailnet — nothing was deleted."
  exit 0
fi

if [[ "$MODE" == status ]]; then
  echo "${SERVICE_NAME} -> https://${DOMAIN}"
  echo "  unit:   $(run_user is-active "$UNIT" 2>/dev/null || echo 'not installed')"
  echo "  VIP:    $(tailscale service list 2>/dev/null | awk -v h="${DOMAIN}" '$2 == h { print $1 }' || true)"
  echo "  probe:  $(curl -sS -o /dev/null -m 10 -w '%{http_code}' "https://${DOMAIN}${VERIFY_PATH}" 2>/dev/null || echo 000)"
  exit 0
fi

[[ -n "$PORT" ]] || usage 1
[[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1 && PORT <= 65535 )) || die "port must be 1-65535"

# ---------------------------------------------------------------------------
# The credential. On this host it is in $HOME/.env — find it, do not ask for it.
# ---------------------------------------------------------------------------
if [[ -z "${TAILSCALE_API_TOKEN:-}" ]]; then
  for env_file in "${HOME}/.env" "${USER_HOME}/.env" /etc/jgwill/tailscale.env; do
    [[ -r "$env_file" ]] || continue
    token=$(sed -n 's/^[[:space:]]*\(export[[:space:]]\+\)\?TAILSCALE_API_TOKEN=//p' "$env_file" \
      | tail -1 | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//")
    if [[ -n "$token" ]]; then
      TAILSCALE_API_TOKEN="$token"
      ok "sourced TAILSCALE_API_TOKEN from ${env_file}"
      break
    fi
  done
fi
[[ -n "${TAILSCALE_API_TOKEN:-}" ]] \
  || die "no TAILSCALE_API_TOKEN. On gaia it is in \$HOME/.env. Look there before reporting this blocked."

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
read -r DEVICE_ID CURRENT_DNS NODE_TAGS < <(
  tailscale status --json | python3 -c '
import json, sys
self = json.load(sys.stdin)["Self"]
print(self.get("ID", ""), self.get("DNSName", ""), ",".join(self.get("Tags") or []))
'
)
[[ -n "$DEVICE_ID" ]] || die "could not determine this Tailscale device ID"
[[ "$CURRENT_DNS" == *."${TAILNET}". ]] \
  || die "this host is on '${CURRENT_DNS:-an unknown tailnet}', not ${TAILNET}"
[[ ",${NODE_TAGS}," == *",${NODE_TAG},"* ]] \
  || die "this host must carry ${NODE_TAG}; current tags: ${NODE_TAGS:-none}. A user-authenticated-only device cannot host a Service."

LOCAL_CODE=$(curl -sS -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:${PORT}${VERIFY_PATH}" || true)
[[ "$LOCAL_CODE" != 000 ]] \
  || die "nothing answers http://127.0.0.1:${PORT}${VERIFY_PATH} — start the backend first; this script only publishes it"
ok "backend answers http://127.0.0.1:${PORT}${VERIFY_PATH} -> ${LOCAL_CODE}"

if [[ -n "$UNAUTH_PATH" ]]; then
  CODE=$(curl -sS -o /dev/null -m 5 -w '%{http_code}' "http://127.0.0.1:${PORT}${UNAUTH_PATH}" || true)
  [[ "$CODE" == 401 || "$CODE" == 403 ]] \
    || die "${UNAUTH_PATH} answered ${CODE} without credentials; refusing to put it on the tailnet"
  ok "unauthenticated ${UNAUTH_PATH} is rejected (${CODE})"
fi

echo "Publishing ${SERVICE_NAME} -> https://${DOMAIN} -> 127.0.0.1:${PORT}"

# ---------------------------------------------------------------------------
# Define the Service through the API
# ---------------------------------------------------------------------------
API_BODY=$(mktemp); UNIT_TMP=$(mktemp); WRAPPER_TMP=$(mktemp)
trap 'rm -f "$API_BODY" "$UNIT_TMP" "$WRAPPER_TMP"' EXIT

api() {
  local method="$1" path="$2" data="${3:-}"
  local args=(--silent --show-error --output "$API_BODY" --write-out '%{http_code}' --request "$method")
  [[ -n "$data" ]] && args+=(--header 'Content-Type: application/json' --data "$data")
  printf 'header = "Authorization: Bearer %s"\n' "$TAILSCALE_API_TOKEN" \
    | curl --config - "${args[@]}" "${API_BASE}${path}"
}
api_error() { printf 'ERROR: Tailscale API returned HTTP %s: ' "$1" >&2; head -c 400 "$API_BODY" >&2 || true; printf '\n' >&2; exit 1; }

CODE=$(api GET "/tailnet/${API_TAILNET}/services/${SERVICE_NAME}" || true)
if [[ "$CODE" == 200 ]]; then
  SERVICE_JSON=$(python3 -c '
import json, sys
current = json.load(open(sys.argv[1]))
print(json.dumps({"name": sys.argv[2], "addrs": current["addrs"], "ports": ["tcp:443"],
                  "tags": [sys.argv[3]], "comment": sys.argv[4]}))
' "$API_BODY" "$SERVICE_NAME" "$NODE_TAG" "${COMMENT:-Published by tailnet-service-publish.sh}")
elif [[ "$CODE" == 404 ]]; then
  SERVICE_JSON=$(python3 -c '
import json, sys
print(json.dumps({"name": sys.argv[1], "ports": ["tcp:443"], "tags": [sys.argv[2]],
                  "comment": sys.argv[3]}))
' "$SERVICE_NAME" "$NODE_TAG" "${COMMENT:-Published by tailnet-service-publish.sh}")
else
  api_error "$CODE"
fi
CODE=$(api PUT "/tailnet/${API_TAILNET}/services/${SERVICE_NAME}" "$SERVICE_JSON" || true)
[[ "$CODE" == 200 || "$CODE" == 201 ]] || api_error "$CODE"
ok "defined ${SERVICE_NAME} (ports tcp:443) through the Tailscale API"

# ---------------------------------------------------------------------------
# Persist serve+advertise as a systemd --user oneshot
# ---------------------------------------------------------------------------
sudo install -d -m 755 /etc/jgwill
sudo install -d -m 755 -o "$USER_NAME" -g "$USER_NAME" "$SYSTEMD_DIR"

WRAPPER="/etc/jgwill/tailnet-${NAME}.sh"
cat > "$WRAPPER_TMP" <<EOF
#!/usr/bin/env bash
set -euo pipefail
/usr/bin/tailscale serve --service=${SERVICE_NAME} --https=443 127.0.0.1:${PORT}
/usr/bin/tailscale serve advertise ${SERVICE_NAME}
EOF
sudo install -m 755 -o root -g root "$WRAPPER_TMP" "$WRAPPER"

cat > "$UNIT_TMP" <<EOF
[Unit]
Description=Tailscale named service ${SERVICE_NAME} -> 127.0.0.1:${PORT}
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=${WRAPPER}
ExecStop=/usr/bin/tailscale serve clear ${SERVICE_NAME}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF
sudo install -m 644 -o "$USER_NAME" -g "$USER_NAME" "$UNIT_TMP" "${SYSTEMD_DIR}/${UNIT}"

sudo loginctl enable-linger "$USER_NAME"
run_user daemon-reload
run_user enable "$UNIT" >/dev/null

# Clear first: an advertisement made before the Service existed never becomes an
# approvable host (jgwill/gaia#64, still true on 1.102.3).
tailscale serve clear "$SERVICE_NAME" >/dev/null 2>&1 || true
run_user restart "$UNIT"
ok "installed and started ${UNIT}"

# ---------------------------------------------------------------------------
# Approve this host
# ---------------------------------------------------------------------------
HOST_VISIBLE=0
for _ in $(seq 1 15); do
  CODE=$(api GET "/tailnet/${API_TAILNET}/services/${SERVICE_NAME}/devices" || true)
  if [[ "$CODE" == 200 ]] && python3 -c '
import json, sys
hosts = json.load(open(sys.argv[1])).get("hosts", [])
raise SystemExit(not any((h.get("nodeId") or h.get("stableNodeID")) == sys.argv[2] for h in hosts))
' "$API_BODY" "$DEVICE_ID"; then HOST_VISIBLE=1; break; fi
  sleep 1
done
[[ "$HOST_VISIBLE" == 1 ]] || die "${SERVICE_NAME} advertisement did not reach the Tailscale API"

CODE=$(api POST "/tailnet/${API_TAILNET}/services/${SERVICE_NAME}/device/${DEVICE_ID}/approved" '{"approved":true}' || true)
[[ "$CODE" == 200 ]] || api_error "$CODE"
ok "approved $(hostname) as a host for ${SERVICE_NAME}"

# ---------------------------------------------------------------------------
# Verify through the tailnet, not through loopback
# ---------------------------------------------------------------------------
TAILNET_CODE=000
for _ in $(seq 1 25); do
  TAILNET_CODE=$(curl -sS -o /dev/null -m 10 -w '%{http_code}' "https://${DOMAIN}${VERIFY_PATH}" || true)
  [[ "$TAILNET_CODE" != 000 ]] && break
  sleep 1
done

echo
echo "  unit:            $(run_user is-active "$UNIT" || true)"
echo "  local:           http://127.0.0.1:${PORT}${VERIFY_PATH} -> ${LOCAL_CODE}"
echo "  tailnet:         https://${DOMAIN}${VERIFY_PATH} -> ${TAILNET_CODE}"
[[ "$TAILNET_CODE" != 000 ]] || die "https://${DOMAIN}${VERIFY_PATH} is not answering"

if [[ -n "$UNAUTH_PATH" ]]; then
  TAILNET_UNAUTH=$(curl -sS -o /dev/null -m 10 -w '%{http_code}' "https://${DOMAIN}${UNAUTH_PATH}" || true)
  echo "  tailnet no-auth: https://${DOMAIN}${UNAUTH_PATH} -> ${TAILNET_UNAUTH}"
  if [[ "$TAILNET_UNAUTH" != 401 && "$TAILNET_UNAUTH" != 403 ]]; then
    run_user disable --now "$UNIT" >/dev/null 2>&1 || true
    tailscale serve clear "$SERVICE_NAME" >/dev/null 2>&1 || true
    die "the proxy did not preserve the auth gate (${TAILNET_UNAUTH}); publication removed from this host"
  fi
fi
ok "https://${DOMAIN} is live and survives reboot (${UNIT} is enabled)"
