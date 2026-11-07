---
name: mentorship
description: >
  When this seat mentors another user's Claude session on the same host: observe it from the
  hook capture, supply information useful to the relationship, steer only with a person's go
  and a clear pane guard, keep the mentee's words verbatim, land what the mentee's session
  wrote, and emit one mentorship event at each step so a person can follow it on a webhook.
  Triggers on "mentor", "mentorship", "watch Jerry's session", "another user's tmux session",
  "send me events", "call my webhook", "what is the mentee doing".
metadata:
  type: skill
  version: 0.0.1
  scope: a mentor seat beside a mentee's session, its steps and the event each one emits
---

# Mentor another user's session

Composed from the run of 2026-11-04 to 2026-11-06 on eury. The seat `6ad00fd4` (user `mia`) watched Jerry's sessions `d8e16584` and `0666437f` (user `gmusic`) while William directed it. The record is `rispecs/hosted-witness-service/01-reverse-engineer.md` in the kit. This skill is a draft and changes with each run.

Who is who:

- **The mentee**: a person working in their own Claude session under another account on this host.
- **The mentor seat**: this session.
- **The person who gives the go**: the maintainer (William) or the mentee himself. Never this seat.

Every step below emits an event with `${CLAUDE_PLUGIN_ROOT}/scripts/mentor-event.mjs`. The README of this plugin lists what each event's `data` carries. Run every command with `--dry-run` first when in doubt: it prints the envelope and changes nothing.

## 1. Open, only after the mentee knows who listens

Before watching, the mentee has heard which account reads his sessions and what it reads. Jerry heard it on 2026-11-06 at 08:39 UTC from his own session, when he asked what records his sessions (run log in `01-reverse-engineer.md`, chronicle commit `ce23729a`). If there is no such moment to point at, do not open. Tell the maintainer what is missing.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/mentor-event.mjs" emit mentorship.opened --subject session:<mentee session id> \
  --data '{"mentee_user":"<account>","sessions":["<id>"],"folder":"<watched folder>","consent_ref":"<file and heading>"}'
```

## 2. Observe from the capture

Start the watcher with Bash `run_in_background: true`. It emits `mentee.said` and `mentee.turn_ended` by itself, without the mentee's words:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/mentee-watch.mjs" --session <id> [--session <id>]
```

Read what happened from `/src/_sessiondata/<id>/`: `last_claude_AssistantResponse.json` (the last reply), `_claude_user_inputs.jsonl` (field `prompt`, no timestamp), the tail of `_claude_PreToolUse.jsonl` (what it is doing). A session is busy when its newest input or tool call is newer than its newest Stop line, and idle when its newest line is a Stop.

Never read `/home/<mentee>/.claude`. It is closed to this account, and its silence means nothing. When the capture itself cannot be read, say which path and why, and report no status for that session.

## 3. Supply what is useful to the relationship

Observing is not the job. After a turn ends, look for what a person needs in order to act, and write it down for them:

- what the mentee did not get, quoted in his words ("i dont get it", "which session?");
- the one next small thing he could receive, in his vocabulary;
- a check of the steps he is about to run, done by the seat before he runs them.

Write it in a file the person reads, for the maintainer `.mia/mentor-notes-<yymmdd>.md` in the watched folder, and tell the maintainer in plain words. Then:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/mentor-event.mjs" emit mentor.supplied --subject session:<id> \
  --data '{"to":"maintainer","file":"<path>","about":"<id>"}'
```

## 4. Steer, only with a person's go and a clear guard

1. Write the steer as a file in the watched folder under `.mia/`, with front matter `go_by`, `go_at` and `go_words` (the person's words, verbatim). It holds the task, what is not the session's this turn, and the marks that prove it done. Example: `.mia/witness-steer-261106.md` in the staged folder of the run.
2. Run the guard as the mentee: `sudo -n -u <mentee> /etc/claude-code/skills/dispatch-discipline/pane-write-guard.sh <pane>`. Exit 1 (composing), 2 (busy) or 3 (no pane) means do not type. Wait for the next `mentee.turn_ended` and check again.
3. On exit 0, type one line and press Enter: `sudo -n -u <mentee> tmux send-keys -t <pane> -l 'Steer from the mentor seat (<session>): read <file> and do what its "Your task" section says.'`, then `sudo -n -u <mentee> tmux send-keys -t <pane> Enter`. Read the pane back.

The watcher will see that line as `mentee.said` with `origin: "steer"`. That is how a receiver tells the mentor's line from the mentee's.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/mentor-event.mjs" emit mentor.steer_sent --subject session:<id> \
  --data '{"steer_file":"<path>","pane":"<pane>","go_by":"<person>","go_at":"<time>","guard_exit":0,"read_back":true}'
```

What reached Jerry: one short message at a time, in his own session, ending with one question, and nothing new until he answered. Two long pages did not reach him.

## 5. Keep the mentee's words verbatim

The mentee's session writes each thing he says about the work into `feedback.md` in the watched folder: a `## <date>, <who>, about <what>` heading and his words in a quote, exactly. The seat reads that file and never rewrites it. It adds only "What changed" under an entry when a revision lands. When a new heading appears:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/mentor-event.mjs" emit mentee.feedback_written --subject session:<id> \
  --data '{"file":"<path>/feedback.md","heading":"<the heading line>","entry":<n>}'
```

The event names the entry. His words stay in the file. Never replace them with a summary, in a note or a reply.

## 6. Land what the mentee's session wrote

The mentee's account often cannot commit where its session writes. Pull, add the changed paths by name (never `-A`), commit with an imperative subject and a `Ref:` to the folder's issue, push. A rejected push is integrated once and retried once; a conflict stops the landing and is reported.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/mentor-event.mjs" emit mentor.landed --subject session:<id> \
  --data '{"repo":"<path>","commit":"<sha>","paths":<n>,"ref":"<owner/repo#n>"}'
```

## What this seat never does

- Type into the mentee's pane without a person's go and guard exit 0.
- Read the mentee's `~/.claude`.
- Put the mentee's words in an event. `--with-text` is for when the mentee has agreed that the webhook's owner receives them.
- Set `MIADI_MENTORSHIP_WEBHOOK_URL` itself. Where events go is the receiving person's choice.
- Close or stop the mentee's session.
