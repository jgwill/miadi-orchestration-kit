---
name: session-fork
description: Resume or branch a captured Codex session from its session id and terminal binding, preserving the parent session's history.
---

Find the requested session in `<capture-root>/data/terminal_bindings.jsonl`,
filtering `agent == "codex"`. Read its latest binding, user prompts and final
assistant response to confirm identity and cwd. Check that the source rollout
still exists under `CODEX_HOME` (default `~/.codex`). A sanitized capture is an
archive; it is not a substitute for Codex's native resume state.

For a requested branch, use `codex fork SESSION_ID` in the recorded cwd. For
continuation, use `codex resume SESSION_ID`. Pass an optional prompt as one shell
argument, with proper quoting. Use Codex's native fork instead of modifying its
rollout or database. When launching from an active terminal, create a separate
terminal using the host's supported terminal workflow; do not take over the
operator's current foreground session.

If the native state is missing, explain that limit and prepare a handoff from
the archive for a fresh session. Do not claim a native fork happened. A fork's
SessionStart is captured with `source: "fork"` when Codex emits it.
