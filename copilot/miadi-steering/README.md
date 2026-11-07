# miadi-steering for GitHub Copilot CLI

The steering inbox of one Copilot CLI session (jgwill/Miadi#942), as an extension. A person's correction reaches the running agent with nothing typed. The contract is `miadi.steering/1`, in `@miadi/connector`'s `STEERING.md`.

```bash
copilot/miadi-steering/install.sh            # into ~/.copilot/extensions/miadi-steering, and turns on enabledFeatureFlags.EXTENSIONS
copilot/miadi-steering/install.sh --remove
```

Copilot loads extensions only under that flag. `--experimental` would load it too, but it writes `experimental: true` into `~/.copilot/settings.json` for every later session, so nothing here passes it. A session started before the install answers `unsupported`.

`extension.mjs` holds the door: `session.send({ mode: "immediate" })`, the one a person's Enter uses. `steering_inbox.mjs` is the file every provider's adapter carries, copied by `scripts/sync-steering-inbox.sh`.

Tested on Copilot 1.0.107 with real sessions. Limits are in `STEERING.md`.
