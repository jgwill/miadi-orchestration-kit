# 02 — Intent

## The Complementary Review Role

In the Miadi plan-insight pipeline, there are two distinct roles:

| Role | Agent | Does |
|------|-------|------|
| **Implementer** | Main session in `/src/Miadi/` | Writes code, modifies proposed plans |
| **Reviewer** | Complementary session | Reviews proposals, surfaces gaps, crafts prompts |

The reviewer role was being played manually — it existed only in conversation context, lost on session end.

## Why a plugin

Without a plugin, every relaunch of the complementary session must re-derive:
- The 5-point gap checklist
- The output contract (gap report + revision prompt)
- Which files to read (proposed/, JSONL hooks, platform routes)
- The tracking issue format

A plugin encodes all of this once, loads it on every `--plugin-dir` invocation, and makes the role portable across machines and operators.

## Desired outcome

Any Claude Code session launched with:
```bash
--plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/claude/miadi-session-orchestrator
```
immediately knows its role, its checklist, its output format, and its boundaries (review only — never implement).
