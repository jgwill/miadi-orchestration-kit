---
name: codex-setup
description: Set up Codex on this account so it can start Miadi sessions that are observed like Claude Code sessions. Covers Codex at a version whose plugin hooks run, the kit's Codex marketplace, the Codex miadi-session-observability plugin, the terminal title that binds a pane, the hook review the person does in /hooks, the proof that capture works, and the removal of legacy Codex hooks after that proof. Use when a person or their agent asks to "set up Codex", "install the Codex plugin", "get ready for ceremonies with Codex", "Codex observability", or when `codex plugin list` does not show miadi-session-observability installed and enabled.
---

# Codex setup for Miadi sessions

Starting sessions with Codex will be required for future ceremonies (Guillaume, 2026-11-14). This skill is run from Claude Code by the agent of the person whose account it is. The agent does the steps marked **agent**. The steps marked **person** belong to the person, and the agent stops before each one and says what it is.

## Tell the person first what is recorded

Once the plugin's hooks are trusted, every Codex session on the account writes what it does under `<root>/<session id>/`: each prompt, tool call and reply, each plan, a copy of each file a tool call writes, and a line binding the session to its tmux pane and team. Tokens and passwords are masked in every stream, and credential files are listed by name without a copy. The root is `CODEX_SESSIONDATA_ROOT`, else `MIADI_SESSION_DIR`, `MIADI_SESSIONDATA_ROOT`, `SESSION_DATA_ROOT`, else `/src/_sessiondata` when that folder exists. On a Miadi host that folder is shared, and other accounts in its group can read what is in it. Say this to the person in one or two plain sentences and continue only with their yes.

## Steps

1. **agent.** Read the starting point: `codex --version`, `codex plugin list | grep miadi`, and whether `~/.codex/hooks.json` names `codex_hooks/*_hook.sh` scripts (the legacy capture).
2. **agent.** Codex 0.163.0 or later runs plugin hooks. Releases 0.167.0 and 0.169.0-alpha.11.1 were measured on 2026-11-14. Upgrade with `codex update`, or `npm i -g @openai/codex@latest` when Codex came from npm. If `~/.codex/auth.json` is missing, the **person** signs in with `codex login`.
3. **agent.** Run `codex plugin marketplace list`. With no `miadi-orchestration-kit` there, run `codex plugin marketplace add jgwill/miadi-orchestration-kit`. When it is already listed, run `codex plugin marketplace upgrade miadi-orchestration-kit`.
4. **agent.** Run `codex plugin add miadi-session-observability@miadi-orchestration-kit`. Its output ends with `Installed plugin root: <path>`, which the next steps call `<plugin root>`. `codex plugin list` now shows it `installed, enabled` with its version.
5. **agent.** Run `python3 <plugin root>/scripts/configure-terminal.py`. It adds the thread id to Codex's terminal title so that capture can bind a session to its tmux pane, and it backs up `config.toml` first.
6. **agent**, only when step 1 found legacy hooks. Run `python3 <plugin root>/scripts/legacy-cutover.py backup` and keep the folder it prints. Leave the legacy hooks wired until step 8, so no session goes unrecorded.
7. **person.** Open Codex in a terminal, type `/hooks`, and review the hooks whose source is the plugin `miadi-session-observability@miadi-orchestration-kit`. Trust them. These hooks run at every action of every Codex session on the account, so the agent never writes trust into `config.toml` for the person.
8. **agent.** Prove it. Start a fresh Codex session, send one prompt, exit. Then `miadi-hooks-interpret digest <thread id>` reads the session, and `<root>/<thread id>/` holds `_codex_SessionStart.jsonl`, `_transcript_final.jsonl` and `_terminal_binding.jsonl`. While the legacy hooks are still wired, each event is written twice. `python3 <plugin root>/tests/runtime-smoke.py` also proves the plugin end to end in an isolated Codex home, against a local fixture, with no model call.
9. **person's word, agent's command.** Removing the legacy hooks deletes their wiring, so ask first. Then run `python3 <plugin root>/scripts/legacy-cutover.py clear --backup <folder from step 6>` and start a fresh session. It removes only `codex_hooks/*_hook.sh` registrations and keeps every other hook. To undo it, restore the saved `hooks.json`.

## After an upgrade of the kit

Run `codex plugin marketplace upgrade miadi-orchestration-kit`, then `codex plugin add miadi-session-observability@miadi-orchestration-kit`, then start a fresh session. When hook definitions changed, `/hooks` asks the person to review them again.

## What the person gets

- A Plan Mode plan is kept as `plans/session_<id>_<yyMMddHHmm>.md`, as Claude Code plans are.
- At each prompt, Codex is told which other sessions are replying in the same repository, Claude Code or Codex, so two agents do not work over each other unaware.
- A Codex session that is replying keeps the marker `<state>/miadi/working/<id>.json` that `tide agents restore` reads after a power-off. tide's restore does not relaunch Codex sessions yet: its runtime names no Codex launcher (measured 2026-11-14).
- The Bash guards of the Claude plugin refuse the same commands in Codex: a `find` over `/`, `tmux kill-server`, and a command that would print a credential.

Each recorded fact is what Miadi's event envelope is built to carry (`packages/hooks-core/src/envelope.ts` in jgwill/Miadi). Sharing a session with the people of a ceremony's circle is not a platform feature yet.

## Related

- `codex/miadi-session-observability/README.md` in this kit: the capture contract, the parity table with the Claude plugin, and the cutover in full.
- The `session-continuity` skill: the binding line and restore after a reboot.
- jgwill/miadi-orchestration-kit#98: Codex parity and the legacy hook cutover.
