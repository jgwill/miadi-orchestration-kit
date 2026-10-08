# `claude/miadi-session-observability/` — the session capture plugin

Version 0.1.0, built on 2026-09-28 by T1 session continuity (A9 on the Session Observability
Plugin page, https://claude.ai/artifact/8mGQMnj4niSUdVayYSDYk8). Tracked in
jgwill/miadi-orchestration-kit#56. The README says how to install it and how teams resolve.

## What is here

- `hooks/hooks.json`: the 12 events and 14 commands that `/opt/binscripts/hooks/claude_hooks`
  wires by hand in `settings.json`, with every path through `${CLAUDE_PLUGIN_ROOT}`.
- `hooks/claude_hooks/`: the capture scripts, with `terminal_binding.sh` (the binding line,
  its name history, the team and the episode).
- `hooks/secret_capture_sanitizer.sh`, `hooks/git_command_validator.sh`: bundled copies.
- `skills/session-continuity/`: T1's practice.
- `scripts/miadi-fork.mjs` and `skills/session-fork/`: branch a session from its binding line
  (`ask`, `open`, `list`), with `scripts/miadi-fork.test.mjs`, 8 checks (jgwill/miadi-orchestration-kit#61).
- `tests/team-resolution.sh`: the team rules, 13 checks.
- `tests/episode-resolution.sh`: the episode rules, 13 checks.
- `tests/transcript-archive.sh`: the transcript archive rules, 25 checks.

## This is the canonical copy

Change the hooks here first. `/opt/binscripts/hooks/claude_hooks` stays a live copy for the
hosts and users that still wire it in `settings.json`. Carry each change there, byte for byte,
until nothing wires it any more.

`/opt/binscripts/hooks/terminal_binding.sh` writes the same binding line for the other agents
(hermes and pi since jgwill/binscripts@c99dd89) with the same tmux and team rules. A change to
those rules here goes there too.

## What the port must keep

- **The capture layout.** `<root>/<session_id>/` under `CLAUDE_SESSIONDATA_ROOT` (`lib.sh`
  resolves `MIADI_SESSION_DIR`, `MIADI_SESSIONDATA_ROOT`, `SESSION_DATA_ROOT`, then
  `/src/_sessiondata`). `_sessiondata/scripts/token_counter.py` (jgwill/src), the Miadi
  `/token-usage` page, plan-insight and the session observers all read that layout.
- **The copies the token counter depends on.** `_responses_progressive.jsonl` (Stop),
  `_transcript_final.jsonl` and `agents/<id>.transcript.jsonl`. Claude Code deletes its own
  transcripts, subagent transcripts and tool-results after `cleanupPeriodDays` (default 30),
  and these copies are what remains. Earned in
  jgwill/binscripts@2064dd07858668206702214d0a8949d36c48befc.
- **The transcript archive** (`lib.sh`, `transcript_archive.sh`, since 0.1.3). Stop,
  SubagentStop and SessionEnd bring the session's copies up to date: the whole transcript to
  `_transcript_final.jsonl`, each subagent to `agents/<id>.transcript.jsonl` with
  `agents/<id>.meta.json`, and `tool-results/` and `session-memory/` at the same path. Each
  call sanitizes only the lines added since the last one (`.<copy>.offset` beside the copy),
  because sanitizing a 33 MB transcript whole takes 18 s. Stop and SubagentStop run it
  detached. A copy whose size changed since the last call was rewritten by an older hook still
  loaded in a running session, and is copied again rather than appended to (0.1.4).
  SessionStart sweeps every session of that user with a folder under the root, which
  catches sessions killed before SessionEnd and sessions the legacy hooks captured before the
  plugin (on gaia, 112 of 293 live sessions had no full copy on 2026-09-30).
  `tests/transcript-archive.sh` holds the rules, 25 checks.
- **Nothing on stdout.** Claude Code injects the stdout of SessionStart and UserPromptSubmit
  hooks into the conversation. The binding writer prints nothing.
- **SessionEnd returns at once.** Claude Code cancels SessionEnd hooks after 1.5 s and prints
  "Hook cancelled" on exit. `session_end_hook.sh` reads the agent's pid and command line, then
  runs everything else in a detached copy of itself. Work added to SessionEnd goes after the
  `--detached` line. Earned in 0.1.1.

## Where it is installed

- gaia, mia: installed on 2026-09-28 from this kit's marketplace, with the `hooks` block removed
  from `~/.claude/settings.json` (backup: `~/.claude/settings.json.bak.260928-before-a9-cutover`).
  Checked: a new session wrote each event once, with its pane and team.
- eury, mia: installed on 2026-09-30 from the GitHub marketplace (`jgwill/miadi-orchestration-kit`),
  with the 14 `claude_hooks` commands removed from `~/.claude/settings.json` (backup:
  `~/.claude/settings.json.bak.260930-before-session-observability`). They pointed at
  `/src/scripts/claude_hooks`, a copy last changed on 2026-07-16. The plugin writes the same 30
  capture files plus `agents/<id>.transcript.jsonl` and the binding line. The herdr
  `SessionStart` hook stays in `settings.json`.
- gaia, jgi: installed on 2026-09-30 from the GitHub marketplace, with the 14 `claude_hooks`
  commands removed from `~/.claude/settings.json` (backup:
  `~/.claude/settings.json.bak.260930-before-session-observability`). The herdr `SessionStart`
  hook stays. Checked: the resumed session and a headless session with a subagent wrote each
  event once, with Stop, SessionEnd, `_transcript_final.jsonl`, `agents/<id>.transcript.jsonl`
  and a start and end binding line (pane `%3`). The session that made the edit stopped
  capturing at the edit: Claude Code reloaded `settings.json` at once, and the plugin's hooks
  load only at the next start. Its last tool calls, its Stop and its SessionEnd were not written.
- gaia, ava: installed on 2026-10-06 from the GitHub marketplace (0.1.5), with the 14
  `claude_hooks` commands removed from `~/.claude/settings.json` (backup:
  `~/.claude/settings.json.bak.261006-before-session-observability`). They pointed at
  `/opt/binscripts/hooks/claude_hooks`. Checked: a headless session wrote each event once, with
  `_transcript_final.jsonl` and a start and end binding line.

An installed plugin is a copy in `~/.claude/plugins/cache/`. A change here reaches an installed
host only after the version in `.claude-plugin/plugin.json` and in the kit's
`.claude-plugin/marketplace.json` goes up, followed by
`claude plugin marketplace update miadi-orchestration-kit` and
`claude plugin update miadi-session-observability@miadi-orchestration-kit` on that host. Sessions
pick it up when they start.

## Cutover rule

When a host enables this plugin, remove the `hooks` block from that host's `settings.json`.
With both wired, every event fires twice. Cut over one user at a time, and only on that user's
word: their `settings.json` is theirs.
