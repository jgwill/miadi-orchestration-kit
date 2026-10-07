# packages/miadi/deb: agent notes

These packages set up a machine for the Miadi factory from apt: `miadi` (the host), `miadi-config`
(its MIADI_* settings), `miadi-terminal` (clickable chronicle references, and `enable restore` for
tmux sessions that survive a reboot), `miadi-tide` (the tide runtime and review loop) and
`miadi-tmux` (one tmux, 3.7c, in place of the distribution's), and beside them `miadi-music` with
`miadi-music-render`, `-measure` and `-video` (music for an album or an episode's score). README.md
says what each package holds and how to build, test and publish it.

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
7. Say what was published.

Never `apt install tmux` on a host with `miadi-tmux`: it removes `miadi-tmux`.
