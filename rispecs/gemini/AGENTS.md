# Gemini Extension RIspec Guidance

This folder is for RIspecs that may become Gemini CLI extensions for the Miadi orchestration kit.

## Vocabulary

Use "Gemini extension", not "Gemini plugin", when targeting Gemini CLI.

Gemini extensions are managed from the shell with:

```bash
gemini extensions --help
gemini extensions new <path> [template]
gemini extensions validate <path>
gemini extensions link <path>
gemini extensions install <source> --consent
```

Do not run extension-management commands inside the interactive Gemini TUI. Use `/extensions list` inside the TUI only to inspect installed extensions. Restart Gemini CLI after linking, installing, enabling, disabling, or updating extensions.

## Current Template Set

The local Gemini CLI reports these extension templates:

- `skills` — bundles on-demand `skills/<name>/SKILL.md` workflows.
- `custom-commands` — adds slash commands under `commands/**/*.toml`.
- `mcp-server` — exposes new model tools through `mcpServers` in `gemini-extension.json`.
- `hooks` — lifecycle hooks such as `SessionStart` through `hooks/hooks.json`.
- `policies` — policy-engine restrictions and safety checkers in `policies/*.toml`.
- `exclude-tools` — removes or narrows tools exposed to the model.
- `themes-example` — UI theme contribution; usually irrelevant to Miadi orchestration.

## Extension Shape

A Gemini extension root must contain:

```text
<extension-name>/
  gemini-extension.json
  README.md                      # strongly recommended
  GEMINI.md                      # optional always-loaded extension context
  skills/<skill-name>/SKILL.md   # for on-demand workflows
  commands/<group>/<name>.toml   # for user-invoked slash commands
  hooks/hooks.json               # only when lifecycle behavior is needed
  policies/*.toml                # only to restrict/guard behavior
  package.json + server files    # only for MCP tools
```

Minimal manifest:

```json
{
  "name": "miadi-extension-name",
  "version": "1.0.0",
  "description": "Miadi-native Gemini CLI extension for ..."
}
```

Manifest rules:

- `name` is the CLI identifier; use lowercase letters, numbers, and dashes.
- Keep the directory name and manifest name aligned.
- Use `${extensionPath}` and `${/}` for files inside the extension.
- Prefer extension skills and commands before MCP servers.
- Add MCP only when Gemini must call new executable tools or data sources.
- Add hooks only for lifecycle logging/validation, not for ordinary instructions.
- Add policies/exclude-tools when the extension must reduce risk.

## Promotion Discipline

Do not turn a RIspec into a Gemini extension just because the RIspec exists.

A RIspec is not ready for Gemini extension promotion when it still has:

- no desired outcome / current reality / structural tension,
- missing source ledger evidence,
- unspecified write scope,
- unverified extension shape,
- no operator-facing install/link/validate recipe,
- unclear distinction between context, skill, command, hook, policy, and MCP,
- a copied Copilot/Codex plugin layout with no Gemini-native adaptation.

Before promotion, answer:

1. Is the behavior always-on context? Use `GEMINI.md`.
2. Is it complex but occasional expertise? Use `skills/<name>/SKILL.md`.
3. Is it an operator shortcut? Use `commands/**/*.toml`.
4. Does the model need new executable tools/data? Use `mcpServers`.
5. Does Gemini lifecycle need logging/guardrails? Use hooks/policies.

## Recommender Extension Goal

The Miadi Gemini extension family should support the same class of work implied by `/a/src/scripts/fn_llm.sh`:

- `pto_orchestration_plugins_recommender()` asks Gemini to inspect Miadi/Copilot kit roots and recommend exact `copilot --plugin-dir <path>` arguments for a work context.
- `pto_orchestration_plugins_recommender_codex()` does the same for Codex kit roots and exact `codex --plugin-dir <path>` arguments.

For Gemini, the target is not `--plugin-dir`. The recommender should recommend exact Gemini extension paths and a launch recipe such as:

```bash
gemini extensions link /workspace/repos/jgwill/miadi-orchestration-kit/gemini/<extension-dir>
gemini extensions validate /workspace/repos/jgwill/miadi-orchestration-kit/gemini/<extension-dir>
# restart Gemini CLI, then use the extension's skills/commands
```

A future Miadi Gemini recommender extension should be capable of:

- reading a work context,
- inspecting local extension candidates under `gemini/*`,
- optionally comparing Copilot/Codex kit intent for parity,
- recommending exact extension paths with 55 words or less per rationale,
- writing a replayable launch script under `./.pde/<tlid>--<uuid>/LAUNCH.gemini-orchestration.sh`,
- refusing to recommend extensions that fail validation or lack source-ledger/readiness evidence.

## Creation Recipe

Use this sequence for a new Gemini extension candidate:

```bash
cd /workspace/repos/jgwill/miadi-orchestration-kit
mkdir -p gemini

gemini extensions new gemini/<extension-name> skills
# or: custom-commands / mcp-server / hooks / policies as justified by the RIspec

# Edit manifest, README, GEMINI.md, skills, commands, etc.
gemini extensions validate gemini/<extension-name>
gemini extensions link gemini/<extension-name>
gemini extensions list
```

If linked during development, edits in the local path are reflected by future Gemini sessions; restart the session to reload extension metadata/context.

## Acceptance Checklist

- [ ] Uses Gemini extension vocabulary and native structure.
- [ ] Contains `gemini-extension.json` with aligned lowercase-dash name.
- [ ] Has README with purpose, install/link, validate, and usage.
- [ ] Uses skills/commands/context/MCP/hooks/policies only where each is justified.
- [ ] Validates with `gemini extensions validate <path>`.
- [ ] Has a launch recipe for local development.
- [ ] Source ledger states what came from Gemini CLI docs/templates, Miadi scripts, and local repo examples.
- [ ] Does not depend on the failed storytelling kit path as authoritative implementation evidence.
- [ ] Agent inspected dirty repo state, staged exact intended files, and committed scoped work unless explicitly told not to.
- [ ] Meaningful repo changes reference a GitHub issue or PR; hygiene/process work uses issue #31 or a more specific successor.
- [ ] Operator report is 55 words or less per aspect and only lists attention-needed items.
