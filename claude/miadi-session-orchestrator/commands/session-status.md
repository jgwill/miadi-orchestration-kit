---
allowed-tools: Bash(ls:*), Bash(cat:*), Bash(tail:*)
description: Read live session hook JSONL files and report what's happening in under 55 words
---

## Context

- Active sessions: !`ls /a/src/_sessiondata/ | grep -E '^[0-9a-f-]{36}$'`
- Latest user inputs: !`tail -3 /a/src/_sessiondata/*/last_claude_user_inputs.jsonl 2>/dev/null | head -20`
- Latest tool use: !`tail -1 /a/src/_sessiondata/*/last_claude_PostToolUse.json 2>/dev/null | head -10`

## Your task

Report what each active session is currently working on — what's being *created*, not the data structure.

**Limit: 55 words total.** Focus on the work, not the mechanism.
