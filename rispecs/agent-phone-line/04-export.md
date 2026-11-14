# 04 — Export

## Where the plugin would live

In this kit's Claude Code lane, `claude/<name>/` (the name is open, `02-intent.md` Q-A):

```
claude/<name>/
  .claude-plugin/plugin.json
  .mcp.json                 the phone server (section 5 of 03-specify.md)
  server/                   the MCP server, the line, the Jev decider
  skills/call-my-person/SKILL.md
  skills/line-setup/SKILL.md
  skills/call-review/SKILL.md
  hooks/hooks.json          SessionStart, UserPromptSubmit, PostToolUse, Stop
  tests/
  README.md
```

The MCP server is harness-neutral, so Codex uses the same tools through its own MCP configuration. Codex has the SessionStart, UserPromptSubmit, PostToolUse and Stop events the hooks use (`codex/miadi-session-observability/README.md`, parity table).

The Jev decider is the one the Factory already shares: lane-check's `lib/decider.mjs`, with its key handling, retry rule, `readAnswer` and billing-header reader, as `choose-worker` and Episode 564's `advance-gate` use it.

## Acceptance

1. **The call of 2026-11-14 replays correctly.** A test feeds the eight sentences of call `1fa8c5ec` (`01-reverse-engineer.md`, the table) to the decision step, one at a time, as a recorded fixture. With live Jev, the line must:
   - say the questions again after sentence 2;
   - close after sentence 4, 5 or 6, and not wait for sentence 8;
   - not close on a question that contains « j'ai fini ».
   The fixture keeps Jev's answers so the test also runs offline against them.
2. Another agent can build the plugin from `03-specify.md` and this file, without the prototype's code.
3. `phone_call` with the phone unregistered returns `refused` with the reason, and rings nothing.
4. A call outside the person's hours, or a second call for the same unanswered question, is refused as in the prototype.
5. Every decision of a call is in the decision ledger with its latency, and a `call-review` ruling names its decision by id.
6. An inbound call reaches a running session as its next prompt through the steering inbox.
7. No event that leaves the account carries the person's words unless their consent is recorded.
8. On the phone page, « je suis over » closes the call within the listening window plus one Jev reading, and a silence closes it only after the one question « Est-ce que c'est tout ? » (section 4b). The record says `closed_on`.
9. A call's loop reads `answered` only after the agent's `phone_reply` reached the person.

## Recording the export

- Prototype: published address `https://github.com/Gerico1007/assembly-call`; the clone on eury is `/home/gmusic/salix/production/agent-telephone`.
- Episode: Episode 576 (miadi-chronicle://576), minted 2026-11-14, holds this folder under `rispecs:` (commit `7b5e1c2`) and the prototype under `prototypes:`.
- Issues: jgwill/miadi-orchestration-kit#154 for this plugin, and Gerico1007/assembly-call#1, opened by the Miette seat of Jerry's account for the relay limits of call `1fa8c5ec`, with the smallest fix proposed for Jerry to choose. Both are named in Episode 576.
