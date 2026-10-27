---
name: witness-a-circle-session
description: >
  Launched as the witness seat onto another session that holds a talking circle: given a peer
  address or session id, and often nothing else, find the circle, listen for William's input in
  that session, keep the inventory for both sessions, get seated in the circle as the seat, and
  speak only the seat's own turns. Triggers on a peer address (uds:/run/user/<uid>/cc-socks/<pid>.sock),
  a tmux or session name carrying a circle id (`<purpose>:<epoch ms>:<suffix>`), "watch its
  session folder for my input", "enter the circle with us", "keep a session inventory".
---

# Witness a session that holds a circle

Earned 2026-10-05 (ask-10 in the mino ledger). William launched the seat with one line and a
peer address, and said the next launch like it should need no more than that. These are the
steps that launch needed, in order.

## 1. Read the peer, not the socket

The peer address names a Claude Code session. Its session id is in the address block William
pastes, or `ListAgents` gives it. Then read `/a/src/_sessiondata/<id>/`:

- `_terminal_binding.jsonl`: tmux session, pane, cwd, transcript path, launch alias.
- `custom-title.json`: the name it carries now.
- `_claude_user_inputs.jsonl`: William's input, once he sends it. Its absence means he has not.

A tmux or session name of the shape `<purpose>:<epoch ms>:<suffix>` carries a circle id.
The circle is `circle:<epoch ms>:<suffix>`. It is not an invitation code.

## 2. Listen

```bash
node "$KIT/claude/miadi-witness/scripts/witness-listen.mjs" await --seat mino --watch <peer session id>
```

Run it with `run_in_background: true`. The first wake usually carries a backlog of older
scratchpad blocks and threads. Hold every event that is not this mission, in one clause.

William writes scratchpad blocks over several saves, and the default settle of 3 seconds wakes
the seat at each one (2026-10-06: three wakes in three minutes on one block). Prefix the command
with `WITNESS_SETTLE_MS=60000` so a block wakes the seat once he has stopped editing for a minute.
Thread events are not delayed by it.

Add `--only-watched` when another witness seat is live, or when the mission is one circle. The
seat then wakes for the watched sessions and their forks only, and not for every thread of the
seat (2026-10-06: six wakes in an hour about other seats' work, each reaching William as a reply).
A fork of the watched session wakes it even when the fork belongs to no seat. Without the flag,
the trunk's fork ran 21 hours unseen.

## 3. Keep the inventory, both sessions

```bash
node "$KIT/claude/miadi-witness/scripts/inventory.mjs" write --session <peer id> --session <own id>
```

Then add the meaning to each record (`mission`, `work_completed`, `held_decisions`,
`next_steps`) once William's input to the peer exists. Before that there is no mission to write.

## 4. Get seated

1. `GET $MIADI_API_URL/api/identity/me` with `MIADI_MINO_TOKEN` must answer
   `Mino-Bimaadizi-Daa`. Never print the token.
2. `GET /api/ceremony/<id>` with the seat's token. `Forbidden` means the seat is not a member.
3. The seat cannot seat itself. When William has said the observing agent will enter the
   circle, that sentence is the consent (MINO.md §5, last row). The facilitator's token
   (`MIADI_PERSON_TOKEN` after sourcing `/opt/binscripts/etc/bash_env_common`) issues a
   single-use invitation for the seat's person id, and the seat redeems it with its own token:

   ```bash
   C=$(jq -rn --arg c "<circle id>" '$c|@uri')
   POST /api/circles/$C/invite  {"intended_for":"<seat person id>","max_uses":1}   # facilitator token
   POST /api/circles/$C/join    {"code":"<code>"}                                    # seat token
   ```

4. Prove it: `GET /api/ceremony/<id>` with the seat's token lists the seat in
   `.circle.members` and `.can.speak` is true. Tell William his token issued the invitation.

## 5. Speak only the seat's turns

William asks the peer to speak his words for him. So the peer speaks his turns and the seat
does not, or every word lands twice. The seat speaks its own turns, with its own token, in
the ceremony the conversation lives in. When he says an existing ceremony gets little and a
new one is opened for the conversation, wait for the peer to open it. Do not open a second.

His turns are often dictated. A voice transcription can add words he never said. On
2026-10-05 the seat built a reading of a decision on "an amazing name", a phrase in his
transcribed turn, and he answered "I never said" it. So before a turn of the seat rests on one
phrase of his, say that it came through transcription and that he has not confirmed it. When he
disowns a phrase, speak a turn that withdraws what was built on it, and leave the earlier turns
as they were spoken.

## Listen to the circle, too

When William places work in a ceremony and asks the seat to act on what is said there, the
circle becomes a source of wakes:

```bash
node "$KIT/claude/miadi-witness/scripts/circle-listen.mjs" await --seat mino --ceremony <id>... [--reviews]
```

It wakes on a turn or diary entry spoken by anyone but the seat, on a ceremony closing, and,
with `--reviews`, on a new Miadi review. Its first read is a baseline. It prints the exact words
and the re-arm command. It has no deadline and keeps listening through a door that refuses, so
it wakes the seat only when the circle moves. Exit 4 comes only from a `--timeout` someone gave
it, and exit 5 means another listener already runs for the seat.

## When William forks the seat

A fork (`mino_fork <session id> [name]`, which is `claude --resume <id> --fork-session`) carries
the whole conversation and none of the running work. Background tasks, such as the listener,
stay with the parent. In the fork, the harness reports them as "stopped". That notice means the
fork does not hold them. It does not mean they ended. Check with `tmux list-panes` and the parent's
task output before you believe it.

What the forks in the inventory were for: f174aa5a witnessed the restore session and relayed his
answers to it. dddf5ee3 turned results into catalogued, postable work. 00b0a513 sat in pane 2 beside
the listener in pane 1, and he used it to ask about the seat itself without interrupting the
listener. Each time, the fork opened a second line of the same relationship, with the same memory,
while the parent kept its obligations.

So, in a fork:

- Do not re-arm the parent's listener. The script refuses with exit 5, and the parent holds it.
- Do not speak in the circle unless the parent hands the turn over. Both share Mino's identity,
  so two forks speaking would read as one seat saying everything twice.
- Write the fork's own inventory record with `inventory.mjs write --session <fork id>`, name the
  parent and the pane, and say what the fork is for.

## 6. Record the launch words

```bash
node "$KIT/claude/miadi-witness/scripts/asks.mjs" add --seat mino --title "<what he asked>" --words - <<'EOF'
<his words, verbatim>
EOF
```

## Related

- `commands/witness-listen.md`: the turn budget each wake carries.
- `miadi-witness-first-impression`: reading the peer and writing for the ear.
- `chronicle-episode` S15 in the kit: circles, ceremonies, turns, invitations.
