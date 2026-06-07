# 04 — Export

## Launch Surface

```bash
claude \
  --add-dir /src/Miadi/ \
  --add-dir /src/scripts/ \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /a/src/_sessiondata/<session-id> \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/claude/miadi-session-orchestrator \
  --mcp-config /workspace/etc/mcp-config-qmd-remote-eury.json
```

## LAUNCH script location

`/a/src/_sessiondata/22527948-4747-4b9b-9a1b-1e26ea52f808/LAUNCH.complementary-role.sh`

## Promotion criteria

The plugin graduates from scaffold → validated when:
- [ ] `/review-plan` tested against a real updated `MIGRATION-PLAN-INSIGHT.md`
- [ ] `/session-status` tested against live JSONL files
- [ ] `plan-review` agent invoked by main session via `Agent` tool
- [ ] `AGENTS.md` added to `claude/` directory (mirror pattern from `codex/`, `gemini/`)
- [ ] At least one review cycle completed end-to-end (propose → review → revise → re-review)

## Future extension points

- `commands/track-issue.md` — create/update jgwill/src tracking issue from within the session
- `agents/session-monitor.md` — watch JSONL hook files and notify on ExitPlanMode events
- Integration with `rispecs/east-pde-session-orchestration/` for EAST-direction session initiation
