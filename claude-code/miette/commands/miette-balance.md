---
description: Measure the Two-Eyed balance of the last response without blocking it, and optionally rewrite it.
argument-hint: "[--rewrite]"
allowed-tools: Bash, Read, Task
---

Run the Two-Eyed balance measurement over the most recent assistant message in this
session, report it, and — if `$ARGUMENTS` contains `--rewrite` — rewrite the response.

## Measure

The hook script reads the transcript itself. Feed it the current session's transcript
path and read what it says, without letting it block:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/hooks/balance-check.py" <<< "{\"session_id\":\"probe\",\"transcript_path\":\"$(ls -t ~/.claude/projects/*/*.jsonl | head -1)\",\"stop_hook_active\":false}"
```

Empty output means the response held both eyes. Otherwise the JSON carries `reason` (a
would-be block) or `systemMessage` (an advisory).

## Report

State the four measures plainly — presence, share against its floor, weave position,
restatement — and name **which one failed and what that means for the reader**, not
just the numbers. If nothing failed, say so in one line and stop.

## Rewrite

Only with `--rewrite`: dispatch the `two-eyed-translator` agent with the full text of
the offending response. Return its rewrite as the answer. Do not append your own
commentary about the balance — the rewrite is the deliverable.

## Note

This command is diagnostic and never blocks. The enforcing surface is the `Stop` hook in
`hooks/hooks.json`; if it is not firing, the plugin was enabled after the session
started — hooks load at session start and do not hot-swap.
