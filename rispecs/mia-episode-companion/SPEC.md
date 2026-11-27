# Mia’s return to an episode take

Capability `miadi-capability://jgwill/miadi-orchestration-kit/plugin/mia-episode-companion`.
The [Stateloom system](./mia-episode-companion.sysdf.json) draws the voice-take-to-reply
scenario provided by the Claude Code plugin.

## Intent

A person can record a thought while away from the desk and receive a grounded reply from
Mia in the same episode.

## Current contract

1. The listener starts from the episode’s known takes and waits for a new take. It can read
   the episode’s working files and fetch its branch without merging.
2. A take can wake the companion once its capture manifest names this episode and its
   declared transcript outputs pass the byte and SHA-256 checks. The listener requires
   the English transcript and reads transcript text.
3. Mia drafts a reply. The developmental-editor agent returns recommendations on the
   exact draft. Mia revises and applies the Jev review before returning the reply.
4. Mia can send the final reply to the phone page. The person can read it or request audio
   there. The decision to act on the reply stays with the person.

The [plugin README](../../claude/mia-episode-companion/README.md) gives the commands and
operating limits. The checks are implemented in
[`mia-listen.mjs`](../../claude/mia-episode-companion/scripts/mia-listen.mjs), and the
review question set is in
[`questions.json`](../../claude/mia-episode-companion/scripts/jev/questions.json).
