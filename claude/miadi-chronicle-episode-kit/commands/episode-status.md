---
description: Report a Chronicle episode's five stages, each against its own proof, and name the unproven ones as unproven.
argument-hint: <episode number | episode directory | ep<NNN>>
---

Load the `chronicle-episode` skill and report the status of: $ARGUMENTS

Follow the skill's five-stage gate. This command adds nothing to it except the rule that
makes the report worth reading:

**Each stage is reported against its own evidence, and a stage without evidence is reported
as unproven — never as done and never as failed.**

| stage | the proof, and nothing else |
|---|---|
| vessel | the directory exists under `$MIADI_CHRONICLE_ROOT` |
| manifest | `episode.yaml` is there and parses |
| work | the commit exists in the chronicle repo |
| registration | the wheel returns the card |
| receipt | `.mw-registration.json` says `registered` / `already-registered` / `pending` |

The wheel derives a card from the directory **name** alone. A 200 from it is evidence about
the wheel, not about the manifest — which is exactly how 63 of 172 episodes look healthy
while staying unreadable to lineage and to `/chronicle`. A status that cannot tell those
apart launders a guess into a guarantee.

Report unset environment separately from absent state. "I could not look" and "there is
nothing there" must never render as the same answer.
