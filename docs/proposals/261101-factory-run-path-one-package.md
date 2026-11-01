# Proposal: one installable package opens a factory run, from approval to a live session

Status: proposal (2026-11-01). Draft body for an issue in `jgwill/miadi-orchestration-kit`. Not filed yet.

## Context

An approved connector run takes two repositories and one host to reach a live session:

| step | where | repo |
|---|---|---|
| name the session `connector-<yymmdd>-<id>`, write a brief into `~/.miadi/factory/queue/` | `packages/connector/src/approve.ts` (`runBrief`, `queueBrief`) | `jgwill/Miadi` |
| read the queue every 5 minutes, `tmux new-session`, type the launcher, hand over the brief | `factory/intake/` (`intake.mjs`, `lib/deliver.mjs`), `factory-intake-deliver.timer` | `miadisabelle/workspace` (Mia's personal workspace) |

The two halves share only a file format (an `<input …>` block) and a folder. Neither repo declares the other as a dependency.

The intake can't be installed anywhere except eury. It hardcodes:
- `/a/src/Miadi-18` as the default `cwd`
- `/etc/claude-code/skills/dispatch-discipline/pane-write-guard.sh` as the pane guard
- `/workspace/repos/jgwill/smcraft/...` as the lane-check code, imported in place (the tests fail without it)
- `~/workspace/.mino/briefs` for briefs
- `/src/_sessiondata/data/terminal_bindings.jsonl` for bindings
- `claudeyolochronicle` as the launcher, a shell alias
- the unit file's `/home/mia/.nvm/versions/node/v24.18.0/bin/node`

On 2026-11-01 the request "start Remote Control in every new connector session" (`miadisabelle/workspace` commit `d119993`) had to land in Mia's workspace, though the connector it concerns lives in `jgwill/Miadi`. The feature's switch, `MIADI_CONNECTOR_CLAUDE_REMOTE_CONTROL`, is read by a program the connector doesn't ship.

The kit already builds Debian packages (`packages/miadi/deb/`). None of them carries the intake. The kit has no Termux packaging.

## Desired State

One package, `@miadi/factory-runner` (name open), holds the whole run path: queue format, delivery, session opening, provider launchers and session-start steps (Remote Control among them). The connector depends on it for the brief format. The kit installs it on Ubuntu (deb + systemd user timer) and Termux (`termux-services` or a cron line) from configuration alone: no path in the code names a host, a user or a personal workspace. A person installing the kit on a new machine sets a config file, and the next approved run opens a session there.

## Action Steps

- [ ] Move the queue format (`<input>` block, `to=`, `cwd=`, `provider=`, `launcher=`, `remote_control=`) into one module with a schema, imported by both `packages/connector` and the runner.
- [ ] Move `factory/intake` delivery (`deliverAll`, `openNew`, `deliverToExisting`, `submitLine`, queue handling) into the package. The scratchpad-review and Jev readiness parts stay in Mia's workspace as a consumer.
- [ ] Replace every hardcoded path with one config file (`~/.config/miadi/factory.json` or env), with defaults from `XDG` / `$PREFIX` (Termux).
- [ ] Make launchers a table keyed by provider (`claude`, `codex`, `pi`, `copilot`), each with its command and its session-start steps. `claude` gets `/remote-control <session>`, on unless `MIADI_CONNECTOR_CLAUDE_REMOTE_CONTROL=0`. Honour the `provider=` the connector already writes; today the intake ignores it.
- [ ] Make the pane guard and lane check optional plugins, absent by default, never a required path.
- [ ] Ship a `miadi-factory-runner` deb with a systemd user timer, and a Termux install script, both from the kit.
- [ ] Remove `factory/intake/lib/deliver.mjs` from `miadisabelle/workspace` once eury runs the package, in the same change that switches eury's timer.

## Structural Tension

The connector promises "an approved run opens a session", but keeping that promise depends on code that exists on one host, in one person's workspace, at paths only that host has. The kit is meant to be installed on other people's Ubuntu and Termux machines.

## Related

- `jgwill/Miadi` `packages/connector/src/approve.ts` (`runBrief`, `queueBrief`), `packages/connector/README.md`
- `miadisabelle/workspace` `factory/intake/`, commit `d119993` (Remote Control at session start)
- `jgwill/miadi-orchestration-kit` `packages/miadi/deb/`
- jgwill/Miadi#815, jgwill/Miadi#816 (connector runs), jgwill/Miadi#893 (resolved provider)
