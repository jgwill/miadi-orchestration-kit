# Pi context capture repair — 2026-10-23

Tracking: [#99](https://github.com/jgwill/miadi-orchestration-kit/issues/99).
Package: `@miadi/pi-session-observability` **0.1.1**. Runtime: Pi **1.4.0**,
Node **24.18.0**, mia@gaia. No Codex changes, Pi binary upgrade or npm publication.

## Failure and repair

The TUI diagnostic `context_with_system: capture failed` came from this
extension's generic catch. Pi continued its work. Replaying a local conversation
slightly over 1 MiB reproduced the sanitizer's five-second helper deadline.
Earlier context snapshots were present; subsequent context events were missing.
The old permissions/helpers hint did not identify that timeout.

Sanitization now partitions JSON arrays and objects into 64 KiB groups, retaining
individual strings and their credential field names. Up to four helpers run
concurrently; each keeps the original timeout/output limit. Results retain
message order and numeric metadata. All active helpers are joined on failure,
queued work stops spawning helpers, and no partially sanitized result is returned
for storage. Existing storage bounds and shared sanitizer bytes are unchanged.

The same local history now sanitizes successfully. Payload contents and provider
credentials were not copied into this repository or diagnostic output. Future
failures name a safe reason code such as `helper_timeout`, without exception
messages, paths or helper stderr.

## Verification

- **16 Node tests pass**, including new large-context ordering, immutable input,
  whole multiline private-key redaction, consecutive context snapshots, continued
  tool capture and safe helper-error diagnostics.
- The existing installed-Pi RPC start/shutdown smoke and shared sanitizer
  self-test pass.
- `tests/context-smoke.py` exercises the real Pi `context_with_system` path
  with more than 1 MiB of synthetic history and an in-process deterministic
  provider. A context snapshot is recorded, the leading system message and
  history reach the provider intact, stderr has no capture failure, and shutdown
  releases the writer lock. No external model/API call is made.
- An ordinary configured-account RPC process discovers the package without
  an explicit capture `-e` or `--no-extensions`; start/shutdown streams each
  contain one event, and sequence, terminal/team binding and lock checks pass.
- JS/shell syntax, package JSON and scoped whitespace checks pass.

## Complete the launcher cutover without disturbing running work

The package was already registered once in `~/.pi/agent/settings.json`, with
no legacy entry in `extensions`. But the shared `mpi` alias still passed
`-e /opt/binscripts/hooks/pi_hooks/event_capture.ts`. A current process's binding
showed both capture routes, with two start lines for the same PID.

The account-local `/home/mia/.bash_aliases` now overrides `mpi` after the shared
aliases load. It retains `pit`'s `--thinking xhigh` and Miette's `-e` argument,
and omits only legacy capture. The account file was clean relative to its own
repository before this five-line change; it was backed up to:

`/home/mia/.bash_aliases.before-miadi-pi-observability-20261023T145419Z`

The private backup is mode `0600` and its checksum was verified. The shared
binscripts alias, other accounts, dashboards and running Pi process were left
alone. A fresh-shell dry run intercepted `pi` and proved the launcher argv;
it did not start another agent.

The currently running process retains its original CLI extensions. **Do not use
`/reload` to remove that legacy CLI argument.** After finishing the current work,
exit Pi and, from the same project directory, run:

```sh
source "$HOME/.bash_aliases"
mpi --continue
```

New shells already load the corrected alias. A process started directly through
`pi` without legacy CLI capture can instead reload the package while idle.
