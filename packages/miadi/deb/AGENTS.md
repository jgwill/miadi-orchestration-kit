# packages/miadi/deb: agent notes

These packages set up a machine for the Miadi factory from apt: `miadi` (the host), `miadi-config`
(its MIADI_* settings), `miadi-terminal` (clickable chronicle references, and `enable restore` for
tmux sessions that survive a reboot), `miadi-tide` (the tide runtime and review loop),
`miadi-tmux` (one tmux, 3.7c, in place of the distribution's), `miadi-claude` (one command that
sets up Claude Code for an account), `miadi-perms` (group read and
write on the shared session capture every 4 hours), `miadi-chronicle-server` (the chronicle's host
services) and, for any machine, `miadi-chronicle-client` (the chronicle's commands and MCP servers),
both run by `miadi-node` (a private Node.js 24), and beside them `miadi-music` with
`miadi-music-render`, `-measure` and `-video` (music for an album or an episode's score), `miadi-film`
(Kdenlive, Ardour and the media tools for a film made with an episode), and for
the maintainer's host `miadi-feedback` (an issue on the kit wakes a seat, jgwill/miadi-orchestration-kit#109).
README.md says what each package holds and how to build, test and publish it.

## Relationship with jgwill/gaia

jgwill/gaia `linux_migration/` is where host work is done first, by hand, as numbered scripts.
These packages carry what a new machine needs from it.

- **Session continuity (team T1, jgwill/gaia#90):** `miadi-terminal`'s
  `usr/share/miadi-terminal/session-continuity/` and `usr/lib/systemd/user/` are copies of what
  gaia's `14-tmux-resurrect.sh` installs. `tests/session-continuity-sync.sh` checks them against a
  gaia checkout. Run it after a change on either side, and change both in the same session.
- **The practice** is the `session-continuity` skill in `claude/miadi-session-observability`. The
  team is T1 in `teams/README.md`.

## Finishing is publishing

William, 2026-10-03: "This is always something you have to do. You don't need to come back to me
with it depends on you publishing it." A change to a package is finished when all of these are done:

1. Bump `Version:` in its `DEBIAN/control`.
2. Commit and push.
3. Build with `bash build.sh <package>`.
4. Run `bash test-install.sh dist/...` in a clean ubuntu:22.04.
5. Publish in dependency order (README.md, "Build, test, install"), with the token in
   `~/.config/sanctuaire-apt.env`.
6. Install on gaia: `sudo apt-get install --no-install-recommends <package>`.
   A package that serves the Miadi web app, such as `miadi-server`, is not installed on a host that
   runs the app from a source build, gaia included. It goes on the hosts that run the app from the package.
7. Say what was published.

A Termux build (`termux/<package>`) is published by its push: a phone with
`miadi-termux` 0.3.0 or later builds every Termux version it lacks from
origin/main before each `apt update`, and `apt upgrade` installs it
(termux/README.md). So bump its version before pushing: the package's own
`Version:`, or for a build of an Ubuntu package the Ubuntu version or a Termux
revision (`Version: @VERSION@-1`). A `miadi-tide` change that moves ironsilk or
`prep/miadi-tide.constraints.txt` also changes
`termux/miadi-tide/prefix/share/miadi-tide/requirements.txt`; run
`MIADI_SRC=... bash tests/termux-tide-pins.sh`.

Never `apt install tmux` on a host with `miadi-tmux`: it removes `miadi-tmux`.
