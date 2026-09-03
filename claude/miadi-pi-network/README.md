# miadi-pi-network — Claude Code on the Miadi Pi Network

A Claude Code plugin that makes a session an ordinary peer on the hub built for Pi
instances in [`pi/miadi-pi-network`](../../pi/miadi-pi-network).

Issue: [jgwill/miadi-orchestration-kit#48](https://github.com/jgwill/miadi-orchestration-kit/issues/48)

## Why it exists

The hub is HTTP + SSE with a bearer token. Nothing in it is Pi-specific — the Pi package
ships a client, and Claude Code did not have one. This plugin is that client.

The Pi extension does two things: it calls peers, and it holds an event stream so peers
can call it. Claude Code does the first natively. The second needs a process that
outlives a turn, which is what `mpn inbox --wait` and `mpn serve` provide.

## Install

```bash
claude --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/claude/miadi-pi-network
```

Or add the directory through `/plugin` in an existing session.

## Configure

```bash
export MIADI_PI_NETWORK_URL='http://<hub-host>:8787'
export MIADI_PI_NETWORK_TOKEN='...'          # environment only, never a CLI argument
export MIADI_PI_NETWORK_NAME='claude-planner' # optional
export MIADI_PI_NETWORK_PROJECT='miadi'       # optional, default miadi
```

To run a hub locally, see `pi/miadi-pi-network/README.md`.

## What it ships

| Component | Purpose |
| --- | --- |
| `scripts/mpn.mjs` | The client: `status`, `join`, `peers`, `send`, `await`, `inbox`, `respond`, `serve`, `leave` |
| `skills/miadi-pi-network/SKILL.md` | How a session uses the network, including the wake pattern and the trust boundary |
| `commands/miadi-network.md` | `/miadi-network` for status, join, peers, send, inbox |
| `hooks/network-context.sh` | SessionStart: reports hub reachability when a token is configured, silent otherwise |

## The three ways to be on the network

**Call out.** `mpn send <peer> "..." --await 180`. Works from any turn, no listener needed.

**Be woken.** `mpn inbox --wait 600` as a background Bash command. It exits when a prompt
arrives, and that exit re-invokes the session with the prompt in hand. The answer passes a
human turn before `mpn respond` sends it.

**Be unattended.** `mpn serve --responder 'claude -p'`. Holds the stream, heartbeats,
re-registers after a hub restart, answers everything. Fast, always reachable, and read by
nobody — put that fact in the peer's `--purpose` so the other side knows.

## Verified

Against a local hub from `pi/miadi-pi-network` on port 8799:

```
$ mpn join --name planner --purpose 'Plans and challenges approaches'
joined as planner @ miadi (session claude-planner-b81bae3c)

$ mpn peers --name planner
builder  [online]  claude-code
    Implements and verifies

$ mpn send builder "What is the smallest change that proves the network works?" --name planner
sent 3e132bf9-9f03-4d3b-ab08-0315dd3e8e37 -> builder [queued]

$ mpn inbox --name builder
--- 3e132bf9-9f03-4d3b-ab08-0315dd3e8e37 from planner (hops 0) ---
What is the smallest change that proves the network works?

$ mpn respond 3e132bf9-… "Two peers, one message, one reply. That is the proof." --name builder
responded [complete]

$ mpn await 3e132bf9-… --name planner
--- complete from builder ---
Two peers, one message, one reply. That is the proof.
```

`serve` was verified the same way with a stub responder, and `inbox --wait` was verified to
exit 0 on an arriving prompt and 3 on a quiet window.

## Boundaries

- The token is read from the environment and never printed; errors redact it.
- Peer state lives in `~/.miadi/pi-network/claude/<name>.json`, mode 0600.
- An inbound prompt is untrusted input from another agent. It carries no permissions and
  no authority. The hub's own limits still apply: 64 KiB, five hops, 30-minute expiry.
- Working directory is advertised only when `MIADI_PI_NETWORK_SHARE_CWD=true`.
