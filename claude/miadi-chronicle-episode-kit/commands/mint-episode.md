---
description: Mint a Miadi Chronicle episode vessel with mkepisode, register it, and read the receipt back before claiming it exists.
argument-hint: <number> "<title>" "<goal>" -r owner/repo#N
---

Load the `chronicle-episode` skill and mint an episode from: $ARGUMENTS

This command is a doorway, not a second copy of the procedure. The skill at
`skills/chronicle-episode` is the only place the five-stage gate, the wheel URL law, and
the receipt contract are written. Read it and follow it; do not reconstruct it here.

Three things this command exists to keep true:

1. **`mkepisode` mints; `mkdir` never does.** The plugin's PreToolUse hook enforces this,
   so a hand-made directory will be refused with the invocation to use instead.
2. **The wheel URL comes from the environment.** `MW_API_URL` derives from
   `MIADI_CHRONICLE_MW_URL`. `https://mw.tail3b11eb.ts.net` is retired and offline since
   2026-07-29; anything still naming it is stale.
3. **A stage is reported only when it is proven.** The directory, the manifest, the commit,
   the wheel card and the receipt are five separate facts. Read `.mw-registration.json`
   rather than inferring registration from an exit code.

If a directory for this episode already exists without a manifest, this is an adoption,
not a minting: `mkepisode --adopt` with `--status` naming what the work actually is.
