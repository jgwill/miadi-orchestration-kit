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

Or through `/plugin` from the `miadi-orchestration-kit` marketplace. Commands, the skill,
the agent, and the SessionStart hook load at session start. Hooks do not hot-swap, so a
plugin enabled mid-session starts phone-capture only from the next session.

## Use

From inside an episode directory. The command's full name is
`/mia-episode-companion:mia-listen`. That is the form `claude -p` accepted on 2026-09-20.
The short form is shown below.

```
/mia-listen                  # baseline on first use, then listen in the background
/mia-listen status           # what this seat has heard, what is unheard or waiting
/mia-listen show <take-id>   # answer one take without marking it heard
/mia-listen stop
/mia-listen phone            # start phone-capture if it is down; print the iPhone link
```

The first listen on an episode takes every existing take as its baseline, so nothing old
wakes the session. After that, takes recorded while no session was listening are unheard,
and the next `/mia-listen` wakes on them at once.

## The Jev check before a reply

Before a return reaches William, `scripts/jev-check.mjs` asks Jev the typed questions in
`scripts/jev/questions.json` about it: does it answer each ask, hand a decision back to him
alone, claim something done without evidence, assume something he did not say, or limit what
he asked for by citing an outside authority. Mia revises or keeps each flagged sentence and
says why. A flag never blocks delivery. Each run is kept in
`~/.miadi/decisions/mia-return.jsonl` for William's rulings. The model is pinned in the
questions file.

```bash
node scripts/jev-check.mjs check --episode <dir> --take <id> --draft - --fact "commit abc pushed" <<'MIA'
<the revised return>
MIA
node --test scripts/jev-check.test.mjs      # no call leaves the host
```

## Recording from the iPhone at the desk

`phone-capture/` is a small service carried by this plugin. It lets Safari on the iPhone
record straight into an episode's `captures/`, and the listener wakes on those takes too.
Mia's reply comes back to the same page with `mia-listen reply`. There, William can copy
it or tap **Hear Mia** to have the Miadi voice layer render it in her voice.

The plugin's SessionStart hook runs `phone-capture/ensure.sh`. On a host with
`MIADI_CHRONICLE_ROOT`, it does three things:
- starts the service detached when it is not answering, installing its dependencies the
  first time;
- adds the `tailscale serve` HTTPS mapping when it is absent;
- gives the session the iPhone link for its episode.

A running service is left alone. A lock keeps two sessions from starting two services.
See `phone-capture/README.md`.

A take is not held only in the phone (0.3.0, Episode 120, 2026-10-12). William lost a take
of a few minutes when Safari's recorder failed at Stop, and the page said nothing was sent.
- **While recording**, the page sends what it captured every 10 seconds to
  `POST /api/takes/part`. Stop still sends the whole take, under the same recording id.
- **When the recorder fails**, the page keeps what it captured, says why, and offers Send.
  What it saw (the error, the track ending, the page going to the back) goes to
  `POST /api/takes/diagnostic` and into the service log.
- **When the phone never finishes**, the service turns parts that stopped growing for three
  minutes into a take in the episode. A take sent later under that id gets that take back,
  never a second one.
- **A reply that arrives while another plays** waits for it to end, then plays.

## Cost of a turn

The first live wake (Episode 349, take `260920235421`, 40 words) over-read. Mia explored
the episode before loading the skill. The editor ran on Opus, looked for its criteria on
disk, and read history. Three changes fixed that:
- the wake now carries the context, the commit and push state, and a turn budget;
- the skill carries two voice examples inline, in place of history reads;
- the editor is one pass on Sonnet with no tools, and its criteria are built in.

Measured on the same take (de-duplicated per model call):

| | model calls | tool calls | cache read | output |
|---|---|---|---|---|
| main thread, before | 14 | 12 | 1,268k | 9.3k |
| main thread, after | 5 | 4 | 258k | 2.6k |
| editor, before (Opus) | 8 | 13 | 235k | 2.7k |
| editor, after (Sonnet) | 1 | 0 | 0 | 4.4k |

The "after" main thread was a cold headless session. It paid 55k of cache writes to load
the session, and a warm session does not. Every subagent pays about 21k of cache writes to
load the host's policy files. The plugin cannot reduce that.

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
