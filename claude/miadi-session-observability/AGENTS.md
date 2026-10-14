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
- `hooks/claude_hooks/files_written.sh` and `tests/files-written.sh`: the files-written capture
  (0.1.11), 41 checks.
- `hooks/claude_hooks/publications.sh` and `tests/publications.sh`: the publication index
  (0.1.12), 43 checks.
- `tests/binding-agent.sh`: the binding line names the agent process of its own session, 4
  checks.
- `tests/binding-mission.sh`: the binding line names the miadi-run mission that started a
  session, 19 checks.
- `hooks/workspace_clone_guard.sh` and `tests/workspace-clone-guard.sh`: the workspace clone
  guard (0.1.13), 21 checks. A separate PreToolUse entry in `hooks.json`, so the capture
  scripts carried to `/opt/binscripts/hooks/claude_hooks` stay unchanged.

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
- **The files-written capture** (`lib.sh`, `files_written.sh`, since 0.1.11). Write and Edit
  had `proposed/` since the first hooks. A file written any other way (a Bash heredoc, `cp`,
  `mv`, a script, an MCP server) was captured nowhere: on 2026-10-11 a session wrote its PDE
  `input-prompt.md` with a heredoc and moved it into `.pde/`, and the session folder held no
  trace of it. PreToolUse marks the start of a Bash or MCP call, PostToolUse and
  PostToolUseFailure mark its end and queue a detached copy of each file whose inode changed
  between the marks to `written/<absolute path>`, with a line in `_claude_files_written.jsonl`.
  The hook adds one `jq` call and returns at once. `tests/files-written.sh` holds the rules,
  41 checks. jgwill/miadi-orchestration-kit#82 holds the Phase 2 proposals.
- **The publication index** (`lib.sh`, `publications.sh`, since 0.1.12). Artifact pages, GitHub
  issues, comments, pull requests and releases, commits checked in their tree, pushes and npm
  releases, one line each in `_claude_publications.jsonl` with the `tool_use_id` and
  `prompt_id`. `@miadi/hooks-interpreter` 0.5.0 reads it with the files-written index and the
  session's `_terminal_binding.jsonl` (jgwill/Miadi). `tests/publications.sh`, 43 checks.
- **Credential files are listed, never copied** (0.1.12). `written/` copies every text file a
  call wrote, and the sanitizer redacts token shapes, not a password on a line of its own. A
  file whose name says it holds credentials (`.env*` but not `.env.example`, keys,
  `.netrc`, `.pgpass`, `.npmrc`, cloud credentials, Terraform state) gets an index line with
  the note `not copied: its name says it may hold credentials` and no hash. The sanitizer
  redacts the password in `scheme://user:password@host` and in PHP `define('…PASSWORD…', …)`
  since 0.1.12, in every capture. `*.env` stays on the list although it also holds harmless
  files (`.hch/issue_N.env`): a missing copy costs less than a copied `prod.env`. Found
  by the first review of 0.1.12 (a `vercel env pull` would have copied a Neon URL with its
  password).
- **The binding line names its own session's agent** (0.1.12). `_tb_agent_pid` takes the
  nearest ancestor registered in `~/.claude/sessions/<pid>.json` for the hook's session id. A
  `claude -p` started inside another session is not registered there, and until 0.1.12 its
  binding line took the parent session's pid, name and command line (seen on 2026-10-11 with
  session `a8d71f4d`). `tests/binding-agent.sh`, 4 checks.
- **The binding line names the mission that started a session** (0.1.12). A seat that
  `skills/miadi-run` launched is told `Read <brief> whole first` by tide, the second prompt
  after `/mia-listen`. The first prompt naming a `…/<id>/prompt.md` with a
  `miadi-run/mission@1` mission.json beside it appends a `session.mission` line whose `mission`
  block holds the pinned prompt reference, version, sha256, trace and episode
  (`source: "prompt"`). `MIADI_RUN_MISSION` and `MIADI_RUN_HOME` in the agent's environment put
  the same block on every line (`source: "env"`). tide does not pass that variable into the
  pane today. It needs `tmux new-session -e` in tide-runtime, a change left to Guillaume.
  Settled with the miadi-run seat on 2026-10-11. `tests/binding-mission.sh`, 19 checks.
- **Nothing on stdout.** Claude Code injects the stdout of SessionStart and UserPromptSubmit
  hooks into the conversation. The binding writer prints nothing.
- **SessionEnd returns at once.** Claude Code cancels SessionEnd hooks after 1.5 s and prints
  "Hook cancelled" on exit. `session_end_hook.sh` reads the agent's pid and command line, then
  runs everything else in a detached copy of itself. Work added to SessionEnd goes after the
  `--detached` line. Earned in 0.1.1.

- **The workspace clone guard** (0.1.13). On 2026-09-27 a session committed and pushed
  miadisabelle/home from `/workspace/repos/miadisabelle/home`, while the repo is worked on in
  `/home/mia` (`/src/Miadi/config/stc-workspaces.json`). The next pull in `/home/mia` stopped
  on a rebase conflict on 2026-10-12. The guard refuses Write, Edit, MultiEdit, NotebookEdit,
  a Bash redirect, and `git commit` or `git push`, when the target lies in
  `<autoClonePath>/<owner>/<repo>/` and the config maps that repo to another localPath that
  exists on the host. Reads, `git fetch` and `git pull` stay open. The config is
  `$MIADI_SRC/config/stc-workspaces.json` (or `STC_WORKSPACES_CONFIG`). A host without
  `MIADI_SRC`, or without the file, has no guard and keeps the full capture (0.1.14).
  To work in a clone on purpose, the config's localPath changes first. jgwill/workspace#60.

## Not here: the session issue

The ilex prototype's two hooks, which open a GitHub issue at a session's first prompt and
comment on it at each exit (jgwill/binscripts branch `hooks/portable-session-dir`), are not in
this plugin, and will not be: this plugin records and never publishes. They are their own
plugin, `claude/miadi-session-issue`, opted into per session, specified in
`rispecs/chronicle-github-sessions-observability/`. It reads this plugin's files from the same
session folder (same root chain) and writes only its markers, its texts, `trace.log` lines and
`by: "hook"` lines in `_claude_publications.jsonl`. It carries a copy of
`hooks/secret_capture_sanitizer.sh`: when the sanitizer here changes, copy it there too.
jgwill/miadi-orchestration-kit#89.

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
- ilex (Termux, Pixel 2), u0_a194: installed on 2026-10-14 from the GitHub marketplace
  (0.1.14) by Guillaume. `settings.json` had no `hooks` block, so nothing was removed. The root
  is `MIADI_SESSION_DIR=/data/data/com.termux/files/srv/miadi/sessions`, from the shell
  environment (binscripts `etc/bash_env_common`), not from `settings.json` `env`. Checked: the
  session running at the install wrote each event once under that root, with its binding line
  (pane `%16`).

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
