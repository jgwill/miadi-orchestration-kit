# Gemini Extension Instructions

This folder is for Gemini CLI extensions, not Copilot/Codex plugins.

Use `rispecs/gemini/AGENTS.md` before creating or modifying anything here. That file records the local Gemini CLI extension template set, promotion discipline, validation commands, and Miadi recommender expectations.

## Agent ownership

When you create or modify an extension here, validate it and commit the scoped repo work unless the operator explicitly says not to. Do not report a dirty repo as if cleanup belongs to the human. Own the final Git hygiene: inspect, secret-scan, stage exact files, verify staged names, commit, and report only attention-needed leftovers.

## Required Native Shape

Each extension should live in its own directory:

```text
gemini/<extension-name>/
  gemini-extension.json
  README.md
  GEMINI.md                      # optional always-loaded context
  skills/<skill-name>/SKILL.md   # preferred for Miadi workflows
  commands/<group>/<name>.toml   # optional operator shortcuts
  hooks/hooks.json               # only when lifecycle behavior is needed
  policies/*.toml                # only for restrictions/safety checkers
```

Prefer skills + README + optional commands first. Add MCP servers only when Gemini needs new executable tools or data sources. Add hooks/policies only when the RIspec explicitly justifies lifecycle behavior or guardrails.

## Validate Before Claiming Done

```bash
gemini extensions validate gemini/<extension-name>
gemini extensions link gemini/<extension-name>
gemini extensions list
```

Restart Gemini CLI after link/install/update/enable/disable.
