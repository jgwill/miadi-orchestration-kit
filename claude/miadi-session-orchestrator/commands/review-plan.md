---
allowed-tools: Read, Bash(cat:*), Bash(ls:*), Bash(gh issue:*)
description: Review a proposed Miadi plan file and output a gap report + revision prompt
---

## Context

- Session folder: !`ls /a/src/_sessiondata/ | tail -5`
- Proposed files: !`find /a/src/_sessiondata -path "*/proposed/*.md" 2>/dev/null`
- Current plan content: !`cat "$ARGUMENTS" 2>/dev/null || echo "Pass a path: /review-plan <path-to-plan.md>"`

## Your task

Review the plan file at the path provided (or the most recent proposed/ file if no argument given).

Apply the 5-point checklist:
1. `plan_content` inline in POST payload — not filesystem re-read
2. Idempotency key — `session_id + plan_filename` dedup at API layer
3. Failure path Langfuse trace — not just success path
4. Write-back pattern resolved — no ambiguity on how `miette_perspective.md` is written back
5. Naming consistency — `plan_file` vs `plan_filename` unified in schema + tables

Output:
- **Gap Report**: numbered, severity-tagged (🔴 blocker / 🟡 important / 🟢 minor)
- **Revision Prompt**: paste-ready instructions for the implementing agent, under 250 words
