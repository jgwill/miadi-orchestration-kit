# miadi-mentorship (draft, 0.0.1)

A seat that mentors another user's session on the same host. It reads the mentee's hook capture, supplies information useful to the relationship, steers only after a person's go and a clear pane guard, and keeps the mentee's words verbatim. Each of those steps is an event that a person can receive on a webhook of their choice.

This is a first draft. It is not in `.claude-plugin/marketplace.json` and is not installed anywhere. It has no hooks: the events come from a script the seat runs and from the seat itself, so nothing has to load at session start.

Why it exists, in William's words (2026-11-06): "capture this fact that you're monitoring another TMUX session from another user and you're providing this mentorship like we are here. Not just to observe, but to supply information that could really be useful to the relationship." And about Jerry: "I would have loved that by setting you up, you would have automatically called my webhook on my computer with a payload. Like I started communicating with Jerry, he responded, and there would be a few events that would enable me to actually know what's going on".

It is the event side of `rispecs/hosted-witness-service/`, composed from the run in which the seat `6ad00fd4` (user `mia`) watched Jerry's sessions `d8e16584` and `0666437f` (user `gmusic`) on eury. That run's record is `rispecs/hosted-witness-service/01-reverse-engineer.md`.

## Scripts

Node 18 or later, no npm dependencies. Both refuse to start below that floor.

```bash
# one event, from the seat
node "${CLAUDE_PLUGIN_ROOT}/scripts/mentor-event.mjs" emit <type> [--subject session:<id>] [--data '<json object>'] [--dry-run]
node "${CLAUDE_PLUGIN_ROOT}/scripts/mentor-event.mjs" types

# the mentee's capture, turned into mentee.said and mentee.turn_ended
node "${CLAUDE_PLUGIN_ROOT}/scripts/mentee-watch.mjs" --session <id> [--session <id>]... [--once] [--dry-run] [--with-text] [--from-start] [--interval <s>] [--root <dir>]
```

`mentee-watch` reads `<root>/<id>/_claude_user_inputs.jsonl` and `_claude_Stop.jsonl`, which `miadi-session-observability` writes for every session and which every account on the host may read. The root is `CLAUDE_SESSIONDATA_ROOT`, `MIADI_SESSION_DIR`, `MIADI_SESSIONDATA_ROOT`, `SESSION_DATA_ROOT`, then `/src/_sessiondata`. It never reads the mentee's `~/.claude`.

- A session seen for the first time is a baseline. What it already holds is not emitted. `--from-start` emits it all once.
- `--once` checks once and exits. Without it, it checks every 20 seconds until stopped.
- `--dry-run` prints the envelopes and changes nothing: no events file, no POST, no offsets.
- Exit codes: `0`, `2` usage, `3` a capture could not be read (nothing is reported for that session), `4` an event was kept locally but not delivered.

## Configuration

| variable | effect |
|---|---|
| `MIADI_MENTORSHIP_WEBHOOK_URL` | where each event is POSTed. Unset: events stay in the local file, said once on stderr |
| `MIADI_MENTORSHIP_WEBHOOK_TOKEN` | sent as `Authorization: Bearer <token>`. Never printed. Messages name only the URL's origin |
| `MIADI_MENTORSHIP_STATE_DIR` | state folder, else `$XDG_STATE_HOME/miadi-mentorship`, else `~/.local/state/miadi-mentorship` |
| `CLAUDE_CODE_SESSION_ID` | the mentor session, set by Claude Code. It ends the event's `source` |

The state folder holds `events.jsonl` (every event, one per line) and `offsets.json` (lines already emitted, per watched session). It is created with mode 700 and its files with 600.

## The envelope

CloudEvents 1.0, structured mode (`content-type: application/cloudevents+json`):

```json
{"specversion":"1.0","id":"<uuid>","type":"miadi.mentee.said",
 "source":"eury/mia/6ad00fd4-17be-423a-8a7a-abacd07deffb","subject":"session:d8e16584-a820-4346-a0b0-0bb6cef4d216",
 "time":"2026-11-06T…Z","datacontenttype":"application/json",
 "data":{"session_id":"d8e16584-…","mentee_user":"gmusic","prompt_id":"…","index":5,"count":8,"origin":"pane","chars":94,"capture_file_mtime":"…"}}
```

`type` is `miadi.` followed by the vocabulary name, so `miadi.mentorship.opened`, `miadi.mentee.said`, `miadi.mentor.steer_sent`. `source` is `<host>/<user>/<mentor session id>`. `subject` is the session the event is about.

## Event vocabulary

| type (after `miadi.`) | fires when | `data` carries | emitted by |
|---|---|---|---|
| `mentorship.opened` | the seat starts watching a mentee's sessions, after the mentee has heard who reads them | `mentee_user`, `sessions[]`, `folder`, `consent_ref` (where the mentee heard it) | the seat |
| `mentee.said` | a new input line appears in a watched session's capture | `session_id`, `mentee_user`, `prompt_id`, `index`, `count`, `origin` (`steer` for a mentor's steer line, else `pane`), `chars`, `capture_file_mtime`; `excerpt` only with `--with-text` | `mentee-watch` |
| `mentee.turn_ended` | a new Stop line appears, the mentee's agent has finished a turn | `session_id`, `mentee_user`, `prompt_id`, `index`, `count`, `reply_chars`, `capture_file_mtime`; `excerpt` only with `--with-text` | `mentee-watch` |
| `mentor.supplied` | the seat wrote something useful to the relationship for a person to read | `to` (`maintainer` or `mentee`), `file`, `about` (session id) | the seat |
| `mentor.steer_sent` | the seat typed one steer line into the mentee's pane, after a person's go and guard exit 0 | `steer_file`, `pane`, `go_by`, `go_at`, `guard_exit`, `read_back` | the seat |
| `mentee.feedback_written` | a new entry appears in a watched folder's `feedback.md` | `file`, `heading`, `entry` (its number in the file) | the seat |
| `mentor.landed` | the seat committed and pushed what the mentee's session wrote | `repo`, `commit`, `paths` (count), `ref` | the seat |

## The mentee's words

By default no event carries what the mentee typed or what his agent answered: only ids, counts and times. `--with-text` adds an excerpt of at most 280 characters. Use it only when the mentee has agreed that the webhook's owner receives his words. The words themselves are kept in `feedback.md`, verbatim, where the mentee's session writes them.

The capture has no timestamp field. An event's `time` is when the watcher saw the line, and `capture_file_mtime` is exact only for the file's last line. The capture cannot say who typed an input. A line that starts with `Steer from the witness seat` or `Steer from the mentor seat` is marked `origin: "steer"`. Every other input is `pane`, usually the mentee and not provably so.

## What it does not do yet

- No retry. An undelivered event stays in `events.jsonl` and the offset moves on.
- No lock. Two watchers on the same session emit each line twice.
- `--with-text` excerpts do not pass through the capture sanitizer (`miadi-session-observability/hooks/secret_capture_sanitizer.sh`).
- It does not watch `feedback.md`, deliver a steer, land a commit or write to the Miadi factory. The seat does those and emits their events itself (skill `mentorship`).
- The pane guard it relies on, `/etc/claude-code/skills/dispatch-discipline/pane-write-guard.sh`, comes from jgwill/etc-claude-code and is not shipped here.
- It has no receiver. Whoever sets `MIADI_MENTORSHIP_WEBHOOK_URL` provides one.

## Related

- jgwill/miadi-orchestration-kit#138: the issue that holds this draft and the hosted witness.

- `rispecs/hosted-witness-service/`: the package this draft would feed. Its watcher events (`turn_end`, `input`, `feedback`) are this plugin's `mentee.turn_ended`, `mentee.said` and `mentee.feedback_written`.
- `claude/miadi-witness/`: the witness team's seat and practices.
- The staged folder of the run: `/srv/miadi/episodes/miadi-chronicle/_staging_for_new_episodes/stcmastery-plugin-structure-atelier-jerry-near-the-loop-261104/` (miadisabelle/chronicle-sessions#103).
