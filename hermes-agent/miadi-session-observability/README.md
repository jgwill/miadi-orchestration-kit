# miadi-session-observability — Hermes

Native Hermes plugin replacing `/opt/binscripts/hooks/hermes_hooks` for local
Miadi capture. Related work: jgwill/miadi-orchestration-kit#56 and #117.
This directory, not binscripts or an installed copy, is canonical for Hermes.
The Claude implementation remains canonical for Claude; this is not its shell API
wrapped in a different manifest.

Since 0.1.1 the installed Miadi 0.3.0 bridge is recognized as the continuity
owner for start/end/index. With that plugin loaded, capture does not duplicate
those records. It fills the bridge's missing resume boundary with
`session.observed` only when a tmux pane is verified; messaging sessions never
gain invented terminal coordinates. `plugins.entries.miadi-session-observability.settings.continuity_owner`
is `auto` by default; `bridge` or `capture` is an explicit deployment override.
For an older Miadi bridge without lifecycle hooks choose `capture`, or upgrade
the bridge first. The advisory dependency orders bridge discovery before this
decision. Event/reply/history capture remains active in either mode. Session cwd
comes from ctx.session_cwd(), not the shared gateway process's working directory.

## Requirements and installation

Hermes >=0.23.0 with `register_hook`, `register_skill`, and the observer lifecycle
listed in `plugin.yaml`; Python >=3.10 on POSIX (flock, O_NOFOLLOW, /proc).
The installed Hermes 0.23.0 runtime was used for verification. `requires_hermes`
is a release floor; forks missing the listed hooks are unsupported. Core capture
uses only the Python standard library. tmux is optional, queried read-only with
an explicit socket and one-second timeout. There is no MCP server, network call,
extra model call, tool permission, external shell script, or publishing action.
The installer uses PyYAML, already provided by Hermes.

From a checkout of this kit, using the Python environment that runs Hermes:

    python hermes-agent/miadi-session-observability/scripts/install.py --home ~/.hermes
    hermes plugins doctor ./hermes-agent/miadi-session-observability --ci
    python hermes-agent/miadi-session-observability/scripts/install.py --home ~/.hermes --apply

The first command is a dry run. Apply installs a local plugin symlink and updates
only the selected profile's `hooks` and `plugins` blocks in one atomic config
replacement. It enables this plugin, removes only recognized legacy Hermes
capture commands, keeps unrelated hooks and existing enabled plugins, and saves
a mode-0600 timestamped backup first. Other blocks are retained verbatim; comments
inside rewritten blocks may be reformatted. YAML aliases/anchors are refused.
An existing plugin destination not pointing to this source is never overwritten.
The checkout must remain available. This is a local checkout installation, not a
catalog/Git-subdirectory install or an automatically updated package.

Restart Hermes immediately after applying. Existing CLI processes may retain old
callbacks. A long-lived gateway can resync away old shell hooks before discovering
the new plugin, causing a capture gap until restart. No hot-swap is promised.
Do not restart other people's sessions. Never wire legacy capture and this plugin
together: every overlapping event would be recorded twice. Removing legacy hook
configuration does not delete binscripts or its old consent allowlist.

For a shared gateway that cannot be restarted during this session, safely stage
the plugin without changing configuration or removing a single legacy hook:

    python hermes-agent/miadi-session-observability/scripts/install.py --home ~/.hermes --stage --apply

It remains disabled (standalone plugins require explicit enablement). At a
coordinated restart, run the normal `--apply` command without `--stage`, then
restart the gateway. Do not enable the staged plugin separately while legacy
hooks remain. The installer refuses to stage over an already enabled instance.

Rollback: privately restore the backup to the same config and remove the plugin
symlink, then restart Hermes. Do not print config or backup contents; they can
contain secrets. Re-running apply with no changes is idempotent and makes no backup.

## Capture contract

`<root>` is the first nonempty environment variable in this order:
HERMES_SESSIONDATA_ROOT, MIADI_SESSION_DIR, MIADI_SESSIONDATA_ROOT,
SESSION_DATA_ROOT; otherwise `/src/_sessiondata` if `/src` exists, else
`~/_sessiondata`. The Hermes-specific override keeps its legacy priority.
MIADI_SESSION_DIR is also honored now, consistent with the other Miadi harnesses.
`HERMES_HOME` selects a profile, not the shared capture root. Payload session ids
win over the environment, which is only a fallback for empty tool-hook ids.
Unsafe/missing ids are rejected, never merged into `unknown-hermes-session`.

Each firing appends a redacted JSON object to these existing paths:

- `<root>/<sid>/_hermes_<event>.jsonl`
- `<root>/<sid>/last_hermes_<event>.json` (atomic latest snapshot)
- `<root>/<sid>/_hermes_hooks_all.jsonl`
- `<root>/data/hermes_hooks_all.jsonl`
- `<root>/data/session_index.jsonl` (once per identity when this plugin owns continuity; otherwise the Miadi bridge owns it)

The shell bridge's `hook_event_name`, `tool_name`, `tool_input`, `session_id`,
`cwd`, `extra`, and routing fields are preserved. Native `args` become
`tool_input`; `result`, approval status, usage, and correlation ids stay in `extra`.
`turn_id` and `tool_call_id` are also promoted for joins. `captured_by` now names
the plugin and `capture_schema_version: 1` identifies the additive schema.
`conversation_history` is replaced in event records by its count, avoiding
quadratic history copies. Raw API requests/responses and SDK objects are omitted;
API usage, model attribution, status and timing are retained.

| Native event | Capture event(s) |
|---|---|
| on_session_start | session_start |
| pre_llm_call | user_prompt_submit, corrective_feedback (legacy aliases, not a judgment about the prompt) |
| pre_tool_call / post_tool_call | pre_tool_use / post_tool_use |
| pre_approval_request / post_approval_response | permission_request / accepted_redirection |
| subagent_start / subagent_stop | subagent_start / subagent_stop |
| on_session_end | session_end (a turn boundary, including failure/interruption) |
| post_llm_call | post_llm_call |
| on_session_finalize / on_session_reset | session_finalize / session_reset |
| post_api_request / api_request_error | api_usage / api_request_error |
| post_compaction | post_compaction |

`post_llm_call` also appends `_hermes_responses.jsonl` and atomically saves the
supplied conversation history to `_hermes_history_latest.jsonl`. This is the
last hook-visible context, not a lossless Hermes SQLite archive, not a Claude
transcript, and not a guarantee of preserving content removed by compaction.
Failed/interrupted turns remain visible via session_end even without a final reply.
Child session ids are used when supplied; parent/child/task ids remain in payloads.

### Terminal continuity

When this plugin owns continuity, start, first prompt after resume, or changed binding metadata appends the binding
schema tide reads to `<root>/data/terminal_bindings.jsonl` and the session's
`_terminal_binding.jsonl`. Only finalize/reset appends `session.end`; reset uses
`old_session_id`, never the replacement identity. Native hook callbacks return
None, inject nothing, and never block tools even if capture fails.

Bindings verify TMUX's server pid/socket before naming a pane. They include host,
agent process/argv (or null when no Hermes ancestor can be proved), launch alias,
name history when a callback supplies a name, and team/episode rules matching
binscripts' generic binding writer: declared team, session, longest folder, name;
episode by add-dir, cwd, then declared production episode. MIADI_ACCOUNT_PERSON
is recorded when exported. No person.env is sourced. There is no synthesized
rename event for a rename Hermes does not expose. State stays separate from the
legacy shell hooks' `_terminal_binding.state` for safe coexistence during restart.

### Privacy and failures

All persisted strings are sanitized before JSON encoding: held secret values from
credential-named environment variables (8+ characters), vendor token shapes,
private keys, Bearer values, URL passwords, PHP credential definitions and secret
assignments. Sensitive JSON fields are masked in full, not by prefix. Credential
files are never read or copied. This does not redact Hermes's own store, the model
context, or a tool's live output; it is not Claude's secret-print guard.

New files are mode 0600; capture subdirectories cannot be symlinks, append targets
use O_NOFOLLOW, and global appends use flock. Per-session locks serialize parallel
tool events; latest snapshots use atomic replacement. Multi-file capture is not
a database transaction: a crash can leave a partial firing across ledgers. Root
write access is checked visibly at plugin load. Later errors log only hook and
exception class, never raw payload/credentials, and leave execution unchanged.

## Deliberately separate

The old pre/post-tool scripts also attempted Miette plan-perspective launches
through `/opt/binscripts/plan-insight`. Those side effects do not belong in a
recording plugin and are not carried over. `../miette-plan-insight` now provides
that separate opt-in; capture does not silently start Claude or Miette.

This first Hermes plugin does not claim Claude feature parity: no inode-scanning
files-written index, publication index, Claude-specific transcript/subagent sweep,
secret-print/workspace/tmux policy guards, session-issue publication, fork command,
or steering inbox adapter. Hermes already provides native mid-turn steering.
The continuity skill is registered read-only as
`miadi-session-observability:session-continuity`, not copied into another profile.
Existing `miadi` and `herdr-agent-state` plugins are retained, not replaced by an MCP.

## Verification

    python -m unittest discover -s hermes-agent/miadi-session-observability/tests -v
    hermes plugins doctor ./hermes-agent/miadi-session-observability --ci
    python hermes-agent/miadi-session-observability/scripts/smoke.py
    python hermes-agent/miadi-session-observability/scripts/smoke.py --isolation host

The smoke probe uses the installed Hermes PluginManager with a scratch home/root,
not a mock plugin API or real model request. It exercises registration, tool
success/error, approval, subagents, reply/history, resume, reset and finalize,
then reads back ledgers and checks the continuity skill. It makes no network or
provider calls and does not touch the live tmux server or any other profile.
The validator's private-import warning concerns this standalone smoke harness's
PluginManager/VALID_HOOKS imports, not the plugin entrypoint or capture runtime.
