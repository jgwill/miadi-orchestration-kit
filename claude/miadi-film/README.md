# miadi-film (Claude Code plugin)

The production team's (T6) assistant editor. The `miadi-film` deb (`packages/miadi/deb/miadi-film/`)
installs the tools (Kdenlive, Ardour, ffmpeg). This plugin carries the role that uses them: in a film, the
assistant editor prepares the editing room, receives the media, sorts and labels it, logs what is said in it,
lays out stringouts, and hands the editor and the director a project they can open. The editor and the
director make the choices. T6's other plugin, `miadi-deepdiver`, makes media; this one prepares it for editing.

| part | what |
|---|---|
| `agents/assistant-editor.md` | the role: prepares an episode's editing room and its stringouts, checks them, writes the room sheet, never makes the editor's choices |
| `skills/editing-room/` | every medium of an episode in one Kdenlive project's bins, with its address and first words, takes fetched by sha256, the room sheet |
| `skills/scenes-to-timeline/` | a video cut into its scenes on a stringout, black between them, an empty music track, a guide at each black |
| `commands/editing-room.md` | `/editing-room <episode> [--fetch-from <host>] [--scenes]` |
| `commands/scenes-timeline.md` | `/scenes-timeline <episode> [video ...]` |
| `scripts/editing_room.py` | writes `room.kdenlive`, `room.json` and the room sheet |
| `scripts/scenes_to_kdenlive.py` | writes one stringout `.kdenlive` per video and `scenes.json` |
| `scripts/verify_timeline.py` | renders each stringout through melt and checks its length, each black and the silence under it |
| `scripts/kdenlive_check.sh` | opens a copy in Kdenlive on a hidden display, saves it, counts what Kdenlive kept (tracks, bin, markers), takes a screenshot |

First use: Episode 575 (miadi-chronicle://575) on 2026-11-13, `film/editing-room-261113/` and
`film/deepdiver-scenes-261113/`. The film's home is Episode 120 (miadi-chronicle://120). Issue:
jgwill/miadi-orchestration-kit#153.

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
