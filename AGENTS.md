`copilot/AGENTS.md` is for copilot plugins

`claude/AGENTS.md` is for Claude Code plugins (one lane since 2026-09-05; `claude-code/` was folded into it on William's word)

`gemini/AGENTS.md` is for Gemini CLI extensions (Gemini calls them extensions, not plugins).

`antigravity/AGENTS.md` is for antigravity plugins

## The Factory's installed CLIs

A script, timer or skill calls the CLI the packaging installs, on the PATH a service gets: `/usr/bin/tide` runs tide from its own venv, `/usr/lib/miadi-tide/tide-runtime`, built by the `miadi-tide` package (`packages/miadi/deb/README.md`). A shell may find another copy first (on gaia, jgi's anaconda). Never point a script at it and never install a second copy. A new tide arrives through the package (Guillaume, 2026-11-04).

## Agent ownership of repo state

If an agent creates or changes files in this repository, it must inspect, validate, stage, and commit its scoped work unless the operator explicitly says not to. Do not leave humans with generic "repo is dirty" cleanup. Classify dirty files, preserve tracked STC/Coaia telemetry when safe, redact secrets if found, and commit coherent changes with a clear message.

Every meaningful repo change must be associated with a GitHub issue or PR. If no suitable issue exists, create one first or immediately after discovery, then reference it in commits/comments. Current hygiene anchor: https://github.com/jgwill/miadi-orchestration-kit/issues/31

Reports to the operator should stay compact: 55 words or less per aspect, surfacing only attention-needed items.
