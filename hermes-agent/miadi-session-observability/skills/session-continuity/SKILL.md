---
name: session-continuity
description: Find which Hermes session a terminal held, verify Miadi capture, and resume after a crash or reboot. Use for terminal bindings, tide agents, session continuity, or migrating legacy Hermes capture hooks.
metadata:
  version: 0.1.0
  team: T1 session continuity
---

# Hermes session continuity

This plugin is the canonical Hermes capture implementation in miadi-orchestration-kit.
It records locally; it never publishes a session, starts a review agent, or restores panes itself.
The related Claude practice is claude/miadi-session-observability/skills/session-continuity/.

## Find a session without opening raw conversation captures

1. Run `/usr/bin/tide agents list` on a packaged Miadi host. Use the installed CLI,
   not a shell's alternative Python environment. Do not install a second tide.
2. Join the pane to `<root>/data/terminal_bindings.jsonl`, filtering by agent `hermes`,
   session id, or tmux session. The per-session copy is `_terminal_binding.jsonl`.
3. A binding names the agent process, argv, launch alias, tmux pane and socket, team,
   episode, and account person when declared. A null tmux means no verified pane,
   not permission to guess which terminal it used.
4. Resume with `hermes --resume <exact-session-id>`, or the recorded launch alias.
   Do not manufacture a new id from a display name.

`<root>` is the first nonempty HERMES_SESSIONDATA_ROOT, MIADI_SESSION_DIR,
MIADI_SESSIONDATA_ROOT, SESSION_DATA_ROOT, otherwise /src/_sessiondata if /src exists,
otherwise ~/_sessiondata. HERMES_HOME selects the profile; do not change other profiles.

## Lifecycle matters

Hermes `on_session_end` ends a run/turn, not the lifetime of the conversation.
A turn-end capture must not mark a terminal's agent as exited. The plugin binds a new
session at start, observes resumed sessions on their first prompt in a process, and
writes `session.end` only at finalize or reset (for reset, the old session id).
A killed process cannot emit finalize; tide's process inventory must determine liveness.

## Verify capture or migrate a host

- Read the plugin README before cutover. The installer defaults to a dry run.
- Remove only the old Hermes capture commands, not unrelated hooks or Herdr/Miadi plugins.
- Keep the mode-0600 config backup private: it can contain credentials. Never print it.
- Start a new Hermes process immediately after applying cutover. An already running
  CLI can retain old hooks, and gateway hook resync can remove them before it loads
  the plugin. Do not claim this running session has hot-swapped.
- Check the new session's `_hermes_session_start.jsonl`, `_hermes_post_tool_use.jsonl`,
  `_hermes_post_llm_call.jsonl`, and `_terminal_binding.jsonl` for one event per firing.
- `_hermes_history_latest.jsonl` is a sanitized snapshot of the last history supplied
  to post_llm_call, not Hermes's authoritative SQLite store or a lossless lifetime archive.
- Capture is redacted before persistence. It does not prevent a credential from being
  printed to the model. Never open .env, credential files, or raw captures to find a session.

## Recovery is a separate action

First inspect `/usr/bin/tide agents restore --dry-run --force`. Actual restoration,
starting missing sessions, and changing team assignments require the person's scope.
Never test by ending the shared tmux server. Use a private server with an explicit
socket and an isolated save folder. Consult the Claude continuity practice for the
host's tmux-save, tmux-server-watch and tide recovery procedures.
