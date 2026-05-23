# 01 — Reverse Engineer

## Source Session

Session `22527948-4747-4b9b-9a1b-1e26ea52f808` was launched as a **complementary role** instance — not the implementer, but the reviewer. It was given:
- A proposed migration plan: `proposed/MIGRATION-PLAN-INSIGHT.md`
- Access to the Miadi platform (`/src/Miadi/`) and orchestration kit
- The `backend-architect` plugin from `mia-awesome-claude-plugins-ComposioHQ`

## What the session did manually (without a plugin)

1. Read `MIGRATION-PLAN-INSIGHT.md` and surfaced 5 structural gaps
2. Created jgwill/src#477 as a tracking issue
3. Crafted a revision prompt for the implementing agent
4. Updated the LAUNCH script with proper `--add-dir` and `--plugin-dir` flags
5. Scaffolded `claude/miadi-session-orchestrator/` by learning the plugin shape from `backend-architect`

## Pattern extracted from `backend-architect`

```
<plugin>/
  .claude-plugin/plugin.json   # name + description with <example> blocks
  agents/<name>.md             # frontmatter: name, description, color, tools
                               # body: role instructions
```

Extended with patterns from `code-review` and `agent-sdk-dev`:
```
  commands/<name>.md           # frontmatter: allowed-tools, description
                               # body: !`live context` + task
  skills/<name>/SKILL.md       # step-by-step workflow with output contract
```

## Structural absence confirmed

`claude/` directory existed but was empty. `AGENTS.md` at kit root referenced `claude-code/AGENTS.md` — that file did not exist. This rispec closes that absence.
