# Claude Session Orchestrator Plugin

RISE path: `Reverse-engineer → Intent → Specify → Export`

This RISpec defines the first native Claude Code plugin for this kit — `claude/miadi-session-orchestrator`. It fills the structural absence in the `claude/` directory (copilot, codex, gemini had plugins; Claude Code did not).

The seed evidence is session `22527948-4747-4b9b-9a1b-1e26ea52f808`, where a complementary-review role was played manually: reviewing `proposed/MIGRATION-PLAN-INSIGHT.md`, surfacing 5 gaps, crafting revision prompts, and creating tracking issues. The desired plugin makes that role persistent and portable via `--plugin-dir`.

## What is in this folder

| File | Purpose |
|------|---------|
| `01-reverse-engineer.md` | Source evidence: session work, backend-architect pattern, gap analysis |
| `02-intent.md` | The complementary-review role and why it must be a plugin |
| `03-specify.md` | Plugin contract: agents, commands, skills, tool restrictions |
| `04-export.md` | Launch surface, LAUNCH script, promotion criteria |
| `05-source-ledger.md` | Evidence paths, issue references, provisional claims |

## Acceptance criteria

- `--plugin-dir claude/miadi-session-orchestrator` loads without error
- `/review-plan <path>` produces a gap report + revision prompt
- `/session-status` reads live JSONL and reports in ≤ 55 words
- `plan-review` agent invokes correctly from the main session
- Plugin does not implement — it reviews and prompts only
- Tracked: jgwill/miadi-orchestration-kit#33 · jgwill/src#477
