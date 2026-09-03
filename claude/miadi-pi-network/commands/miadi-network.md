---
description: Show Miadi Pi Network status, or join / list peers / send / inbox with an argument
argument-hint: "[status | join <name> <purpose> | peers | send <peer> <prompt> | inbox]"
allowed-tools: Bash
---

Act on the Miadi Pi Network using `${CLAUDE_PLUGIN_ROOT}/scripts/mpn.mjs`.

Arguments: `$ARGUMENTS`

1. With no arguments, or `status`: run `"${CLAUDE_PLUGIN_ROOT}/scripts/mpn.mjs" status`
   and report hub reachability, this session's peer identity, and the peers online.
2. `join <name> <purpose...>`: run `join --name <name> --purpose '<purpose>'`.
3. `peers`: run `peers`.
4. `send <peer> <prompt...>`: run `send <peer> "<prompt>" --await 180` and show the reply.
5. `inbox`: run `inbox`, then show each pending prompt and its message id.

Report exactly what the command printed. Exit 3 on `status` means the hub is unreachable
and exit 2 means `MIADI_PI_NETWORK_TOKEN` is unset — state which one and stop; the user
sets the token, not you. Never echo the token value.

For anything beyond these five, follow the `miadi-pi-network` skill.
