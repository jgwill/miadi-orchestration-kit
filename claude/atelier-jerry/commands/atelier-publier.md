---
description: Publish a verified piece into a studio room with its label and its provenance, and record it in the self-echo ledger so the watch does not report it back as a deposit.
argument-hint: "<file.m4a|file.mid> --slug <room> [--url URL] [--label \"…\"] [--note-file f.md] [--run]"
allowed-tools: Bash, Read, Task
---

Publish `$ARGUMENTS`. **Dry run by default** — nothing leaves this machine without `--run`.

## Gate one: it must be verified

Run `/atelier-verifier` first, or show its passing output from this session. An unverified
file does not publish. This is the whole reason the two commands are separate.

## Gate two: whose voice is in the file

If the artefact contains a person's recorded voice, breath, whistle or body — not their MIDI
— then **stop and read `${CLAUDE_PLUGIN_ROOT}/skills/studio-portal/SKILL.md`**, the consent
section. The rule that governs this atelier, in the musician's own words:

> *"I don't consent that my voice and my original recording goes outside of the boundary
> here."* — the MIDI is the offered part; the voice is not.

Derived work built from their voice inherits the same rule. Consent is not transitive: a yes
for one piece is not a yes for the next. Record the decision either way in the ledger with
`${CLAUDE_PLUGIN_ROOT}/scripts/atelier_consent.py`.

## Then publish, in this order

1. **Identify the studio.** `atelier_portal.py identify --url …` and confirm the workspace
   is the one intended. A port number and a hostname do not identify a service — the triplet
   (host, port, code tree) does. Two studios answered on the same port number on different
   machines, and one answered from the wrong machine entirely because the port was not
   declared in the gateway.
2. **Import**, then **attach**, then **label**. The portal re-timestamps the filename on
   import; carry the name it gives back. If attach answers `Recording not found`, the file
   is in the composition folder and the endpoint reads the recordings directory — move it,
   do not retry.
3. **The label carries the decisive figure**, not a title. "0 notes between 45 and 53" tells
   the musician something; "Opus 24" does not.
4. **Append the provenance to the room's note** — never replace it. What was measured, what
   was theirs, what you chose, what you corrected. Append, because someone else's writing is
   in that field.
5. **Record it in the self-echo ledger**: `atelier_veille.sh --mine <filename>`. Skip this
   and the watch will report your own publication back to you as the musician's deposit. It
   did, once.

## What is never published

Their unaltered voice recordings. Their crops, off their device. A `.sf2` built from their
sound — a SoundFont is a format made to travel, and travel was not granted. Any of these
goes into the held-gate ledger by name, with the reason and their own words, and waits.
