# chronicle-github-sessions-observability

> A Claude Code session that asks for it opens one GitHub issue from its first prompt. Each time the session ends, it comments there: how many prompts and tool calls it ran, what it wrote and published, and its last answer.

The surface is a plugin of its own, [`claude/miadi-session-issue`](../../claude/miadi-session-issue/): two hooks and the `/session-issue` command, specified from the prototype that ran on ilex (Termux, Pixel 2) in July 2026. A session asks at launch (`MIADI_SESSION_ISSUE`) or midway (`/session-issue`). The capture plugin records, and never publishes. An optional second sink records the same opening and closing as a trace that `@miadi/tracing` can resolve.

**Issue**: jgwill/miadi-orchestration-kit#89
**Status**: built 2026-10-14, `claude/miadi-session-issue` 0.1.0 ([`STATUS.md`](./STATUS.md)). The tracing sink is specified, not built.

## Files, in reading order

| File | Phase | Holds |
|---|---|---|
| [`01-reverse-engineer.md`](./01-reverse-engineer.md) | R | What the ilex prototype does, and what it left on GitHub and on disk |
| [`02-intent.md`](./02-intent.md) | I | Desired outcome, current reality, structural tension, beloved qualities, boundaries |
| [`chronicle-github-sessions-observability.kin.md`](./chronicle-github-sessions-observability.kin.md) | I | Its relatives and what each relationship asks of us. Read before changing anything |
| [`03-specify.md`](./03-specify.md) | S | The opt-in, the session issue opener and command, the session end commenter, the tracing sink option, the data they keep |
| [`04-export.md`](./04-export.md) | E | Building the plugin, installing it on ilex, the gates that prove both |
| [`STATUS.md`](./STATUS.md) | | What was built, the gates and the live run |
| [`05-source-ledger.md`](./05-source-ledger.md) | | Sources, claim confidence, what is still to confirm |
| [`research/ilex-prototype/`](./research/ilex-prototype/) | R | The prototype, copied byte for byte from jgwill/binscripts |

## Acceptance

- A session started with `MIADI_SESSION_ISSUE` opens exactly one issue at its first prompt. `/session-issue` opens it midway from the session's first prompt. Each `/exit` adds one comment.
- A session that does not ask is untouched, and the capture plugin is unchanged at 0.1.14.
- Nothing the plugin posts to GitHub skips the capture sanitizer, and nothing is posted to a public repository.
- `tests/session-issue.sh` holds the gates of `04-export.md` and passes with a stub `gh`.
