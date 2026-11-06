# miadi-steering for GitHub Copilot CLI

The steering inbox of one Copilot CLI session (jgwill/Miadi#942), as an extension. A person's correction reaches the running agent with nothing typed. The contract is `miadi.steering/1`, in `@miadi/connector`'s `STEERING.md`.

```bash
copilot/miadi-steering/install.sh            # into ~/.copilot/extensions/miadi-steering
copilot/miadi-steering/install.sh --remove
```

A session loads it only when started with `--experimental`, which the factory runner's default launcher passes. A session started without it, or before the install, answers `unsupported`.

`extension.mjs` holds the door: `session.send({ mode: "immediate" })`, the one a person's Enter uses. `steering_inbox.mjs` is the file every provider's adapter carries, copied by `scripts/sync-steering-inbox.sh`.

Tested on Copilot 1.0.107 with real sessions. Limits are in `STEERING.md`.
