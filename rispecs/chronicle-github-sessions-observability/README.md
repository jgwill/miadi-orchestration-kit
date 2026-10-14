# chronicle-github-sessions-observability

> A Claude Code session on a host that asks for it opens one GitHub issue at its first prompt. Each time the session ends, it comments there: how many prompts and tool calls it ran, what it wrote and published, and its last answer.

The surface is two hooks of `claude/miadi-session-observability`, specified from the prototype that ran on ilex (Termux, Pixel 2) in July 2026. An optional second sink records the same opening and closing as a trace that `@miadi/tracing` can resolve.

**Issue**: jgwill/miadi-orchestration-kit#89
**Status**: specified, not built. The plugin (0.1.14) does not carry these hooks yet, and ilex has no capture wired.

## Files, in reading order

| File | Phase | Holds |
|---|---|---|
| [`01-reverse-engineer.md`](./01-reverse-engineer.md) | R | What the ilex prototype does, and what it left on GitHub and on disk |
| [`02-intent.md`](./02-intent.md) | I | Desired outcome, current reality, structural tension, beloved qualities, boundaries |
| [`chronicle-github-sessions-observability.kin.md`](./chronicle-github-sessions-observability.kin.md) | I | Its relatives and what each relationship asks of us. Read before changing anything |
| [`03-specify.md`](./03-specify.md) | S | The session issue opener, the session end commenter, the tracing sink option, the data they keep |
| [`04-export.md`](./04-export.md) | E | Building it into the plugin, installing it on ilex, the gates that prove both |
| [`05-source-ledger.md`](./05-source-ledger.md) | | Sources, claim confidence, what is still to confirm |
| [`research/ilex-prototype/`](./research/ilex-prototype/) | R | The prototype, copied byte for byte from jgwill/binscripts |

## Acceptance

- On a host with `CHRONICLE_SESSIONS_REPO` set, a session's first prompt opens exactly one issue in that repository. Each `/exit` adds one comment.
- On a host without it, the plugin behaves exactly as 0.1.14 does.
- Nothing the hooks post to GitHub skips the capture sanitizer, and nothing is posted to a public repository.
- `tests/session-issue.sh` holds the gates of `04-export.md` and passes with a stub `gh`.
