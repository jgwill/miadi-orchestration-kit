# T1 → T8: Pi observability, 2026-10-22

Issue: https://github.com/jgwill/miadi-orchestration-kit/issues/99

- **Producer (T1):** `t1-pi-coding-miadi-orchestration-kit-observability-2610221637`, native session `01a1655f-66aa-7042-94b1-7b7cc227a3d9`.
- **Consumer (T8):** `t8-pi-agent-observability-rel2-miadi-review-a66e014e-2610221636`, working in `/workspace/repos/miadisabelle/pi-agent-observability`.
- **Boundary:** T1 owns private capture, terminal continuity, archive/snapshot semantics and durable replay. T8 owns dashboard/application integration, browser behavior, deployment/auth, and any event-path adapter to the Factory. No unrequested dashboard source changes or npm release were made.

## Already running on gaia

A local service was prepared **before implementation**, to let William watch the existing sanitized hooks while the package was built:

- Dashboard: `http://127.0.0.1:43190/`, reference repo's `apps/observability/server.ts` only, **not** Steelman or `just all`.
- Authentication: private token file `/home/mia/.local/share/miadi/pi-observability/token` (`0600`). Do not paste its contents into GitHub, captures, or this document. Construct the browser URL locally with `?token=<value>`; session selection is `#view=single&sid=<id>`.
- Database: `/home/mia/.local/share/miadi/pi-observability/obs.db` (SQLite/WAL).
- Isolated Bun **1.4.4** binary: `/home/mia/.local/share/miadi/pi-observability/runtime/node_modules/@oven/bun-linux-x64/bin/bun`. Installed with npm's `@oven/bun-linux-x64`, no global toolchain changes.
- tmux windows in the **T1 session**: `obs-dashboard` (Bun), `obs-bootstrap` (legacy bridge), `obs-forward` (new durable journal forwarder). Windows were created detached; T8's pane was not steered or restarted.
- Bootstrap bridge: `/home/mia/.local/share/miadi/pi-observability/legacy-bridge.mjs`; reads only this T1 session's existing `_pi_hooks_all.jsonl`. Its dashboard identity is deliberately **`bootstrap-01a1655f-66aa-7042-94b1-7b7cc227a3d9`**, pool `T1-bootstrap`, label `T1 Pi capture migration`. It cannot reconstruct missing startup/context/timing events. Its source-line sequence must **not** share the canonical session's sequence namespace.
- Canonical forwarder already watches `01a1655f-66aa-7042-94b1-7b7cc227a3d9`; it waits harmlessly until the new journal exists. After an idle `/reload`, choose the native session row to see augmented telemetry. The bootstrap row remains historical/compatibility evidence, not another agent.
- Health: `curl -fsS http://127.0.0.1:43190/health`. For a remote browser: `ssh -L 43190:127.0.0.1:43190 mia@gaia`. The service is loopback-only, tmux-managed, **not boot-persistent**; T8 must decide production service ownership.

Only the **mia** account was cut over. `~/.pi/agent/settings.json` now adds the local package and removes the binscripts extension entry, with unrelated settings preserved. Backup: `~/.pi/agent/settings.json.before-miadi-pi-observability-1792703289496`. Other accounts, binscripts' live code and T8's reference checkout remain untouched. Existing Pi processes keep their loaded legacy extension until `/reload` at an idle boundary or restart. Do not inject `/reload` into a busy agent. A newly started ordinary `pi` in T8's directory uses the package without `-e`.

## T8's first loop

1. Read [README.md](README.md) for events, limits, privacy and omitted Claude-only capabilities. Keep existing capture active if running; reload only when idle.
2. Start ordinary Pi from T8's terminal, or idle-reload an already started process. Find its **native session ID** in `/src/_sessiondata/data/terminal_bindings.jsonl` by `tmux.session`, not by a guessed transcript filename.
3. Start its explicit local forwarder (a separate supervised terminal/window):

   ```sh
   export OBS_TOKEN_FILE=/home/mia/.local/share/miadi/pi-observability/token
   node /workspace/repos/jgwill/miadi-orchestration-kit/pi/miadi-session-observability/scripts/forward.mjs \
     --session <native-pi-session-id> --watch
   ```

4. Open the native session row in the dashboard. Verify a user prompt, tool call/result, failing tool, model change, one token/cost rollup and the prompt/context snapshot references. Do not load the reference repo's `extension/pi-observability.ts` alongside this capture: it independently assigns `seq` from zero and can collide for the same session ID.
5. T8 can either keep the supplied forwarder or write a consumer of `_pi_observability.jsonl`. Reuse **event IDs and sequence numbers** when replaying; never renumber on reconnect. The canonical stream matches `shared/types.ts` event discriminators/envelope/payload names, with additive `schema`, `miadi`, snapshot refs, `cost_reported`, durations and error correlation. Native Pi `turn_index` can restart with a new run; use `miadi.run_id` to distinguish runs and `miadi.prompt_id` for the most recently observed input event. This does not claim every custom/queued run has a fresh human prompt.
6. The reference server stores `payload` and selected envelope fields only: additive `schema`/`miadi` envelope metadata is dropped from its SQLite/SSE reconstruction. T1 therefore **mirrors correlation in `payload.miadi`**, which survives unchanged; T8 can project that into team/episode/run UI without losing existing records. Do not confuse a terminal team with a dashboard pool.
7. Snapshot paths are **relative to that session's capture directory**, never arbitrary client-supplied host paths. The server currently has no snapshot-file endpoint; T8 must add an authenticated, traversal-safe reader or keep inspection local. The changed prompt is also inline in canonical `agent_start`, so basic prompt inspection works now. The context event's snapshot reference does not make the full context magically browser-readable.

## Validation performed

- **13 Node tests**: lifecycle mapping, no event mutation/blocking, redaction (including large numeric token counts), snapshot hashes, timing/costs, model/tool errors, file capture exclusions, reload metadata, resume/partial-journal recovery, duplicate writers, archive rewrite/partial-line/corruption isolation, forward acknowledgements/retry/sequence conflicts, and additive/idempotent settings migration.
- Installed Pi 1.4.0 RPC smoke: actual package discovery, real start/shutdown, team binding, valid protocol-only stdout and lock release; no provider/model calls. Also launched from T8's working directory using **the migrated account configuration, no `-e`**, and verified exactly one start capture with T8 binding.
- Claude's existing team-resolution and episode-resolution suites: **13 + 13 checks**, pass. The shared sanitizer self-test passes. Bundled shell helpers match their source copies byte-for-byte.
- Live reference server ingest/API health was exercised using the sanitized bootstrap stream. Optional `tests/dashboard-smoke.mjs` also ingested **13 explicitly synthetic events**, checked token/cost rollups count only the assistant once (10 tokens, 0.123 fixture cost), one error, snapshot refs and correlation surviving the server. Its dashboard rows are labelled **SYNTHETIC**, not real agent work; fixture capture files are removed after the check. Browser interactions have **not** been automated or claimed as tested.

## Remaining decisions / honest gaps

- Account-by-account rollout and publication are William's; package is private/local, not npm-published.
- T8 chooses projection of correlation metadata, authenticated snapshot delivery, service supervision and external exposure. The current reference server is a local development tool, not a production auth boundary.
- No cross-account archive sweep, Bash/MCP filesystem tracing, publications/comments/btw index, subagent discovery, all extension-error capture or automatic retention. See #82/#83 and the parity notes in the README before treating this as Claude feature parity.
- The old running T1 process cannot retroactively acquire richer hooks. Idle reload is the last activation step; the live bootstrap service keeps it observable until then.
