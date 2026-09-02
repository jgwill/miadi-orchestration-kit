# Miadi Pi Network

A Miadi-owned Pi package for flat, two-way collaboration between purpose-specific Pi instances. Every Pi runs the client extension; one small authenticated hub provides discovery and message relay across a trusted VPN.

Issue: [jgwill/miadi-orchestration-kit#48](https://github.com/jgwill/miadi-orchestration-kit/issues/48)

## Shape

```text
Pi planner ─┐
Pi builder ─┼── HTTP + SSE ── authenticated hub ── Miadi VPN
Pi witness ─┘
```

The hub has no model and makes no decisions. It tracks presence and pending messages. Peers remain equal: either Pi may initiate a request, and the receiving Pi's ordinary assistant response is returned automatically.

## Install

```bash
cd /workspace/repos/jgwill/miadi-orchestration-kit/pi/miadi-pi-network
bun install
pi install "$PWD"
```

For development, replace `pi install` with `pi -e ./extensions/miadi-pi-network.ts`.

## Start a local hub

Keep the token private and distribute it through an existing secret channel—not chat, Git, logs, or command-line arguments.

```bash
cd pi/miadi-pi-network
read -rsp 'Network token: ' MIADI_PI_NETWORK_TOKEN; export MIADI_PI_NETWORK_TOKEN; echo
bun run hub
```

Defaults: `127.0.0.1:8787`. Health is public and contains counts only:

```bash
curl -fsS http://127.0.0.1:8787/health
```

## Join two local Pi instances

In each terminal, set the same token without placing it on the Pi command line:

```bash
export MIADI_PI_NETWORK_URL=http://127.0.0.1:8787
export MIADI_PI_NETWORK_TOKEN

pi -e ./extensions/miadi-pi-network.ts \
  --miadi-network-name planner \
  --miadi-network-purpose 'Plans and challenges approaches'

pi -e ./extensions/miadi-pi-network.ts \
  --miadi-network-name builder \
  --miadi-network-purpose 'Implements and verifies changes'
```

The extension exposes:

- `miadi_network_peers` — discover peers and purposes;
- `miadi_network_send` — initiate a focused request;
- `miadi_network_get` — poll without blocking;
- `miadi_network_await` — wait for the peer's response.

Use `/miadi-network` for current identity and peer count.

## Join across the Miadi VPN

Run the hub on a stable VPN node and bind it to that node's VPN address:

```bash
export MIADI_PI_NETWORK_HOST='<hub-vpn-address>'
export MIADI_PI_NETWORK_PORT=8787
export MIADI_PI_NETWORK_TOKEN
bun run hub
```

On every Pi host—including Android/Termux—set:

```bash
export MIADI_PI_NETWORK_URL='http://<hub-vpn-address>:8787'
export MIADI_PI_NETWORK_TOKEN
export MIADI_PI_NETWORK_PROJECT='miadi'
```

Bind to a private VPN address rather than a public interface. The bearer token is required for every `/v1/*` request; VPN membership alone is not treated as authorization.

## Identity and privacy

Identity may be supplied by flags or environment:

| Meaning | Flag | Environment |
| --- | --- | --- |
| Hub URL | `--miadi-network-url` | `MIADI_PI_NETWORK_URL` |
| Peer name | `--miadi-network-name` | `MIADI_PI_NETWORK_NAME` |
| Purpose | `--miadi-network-purpose` | `MIADI_PI_NETWORK_PURPOSE` |
| Project | `--miadi-network-project` | `MIADI_PI_NETWORK_PROJECT` |

The token is environment-only. Working directories are not advertised unless `MIADI_PI_NETWORK_SHARE_CWD=true`. Audit entries contain IDs, peers, status, and hop counts—never prompts, responses, or credentials.

## Safety boundaries

- 64 KiB prompt and response limits;
- five-hop ceiling to stop runaway forwarding;
- 30-minute message expiry;
- sender/target ownership checks on message reads and responses;
- heartbeat presence and stale-peer status;
- automatic unregister and stream cleanup on shutdown;
- no durable prompt storage: the current hub is memory-only.

This is an authenticated coordination plane, not a sandbox. A peer's message is untrusted input; each Pi retains its own tools, permissions, purpose, and data-access boundary.

## Verify

```bash
bun run typecheck
bun test
pi -e ./extensions/miadi-pi-network.ts --help >/dev/null
```

The integration suite starts a real hub, joins two independent extension instances, sends a prompt, simulates the receiver's normal assistant answer, and awaits the reply from the sender.

## Lineage

This implementation was prompted by IndyDevDan's “Pi to Pi” approach and the community `coms` / `coms-net` prototype preserved in `miadisabelle/mia-pi-vs-claude-code`. Miadi's version keeps the four primitive operations while adding a package boundary, tests, VPN deployment guidance, response ownership checks, privacy defaults, and Chronicle/Medicine Wheel lineage.

Review: `miadi-review://d4edc6bd-6990-4248-b415-0c11fa6c0160`.
