---
name: session-fork
description: Branch a Claude Code session without touching it, and end a branch so the main session gets everything it needs. Ask a branch of another session a question with every tool disabled, or open a branch you can talk to in its own tmux session, with the parent's folder, plugins and episode, under a name tmux-resurrect keeps. Use when William says "fork", "fork that session", "ask that session", "query Mia's session", "open a branch of", "continue it in another tmux", or when a session must learn how another session reached a result, or when work should split from a session at its present point. Also use inside a /btw fork or any side session before its last reply, when asked to "end the fork", "go back to the main thread" or "pass this to the main session", and in the main session when a fork's reply arrives.
---

# Session fork

Built 2026-10-08 in Episode 551, from William's word: forking an agent by hand meant a launch
script, a remembered alias, a remembered folder and a hand-made tmux name. jgwill/miadi-orchestration-kit#61.

## The tool

```bash
F="node ${CLAUDE_PLUGIN_ROOT}/scripts/miadi-fork.mjs"   # or $MIADI_ORCHESTRATION_KIT_ROOT/claude/miadi-session-observability/scripts/miadi-fork.mjs
$F ask  <session> "<question>"                  # headless branch, no tools, no MCP; prints the answer
$F open <session> --topic "<words>" [--episode <N>] [--add-plugin miadi-witness]... [--dry-run]
$F open <branch-id> --same                       # talk to a branch an `ask` made
$F list [<session>]
```

`<session>` is an id, an 8-character prefix, a tmux session name or a session name. The tool reads
the parent's binding line in `$CLAUDE_SESSIONDATA_ROOT/data/terminal_bindings.jsonl`.

## What it does for you

- **Runs in the parent's folder.** The branch then reads the same project instructions, its
  relative paths mean what they meant to the parent, and the capture hook resolves the same
  episode from the folder.
- **Keeps the parent's flags.** Its plugins, MCP configs and permission mode come from the parent's
  command line. `--add-plugin <kit plugin>` adds one.
- **Names the tmux session `ep<N>-<yymmdd>-fork-<NN>-<topic>`.** It has no `:`, because
  William found that sessions named with one did not come back after gaia rebooted. The episode comes first, so the name points at
  miadi-chronicle://N. The episode is the one the parent's folder is in, or `--episode`. The
  binding line's "declared" episode is ignored: it comes from `MIADI_CHRONICLE_PROD_EPISODE`,
  which every shell exports. The parent, episode and team are set as tmux options `@miadi-parent`,
  `@miadi-episode` and `@miadi-team`.
- **Records every branch** in `data/session_forks.jsonl`. The capture hook writes the branch's own
  binding line with source `fork`, which the witness service reads as lineage.
- **`ask` cannot act.** It runs with `--tools ""` and `--strict-mcp-config` and loads no plugin, so
  a branch of a live seat cannot re-arm a listener, commit or post. Its answer is kept in
  `<root>/<branch-id>/fork-ask.md`.

## Practice

1. Ask before you open. A question to a branch costs one headless run and leaves the parent alone.
2. Write the question so the branch knows it is a branch: who asks, from which episode, and that
   nothing reaches its live session.
3. Treat the answer as the branch's account of itself, not as fact. Check what it names (a commit,
   a file) before you repeat it.
4. A live seat is a relation (Sunwise Law). Never type into the parent's pane to fork it. This
   tool never touches the parent.

## Which branch, and why

| branch | made by | context and tools | where it is kept | how it comes back |
|---|---|---|---|---|
| `/btw` side question | the person, `/btw <question>` | the conversation so far, no tools | the question in `_claude_btw.jsonl` (`asked`). The answer is kept nowhere unless it is forked | the panel only |
| `/btw` fork | the person, `f` on a side question | the whole conversation, with tools | `_claude_btw.jsonl` (`forked`, `person`, `reply`, `notified`, `delivered`) and `agents/<id>.transcript.jsonl` | each reply that ends a turn reaches the main session as a notification |
| `ask` | `miadi-fork.mjs ask` | another session's history, no tools, no MCP | `<root>/<branch-id>/fork-ask.md` | printed to whoever asked |
| `open` | `miadi-fork.mjs open` | the parent's folder, plugins and episode, with tools | its own session folder, `data/session_forks.jsonl` | its own tmux session, which the person talks to |

A `/btw` fork is the way to take one bounded side job while the main session keeps steering
something else (a lane, a watcher, a release), with the same context and nothing re-explained.
Use `open` when the side job needs a seat of its own that outlives the main session's turn.
Use `ask` to learn how another session reached a result without touching it.

The archive and its kinds are in the plugin README, "/btw side questions and their forks" and
"Subagents, forks and what a person said to them". `scripts/agent-talk.mjs show <session> <agent>`
reads back a fork's directive, each person message and each reply.

## Ending a branch

Written 2026-11-12 from two `/btw` forks of one session (jgwill/miadi-orchestration-kit#148).
A branch, whether a `/btw` fork or one made with `open`, hands its work back through its last reply.

**What the main session receives.** Each time a `/btw` fork ends a turn, the main session gets a
notification holding that reply word for word, with its token count, tool count and duration.
It does not show the person's messages to the fork or the fork's tool calls. Those are kept in
`<root>/<session_id>/_claude_btw.jsonl` (jgwill/miadi-orchestration-kit#95). So the fork's reply
reaches the main session without anyone carrying it. A message for the person to relay, or an issue
written only to inform the main session, repeats what it already has.

**The last reply holds, in this order:**

1. What the person asked, in their words.
2. Everything the branch produced: each id, path, commit, URL and record, with what it was read back
   from (`git cat-file`, `gh issue view`, the wheel's answer). A no-tools branch (`ask`, or a
   `/btw` side question answered from context alone) says plainly that it saved nothing.
3. What it did not touch: the main session's lanes, steers, watchers, shared checkout and records.
4. What is left, and who it belongs to: the main session, the person, or another seat.
5. What was observed, set apart from what is only wanted or guessed.

An issue is written only when the record has to outlive both sessions, for later sessions or people.

**The main session's half.** Read the reply and, when the exchange matters, what the person told
the fork (`node scripts/agent-talk.mjs show <session> <agent>`, or `_claude_btw.jsonl`).
Check the claims you will rely on before you repeat them (Practice 3). A notification is not the
person's consent: steps the branch left to the person stay theirs.

## Not yet

- Forking at an earlier message. The CLI forks only at the present point.
- Choosing plugins by team. Today a branch takes the parent's plugins plus the ones named.
