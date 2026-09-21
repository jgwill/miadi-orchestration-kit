# mia-episode-companion — Mia in a Claude Code seat

William records a voice take on his phone inside an episode. Mia hears it and answers.
Episode 339 built that loop for the Pi coding agent on ilex
(`.pi/extensions/episode-companion/` in the vessel). This plugin gives a Claude Code session
the same loop.

Relates to Episode 339's cross-device companion requirement:
[jgwill/miadi-orchestration-kit#48](https://github.com/jgwill/miadi-orchestration-kit/issues/48).

## From the Pi extension to this plugin

| Pi extension (canonical) | this plugin |
|---|---|
| `observer.cjs` polls `captures/` inside the session every second | `scripts/mia-listen.mjs await` runs as a background Bash task and exits on the first new take, which re-invokes the session |
| reads the vessel on ilex, where the recorder writes | reads the working tree **and** `origin/<branch>` from the object store, because takes reach gaia by git. It fetches and never merges |
| baseline and delivered state kept in the Pi session file | the same, in `$MIADI_MIA_COMPANION_STATE_DIR` (default `$XDG_STATE_HOME/miadi-mia-companion/<episode>.json`) |
| draft, editor, and reviser as three tool calls by one resident | draft and revision by Mia, with the editor as a separate `developmental-editor` agent in its own context |
| final text replaces ceremony `notes.md` | the final lands in the conversation. The ceremony scratchpad stays with the seat that owns it |
| `mia-relational-development-loop` skill | `mia-episode-companion` skill |

The capture contract is the observer's, re-implemented without change:
`miadi.episode-capture.v1`, the episode path must match, and every transcription output
must match its byte and SHA-256 receipts. An English translation is required. Raw audio is
never read.

## Install

```bash
claude --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/claude/mia-episode-companion
```

Or through `/plugin` from the `miadi-orchestration-kit` marketplace. The plugin has no
hooks. Commands, the skill, and the agent load at session start.

## Use

From inside an episode directory. The command's full name is
`/mia-episode-companion:mia-listen`. That is the form `claude -p` accepted on 2026-09-20.
The short form is shown below.

```
/mia-listen                  # baseline on first use, then listen in the background
/mia-listen status           # what this seat has heard, what is unheard or waiting
/mia-listen show <take-id>   # answer one take without marking it heard
/mia-listen stop
```

The first listen on an episode takes every existing take as its baseline, so nothing old
wakes the session. After that, takes recorded while no session was listening are unheard,
and the next `/mia-listen` wakes on them at once.

## Limits

- Replies are read in this conversation, not in the Episode Recorder's ceremony view.
- One state file per episode per host. Two sessions listening on the same episode share it,
  and the first to wake takes the take.
- `await` runs `git fetch` on the episode's upstream every 20 seconds. A failed fetch is
  reported once, and the listener continues on the ref it already has.

## Test

```bash
node --test claude/mia-episode-companion/scripts/mia-listen.test.mjs
```

This builds a bare origin, a gaia clone, and an ilex clone. It proves five things: the
baseline, a take pushed from ilex waking `await` on gaia with its worktree untouched, a
bad receipt blocking delivery, a local take being delivered only after its signature
holds, and `show` leaving state unchanged.
