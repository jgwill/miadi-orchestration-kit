# Machine Setup and Recovery

Team T1's practice: after a reboot or a crash, every terminal still knows which agent session it held, and the agents come back. The canonical text is the `session-continuity` skill in [`claude/miadi-session-observability`](../claude/miadi-session-observability/skills/session-continuity/SKILL.md). The packages are in [`packages/miadi/deb`](../packages/miadi/deb/README.md).

## Set up a host

1. Add the apt repository (lines in the [README](../README.md#apt-packages)), then `sudo apt install miadi miadi-terminal`. `miadi` brings `miadi-tmux`, `miadi-tide` and `miadi-chronicle-server`.
2. Once per user: `miadi-terminal enable` for clickable references and `miadi-terminal enable restore` for tmux restore.
3. `sudo loginctl enable-linger <user>`, so tmux starts at boot.
4. In Claude Code, install `miadi-session-observability` and `miadi-chronicle-episode-kit` from the kit's marketplace. In the same step, remove the `hooks` block from `~/.claude/settings.json`, or every event is captured twice. Restart running sessions, since plugin hooks load at session start.

`packages/miadi/deb/test-install.sh` runs this cycle in a clean Ubuntu 22.04.

## What a restore does

1. `tmux-server.service` starts tmux at boot, and tmux-continuum restores the last save: panes in their folders, with their screens.
2. The `post-restore-all` hook starts `tide agents restore`.
3. tide reads its last snapshot from before this tmux server started and relaunches the agents that were running, with their launch alias and `--resume <id>`, 10 seconds apart and oldest first, within the memory it allows. The rest get their command typed without Enter. An agent that had exited stays a note in its pane until `tide agents resume [pane]`.
4. A session closed after the last save comes back as a shell, and tide closes it again when its snapshot no longer names it.

Dry run, touching nothing: `tide agents restore --dry-run --force`. State: `tide agents list`.

## After a crash

1. Find the first crash, not the last boot: `journalctl --list-boots`.
2. Find tide's last snapshot before it in `~/.miadi/navigator/context/snapshots.sqlite3`, and copy it out before the daemon restarts. `latest.json` is overwritten every minute.
3. `tide agents restore --force` brings back the agents that snapshot names.
4. Compare the snapshot with what tmux restored. Recreating sessions made after the last save is the human's decision.

If tmux did not come back by itself, check `~/.local/share/tmux/resurrect/last`, then start tmux with `systemctl --user start tmux-server.service`, never from an agent's shell. The skill's section "After a crash" has every command.

## Where this meets an episode

The binding line names the episode each session works in, so an episode can list its terminals.
