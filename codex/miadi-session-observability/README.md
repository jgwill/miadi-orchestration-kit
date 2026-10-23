# Miadi Session Observability for Codex

Capture a Codex session and the work it produces in the same
`<root>/<session_id>/` tree used by the Claude plugin and the session observers.
This plugin writes local capture data. It does not open session issues or publish
anything itself. Tracking: [#98](https://github.com/jgwill/miadi-orchestration-kit/issues/98).

## Install

Requires Codex with plugin hooks (verified with CLI 0.163.0), Bash, Python 3,
`jq`, Perl, and GNU file utilities. `flock`, `setsid` and `timeout` provide the
same locking, detachment and scan bounds as the Claude implementation.

From the kit checkout, register its marketplace if it is not already registered:

```sh
codex plugin marketplace add /path/to/miadi-orchestration-kit
codex plugin add miadi-session-observability@miadi-orchestration-kit
```

For an existing Git marketplace, commit/publish the kit changes and update that
marketplace before installing, or point its local configuration at this checkout
during development. Installing from a one-off source override does not change
the marketplace source used by subsequent Codex processes.

Review the plugin's hooks through `/hooks`, then start a fresh session. Installing
alone does not trust hooks. Confirm that each enabled hook has source `plugin`,
this plugin's id and trust status `trusted`. Leave unrelated hooks enabled.

For tmux annotation with Codex's shared app-server (0.164+), expose the native
thread ID in its terminal title:

```sh
python3 codex/miadi-session-observability/scripts/configure-terminal.py
```

This preserves other title items and backs up `config.toml`. New TUI sessions
load it automatically. In an already-running TUI, use `/title`, select
`thread-id`, and save. The native title changes with the selected thread.
Codex 0.164 abbreviates this UUID; capture expands it only when its native
read-only state database identifies one full thread ID uniquely. Then
capture binds it to that TUI's PID and pane. The shared daemon is never recorded
as the terminal owner. Missing or ambiguous titles remain unbound until an
exact identity appears; a later prompt or Stop records it. Tide's packaged
review loop uses that exact native thread ID, and Pi's capture binding, instead
of choosing the newest session in their shared working directory.

The package uses `.codex-plugin/plugin.json` and default `hooks/hooks.json`
discovery, matching the kit's Miette plugin. Codex 0.163.0 read the skills but
returned zero hooks with the newer portable manifest's OpenAI hook extension;
the compatibility layout exposes all 12. Do not replace this layout without a
runtime discovery check.

## Capture contract and parity

The root resolves in this order: `CODEX_SESSIONDATA_ROOT`, `MIADI_SESSION_DIR`,
`MIADI_SESSIONDATA_ROOT`, `SESSION_DATA_ROOT`, `/src/_sessiondata` when present,
then `${PLUGIN_DATA}/_sessiondata`. Direct script runs without `PLUGIN_DATA`
fall back to `${CODEX_HOME:-$HOME/.codex}/miadi-session-observability/_sessiondata`.

| Claude capability | Codex implementation |
| --- | --- |
| SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PreCompact, SubagentStart, SubagentStop, Stop, SessionEnd | Native Codex hooks, one dispatcher per event |
| PostToolUseFailure | Derived from PostToolUse's exit code or MCP `isError`; Codex has no separate failure event |
| Notification | Unavailable in Codex 0.163.0; no fictitious hook registered |
| Additional lifecycle visibility | Native PostCompact and Interrupt |
| Prompt and response ledgers | Legacy `_codex_*` event, last-event, user-input, assistant-response and all-event streams retained |
| Corrective feedback and accepted redirection | Explicitly labelled best-effort prompt classification; never an approval decision |
| Full and progressive transcripts | Incrementally sanitized rollout to `_transcript_final.jsonl`; legacy `_codex_transcript_latest.jsonl`, `_codex_responses_progressive.jsonl` and `_responses_progressive.jsonl` retained |
| Child transcripts and crash recovery | SubagentStop copies `agent_transcript_path`; SessionStart sweeps active/archived Codex rollouts for sessions already captured, including child metadata links |
| Terminal, team, episode and mission | Shared `_terminal_binding.jsonl` and `data/terminal_bindings.jsonl`; nearest Codex ancestor, optional read-only thread name lookup, same team/episode/mission precedence |
| Files written | Bash/MCP scan between tool marks; direct Write/Edit files; explicit apply_patch add/update/move targets, including outside cwd; versions in `written/` |
| Proposals and plans | Sanitized per-call patches in `proposed/`; Write's basename copy retained; `update_plan`/ExitPlanMode inputs in `plans/` |
| Publications | Inherited shell GitHub/npm/commit/push parser plus returned URLs from explicit GitHub connector writes; read calls are excluded |
| Artifact publication/comment parser | Carried for compatible Artifact/ArtifactComments payloads; this does not provide a Claude Artifact service in Codex |
| Session fork | Native `codex fork SESSION_ID` and `codex resume SESSION_ID`, guided by the packaged skill |
| `/btw` | Claude-specific index omitted; no equivalent Codex source contract verified |

Native events keep the original tool input/output. Workers use a normalized copy:
`turn_id` supplies `prompt_id`, native patches use `tool_input.command`, and string
shell output supplies an exit status. Failure classification depends on the
result exposing a status; it does not guess from ordinary error words. The
rollout format and optional Codex SQLite schema are not stable APIs.

Archives use atomic replacement, exclusive locks, complete-line offsets and a
prefix fingerprint to recover from truncation, replacement and damaged copies.
SessionEnd and Interrupt schedule sanitized detached jobs within Codex's three
second limit. Start sweeps recover captures after abrupt termination. Detached
work can finish after the hook returns; verify the files before consuming them.

Files-written retains the Claude limits: text copies up to 512 KiB, 40 copies and
200 index lines per call, five seconds per directory scan, and bounded scans
after a root times out. Binary/larger files are listed. Credential filenames are
listed without a copy or hash. Tokens and URL passwords are sanitized in every
capture stream. A scan proves a change occurred during a call; another writer
in the same tree can be its author. Hosted tools and tools bypassing Codex's
local function path have no tool hooks. Background processes can outlive their
PostToolUse scan window.

The workspace clone guard accepts Codex patch paths as well as the inherited
Write/Edit/Bash forms. It reads `STC_WORKSPACES_CONFIG` or
`$MIADI_SRC/config/stc-workspaces.json`; absent configuration leaves capture
enabled. The scoped Git-add validator is bundled and has no host-specific path.

## Back up and clear legacy wiring

Perform this only for the user who requested the cutover. Keep legacy capture
enabled until plugin discovery, trust and capture are verified. Both active at
once would write each event twice.

```sh
python3 codex/miadi-session-observability/scripts/legacy-cutover.py backup
# After install, review and runtime verification, use the returned directory:
python3 codex/miadi-session-observability/scripts/legacy-cutover.py clear --backup /path/to/backup
```

The backup includes `hooks.json`, `config.toml`, referenced `codex_hooks` scripts,
their sanitizer/validator dependencies and an existing user `hooks/` directory.
It is private and has a SHA-256 manifest. Clear verifies every backup checksum
and that `hooks.json` has not changed, then removes only legacy
`codex_hooks/*_hook.sh` registrations, preserving unrelated handlers and metadata.
Shared scripts in `/src/scripts` or `/opt/binscripts` stay available to other
users. Inspect inline TOML/project/system hooks separately if present.

To roll back, disable this plugin, restore the saved `hooks.json`, and start a
fresh session. The original `config.toml` is a reference for restoring settings;
do not overwrite unrelated changes made since the backup.

## Verify and maintain

```sh
bash codex/miadi-session-observability/tests/run.sh
```

The suite covers native events, failures, patches, credential exclusions, rollout
recovery, children, connector publications, selective backup/clear, and inherited
team, episode, mission, files-written, publication, Artifact-comment and workspace
rules. A real runtime smoke test must additionally confirm plugin discovery and
trust, then capture a fresh session's start, prompt, tool calls, stop and end
exactly once with a nonempty durable rollout. `tests/runtime-smoke.py` drives
the installed Codex against a local deterministic Responses fixture, without an
external model call.

The shared capture helpers and tests were ported from
`claude/miadi-session-observability` 0.1.18 at kit commit `aa033fa`, with
`claude`/`CLAUDE` helper and capture prefixes changed to `codex`/`CODEX`.
`native.py`, `dispatch.sh`, patch capture and migration tooling are Codex-native.
The shared sanitizer and Git validator were copied unchanged; the workspace
guard adds native patch targets. Compare future Claude changes before porting;
never blindly substitute harness-specific transcript or process assumptions.
Changes to this package reach installed users through a version bump and
reinstallation, followed by a fresh session and hook review when definitions
change.
