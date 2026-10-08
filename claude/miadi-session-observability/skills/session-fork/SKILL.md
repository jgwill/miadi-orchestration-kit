---
name: session-fork
description: Branch a Claude Code session without touching it. Ask a branch of another session a question with every tool disabled, or open a branch you can talk to in its own tmux session, with the parent's folder, plugins and episode, under a name tmux-resurrect keeps. Use when William says "fork", "fork that session", "ask that session", "query Mia's session", "open a branch of", "continue it in another tmux", or when a session must learn how another session reached a result, or when work should split from a session at its present point.
---

# Session fork

Built 2026-10-08 in Episode 551, from William's word: forking an agent by hand meant a launch
script, a remembered alias, a remembered folder and a hand-made tmux name. jgwill/miadi-orchestration-kit#61.

## The tool

```bash
F="node ${CLAUDE_PLUGIN_ROOT}/scripts/miadi-fork.mjs"   # or $MIADI_ORCHESTRATION_KIT_ROOT/claude/miadi-session-observability/scripts/miadi-fork.mjs
$F ask  <session> "<question>"                  # headless branch, no tools, no MCP; prints the answer
$F open <session> --topic "<words>" [--add-plugin miadi-witness]... [--dry-run]
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
  miadi-chronicle://N. The parent, episode and team are set as tmux options `@miadi-parent`,
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

## Not yet

- Forking at an earlier message. The CLI forks only at the present point.
- Choosing plugins by team. Today a branch takes the parent's plugins plus the ones named.
