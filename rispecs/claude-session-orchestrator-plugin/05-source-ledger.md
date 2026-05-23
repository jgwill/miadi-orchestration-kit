# 05 — Source Ledger

## Evidence Paths

| Path | Role |
|------|------|
| `/a/src/_sessiondata/22527948-4747-4b9b-9a1b-1e26ea52f808/proposed/MIGRATION-PLAN-INSIGHT.md` | Seed artifact — first plan reviewed |
| `/workspace/repos/miadisabelle/mia-awesome-claude-plugins-ComposioHQ/backend-architect/` | Plugin shape source — pattern extracted |
| `/workspace/repos/miadisabelle/mia-awesome-claude-plugins-ComposioHQ/code-review/` | Command shape source — `!` live context pattern |
| `/workspace/repos/jgwill/miadi-orchestration-kit/claude/miadi-session-orchestrator/` | Plugin scaffold created in this session |
| `/src/scripts/claude_hooks/pre_tool_use_hook.sh` | Hook being migrated to Miadi-18 |
| `/src/Miadi/app/api/session/` | Existing platform routes inspected |

## Issue References

| Issue | Scope |
|-------|-------|
| jgwill/src#477 | Plan-insight migration tracking (hooks → Miadi-18) |
| jgwill/miadi-orchestration-kit#33 | Plugin scaffold tracking |

## Provisional claims

- `--plugin-dir` with `agents/` loads sub-agents into the main session Agent tool — **not yet validated in this environment**
- `/review-plan` command `!` live context blocks work as expected — **not yet tested**
- The `backend-architect` plugin from ComposioHQ is loadable alongside our plugin — **assumed, not confirmed**

## Session provenance

- Session ID: `22527948-4747-4b9b-9a1b-1e26ea52f808`
- Role: complementary reviewer (not implementer)
- Date: 2026-05-23
- Operator: mia@jgwill.com
