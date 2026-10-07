---
description: List, add to, or release the held-gate ledger — the things named but deliberately not done for want of the human's word.
argument-hint: "[--list] | <name> --why \"…\" --quote \"…\" | release <name> --by \"…\""
allowed-tools: Bash, Read
---

Work the held-gate ledger with `$ARGUMENTS`.

```bash
# list what is open
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/atelier_consent.py" held --list

# hold something, with their words if they said any
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/atelier_consent.py" held <name> \
    --why "why this cannot be done alone" --quote "their sentence, verbatim"

# record that the word was given — this does not perform the act
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/atelier_consent.py" release <name> --by "who said it"
```

## What a held gate is

An act the atelier can perform, has decided not to perform, and has named — because the
next step leaves the person's walls, spends their name, or touches infrastructure someone
else owns.

Holding is not caution and it is not a refusal. It is the eleventh state of the loop: the
one you cannot leave alone. Everything else in this plugin is designed so an agent can move
without asking. This is the short list of what is not that.

## What belongs in it

- publishing anything made from a person's voice outside their own studio
- converting their sound into a format built to travel — a `.sf2` is exactly this
- sending their audio to a third party, including transcription
- editing code they own, on a device they own, even when the fix is one word long
- any command requiring `sudo` on shared infrastructure
- force-push, rewritten history, deletions, anything reaching an outside audience

## What does not belong in it

Anything reversible inside a workspace you control. Pulling, cloning, branching, drafting,
rendering, measuring, re-running. The test is one question: **if this turns out wrong, can
it be undone without asking anyone's forgiveness?** If yes, do it and say so. A gate you
invented is not a gate you were given, and asking again after the person has already asked
is the failure, not the safe choice.

## What a held entry carries

The name of the act, the reason it is held, and **the person's own words** where they exist.
Their sentence is what makes the hold theirs rather than yours. The entry is timestamped and
append-only, so a gate cannot quietly evaporate.

## Releasing

`release <name> --by …` records that the word was given, by whom, and when. It does not perform the act.
Someone still has to do the thing, and now they may.

A gate lives in a ledger, never in scrollback. Scrollback scrolls.
