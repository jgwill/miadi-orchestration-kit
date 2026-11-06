# Steering adapter tests

`miadi.steering/1` is written in `@miadi/connector`'s `STEERING.md` (jgwill/Miadi#942).

```bash
node --test tests/steering/conformance.test.mjs     # every adapter on real files; needs no agent or sign-in
node tests/steering/live-probe.mjs --provider pi --case busy --connector <path to @miadi/connector dist> --runner <path to @miadi/factory-runner>
```

`live-probe.mjs` starts one real, disposable agent on a private tmux server (socket `steer942`, with `-f /dev/null` and no `$TMUX`, so it never reaches the host's server), in a scratch folder, with a private inbox root. It spends a little of that provider's quota. With `--connector`, the correction goes through the connector's own `steerSession`, and what `readSteerDelivery` then says is checked against what happened.

Cases: `busy`, `no_next_tool`, `idle`, `two`, `no_adapter`, `restart`. It prints one JSON receipt and exits 0 only when the agent's next decision changed.
