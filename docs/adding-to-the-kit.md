# Adding to the Kit

## Where it goes

| You are adding | Put it in |
| --- | --- |
| a Claude Code plugin | `claude/<name>/`, with `.claude-plugin/plugin.json` |
| a plugin for Codex, Copilot, Gemini CLI or Antigravity | that host's folder, whose `AGENTS.md` states the format |
| a skill any host can read | `skills/<name>/SKILL.md` |
| a team's practice | a skill in the team's plugin or in `skills/`, named in the team's section of `teams/README.md` |
| a package for a machine | `packages/miadi/deb/<package>/` |
| a specification | `rispecs/<subject>/` (RISE) |
| a research packet | `foundations/<topic>/` |

A plugin that works on episodes links the one copy of `skills/chronicle-episode` instead of copying it. `miadi-chronicle-episode-kit` does this with a symlink, so every host reads the same text.

## Rules for a Claude Code plugin

From [`claude/AGENTS.md`](../claude/AGENTS.md):

1. `${CLAUDE_PLUGIN_ROOT}` for every path a hook or a command uses.
2. Hooks load at session start and do not hot-swap. Say so in the plugin's README.
3. Declare the versions and services the plugin needs, and fail loudly without them.
4. A skill copied from elsewhere states which copy is canonical.
5. Never hardcode a wheel URL. Use `MIADI_CHRONICLE_MW_URL`.

A hook enforces what guidance could not: the `mkdir` refusal exists because manifest-less episodes kept growing while the rule was written down.

## Releasing a change

- Bump the version in the plugin's `plugin.json` and in its entry in `.claude-plugin/marketplace.json` together.
- A plugin with npm-pinned MCP servers in `.mcp.json` moves its pins with `scripts/kit-mcp-upgrade.sh --ref owner/repo#n`. It bumps the plugin, proves the servers connect, commits and pushes. The `miadi-factory-delivery` sweep in `jgwill/Miadi` runs it after a publish.
- Add the new plugin, skill or package to `README.md` and `llms.txt` in the same commit.
- Commit by path, never `git add .`, with an `owner/repo#n` reference in the message. An agent commits and pushes its own work ([`AGENTS.md`](../AGENTS.md)).
