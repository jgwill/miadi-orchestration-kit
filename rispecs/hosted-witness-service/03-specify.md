# 03 Specify: `miadi-hosted-witness`

## Parts

| part | does |
|---|---|
| configuration | one file per relative names who is witnessed, by whom, what is read, where the work lands, where the factory is, and when it expires |
| watcher | a user service of the witness user that turns the capture and the watched folders into wake events |
| `await` | what a witness seat runs in the background; it prints the next wake and exits |
| status from capture | busy, idle and ended, read from the capture alone |
| pane bridge | read the relative's pane and deliver one line to it, through a scoped sudo rule and the write guard |
| feedback file | the place a relative's words are kept, one entry per saying |
| landing | commit and push what the relative's sessions wrote in a watched folder |
| factory relay | an observation per wake, and a request per proposed steer or ending |
| inventory | the witness's records and asks, pushed where the maintainer's other seats read them |

## Configuration

`/etc/miadi/hosted-witness.d/<relative>.conf` (a conffile; `~/.config/miadi/hosted-witness.d/<relative>.conf` of the witness user is read after it):

```
RELATIVE=gmusic                    # the account witnessed
WITNESS=mia                        # the account the seat runs as
SESSIONS=d8e16584-a820-4346-a0b0-0bb6cef4d216   # session ids or tmux names; empty means every session of RELATIVE
FOLDERS=/srv/miadi/episodes/miadi-chronicle/_staging_for_new_episodes/stcmastery-plugin-structure-atelier-jerry-near-the-loop-261104
LAND_REPOS=/srv/miadi/episodes     # repositories the seat may commit and push in
LAND_REF=miadisabelle/chronicle-sessions#103   # Ref: trailer for each landing
FACTORY_URL=https://miadi.sanctuaireagentique.com
CONSENT_AT=2026-11-04T11:41:00Z    # when the relative said yes, and in which words (CONSENT_WORDS)
EXPIRES=2026-12-04
```

`miadi-hosted-witness enable <relative>` writes this file from questions. It asks the relative, not the witness, to confirm `SESSIONS` and `FOLDERS`. It records the relative's words of consent in `CONSENT_WORDS`. Past `EXPIRES` the watcher stops and says so.

## Watcher and `await`

The watcher is `miadi-hosted-witness.service` (systemd user unit of `WITNESS`). It checks every 20 seconds and appends one line to `~/.local/state/miadi-hosted-witness/<relative>/wakes.jsonl` per event:

| event | when |
|---|---|
| `turn_end` | a new line in `<capture>/<session>/_claude_Stop.jsonl` |
| `input` | a new line in `_claude_user_inputs.jsonl` |
| `feedback` | a new entry in a watched folder's `feedback.md` |
| `folder` | any other file in a watched folder changed and has been still for 90 seconds |
| `expired` | `EXPIRES` passed |

`miadi-hosted-witness await <relative>` prints the events the seat has not seen yet. If there are none, it blocks until one arrives, then prints it with the re-arm command and exits 0. A seat runs it with `run_in_background: true`, and each exit wakes the seat. Exit 5 means another `await` already holds this relative for this witness.

## Status from capture

A session is:

- `busy` when its newest `PreToolUse` or `input` line is newer than its newest `Stop` line;
- `idle` when its newest line is a `Stop`;
- `ended` when the capture holds a `session.end` binding line for it.

The private session registry is never needed. When the registry is readable, it may confirm the status. It never overrides the capture. (The prototype's listener read only the registry and reported "not running" for a busy session.)

## Pane bridge

`miadi-hosted-witness pane read <relative> [--lines N]` and `miadi-hosted-witness pane deliver <relative> --file <steer.md>`.

- Both run as `RELATIVE` through `/etc/sudoers.d/miadi-hosted-witness`. The rule allows `WITNESS` to run only `/usr/lib/miadi-hosted-witness/pane-as-relative` as `RELATIVE`. That helper calls `tmux capture-pane` and `tmux send-keys` on the relative's own socket and nothing else.
- `deliver` refuses unless `pane-write-guard.sh` returns 0 for the target pane (exit 1 composing, 2 busy, 3 no pane). It types one line: `Steer from the witness seat (<witness session>): read <steer file> and do what its "Your task" section says, within its "Not yours this turn" boundary.` Then it presses Enter, waits 6 seconds, reads the pane back and exits 0 only if the line is no longer at the prompt.
- The steer file lives in a watched folder, under `.mia/`. It holds the person's words verbatim, the task, what is not the session's this turn, and the marks that prove it done.
- `deliver` refuses a steer file that names no person's go (`go_by:` and `go_at:` in its front matter).

## Feedback file

`feedback.md` in each watched folder. One entry per saying:

```
## 2026-11-05 Jerry, about handle-for-jerry.md

> <his words, exactly>

What changed: <filled in later by whoever acted on it>
```

The relative's session writes the entry when the relative speaks about a page (the folder's `AGENTS.md` says so). The witness only reads it, and adds "What changed" when a revision lands.

## Landing

On `turn_end`, `feedback` or `folder`, the seat:

1. pulls each `LAND_REPOS` (fast-forward, or `merge --no-edit origin/main` where the repository forbids rewinds);
2. adds the changed paths of the watched folder by name, never `-A`;
3. commits with an imperative subject, the event in the body and `Ref: $LAND_REF`;
4. pushes. A rejected push is integrated once and retried once. A conflict stops the landing and becomes an observation.

A first landing of a staged chronicle folder runs the folder's own staging script, which opens its chronicle-sessions issue. That issue becomes `LAND_REF`.

## Factory relay

For each wake, the seat calls the connector at `FACTORY_URL`:

- `append_observation` on `session:<relative session id>`, with claim category `observed`: one sentence on what happened and the commit that proves it.
- When the seat drafts a steer: `request_session_steer` with the steer file's text. The request stays `awaiting_approval`, and `show_decisions` puts it in front of the maintainer. `deliver` runs only after the decision, and the decision's id goes into the steer's `go_by`.
- When the relative's work in a folder looks finished: `propose_session_completion`. The seat never closes a session itself.

The seat signs in as itself, never as the maintainer. Until the connector issues seat identities (`rispecs/witness-team-interface/`), the relay writes the same three records to `~/.local/state/miadi-hosted-witness/<relative>/outbox.jsonl`, and the maintainer's seat on gaia reads them from there.

## Inventory

The seat keeps one record per witnessed session in `~/workspace/.mino/session-inventory/<id>.json` (`SCHEMA.md` there, "Witnessed sessions": `peer`, `observations[]`) and the maintainer's asks in `~/workspace/.mino/asks/<seat>.json`. It commits and pushes them after each wake.

## Commands

```
miadi-hosted-witness enable <relative>      # questions, consent, config, sudoers rule, start the watcher
miadi-hosted-witness disable <relative>     # stop the watcher, remove the sudoers rule, keep the record
miadi-hosted-witness status [<relative>]    # what is read, what is watched, last wakes, expiry
miadi-hosted-witness await <relative>       # for the seat: the next wake
miadi-hosted-witness pane read|deliver ...  # the pane bridge
miadi-hosted-witness check <relative>       # can the seat see the capture, the pane, the folders, the repos, the factory
```

## Creative advancement scenarios

**Creative Advancement Scenario**: Jerry receives the handle

**User Intent**: Jerry understands what a plugin changes for him and decides whether to switch.
**Current Reality**: His sessions are recorded by scripts written into his settings. A handle for him sits in a staged folder.
**Natural Progression Steps**:
  1. The maintainer approves a steer in the factory. The seat delivers one line, and the relative's session prints a message that starts "Jerry,".
  2. Jerry reads the page and says what he thinks in his session. The session writes his words into `feedback.md`.
  3. The `feedback` wake lands the entry and puts an observation in front of the maintainer.
**Achieved Outcome**: Jerry has made one decision with its proof in front of him, and the maintainer has his words as he said them.
**Supporting Features**: steer file, pane bridge, feedback file, landing, factory relay.

**Creative Advancement Scenario**: Jerry says go

**User Intent**: The switch happens on his machine and he sees that it worked.
**Current Reality**: Four apt upgrades are waiting. The plugin is not installed in his account.
**Natural Progression Steps**:
  1. Before he says go, the seat checks that the steps can run: packages waiting, marketplace configured, every hook his settings wire also wired by the plugin.
  2. His agent runs the steps and shows him a new session's capture folder.
  3. The `turn_end` wake lands the folder's changes. The seat confirms in the capture that the new session was recorded.
**Achieved Outcome**: His settings no longer carry hooks, his sessions are still recorded, and the record says so with a commit.
**Supporting Features**: `check`, status from capture, landing.

**Creative Advancement Scenario**: the seat cannot see something

**User Intent**: The maintainer trusts what the seat says it saw.
**Current Reality**: A path it needs is closed to the witness user.
**Natural Progression Steps**:
  1. `check` names the path and the permission it lacks.
  2. The seat writes an observation saying what it could not see, instead of a reading of silence.
**Achieved Outcome**: No status is reported from a source the seat could not read.
**Supporting Features**: `check`, status from capture.
