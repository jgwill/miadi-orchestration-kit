---
name: session-continuity
description: Inspect a captured Codex session, trace prompts to files and publications, or prepare a continuation handoff from its durable archive.
---

Resolve the capture root from `CODEX_SESSIONDATA_ROOT`, `MIADI_SESSION_DIR`,
`MIADI_SESSIONDATA_ROOT`, `SESSION_DATA_ROOT`, then `/src/_sessiondata` if present,
otherwise the plugin's writable data directory plus `/_sessiondata`.

Read the session's `_terminal_binding.jsonl` for cwd, agent, terminal, team,
episode and mission. Inspect `_codex_user_inputs.jsonl` and the latest
`_codex_AssistantResponse.jsonl` before the complete transcript. Use
`_codex_files_written.jsonl` and `_codex_publications.jsonl` to connect each
`prompt_id` (Codex `turn_id`) and `tool_use_id` to its result.

Codex 0.164's managed app-server is shared: its PID is not a terminal identity.
Include the native `thread-id` item through `/title` (or the package's
`scripts/configure-terminal.py`). Capture joins that title's unique native ID
to the TUI and tmux pane. An unbound terminal stays unknown; do not infer it
from the daemon's ancestry or select the newest thread in a shared cwd.

`written/` holds sanitized text copies, with `.~N~` previous versions.
Credential files are listed without a copy or hash. A scan records files changed
during a call; shared workspaces can have other writers. Binary, oversized and
over-limit files are listed with a reason. Follow the index rather than assuming
every changed file has a copy.

`_transcript_final.jsonl` retains the full Codex rollout, including token usage;
`_responses_progressive.jsonl` retains assistant messages. Child transcripts live
in `agents/<id>.transcript.jsonl`. The Codex rollout format is not a stable API.
Distinguish observed evidence from an inference. No Notification or `/btw` hook
exists in this Codex version; do not promise their capture.

Write a compact handoff naming desired state, current evidence, relevant paths,
pending decisions and the next action. This plugin records locally. Publishing
an issue or sending a message requires the operator's instruction.
