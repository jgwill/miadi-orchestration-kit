# miadi-steering for Codex CLI

The steering inbox of one Codex CLI session (jgwill/Miadi#942), as hooks. A person's correction reaches the running agent with nothing typed. The contract is `miadi.steering/1`, in `@miadi/connector`'s `STEERING.md`.

```bash
node codex/miadi-steering/install.mjs            # files, five hook entries, and Codex's own trust for exactly those
node codex/miadi-steering/install.mjs --check    # change nothing, print what Codex says about each
node codex/miadi-steering/install.mjs --remove
node codex/miadi-steering/install.mjs --also-trust-kit-plugin
```

Codex runs no untrusted hook. The installer asks Codex's own app-server for each hook's hash and writes that exact trust, so `--dangerously-bypass-hook-trust` is never needed. While any hook on the account is new or modified, Codex's TUI stops at "Hooks need review" at start, and a brief typed into it would answer that prompt, so a factory seat needs all of them settled. `--also-trust-kit-plugin` settles this kit's own plugins.

Codex runs only on its requester's own choice for that mission or their policy (jgwill/Miadi#926). This changes none of that.

`steering_inbox.sh` is the fast half and keeps `seat.json`, how the factory runner learns the seat went idle. `steering_inbox.mjs` is the file every provider's adapter carries, copied by `scripts/sync-steering-inbox.sh`.

Tested on Codex 0.166.0 with real sessions. Limits are in `STEERING.md`.
