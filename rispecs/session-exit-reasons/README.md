# session-exit-reasons

> Every session a person exits before its work is done carries the reason in their words, and a
> periodic reading of those reasons turns each recurring one into a proposed change to how seats
> are launched, briefed or set up. The next reading counts whether that reason came back.

This is a loop the Factory runs on itself: exits become evidence, evidence becomes a pattern, a
pattern becomes a change the person decides, and the change is checked by the exits that follow.
The packet stays in specification. Nothing here is built except the first door,
`/inventory-exit-reason` (miadi-session-observability 0.1.49, jgwill/miadi-orchestration-kit@4a4f169).

**Issues**: jgwill/miadi-orchestration-kit#162 and jgwill/Miadi#1062, children of jgwill/miadi-orchestration-kit#160 (bodies in [`issues/`](./issues/)).
Current anchor: jgwill/miadi-orchestration-kit#56.
**Status**: specified 2026-11-19, not built ([`STATUS.md`](./STATUS.md)).
**Born in**: session `5ffaf964-f4cb-470d-a1da-35fdd040073a`,
miadi-tmux://mia@gaia:t1-exit-not-on-completion-2611190727.

## Files, in reading order

| File | Phase | Holds |
|---|---|---|
| [`01-reverse-engineer.md`](./01-reverse-engineer.md) | R | What the capture, the binding line and the inventory say about how 1002 interactive sessions ended, measured 2026-11-19, and the guard refusal that stopped the measurement |
| [`02-intent.md`](./02-intent.md) | I | Desired outcome, current reality, structural tension, the loop, boundaries |
| [`03-specify.md`](./03-specify.md) | S | The reason at exit, the reason after exit, the interpreter's `exits` view, the investigation pass, the recurrence check, their data |
| [`04-export.md`](./04-export.md) | E | Where each part is built, in which repository, and the gates |
| [`05-source-ledger.md`](./05-source-ledger.md) | | Sources, claim confidence, related issues |
| [`STATUS.md`](./STATUS.md) | | What exists, what is held |
| [`issues/`](./issues/) | | The two issue bodies as sent |

## Acceptance

- A session exited with `/inventory-exit-reason` carries `exit.kind` and the person's words. A
  session that ended without it can receive the reason later, and a later reason never rewrites
  one given at exit.
- `miadi-hooks-interpret exits` answers how and why sessions ended, with the model each one ran,
  so no agent reads the raw capture for it and the lookup guard has a door to name.
- An investigation pass groups the reasons into patterns, each pattern with its sessions as
  evidence and a proposed change held for the person. It changes no record and no session.
- The pass after a change landed reports that pattern's recurrence since the change.
