---
name: session-continuity
description: >
  T1's practice: after a reboot or an exit, every terminal still knows which agent session it
  held, and the agents come back. The binding line (which pane, command line, name history and
  team each Claude session has), tmux save and restore with visible screens, tide naming the
  agent in each pane and bringing it back, and rebuilding what each pane held after a crash.
  Use when a machine rebooted or crashed, when tmux came back with empty shells, to find which
  agent session ran in a tmux session or pane, to resume or relaunch agents, to read
  terminal_bindings.jsonl, to run `tide agents list` or `tide agents restore`, to set a
  session's team, or to check that save and restore work. Triggers on "rebooted", "crashed",
  "restore the sessions", "which agent was in", "resume the agents", "binding line",
  "tide agents", "tmux-resurrect", "session continuity".
metadata:
  type: skill
  version: 1.1.0
  team: T1 session continuity
---

# Session continuity

Earned on 2026-09-28, when gaia crashed on Sunday at 19:31:47 and booted nine times on Monday.
Tmux came back with 67 empty shells from a save 30 hours old. Nothing said which agent
conversation had run in which terminal, and 29 agents had been running.

William's outcome for this practice: "Picture that I'm rebooting my computer and when it comes
back up, all of the sessions are the same way that they were. I should not even know that the
computer rebooted."

## The four parts

| part | what it keeps | where |
|---|---|---|
| binding line | each Claude session's id, tmux `session:window.pane`, pane id, command line, name history, team, chronicle episode | this plugin's `hooks/claude_hooks/terminal_binding.sh`, written to `<root>/data/terminal_bindings.jsonl` |
| tmux save and restore | layout, folders, visible screens, saved every 15 minutes by `tmux-save.timer`; the server started at boot by `tmux-server.service` | `jgwill/gaia` `linux_migration/14-tmux-resurrect.sh` and its two hooks; on a new machine `miadi-terminal enable restore` (apt) |
| tide | the agent in each pane, every 60 s, and the relaunch after a restore | `ironsilk` 0.9.40 and later (claude, hermes, pi), `tide agents list`, `tide agents restore`; apt `miadi-tide` |
| one tmux | 3.7c everywhere: a client of another version cannot attach | apt `miadi-tmux` |
| recovery list | what each pane probably held, when the three above had nothing | built by hand as in "After a crash" below |

`<root>` is `CLAUDE_SESSIONDATA_ROOT`, else `MIADI_SESSION_DIR`, `MIADI_SESSIONDATA_ROOT`,
`SESSION_DATA_ROOT`, else `/src/_sessiondata`.

## Read what a pane holds

```bash
tide agents list                       # running, exited or lost, per pane of the running tmux
jq -c 'select(.tmux.session == "<tmux session>") | {at, event, session_id, name: .name.name, team}' \
  /src/_sessiondata/data/terminal_bindings.jsonl | tail
```

`state: running` comes from the pane's process tree and `~/.claude/sessions/<pid>.json`.
`exited` and `lost` come from the pane's last binding line since the tmux server started. The
session name changes with `/rename`, and every change is a `session.rename` line.

## What happens at a restore

1. `tmux-server.service` starts the tmux server at boot, once the desktop login has imported its
   environment, after pointing a dangling `last` at the newest save. tmux-continuum restores the
   last save: panes in their folders, with their visible screens.
2. The `post-restore-all` hook (`tmux-restore-agents.sh`) starts `tide agents restore`.
3. tide reads its last snapshot with panes from before this tmux server started. It relaunches
   the agents that were running, with their launch alias and `--resume <id>`, 10 seconds apart.
   The most recently active ones that fit above 16 GiB of available memory (512 MiB counted
   each, `--agent-memory-mb`) start, oldest of them first, so the last one resumed is the one
   that was active last and the session list on William's phone keeps its order (ironsilk
   0.9.40, 2026-10-07). The others get their command typed without Enter. An agent that had
   exited starts nothing and gets nothing typed: its pane keeps a note (the pane option
   `@miadi-resume`), `tide agents list` shows it `exited`, and `tide agents resume [pane]`
   brings it back when the human chooses (William, 2026-10-07).
4. It runs once per tmux server start. A second hook call answers "already restored".

Try it without touching anything: `tide agents restore --dry-run --force`.

## Set it up on a machine

- gaia-style host, from the scripts: `jgwill/gaia` `linux_migration/14-tmux-resurrect.sh`.
- Any Ubuntu machine, from apt (`packages/miadi/deb` in this kit):
  `sudo apt install miadi miadi-terminal`, then once per user `miadi-terminal enable restore`.
  `miadi` pulls `miadi-tmux` (3.7c) and `miadi-tide`. Linger keeps tmux starting at boot:
  `sudo loginctl enable-linger <user>`.
- `packages/miadi/deb/test-install.sh` runs the whole cycle in a clean ubuntu:22.04, and
  `tests/session-continuity-sync.sh` there keeps the package's copies in step with gaia's.

## After a crash

1. Find the first crash, not the last boot: `journalctl --list-boots`. A crash loop makes the
   last boot misleading, and tmux may already have restored once between two boots.
2. Find tide's last snapshot before that crash:
   ```bash
   sqlite3 -readonly ~/.miadi/navigator/context/snapshots.sqlite3 \
     "select timestamp from context_snapshots where timestamp < '<crash, UTC>' order by timestamp_epoch desc limit 1"
   ```
   Copy it out before anything restarts the daemon: `latest.json` is overwritten every minute, and
   the store keeps 7 days.
3. If that snapshot names agents (tide 0.9.35 and later), `tide agents restore --force` brings
   them back. If it does not, build the recovery list: for each tmux session in the snapshot,
   the Claude transcripts whose folder matches, with their `/rename` name, the inventory record
   that names the tmux session, and any `--resume <id>` in the tmux save. Call them candidates. A
   shared folder cannot tell which pane held which session.
4. Compare the snapshot with what tmux restored. Sessions created after the last save are
   missing, and sessions closed before the crash come back. Closing or recreating them is the
   human's decision. Panes the restore itself added, idle shells that no snapshot names, are
   yours to remove.

When tmux did not come back by itself (2026-10-03, jgwill/gaia#90):

1. `readlink ~/.local/share/tmux/resurrect/last`. A crash during a save can leave it naming a
   file that is not on disk. Point it at the newest save whose sessions match tide's last snapshot.
2. Start the server through the unit, never from an agent's shell (it would hand that shell's
   environment, `CLAUDECODE` included, to every pane): `systemctl --user start tmux-server.service`.
3. Wait for `~/.miadi/navigator/restore/agents-*.jsonl` to list every step, then
   `tide agents list`. Every relaunched pane should show `running` with its own session id.
4. Compare the pane addresses with the snapshot's. The agents that were not running are noted,
   not started. Give the human the session list to confirm.

## Checks that proved each part

- Binding line: in one pane of a private tmux server (`tmux -L <name> -f /dev/null`), running
  start, `/rename`, `/clear`, exit, resume and exit writes seven lines at the same pane
  address, each with the right session id.
- tmux: on a private server with its own save folder, save, kill and restore bring panes back
  in their folders with their screens, a pane with an empty title included.
- tide: an agent launched with an alias that adds tools, then a snapshot, a save, a kill and a
  restart. The pane resumes the same session with the same MCP configs.
- Team: `bash tests/team-resolution.sh` in this plugin.
- Episode: `bash tests/episode-resolution.sh` in this plugin.

Never test against the live tmux server. Starting a private server loads the same plugins, and
its `run-shell` jobs get `TMUX` for that server, so they stay on it.

## Rules earned

- Pane ids (`%N`) are renumbered every time the tmux server starts. Find a pane by
  `session:window.pane`.
- tmux-resurrect merges an empty field into the next one (`IFS=$'\t' read`). A pane whose
  title is empty, which is every pane whose Claude session exited, lost its folder until
  `tmux-resurrect-repair-save.sh` wrote a one-space title.
- Capturing full scrollback blocks every pane of the server for about 1.4 s per 47,000 lines.
  Capture the visible screen, which takes 13 ms.
- A stale pid can be a thread id. `os.kill(pid, 0)` accepts it, and `ps -p` does not show it.
  Only a process whose `Tgid` equals its pid and whose command line is the daemon counts.
- After a reboot the tide daemon records empty snapshots until tmux runs. Look for the last
  snapshot with panes.
- No hook fires on `/rename`. The prompt and stop hooks compare the name with the last one
  written.
- Claude Code removes `~/.claude/sessions/<pid>.json` before SessionEnd runs, so the end line
  keeps the last name written.
- An exited agent is never relaunched by itself, and nothing is typed into its pane. The pane
  keeps a note, and `tide agents resume` brings it back on a person's choice.
- A resumed hermes writes no binding line until its first turn. tide sees it running from its
  command line (`hermes --resume <id>`), as it sees `pi --session <id>`.
- tmux splits a target at its first colon, and miadi names sessions after circle ids
  (`circle:1791110394383:jj1ql8`). `miadi-tmux` 3.7c-2 resolves a target to the longest prefix
  that names a session, so such a session is reached by its name. A server started before that
  package keeps the old lookup: use the session id (`tmux attach -t '$84'`).
- A message the human sends while an agent is working is stored in the transcript as an
  `attachment` of type `queued_command`, not as a `user` record. The hook capture
  `_claude_user_inputs.jsonl` has it.

Earned 2026-10-03 (jgwill/gaia#90):

- Nothing starts a tmux server after a boot unless something is set to: continuum restores only
  when a server starts. `tmux-server.service` is that something.
- continuum saves from the status line, so only while a client is attached. Saves came 30 to 75
  minutes apart. `tmux-save.timer` saves on time and syncs the save to disk.
- Two `run .../tpm/tpm` lines load continuum twice, and each load restores once more: four
  restores split 32 empty panes into 19 sessions. Load the plugins once.
- A tmux client cannot attach to a server of another version: a 3.7c client against a 3.2a server
  answers "open terminal failed: not a terminal". One tmux per machine (`miadi-tmux`).
- `apt install tmux` on a host with `miadi-tmux` removes `miadi-tmux`.
- tide's snapshot, every minute, is closer to the crash than the last save: compare the two before
  restoring.

## Teams

Every session belongs to one team, and the binding line says which one and how it was found:
`{"id": "T1", "source": "session"}`. The order is a declared team (`MIADI_TEAM`, or
`tmux set-option -t <session> @miadi-team T1`), then the session names in `teams/teams.json`,
then its folders (the longest prefix wins), then its name patterns, else `unassigned`. The list
is `MIADI_TEAMS_FILE`, else `$MIADI_ORCHESTRATION_KIT_ROOT/teams/teams.json`. Keep it in step
with `teams/README.md`. Naming a new team is William's.

## Episodes

The binding line also names the chronicle episode a session works in, so an episode can list
its terminals: `{"id": "2026-09-27-episode-548-...", "source": "cwd"}`. An episode is a
directory directly under `MIADI_CHRONICLE_ROOT` named `<yyyy-mm-dd>-episode-<n>-<slug>`. The
order is a directory given with `--add-dir` (`add-dir`), then the agent's folder (`cwd`), then
`MIADI_CHRONICLE_PROD_EPISODE` (`declared`), else `null`. The variable comes last because every
shell exports it: alone it names the episode in production, not the one the session works in.

## Related

- jgwill/binscripts#158, jgwill/gaia#89, jgwill/Miadi#691, jgwill/miadi-orchestration-kit#56
- Proposal pages: Tmux Agent Restore (https://claude.ai/artifact/Hu5WwqkWTsGQuwESxwmD5q) and
  Session Observability Plugin (https://claude.ai/artifact/8mGQMnj4niSUdVayYSDYk8)
- Publishing tide: `runtime/tide-runtime/RELEASE.md` in jgwill/Miadi, "Publishing from gaia"
