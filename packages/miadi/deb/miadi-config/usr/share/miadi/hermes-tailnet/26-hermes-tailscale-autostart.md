# Kherix + Laskmi: authenticated Hermes APIs on the tailnet

```bash
/opt/gaia/linux_migration/26-hermes-tailscale-autostart.sh
# Packaged equivalent (miadi-config >= 0.2.5):
miadi-hermes-tailnet
```

Run as the account owning Hermes, not root. Requires restored default and
`laskmi` profiles, an installed Hermes launcher, passwordless sudo, and an
already connected/tagged Tailscale node. `TAILSCALE_API_TOKEN` is read by the
adjacent publisher from the environment or `$HOME/.env`. No admin-console step.
If absent, the installer installs `apache2-bin` only: no default Apache service
or port 80 is enabled. It never installs/replaces Hermes or authenticates a new
machine into Tailscale for you.

| HTTPS completion endpoint | Loopback front door | Runtime route |
|---|---|---|
| `https://kherix.tail3b11eb.ts.net/v1/chat/completions` | `127.0.0.1:8643` | default Hermes API |
| `https://laskmi.tail3b11eb.ts.net/v1/chat/completions` | `127.0.0.1:8646` | `:8643/p/laskmi/v1/chat/completions` |

Hermes 0.22 owns both profiles in one gateway process. The dedicated Laskmi
loopback proxy preserves streaming and forwards the caller's bearer token;
it never substitutes the default key. Do not start a competing named-profile
Telegram gateway merely to obtain another API port.

## Credentials and repeatability

- Kherix key: `$HOME/.hermes/.env`, `API_SERVER_KEY` (existing key preserved).
- Laskmi key: `$HOME/.hermes/profiles/laskmi/.env`, `API_SERVER_KEY` (generated
  when missing or equal to Kherix's). Model ID: `laskmi`.
- Restore these private files on a replacement system to retain client keys.
  Updated files are mode 0600; originals receive private timestamped backups.
- No keys in scripts, units, command arguments, package files or output.
- Publication is tailnet-only, never Funnel. Both APIs reject missing, invalid,
  and other-profile keys. A keyless health endpoint is not a completion endpoint.
- Re-running installs the same units/mappings and retains distinct existing keys.
  Existing non-Hermes tailnet mappings are not reset.
- Ordinary profile-key additions hot-reload; no live Telegram turn is interrupted.
  If the host listener itself needs reconfiguration, Hermes's guarded restart
  refuses while work is active. Retry after the work finishes.

## Boot ownership

All units belong to the Hermes user's systemd manager; linger is enabled:

- `hermes-gateway.service`: supported shared Hermes runtime.
- `laskmi-api-proxy.service`: dedicated loopback-only Apache instance, not the
  distribution Apache web service. Errors: `~/.local/state/hermes-laskmi-api/error.log`.
- `tailnet-kherix.service` / `tailnet-laskmi.service`: persistent Serve mappings;
  retry if tailscaled is not ready at user-manager startup. Approval persists;
  the API token is needed only when provisioning a new host.

The legacy `kherix-tailscale.service` is disabled before replacing its ownership,
so its ExecStop cannot later clear the new Kherix mapping. Other users and
other Services are untouched.

## Verify or reinstall

```bash
miadi-hermes-tailnet --status
miadi-hermes-tailnet --verify
miadi-hermes-tailnet --verify --chat-smoke
# Real proxy routing/auth/incremental-SSE checks with an isolated fake backend:
python3 tests/test_hermes_tailnet_proxy.py
```

`--chat-smoke` makes one small, tool-free completion per profile (provider use),
including a real Laskmi SSE stream. Missing/wrong/cross-profile auth is checked
locally and over HTTPS. Installation is opt-in: installing the Debian package
alone neither writes credentials nor publishes Services.

On a replacement host restore the profiles and `$HOME/.env`, connect/tag
Tailscale, install Hermes, then rerun the same command. To unpublish just these
APIs, use `tailnet-service-publish.sh kherix --unpublish` and the corresponding
`laskmi` command; the service definitions and private profiles are retained.

Refs: jgwill/gaia#95; jgwill/miadi-orchestration-kit#101.
