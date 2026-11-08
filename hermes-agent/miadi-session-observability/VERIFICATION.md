# Verification — Hermes session observability 0.1.0

Executed on 2026-11-08 against installed Hermes Agent v0.23.0
(`hermes --version`: stable, local 2bd378ed1b8d, Python 3.14.9).
Issue linkage: jgwill/miadi-orchestration-kit#56 and #117.

## Commands and observed results

- `python -m unittest discover -s hermes-agent/miadi-session-observability/tests -v`
  — 37 tests, OK. Covers legacy filenames, native args/result normalization,
  session-id precedence and rejection, concurrency, private file permissions,
  symlink rejection, redaction, binding/team/episode rules, turn-vs-session
  endings, resume/reset, history snapshots, and safe/idempotent migration/staging.
- `hermes plugins doctor ./hermes-agent/miadi-session-observability --ci`
  — runtime discovery, manifest parsing, import and registration passed;
  0 tools and 15 hooks registered.
- `hermes plugins validate ./hermes-agent/miadi-session-observability`
  — validation passed; security scan safe; declared hooks matched actual
  registration. Its private-core-import warning names only the standalone smoke
  harness's PluginManager/VALID_HOOKS imports, not the runtime plugin.
- `python hermes-agent/miadi-session-observability/scripts/smoke.py --isolation in_process`
  — passed: 18 native dispatcher firings, 20 capture records (two extra legacy
  pre_llm_call aliases), all 15 hooks, namespaced continuity skill, no provider calls.
- The same probe with `--isolation host` — the same checks passed through
  Hermes's real plugin-host process boundary.
- Installer dry run on `/home/mia/.hermes` — would remove exactly 9 recognized
  legacy capture commands and enable the plugin; unrelated enabled `miadi` and
  `herdr-agent-state` plugins would remain.

These probes use explicit fixture payloads, not responses claimed to come from
an LLM or provider. They exercise the actual installed loader, callback dispatch,
filesystem persistence and read-back. No inference request was made, no live tmux
server was modified, and no other Hermes profile was changed.

## Default-profile installation state

Ran:

    python hermes-agent/miadi-session-observability/scripts/install.py --home /home/mia/.hermes --stage --apply

Read back and verified:

- `/home/mia/.hermes/plugins/miadi-session-observability` is a symlink to this
  checkout's `hermes-agent/miadi-session-observability` directory.
- `hermes plugins list` reports version 0.1.0 as `not enabled`.
- Config was not changed. The enabled user plugins remain `herdr-agent-state`
  and `miadi`, and all 9 legacy capture commands remain configured.
- Staging neither backs up nor prints config because it does not rewrite it.

The current session's tool ancestry reaches the shared Hermes gateway. Removing
its hooks before a coordinated restart risks a gap; enabling both implementations
risks duplicate capture. Neither was done. Activation remains an operator step:
run the normal installer `--apply` without `--stage`, then restart Hermes/the
shared gateway at a time approved by the operator.

## Known boundaries

This is not a full port of every Claude guard/index/archival feature. In particular,
Miette plan-review agent launches are deliberately excluded from recording and
need their own opt-in plugin. History is a sanitized last-hook-visible snapshot,
not a lossless lifetime SQLite export. New capture files are private to the local
account; a cross-account observer needs an explicit filesystem access policy.

References checked for the implementation:

- https://hermes-agent.nousresearch.com/docs/developer-guide/plugins
- https://hermes-agent.nousresearch.com/docs/developer-guide/observer-hooks
- The installed Hermes lifecycle call sites and plugin manager.
