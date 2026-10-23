#!/usr/bin/env bash
# Refs: jgwill/gaia#95, jgwill/miadi-orchestration-kit#101
# Publish two authenticated OpenAI-compatible APIs without running competing
# Hermes gateways. Kherix :8643 is the host listener; Laskmi :8646 is an Apache
# loopback proxy to that listener's /p/laskmi/ namespace. SSE is not buffered.
# Credentials stay in the restored Hermes homes; the publisher finds the
# TAILSCALE_API_TOKEN in $HOME/.env. No token is stored in generated units.
set -euo pipefail

usage() {
  printf '%s\n' \
    'Usage: 26-hermes-tailscale-autostart.sh [--status|--verify|--render-proxy] [--chat-smoke]' \
    'Run as the Hermes account after restoring its default and laskmi profiles.' \
    'Default: configure distinct keys, enable gateway/proxy, publish and approve both services.' \
    '--verify: check local + HTTPS APIs, missing/wrong-key rejection, profile isolation.' \
    '--chat-smoke: also perform one small real completion per profile (including SSE).' \
    'Overrides: MIADI_HERMES_USER, MIADI_HERMES_HOME, MIADI_KHERIX_API_SERVER_PORT (8643),' \
    'MIADI_LASKMI_API_SERVER_PORT (8646), MIADI_TAILNET (tail3b11eb.ts.net).'
}
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
MODE=install
CHAT_SMOKE=0
while (( $# )); do
  case "$1" in
    --status) MODE=status ;;
    --verify) MODE=verify ;;
    --render-proxy) MODE=render ;;
    --chat-smoke) CHAT_SMOKE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done
USER_NAME="${MIADI_HERMES_USER:-${SUDO_USER:-$(id -un)}}"
USER_HOME=$(getent passwd "$USER_NAME" | cut -d: -f6)
[[ -n "$USER_HOME" ]] || die "unknown user: $USER_NAME"
[[ $(id -un) == "$USER_NAME" ]] || die "run as $USER_NAME (not root); sudo is used only for host prerequisites"
ROOT="${MIADI_HERMES_HOME:-$USER_HOME/.hermes}"
KHERIX_PORT="${MIADI_KHERIX_API_SERVER_PORT:-8643}"
LASKMI_PORT="${MIADI_LASKMI_API_SERVER_PORT:-8646}"
TAILNET="${MIADI_TAILNET:-tail3b11eb.ts.net}"
for port in "$KHERIX_PORT" "$LASKMI_PORT"; do
  [[ "$port" =~ ^[0-9]+$ ]] && (( port > 1024 && port < 65536 )) || die 'ports must be 1025-65535'
done
[[ "$KHERIX_PORT" != "$LASKMI_PORT" ]] || die 'each API needs a distinct port'
[[ "$ROOT" != *[[:space:]\"\\]* ]] || die 'Hermes home must not contain whitespace, quotes or backslashes'
HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
STATE="$USER_HOME/.local/state/hermes-laskmi-api"
CONF="$USER_HOME/.config/hermes-tailnet/laskmi-apache.conf"
UNIT_DIR="$USER_HOME/.config/systemd/user"
HERMES="${HERMES_BIN:-$USER_HOME/.local/bin/hermes}"

render_proxy() {
  printf '%s\n' \
    "ServerRoot \"$STATE\"" \
    "DefaultRuntimeDir \"$STATE\"" \
    "PidFile \"$STATE/apache.pid\"" \
    'ServerName laskmi-api.local' \
    "Listen 127.0.0.1:$LASKMI_PORT" \
    'LoadModule mpm_event_module /usr/lib/apache2/modules/mod_mpm_event.so' \
    'LoadModule authz_core_module /usr/lib/apache2/modules/mod_authz_core.so' \
    'LoadModule proxy_module /usr/lib/apache2/modules/mod_proxy.so' \
    'LoadModule proxy_http_module /usr/lib/apache2/modules/mod_proxy_http.so' \
    'ServerTokens Prod' 'ServerSignature Off' \
    "ErrorLog \"$STATE/error.log\"" 'LogLevel warn' \
    'StartServers 1' 'ServerLimit 2' 'ThreadsPerChild 16' 'MaxRequestWorkers 32' \
    'ProxyRequests Off' 'ProxyPreserveHost On' 'ProxyTimeout 1900' \
    "ProxyPass \"/\" \"http://127.0.0.1:$KHERIX_PORT/p/laskmi/\" connectiontimeout=5 timeout=1900" \
    "ProxyPassReverse \"/\" \"http://127.0.0.1:$KHERIX_PORT/p/laskmi/\"" \
    '<Location "/">' '  Require all granted' '</Location>'
}
if [[ "$MODE" == render ]]; then render_proxy; exit 0; fi

verify() {
  python3 - "$ROOT" "$KHERIX_PORT" "$LASKMI_PORT" "$TAILNET" "$CHAT_SMOKE" <<'PY'
import json, re, sys, time, urllib.error, urllib.request
from pathlib import Path
root, kp, lp, tailnet, smoke = sys.argv[1:]

def key(path):
    matches = re.findall(r'^\s*(?:export\s+)?API_SERVER_KEY=(.*)$', path.read_text(), re.M)
    if not matches:
        raise SystemExit(f'No API_SERVER_KEY in {path}')
    return matches[-1].strip().strip('\"\'')

keys = {'kherix': key(Path(root)/'.env'), 'laskmi': key(Path(root)/'profiles/laskmi/.env')}
assert keys['kherix'] and keys['laskmi'] and keys['kherix'] != keys['laskmi'], 'distinct keys required'

def request(base, path, token=None, payload=None):
    headers = {'Authorization': 'Bearer ' + token} if token else {}
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(base + path, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=180 if data else 15) as res:
            return res.status, res.read().decode(), dict(res.headers)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode(), dict(exc.headers)

for name, port in [('kherix', kp), ('laskmi', lp)]:
    other = keys['laskmi' if name == 'kherix' else 'kherix']
    for base in [f'http://127.0.0.1:{port}', f'https://{name}.{tailnet}']:
        status, body, _ = request(base, '/v1/models', keys[name])
        assert status == 200, (base, 'authenticated models', status, body[:150])
        models = json.loads(body)['data']
        assert models and (name != 'laskmi' or models[0]['id'] == 'laskmi'), (base, models)
        for token in [None, 'invalid-key', other]:
            status, _, _ = request(base, '/v1/models', token)
            assert status == 401, (base, 'must reject missing/wrong/other-profile key', status)
        status, _, _ = request(base, '/v1/chat/completions', payload={'messages': []})
        assert status == 401, (base, 'POST completion must require auth', status)
        print(f'PASS {base}: models=200, missing/wrong/cross-profile keys=401, chat POST gated', flush=True)
    if smoke == '1':
        marker = name.upper() + '_API_OK'
        payload = {'model': models[0]['id'], 'messages': [{'role': 'user', 'content':
            f'Connectivity smoke test only. Reply exactly {marker}. Do not use any tools or change any files.'}],
            'stream': name == 'laskmi'}
        status, body, headers = request(f'https://{name}.{tailnet}', '/v1/chat/completions', keys[name], payload)
        assert status == 200, (name, status, body[:250])
        if name == 'laskmi':
            assert 'text/event-stream' in headers.get('Content-Type', headers.get('content-type', '')), headers
            chunks = [json.loads(line[6:]) for line in body.splitlines() if line.startswith('data: ') and line != 'data: [DONE]']
            text = ''.join(c.get('choices', [{}])[0].get('delta', {}).get('content', '') for c in chunks)
            assert 'data: [DONE]' in body, 'SSE stream must terminate'
        else:
            text = json.loads(body)['choices'][0]['message']['content']
        assert text.strip() == marker, (name, text)
        print(f'PASS https://{name}.{tailnet}/v1/chat/completions: real reply {marker}' + (' (SSE)' if name == 'laskmi' else ''), flush=True)
PY
}
if [[ "$MODE" == verify ]]; then verify; exit 0; fi
if [[ "$MODE" == status ]]; then
  systemctl --user --no-pager status hermes-gateway.service laskmi-api-proxy.service tailnet-kherix.service tailnet-laskmi.service
  tailscale serve status
  exit 0
fi

for cmd in python3 sudo tailscale curl systemctl loginctl; do
  command -v "$cmd" >/dev/null || die "$cmd is required"
done
[[ -x "$HERMES" && -f "$ROOT/config.yaml" && -f "$ROOT/profiles/laskmi/config.yaml" ]] \
  || die 'install Hermes and restore both profiles first'
[[ -r "$HERE/tailnet-service-publish.sh" ]] || die 'keep tailnet-service-publish.sh beside this installer'
sudo -n true || die 'passwordless sudo is required for unattended provisioning'
tailscale status >/dev/null
if [[ ! -x /usr/sbin/apache2 ]]; then
  # apache2-bin has no default web-server service to start or port 80 to take.
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends apache2-bin
fi
mkdir -p "$STATE" "$(dirname "$CONF")" "$UNIT_DIR"
chmod 700 "$STATE" "$(dirname "$CONF")"

# Only owned API keys/settings are upserted; preserve other secrets and make private
# backups on change. The profile listener stays disabled: the multiplexer mirrors
# its authenticated API at /p/laskmi/, and the proxy owns the separate port.
python3 - "$ROOT" "$KHERIX_PORT" <<'PY'
import datetime, os, re, secrets, sys, tempfile
from pathlib import Path
root, port = Path(sys.argv[1]), sys.argv[2]

def value(text, key):
    values = re.findall(r'^\s*(?:export\s+)?' + key + r'=(.*)$', text, re.M)
    return values[-1].strip().strip('\"\'') if values else ''

def update(path, settings):
    before = path.read_text() if path.exists() else ''
    after = before
    for key, val in settings.items():
        pattern = r'^[ \t]*(?:export[ \t]+)?' + key + r'=.*$'
        if re.search(pattern, after, re.M):
            after = re.sub(pattern, key + '=' + val, after, flags=re.M)
        else:
            after = after.rstrip('\n') + '\n' + key + '=' + val + '\n'
    if before == after:
        return
    if path.exists():
        backup = path.with_name(path.name + '.before-tailnet-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
        fd = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as f:
            f.write(before)
    fd, tmp = tempfile.mkstemp(prefix='.api-env-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as f:
            f.write(after)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

main = root/'.env'
profile = root/'profiles/laskmi/.env'
kkey = value(main.read_text() if main.exists() else '', 'API_SERVER_KEY') or secrets.token_hex(32)
lkey = value(profile.read_text() if profile.exists() else '', 'API_SERVER_KEY')
if not lkey or lkey == kkey:
    lkey = secrets.token_hex(32)
update(main, {'API_SERVER_ENABLED': 'true', 'API_SERVER_HOST': '127.0.0.1', 'API_SERVER_PORT': port, 'API_SERVER_KEY': kkey})
update(profile, {'API_SERVER_KEY': lkey, 'API_SERVER_MODEL_NAME': 'laskmi'})
print('Profile API credentials configured (keys kept private).')
PY
render_proxy > "$CONF"
/usr/sbin/apache2 -t -f "$CONF"
cat > "$UNIT_DIR/laskmi-api-proxy.service" <<EOF
[Unit]
Description=Laskmi API :$LASKMI_PORT -> Hermes /p/laskmi/ on :$KHERIX_PORT
After=hermes-gateway.service
Wants=hermes-gateway.service

[Service]
Type=simple
ExecStartPre=/usr/sbin/apache2 -t -f "$CONF"
ExecStart=/usr/sbin/apache2 -f "$CONF" -DFOREGROUND
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$STATE
UMask=0077

[Install]
WantedBy=default.target
EOF
sudo loginctl enable-linger "$USER_NAME"
if ! systemctl --user cat hermes-gateway.service >/dev/null 2>&1; then
  HERMES_HOME="$ROOT" "$HERMES" gateway install
fi
systemctl --user daemon-reload
systemctl --user enable --now hermes-gateway.service
# Named-profile secrets are read per request, so adding Laskmi's key does not
# require interrupting a live Telegram turn. Restart only a stale host listener.
if ! python3 - "$ROOT/.env" "$KHERIX_PORT" <<'PY'
import re, sys, urllib.request
from pathlib import Path
key = re.findall(r'^API_SERVER_KEY=(.*)$', Path(sys.argv[1]).read_text(), re.M)[-1].strip().strip('\"\'')
req = urllib.request.Request(f'http://127.0.0.1:{sys.argv[2]}/v1/models', headers={'Authorization': 'Bearer ' + key})
try:
    with urllib.request.urlopen(req, timeout=5) as response:
        raise SystemExit(response.status != 200)
except OSError:
    raise SystemExit(1)
PY
then
  HERMES_HOME="$ROOT" "$HERMES" gateway restart
fi
systemctl --user enable laskmi-api-proxy.service
systemctl --user restart laskmi-api-proxy.service

# Check the real profile key before allowing publication. No keys in argv/logs.
python3 - "$ROOT/profiles/laskmi/.env" "$LASKMI_PORT" <<'PY'
import re, sys, time, urllib.request, urllib.error
from pathlib import Path
key = re.findall(r'^API_SERVER_KEY=(.*)$', Path(sys.argv[1]).read_text(), re.M)[-1].strip().strip('\"\'')
for attempt in range(45):
    try:
        req = urllib.request.Request(f'http://127.0.0.1:{sys.argv[2]}/v1/models', headers={'Authorization': 'Bearer ' + key})
        with urllib.request.urlopen(req, timeout=5) as response:
            assert response.status == 200
        break
    except (OSError, AssertionError):
        if attempt == 44: raise
        time.sleep(2)
PY
# Retire the old owner BEFORE installing the canonical publisher. Two ExecStop
# owners for svc:kherix would otherwise clear each other's mapping on reboot.
if systemctl --user is-enabled --quiet kherix-tailscale.service || systemctl --user is-active --quiet kherix-tailscale.service; then
  systemctl --user disable --now kherix-tailscale.service
fi
bash "$HERE/tailnet-service-publish.sh" kherix "$KHERIX_PORT" --user "$USER_NAME" --path /health --require-unauthorized /v1/models --comment 'Kherix Hermes API; jgwill/gaia#95'
bash "$HERE/tailnet-service-publish.sh" laskmi "$LASKMI_PORT" --user "$USER_NAME" --path /health --require-unauthorized /v1/models --comment 'Laskmi Hermes API; jgwill/gaia#95'
verify
printf '\nReady (tailnet-only; use each profile API_SERVER_KEY):\n  https://kherix.%s/v1/chat/completions\n  https://laskmi.%s/v1/chat/completions\n' "$TAILNET" "$TAILNET"
