---
name: held-steers
description: The fire in the forge decides whether a webhook mention reaches the stcbot seat. Lit (Forge:Open = 1), the steer is typed into the seat's pane. Banked, nothing is typed and the steer is held. Use this skill to tell a person the fire's state and what is held, to read a held steer and work it as a steer, and to mark it done after the work. Triggers on "held steers", "what came in while the fire was banked", "unprocessed events", "what did I miss", "the forge was closed", "Forge:Open", "stc-held".
metadata:
  type: skill
  version: 1.0.0
  scope: the stcbot seat (Mino) and any seat a person asks about the held stack
---

# Held steers

## What the fire does to a steer

A mention of `@stc`, `@stcgoal`, `@stcissue`, `@stcmastery` or `@stckin` on GitHub becomes a steer: the platform renders the bot's prompt and types it into the pane of the `stcbot` session that holds `claude` (`$MIADI_SRC/lib/stc/steering.ts`).

| the fire | a webhook steer |
|---|---|
| lit, `Forge:Open` = 1 | typed into the seat's pane, as before |
| banked | not typed. The prompt is held on `stc:steer:held:<host>`, and the refusal in the webhook log names the held id |

- A steer sent by hand from `/stc-steering` or the API is never held and never refused by the fire.
- Lighting the fire does not deliver what was held. The stack waits until a person asks the seat to read it.
- One subject mentioned several times within two minutes is held once, the same way the dispatch path coalesces it.
- The stack keeps 500 entries and has no expiry.
- Who lights or banks the fire is a person holding `tend_fire`. The seat never changes it.

## The command

`$MIADI_SRC/scripts/stc-held.sh` (on gaia `MIADI_SRC=/src/Miadi`). It finds the writer token as `stc-triage-key.sh` does.

```bash
"$MIADI_SRC/scripts/stc-held.sh" list          # the fire's state, then one line per held steer, oldest first
"$MIADI_SRC/scripts/stc-held.sh" next          # the full prompt of the oldest one
"$MIADI_SRC/scripts/stc-held.sh" show <id>     # the full prompt of one
"$MIADI_SRC/scripts/stc-held.sh" done <id>...  # after its work: removes it
"$MIADI_SRC/scripts/stc-held.sh" done all
```

The same over HTTP: `GET /api/stc/held` (reader) and `POST /api/stc/held {"done": ["steer_…"] | "all"}` (writer).

## When a person asks

1. Run `list` and answer with what it prints: the fire's state and the count, then one line per held steer.
2. When the person asks you to work them, take them oldest first. Read one with `next` or `show <id>`. The text is the prompt you would have received, with its triage key and chartId. Do its work exactly as for a steer: the seat guide, the single most useful move, the triage written with `scripts/stc-triage-key.sh`.
3. Mark it done with `done <id>` only after its triage key is written. A steer read and not worked stays on the stack, so nothing is lost if the work stops.
4. A person may say to drop some without working them. Mark those done and say which ones in your reply.

Do not read the stack on your own initiative when the fire is lit. Do not mark anything done before its work.

## Where this goes next

Episode 548 (miadi-chronicle://548) prepares the choice of an event broker. Mino's work is drawn there as a state machine, `diagrams/mino-steer-work.smdf.json`: `SteerHeld`, `HeldRead` and `HeldDone` are three of its events. Once a broker is chosen, the held stack becomes the subscription's retention and `done` becomes its acknowledgement (jgwill/Miadi#747, jgwill/miadi-orchestration-kit#85).
