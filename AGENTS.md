`copilot/AGENTS.md` is for copilot plugins

`claude/AGENTS.md` is for Claude Code plugins (one lane since 2026-09-05; `claude-code/` was folded into it on William's word)

`gemini/AGENTS.md` is for Gemini CLI extensions (Gemini calls them extensions, not plugins).

`antigravity/AGENTS.md` is for antigravity plugins

## Deprecated: `/opt/binscripts/hooks/claude_hooks/`

The hand-wired Claude Code hooks in `/opt/binscripts/hooks/claude_hooks/` are deprecated and
used by nothing (Guillaume, 2026-11-19). This holds for every agent, Claude Code, Codex,
Gemini, Copilot, pi or any other: never read that folder, compare against it, carry a change to
it or report on its state. Claude Code capture is `claude/miadi-session-observability` only.

## The Factory's installed CLIs

A script, timer or skill calls the CLI the packaging installs, on the PATH a service gets: `/usr/bin/tide` runs tide from its own venv, `/usr/lib/miadi-tide/tide-runtime`, built by the `miadi-tide` package (`packages/miadi/deb/README.md`). A shell may find another copy first (on gaia, jgi's anaconda). Never point a script at it and never install a second copy. A new tide arrives through the package (Guillaume, 2026-11-04).

## Agent ownership of repo state

If an agent creates or changes files in this repository, it must inspect, validate, stage, and commit its scoped work unless the operator explicitly says not to. Do not leave humans with generic "repo is dirty" cleanup. Classify dirty files, preserve tracked STC/Coaia telemetry when safe, redact secrets if found, and commit coherent changes with a clear message.

Every meaningful repo change must be associated with a GitHub issue or PR. If no suitable issue exists, create one first or immediately after discovery, then reference it in commits/comments. Current hygiene anchor: https://github.com/jgwill/miadi-orchestration-kit/issues/31

Reports to the operator should stay compact: 55 words or less per aspect, surfacing only attention-needed items.

## Issues: the agent decides, and opens the issue

This holds for every agent, Claude Code, Codex, Gemini, Copilot, pi or any other (Guillaume, 2026-11-25, jgwill/etc-claude-code#27). When work may need a GitHub issue, or a commit needs an issue reference the agent does not have, the agent runs the issue-decision model and acts on its answer: `open_new`, `update_existing` (it names the issue) or `none`. It never drafts an issue and hands it back to a person, and never writes that an issue waits on someone's "word".

The rule, its skill and its decision model are host law, in jgwill/etc-claude-code: `/etc/claude-code/skills/structural-issue-authoring/` (`SKILL.md`, `decision-model/issue-decision.mjs`). Claude Code loads the skill from there. Codex, Gemini and the generic agent layer read it through `~/.agents/skills/structural-issue-authoring`, a link to that folder:

```sh
ln -s /etc/claude-code/skills/structural-issue-authoring ~/.agents/skills/structural-issue-authoring
node /etc/claude-code/skills/structural-issue-authoring/decision-model/issue-decision.mjs --work "<what was asked or found>" --repository <owner/repo> [--asked-by "<person>"] [--commit-needs-reference]
```
