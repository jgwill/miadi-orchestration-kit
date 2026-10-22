# Pi session observability — T1 → T8

Local Pi package, version **0.1.0**, tracked by [#99](https://github.com/jgwill/miadi-orchestration-kit/issues/99).
Canonical successor to `/opt/binscripts/hooks/pi_hooks/event_capture.ts`. Tested with Pi **1.4.0**, Node **24** on gaia; Linux/Termux need `bash`, `perl`, `jq` (and `tmux` for terminal identity).
No runtime npm dependencies, network calls, background processes, or timers inside the extension. No publishing or issue-creation hooks.

## Install / cut over one account

```sh
KIT=/workspace/repos/jgwill/miadi-orchestration-kit
node "$KIT/pi/miadi-session-observability/scripts/migrate-settings.mjs"          # dry run
node "$KIT/pi/miadi-session-observability/scripts/migrate-settings.mjs" --apply  # account owner's consent
# Start Pi, or /reload ONLY when the running session is idle.
```

The migration adds this local package to `packages`, removes legacy `pi_hooks/event_capture.ts` entries from `extensions`, and preserves unrelated settings/packages. It makes a private timestamped settings backup and refuses a concurrent edit. `--agent-dir <dir>` or `PI_CODING_AGENT_DIR` selects an alternate account configuration. No other accounts are changed.

Alternatively `pi install "$KIT/pi/miadi-session-observability"`, **then remove the old extension path in the same cutover**. Both loaded means duplicate legacy capture. For an isolated one-invocation check: `pi --no-extensions -e "$KIT/pi/miadi-session-observability"`; this also disables other configured/built-in extensions for that invocation, not for ordinary operation.

A reload replaces the extension runtime, not the Pi process environment. New environment variables need a new process. The old binaries are not deleted; rollback restores the settings backup and starts/reloads Pi. Use the same session-data root.

## Files and contract

Root: `MIADI_SESSION_DIR` → `MIADI_SESSIONDATA_ROOT` → `SESSION_DATA_ROOT` → `/src/_sessiondata` when `/src` exists → `~/_sessiondata`. Empty variables fall through. The session ID is Pi's native session ID, never the tmux name.

```text
<root>/<session-id>/
  _pi_hooks_all.jsonl               # legacy envelope: source,event,timestamp,session_id,cwd,payload
  _pi_<native-event>.jsonl          # per-event stream
  last_pi_<native-event>.json       # atomic last event
  _pi_observability.jsonl           # T8 ObsEvent-compatible journal (schema miadi/pi-observability@1)
  _terminal_binding.jsonl           # terminal, pid, argv, name, team, episode
  _transcript_final.jsonl           # sanitized incremental native Pi transcript, not Claude JSONL
  .pi-transcript-offset.json        # source offsets / rewrite fingerprint
  _pi_snapshots/<kind>-<sha>.json    # content-addressed prompt, context, direct-write snapshots
  _pi_files_written.jsonl           # direct write/edit outcomes, call IDs and snapshot refs
  .pi-forward-<endpoint-hash>.json   # dashboard acknowledgement cursor
```

Bindings also append to `<root>/data/terminal_bindings.jsonl`. Reload start/end do **not** write false terminal lifecycle lines. Pi session renames do; a resumed process writes a real start. `agent_start` observes a missing binding. Team/episode resolution stays with the shared writer, not another TS implementation. T8 can join the journal's `miadi.{team,episode,tmux,launch_alias}` to those lines. Correlation is mirrored in `payload.miadi` so the reference dashboard's opaque payload storage preserves it. `miadi.run_id` separates runs whose native turn indices restart; `miadi.prompt_id` references the most recently observed input event.

Canonical events: `session_start/shutdown`, `agent_start/end`, `turn_start/end`, `user_message`, `assistant_message`, `tool_call/result`, `model_change`, `error`, `compaction`, `branch_nav`, and `custom` (`context_snapshot`, `session_name`, `agent_settled`). Native lifecycle events remain separately available. `before_agent_start` supplies **one** canonical `agent_start`; the native `agent_start` is not counted a second time.

- Every canonical event has a stable random `event_id` and per-session `seq`. Resume/reload recovers the next sequence from disk; incomplete journal tails are repaired. One capture writer per session is enforced by a pid lock; dead-pid locks recover at next start. Concurrent writers are refused visibly, never merged.
- Tool IDs join calls/results, including parent IDs when Pi supplies them. Failed tools, model messages and compactions produce explicit `error` events. Provider-private reasoning and extension errors not exposed by Pi are not invented.
- Only `assistant_message.usage` is summed for tokens/costs. `turn_end` repeats usage for turn inspection, not billing. `cost_reported:false` distinguishes missing cost from a reported zero; costs are Pi/model-reported estimates, not subscription invoices. Timing uses monotonic hook observations, includes instrumentation overhead, and is not provider-side timing. First-delta timing is measured without per-delta I/O; noisy generation windows below 50 ms have no TPS estimate.
- Prompt snapshots are observed at `before_agent_start`, context snapshots at `context_with_system`. Later extensions can still modify them: neither claims to be final serialized provider bytes. Snapshot references hash the **sanitized, bounded stored JSON**. `system_prompt_sha256` hashes the sanitized system-prompt string. Available skill metadata is not proof a skill body was read; this extension does not reread every skill from disk.
- Transcript archive runs at start, agent end and shutdown, appends only complete added lines, and detects truncation/rewrites/interrupted copies. A killed process has its existing transcript archived when **that session resumes**; there is no all-account startup sweep. A crash before the first disk-persisted native session entry cannot be recovered.

## Bounds and privacy

Package-owned capture directories are `0700`, files `0600`; shared binding helpers create new files under a private umask but leave pre-existing shared binding-file permissions unchanged. The bundled shared sanitizer runs **before persistence**; failure skips capture and emits a generic stderr diagnostic, never falls back to raw content or interrupts tools. It redacts recognized credential shapes, not all possible confidential prose; prefixes remain. Observe only trusted local sessions and treat captures as private. No `.env` autoloading, provider-header collection, or remote forwarding.

Binary image/audio bodies are omitted. Legacy strings default to 64 KiB, normalized strings/snapshots to 128 KiB; containers to 256 entries and depth 16; records/snapshot documents to 1 MiB (oversize documents get an explicit omission receipt). Transcript lines over 1 MiB get an omission line. Agent-end raw capture stores a count rather than recopying the whole run; turn-end raw capture omits repeated boundary context/tool results. These are deliberate bounded differences from binscripts. Snapshot `bounded:true` always discloses that policy; this is not an unlimited forensic archive.

Successful native `write`/`edit` captures regular text files up to 256 KiB, with sanitized content-addressed snapshots and credential-name exclusions. Credential paths are indexed, not copied into snapshots. Symlink files and binary files are not copied. **Bash/MCP writes, subagent transcripts, Claude publications/Artifact-comment/btw indices, clone guard and fork commands are not ported.** Tool arguments/results and transcript content still receive pattern-based sanitization, including when a tool edits a credential file; the filename exclusion is not a guarantee that arbitrary passwords elsewhere cannot appear. The transcript is Pi-native and must not be fed to a Claude-only token parser.

There is no automatic deletion. Retention is an explicit remaining policy in [#83](https://github.com/jgwill/miadi-orchestration-kit/issues/83); repeated bounded context snapshots can still accumulate. No upload occurs without a separately started forwarder.

## Local dashboard / replay

T8 owns the dashboard; this package owns its durable input. Run the existing reference server **only**, not its demo stack or recipes which clear ports:

```sh
export OBS_HOST=127.0.0.1 OBS_PORT=43190
export OBS_AUTH_TOKEN="$(openssl rand -hex 24)"        # keep private; same token for forwarder
export OBS_DB_PATH="$HOME/.local/share/miadi/pi-observability/obs.db"
cd /workspace/repos/miadisabelle/pi-agent-observability
bun run apps/observability/server.ts
```

In another terminal (with the same token, or `OBS_TOKEN_FILE` pointing to a private file):

```sh
node "$KIT/pi/miadi-session-observability/scripts/forward.mjs" --session <pi-session-id> --watch
```

Select sessions explicitly; repeat `--session` for more. `--root` selects another capture root, `--url` another loopback server. Without `--watch`, drain pending events and exit. Durable cursor advances only after acknowledgement. Restart/network outage retries the same event IDs; rejected IDs are verified against the server so sequence conflicts are not silently dropped. Delete the endpoint cursor to replay into a rebuilt database. Agent capture is unaffected by forwarder failure.

Open `http://127.0.0.1:43190/?token=<private-token>#view=single&sid=<pi-session-id>`. Remote browser: `ssh -L 43190:127.0.0.1:43190 mia@gaia`. Never bind the reference server to a public interface; its static routes/CORS and development authentication are not a production security boundary. See [HANDOFF-T8.md](HANDOFF-T8.md) for this session's service and transition.

## Validation and ownership

```sh
npm test --prefix pi/miadi-session-observability
bash pi/miadi-session-observability/hooks/secret_capture_sanitizer.sh --self-test
python3 pi/miadi-session-observability/tests/rpc-smoke.py  # installed Pi, no model/API calls
# Optional, against a running loopback reference dashboard; adds a labelled synthetic fixture row:
OBS_TOKEN_FILE=<private-token-file> node pi/miadi-session-observability/tests/dashboard-smoke.mjs
```

`hooks/secret_capture_sanitizer.sh` is byte-for-byte from `claude/miadi-session-observability/hooks/`; propagate fixes from that canonical sanitizer. `hooks/terminal_binding.sh` is the shared non-Claude writer, migrated byte-for-byte from `/opt/binscripts/hooks/terminal_binding.sh`; this is its kit home. Keep binscripts' live copy and other capture packages aligned when changing shared rules. Do not replace it with Claude's agent-specific writer.
