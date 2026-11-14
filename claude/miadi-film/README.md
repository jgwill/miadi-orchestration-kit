# miadi-film (Claude Code plugin)

Film work for agents on a Miadi host. The `miadi-film` deb (`packages/miadi/deb/miadi-film/`) installs the
tools (Kdenlive, Ardour, ffmpeg). This plugin carries what an agent needs to repeat the work done with
them: a skill, its scripts and a command.

| part | what |
|---|---|
| `skills/scenes-to-timeline/` | cut videos into scenes, lay them on a Kdenlive timeline with black between them, check it, land it in an episode |
| `commands/scenes-timeline.md` | `/scenes-timeline <episode> [video ...]` runs the whole pass |
| `scripts/scenes_to_kdenlive.py` | writes one `.kdenlive` per video and `scenes.json` |
| `scripts/verify_timeline.py` | renders each project through melt and checks its length, each black and the silence under it |
| `scripts/kdenlive_check.sh` | opens a copy in Kdenlive on a hidden display, saves it, counts what Kdenlive kept, takes a screenshot |

First use: Episode 575 (miadi-chronicle://575), `film/deepdiver-scenes-261113/`, on 2026-11-13. The film's
home is Episode 120 (miadi-chronicle://120). Issue: jgwill/miadi-orchestration-kit#153.

Install from this kit's marketplace:

    claude plugin install miadi-film@miadi-orchestration-kit

## Runtime floor

`miadi-film` 0.1.0 (Kdenlive 21.12 or later, melt 7, ffmpeg 4.4 or later for `scdet`), Python 3.8. The
Kdenlive check also needs `xvfb-run`, `dbus-run-session` and ImageMagick's `import`. Each script names what
is missing and stops.

## For the next revision of the miadi-film package

Found on hu on 2026-11-13. The package does not install these yet:

- **xvfb**: without it, Kdenlive cannot run on a hidden display. hu's `Xvnc` is RealVNC and refuses to start
  without a license, and Kdenlive 21.12 crashes on Qt's `vnc` and `offscreen` platforms. gaia has Xvfb.
- **imagemagick** (`import`): the screenshot of the check. Present on both hosts, through other packages.
- **One Kdenlive version on every host**: gaia runs 22.04.3 from the Kdenlive PPA, hu 21.12.3 from Ubuntu.
  The projects are written in format 1.04, which 22.04 writes.
