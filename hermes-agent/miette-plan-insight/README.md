# miette-plan-insight — Hermes 0.1.0

Hermes-native adapter for the **shared seat runtime** in
`claude/miette-plan-insight/scripts/`. Related: jgwill/miadi-orchestration-kit#104
and #106. Node >=18, Hermes >=0.23.0 and this checkout are required. Real seat
opening needs the installed `mct` (`@miadi/chronicle-tui`) or optional Herdr.
This plugin does not install another Tide or duplicate the Miadi bridge.

## What triggers a review

Once deliberately enabled, a successful write_file/patch touching a Markdown
file directly in `.hermes/plans/` presents that real file to Miette. No todos
are reconstructed as pretend plans. Files over 512 KiB, symlinked plan files,
empty plans, failed calls, unrelated paths, webhook and unknown surfaces are
ignored. Content digests deduplicate resaves, under a per-file lock. Changed
versions reach the same named seat. Credential-shaped text is redacted through
the canonical Hermes observability redactor before automatic persistence.

`MIADI_MIETTE_PLAN_INSIGHT=0` disables triggering. `MIADI_MIETTE_SEAT` prevents
recursive seats. Hook errors log only their class and never block the plan.
The adapter normalizes Hermes callbacks for the shared runtime; there is no
fictitious ExitPlanMode event registered in Hermes.

The Node runtime keeps the plan and starts a detached opener; the hook returns
after acknowledgment, not after a reviewer has completed a critique. Opening
failures remain in `open.log`/seat state. No reviewer or model was launched by
verification; subprocess tests use explicit mct/tmux stand-ins.

## Reviewer and commands

The default reviewer is **Hermes**, with `mct --no-name` and no Claude `-n` or
Remote Control arguments. Profile, state directory and capture root are carried
explicitly into the launch even when the tmux server predates this session.
`MIADI_MIETTE_LAUNCH` can explicitly select another reviewer launcher.

    /miette-insight --plan <path> [--session <id>] [--episode <ref>] [--mission <pinned-mission>]
    /miette-listen [--session <id>] [--timeout <seconds>]
    /miette-listen status
    /miette-status [--session <id>]
    /miette-file <insight.md> [--session <id>] [--no-register]

Explicit commands dispatch Hermes's terminal tool, preserving its approval,
process tracking and notification path. `/miette-listen` is a background task
with notify:true; on a new version it returns MIETTE WAKE, then the seat re-arms
it after revising/filing. It is not a synchronous slash command hung forever.
Pre-LLM context reminds a resumed review seat which plan it serves and whether
its listener runs.

Hermes registers `miette-plan-insight:miette-plan-insight` and
`miette-plan-insight:plan-critic` skills rather than pretending Claude's named
agent API exists. The skill requires a separate available subagent for the
critic pass. A missing independent critic or voice capability is explicitly
owed, never silently self-certified. The person alone approves a plan.

The shared runtime retains mission prompt resolution, named seat reuse,
listener locking, versioned insights, `plans/miette_perspective.md`, answered
plan snapshots, optional plan-insight-register projection and mission research
observations. Supported native Hermes session identities file under their
actual capture folder; mission/ask keys remain in private seat state. The
Hermes person's prompt ledger is `_hermes_user_prompt_submit.jsonl`, not a
Claude transcript.

## State and source ownership

Default state: `$HERMES_HOME/plugin-data/miette-plan-insight`, overridden by
MIADI_MIETTE_STATE_DIR. Shared Node runtime changes are authored in the Claude
lane first, version 0.1.4, with its existing regression suite kept passing;
the Hermes adapter does not fork that runtime. The Hermes review skills adapt
only the command/critic/capture interfaces and name their canonical practice.
Set MIADI_ORCHESTRATION_KIT_ROOT for isolated doctor/validator copies.

Manual `--plan` requests use the shared runtime's existing trusted-file path;
automatic-trigger redaction is not a claim that every manually filed insight
or external log is sanitized. Review these before publication. The default
profile's state remains under its own Hermes home; no other profile is changed.

## Install and verify

    python scripts/install-hermes-kit.py --home ~/.hermes --apply
    hermes plugins doctor ./hermes-agent/miette-plan-insight --ci
    hermes plugins validate ./hermes-agent/miette-plan-insight
    node --test claude/miette-plan-insight/scripts/miette-plan-insight.test.mjs hermes-agent/miette-plan-insight/tests/hermes-runtime.test.mjs
    python hermes-agent/tests/smoke_features.py --isolation host

Apply alone stages disabled. Enable only after cutting over the legacy capture
hooks: their pre/post-tool scripts also attempted Miette plan launches. The
installer refuses `--enable` for Miette while those hooks remain, avoiding two
review implementations. Restart the shared gateway at an operator-approved
boundary; neither plugin installation nor verification restarts it.
