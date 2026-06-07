`copilot/AGENTS.md` is for copilot plugins

`claude-code/AGENTS.md` is for claude-code plugins

`gemini/AGENTS.md` is for Gemini CLI extensions (Gemini calls them extensions, not plugins).

`antigravity/AGENTS.md` is for antigravity plugins

## Agent ownership of repo state

If an agent creates or changes files in this repository, it must inspect, validate, stage, and commit its scoped work unless the operator explicitly says not to. Do not leave humans with generic "repo is dirty" cleanup. Classify dirty files, preserve tracked STC/Coaia telemetry when safe, redact secrets if found, and commit coherent changes with a clear message.

Every meaningful repo change must be associated with a GitHub issue or PR. If no suitable issue exists, create one first or immediately after discovery, then reference it in commits/comments. Current hygiene anchor: https://github.com/jgwill/miadi-orchestration-kit/issues/31

Reports to the operator should stay compact: 55 words or less per aspect, surfacing only attention-needed items.
