# Hermes feature phase — verification and coverage

Executed 2026-11-08 against installed Hermes Agent 0.23.0, local 2bd378ed1b8d.
Related work: jgwill/miadi-orchestration-kit#41, #64, #103, #104, #56 and #117.
No GitHub issue/comment was written: the CLI is unauthenticated; the existing
issues/PR provide linkage rather than a fabricated publication receipt.

## What was actually built

| Component | Ownership and coverage |
|---|---|
| miadi-chronicle-episode-kit 0.1.0 | Canonical Chronicle/staging/screenwalk skills; native terminal/write_file/patch vessel guard; full-reply Miadi address transform; status and preview-first mint commands through the existing bridge |
| miette-plan-insight 0.1.0 | Successful plan-file triggers, content dedup, recursion/origin gates, registered review/critic skills, ask/listen/status/file commands; shared seat runtime launches Hermes without Claude-only flags |
| miadi-session-observability 0.1.1 | Existing Miadi bridge owns start/end/index, eliminating duplicate lifecycle writes; dedicated capture fills verified-pane resumes, keeps event/reply/history capture, and resolves the caller's cwd through Hermes context |
| Shared Claude Miette runtime 0.1.4 | Backward-compatible Hermes selector, profile/state inheritance, native prompt ledger and recognized Hermes session identities; existing Claude defaults remain |

## Measured bridge overlap

The path mentioned by the operator contains an older bridge. The installed
`/home/mia/.hermes/plugins/miadi` resolves to:

    /usr/local/src/mightyeagle.wt/733-hermes-session-continuity/runtime/hermes-plugins/miadi

That version is 0.3.0 and already registers lifecycle callbacks, generic API,
scoped memory, conductor, routing and Tide tools. No MightyEagle file was changed.
The two feature plugins register zero duplicate Miadi tools and install no MCP
servers. Chronicle commands use ctx.dispatch_tool("miadi_api", ...), and refuse
webhook/unknown origins rather than bypassing the bridge's channel separation.
The older path is not silently substituted for the installed worktree.

## Tests and real execution

- Capture suite: 37 Python tests passed.
- Native feature/coexistence/installer suite: 24 Python tests passed.
- Shared Claude Miette plus Hermes-specific runtime tests: 22 Node tests passed.
- Existing Chronicle address and screenwalk-name suites: 16 Node tests passed.
- Total: 99 automated tests, all passed.
- Plugin doctor passed for all three native plugins (15/2/2 hooks, zero new tools).
  In isolated single-package checks the optional Miadi dependency is reported as
  missing/advisory; the full coexistence probe loads the actual installed bridge.
- Plugin validation passed for both new feature plugins: declared registrations
  match, security scan safe, no core overrides or private runtime API imports.
- The installed-runtime feature probe passed in both `in_process` and `host`
  modes, with the real Miadi bridge and all three kit plugins enabled inside
  a scratch profile/capture root. It checked canonical skills, exactly one
  session-index record, guard refusal and a complete preserved reply with its
  missing address. No provider call or live episode write occurred.
- `/episode-status 573` was invoked through the installed plugin command and
  real bridge in the runtime probe. The API returned HTTP 200 for
  `2026-11-07-episode-573-closing-a-cycle-the-person-answers-the-agents-continue`:
  created, committed, pushed, registered and receipt-verified were all proven.
  This is a real read result, not a fixture response.
- The independent capture-only host probe also passed: 18 native firings,
  20 legacy-compatible capture records and the continuity skill, zero inference.

Seat-opening subprocess tests use explicit mct/tmux stand-ins. They verify launch
arguments, state, native prompt-ledger references and filing under the actual
capture identity; they are not evidence that a real reviewer completed a critique.
No live reviewer, model request, wheel perspective or new episode was created.

Reproduce from the kit root:

    python -m unittest discover -s hermes-agent/miadi-session-observability/tests -q
    python -m unittest discover -s hermes-agent/tests -q
    node --test claude/miette-plan-insight/scripts/miette-plan-insight.test.mjs hermes-agent/miette-plan-insight/tests/hermes-runtime.test.mjs
    node --test claude/miadi-chronicle-episode-kit/hooks/address-check.test.mjs claude/miadi-chronicle-episode-kit/skills/screenwalk-names/scripts/screenwalk-name.test.mjs
    python hermes-agent/tests/smoke_features.py --isolation host --live-ref 573
    python hermes-agent/tests/smoke_features.py --isolation in_process

## Default-profile deployment, read back

Ran `python scripts/install-hermes-kit.py --home /home/mia/.hermes --apply`.
All three source symlinks were verified. Config bytes were compared before and
after and were unchanged. Hermes lists:

    enabled      herdr-agent-state             1.0
    enabled      miadi                         0.3.0
    not enabled  miadi-chronicle-episode-kit   0.1.0
    not enabled  miadi-session-observability   0.1.1
    not enabled  miette-plan-insight           0.1.0

All nine legacy capture commands remain active. No shared gateway restart or
other-profile change was made. At an operator-approved restart boundary:

1. Apply `hermes-agent/miadi-session-observability/scripts/install.py --home ~/.hermes --apply`.
   It privately backs up config, removes only recognized legacy capture commands,
   enables observability and preserves Miadi/Herdr.
2. Run `scripts/install-hermes-kit.py --home ~/.hermes --apply --enable` through
   the Hermes Python environment. Enabling uses the public Hermes CLI and saves
   a private config backup. It refuses to enable Miette while legacy hooks remain.
3. Immediately restart Hermes/the gateway. No hot-swap is promised; do not leave
   a gap between legacy-hook removal and restart.
4. Verify a fresh session's capture and a real chosen plan/review if authorized.

## Explicit remaining differences from Claude

- Voice/TTS and the three dedicated Chronicle MCP servers are not installed by
  this phase. The canonical episode API workflows use the existing HTTP bridge;
  voice must be connected separately before a voiced review is claimed.
- The chart-pulse Stop protocol is not ported; miadi-chart-pulse is absent on the
  measured host. There is no placeholder check claiming that a chart moved.
- The independent critic gate needs an available separate subagent; a skill is
  not a fictitious named-Claude-agent API. Missing critique is reported as owed.
- Claude's richer file/publication indexes, transcript/subagent sweeps, security
  policy guards, session issue and forks remain outside the initial capture port.
- This remains a checkout installation with shared canonical assets, not a
  standalone catalog package containing copied skill/runtime bodies.
