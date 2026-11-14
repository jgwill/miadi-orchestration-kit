---
name: mentorship
description: >
  When this seat mentors another user's Claude session on the same host: observe it from the
  hook capture, supply information useful to the relationship, steer only with a person's go
  and a clear pane guard, keep the mentee's words verbatim, land what the mentee's session
  wrote, and emit one mentorship event at each step so a person can follow it on a webhook.
  It also says how to write to each of a mentee's identities (a Unix account, a person and a
  label in the factory) on its own channel, and how to walk a mentorship path of steps.
  Triggers on "mentor", "mentorship", "watch Jerry's session", "another user's tmux session",
  "send me events", "call my webhook", "what is the mentee doing", "his label", "two
  accounts", "mentorship path", "capture the events of mentorship".
metadata:
  type: skill
  version: 0.2.0
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

## 7. One message per identity

A mentee can be several identities, and each sees something different. Jerry is three: the Unix account `gmusic` (H) where his agents run, the person "Jerry (Gerico)" (P) in the factory, and the label "gmusic (Jerry's label)" (L) that his composition agent signs in as. Write to each in its own place:

- **P, the person**: the factory's reply in a thread the person started, so it reaches him (`miadi-factory-mail`'s `reply_mail.py` answers the sender), and a turn "for <name>" in a circle he sits in.
- **L, the label**: a turn in the circle the label sits in, and a copy to the label's own address. The factory's mail tool only replies to a sender, so the copy rides on the person's thread with the label in Cc when the label never wrote.
- **H, the home account**: what his agents should do, written as one sentence he can hand them. Never type into his panes for that; he decides what his agents see.

Before sending, check each claim against the tool. A circle turn cannot be edited: a wrong one is corrected by a new turn that says what was wrong, never left. On 2026-11-14 Miette's turns twice stated a wish as a fact ("the circle will see", "nothing is written as the label") and each needed a correction.

Then, for each message:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/mentor-event.mjs" emit mentor.message_sent --subject identity:<factory id or account> \
  --data '{"channel":"email|circle|pane","perspective":"<H|P|L>","to_identity":"<id>","ref":"<Sent UID, or ceremony/turn id>","path":"<path file>"}'
```

## 8. Walk a path

A path file lists the steps of a mentorship, each with the identity it concerns, what exists today (measured), who owns the step, and what shows it reached. The first one is `_staging_for_new_episodes/jerry-label-musical-belt-261114/mentorship-path.md` in the chronicle.

- A step is reached when its evidence is there, read by a command in the same turn: a binding line, a record the connector lists, a desk that answers. Never on the seat's own sense that it went well.
- Choices on the path (which composition, which episode) are the mentee's and the maintainer's. The path names them as questions and the seat leaves them open.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/mentor-event.mjs" emit mentorship.step_reached --subject identity:<id> \
  --data '{"path":"<path file>","step":"M1","identity":"H","evidence":"<the command or address>"}'
```

## 9. Each agent speaks in its own name

When a mentee's agents share one account in the factory, as Jerry's share his label's, seat that account in each circle where the agents receive mentorship, and tell each agent the same rule: open every turn and diary entry with your own name and for whom you speak, one agent per turn, never the person's name as your own. The person speaks with their own account. The rule comes from Jerry (2026-11-14) and from his own line for the label: drafts alone, anything shown outside the community he signs.

## 10. Record a lesson

A lesson is what an agent learned or taught, kept the way Jerry described it (the README's table). The learning agent writes its notes as a diary entry of kind `learning` in the ceremony where it learned; the seat, or the agent, records the lesson:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/mentor-event.mjs" emit mentorship.lesson_recorded --subject identity:<account id> \
  --data '{"lesson_id":"<slug>","version":1,"learner":"<agent name>","identity":"<account id>","teacher":"<name>","ceremony":"<ceremony id>","time_slot":{"from":"<iso>","to":"<iso>"},"human_interactions":<n>,"languages":["fr","en"],"concepts":["<…>"],"notes_ref":"<diary entry id>","content_refs":["<file or video>"]}'
```

A new version of a lesson is a new event with `version` raised, never an edit of the old one.

## What this seat never does

- Type into the mentee's pane without a person's go and guard exit 0.
- Read the mentee's `~/.claude`.
- Put the mentee's words in an event. `--with-text` is for when the mentee has agreed that the webhook's owner receives them.
- Set `MIADI_MENTORSHIP_WEBHOOK_URL` itself. Where events go is the receiving person's choice.
- Close or stop the mentee's session.
