# Codex session observability cutover — 2026-10-22

Tracking: [jgwill/miadi-orchestration-kit#98](https://github.com/jgwill/miadi-orchestration-kit/issues/98).
Source: `codex/miadi-session-observability`, version **0.1.2**, ported from Claude
0.1.18 at `aa033fa`. Host: gaia, user: mia. Runtime: `codex-cli 0.163.0`.

The installed package matches source byte for byte, excluding generated Python
cache files. Codex reports all 12 observability hooks enabled and trusted, with
no discovery errors or warnings. The existing Miette hook remains trusted and
enabled. No marketplace source was changed.

`/home/mia/.codex/hooks.json` now contains `{"hooks": {}}`. Eight legacy
capture registrations were removed. There were no inline TOML hook events,
project hook file, or user `hooks/` directory. Legacy trust metadata and the
shared scripts remain available for rollback and other users.

The cutover backup is `/home/mia/.codex/backups/session-observability-20261022T211102.424220Z`. All **18 files** passed the SHA-256
manifest check after cutover. It contains the original hook wiring, config,
referenced scripts and sanitizer/validator dependencies. An earlier backup,
`/home/mia/.codex/backups/session-observability-20261022T205341.683996Z`, predates
plugin installation. Neither backup is committed to this public repository.

## Verification

- `tests/run.sh`: **208 checks passed** (198 inherited assertions, nine native
  integration tests, one sanitizer self-test).
- `tests/runtime-smoke.py`: real Codex with an installed package and a local
  deterministic Responses fixture; start, prompt, pre-tool, post-tool, stop and
  end each captured once. The written file, assistant responses, transcript and
  start/end binding with the agent pid were verified.
- Final live installation check used the normal Codex home, the installed
  **0.1.2** package and persisted trust, **without a hook-trust bypass**. Only the
  model provider and unrelated plugins/MCP servers were overridden for that
  invocation; their persisted settings were preserved. The fixture made two
  local HTTP requests and no external model request.
- Live session: `01a16579-caf4-74f1-baa1-49c24c2c4915`. Evidence remains in
  `/src/_sessiondata/01a16579-caf4-74f1-baa1-49c24c2c4915`. Each of the six events above appears **once**. The
  durable rollout has **93,059 bytes**; progressive responses and
  the fixture's file copy are nonempty. Start/end bindings retain agent pid
  `1614659`.
- All package Bash/Python/JSON syntax checks and the scoped Git whitespace
  check pass. Both packaged skills were discovered by Codex.

The earlier app-server check created an empty thread,
`01a16574-a543-74c2-a66d-e0ec97d7b786`, and archived it. Codex emits SessionStart
on the first turn, so that empty thread is evidence of end-hook execution only;
the full live session above proves the complete lifecycle.

## Boundaries and repository ownership

Codex 0.163.0 has no Notification or PostToolUseFailure event and no verified
Claude `/btw` source. Failure capture is derived from PostToolUse status. These
limits, capture roots, file-copy bounds and rollout assumptions are documented
in the plugin README. New sessions use the plugin; an already running session
can retain the hook definitions it loaded earlier.

The scoped commit contains the Codex package, its marketplace entry and this
record. Pre-existing STC, Coaia and PDE edits, resume files, and concurrent Pi
work were preserved. Existing structured Coaia/PDE data was parsed successfully;
unrelated repository whitespace was left with its owning work.
