# 01 · Reverse-engineer: one seat showing a person a timeline

Observed 2026-11-25 on gaia, in miadi-tmux://mia@gaia:t9-miadi-film-start-2611251354 (Claude Code
session `01Lt89t3inkuSJe8W45JZCES`, Claude Opus 5.5). Kit at `e9be0aa`. The record the seat wrote at the
time is `film/proposal-timeline-261124/agent-actions-261125.md` in Episode 120
(miadi-chronicle://120), commit `91518819` of the Chronicle.

## What the person asked

The computer had crashed on 2026-11-24 after the Episode 120 companion seat built a proposal timeline
(`variation-a.kdenlive`: 11 cards on V1, two music sketches on A1, an empty V2 "Kept by Guillaume",
90 s). Guillaume never saw it. On 2026-11-25 he asked a seat to find the workspace and open it, then
whether the seat could interact with it, then to play it through. Then he asked that every action the
seat took become a capability of the factory, and that what helps agents work in the production
programs with people be specified, built in the plugin, and inventoried.

## The actions, as they were done

No plugin carried any of them. Each was a shell command the seat composed.

| code | action | command | proof |
|---|---|---|---|
| C1 | find the film projects in the Chronicle, newest first | `find "$MIADI_CHRONICLE_ROOT" -name '*.kdenlive' -printf '%T+ %p\n' \| sort -r`, then each folder's README | 4 projects in 2 episodes; Episode 120's the newest |
| C2 | check the project is committed and unchanged | `git status --short`, `git log -1 -- <folder>` | clean, last commit `d373e889` |
| C3 | open it on the person's display | from the project's folder: `DISPLAY=:0 setsid nohup kdenlive <file> &` | pid 571907; window title names the file |
| C4 | raise and maximize the window | `xdotool search --name`, `wmctrl -b add,maximized_vert,maximized_horz`, `xdotool windowactivate` | screenshot |
| C5 | see the screen | `import -window root`, and a crop of the monitor's timecode | screenshot before and after every drive |
| C6 | ask what Kdenlive accepts over D-Bus | `qdbus org.kde.kdenlive-<pid>` on the session bus | 27 general actions (`file_open`, `file_save`, `file_revert`, `edit_undo`, `view_zoom_in` ...), nothing to seek, play or reach a guide |
| C7 | move the playhead | a click on the timeline ruler at a measured x | the project monitor showed card 05 at 0:30:08 |
| C8 | play from the start | C7 to 0:00, a click on the project monitor's play button | timecode 0:03, then 0:39 about 27 s later |
| C9 | check the sound reaches the speakers | `pactl list sink-inputs` | a `kdenlive` stream, not corked, not muted, during the first music cue |
| C10 | say where Kdenlive comes from | `dpkg -s miadi-film` | `Depends: kdenlive, ardour, ffmpeg, mediainfo, ...` |

## What the person's desktop added

- **H1 · One mouse for two.** `xdotool` moves the person's cursor and takes the focus. During playback
  his terminal sat over the timeline.
- **H2 · The layout moves between two looks.** Between two screenshots the bin panel switched tabs and
  the right panel changed. A coordinate read from one screenshot is stale in the next. C7 and C8 held
  only because a screenshot came just before each click.
- **H3 · Some acts are his.** In this timeline, dragging a card to V2 and saving is how he chooses. The
  seat did neither.

## What exists in the kit and on the host

| thing | state on 2026-11-25 |
|---|---|
| `miadi-film` deb 0.1.0 | installed on gaia. Brings Kdenlive 22.04.3, Ardour 6, ffmpeg, mediainfo, exiftool, sox |
| `claude/miadi-film` plugin 0.2.0 | `editing_room.py` (an episode's media in bins, timeline empty on purpose), `scenes_to_kdenlive.py` (stringouts), `verify_timeline.py` (melt render checks), `kdenlive_check.sh` (a **copy** on a **hidden** Xvfb display, saved and counted). Nothing that works on the person's own display, and no proposal timeline (X8 of `process-trace-261124.md`) |
| `proposal_timeline.py` | a prototype in Episode 120, `film/proposal-timeline-261124/`: a proposal written as data (`proposal.json`) becomes a filled timeline |
| on gaia | `xdotool`, `wmctrl`, `import` (ImageMagick 6), `pactl`, `melt`, `xvfb-run` present. `qdbus` and `dbus-run-session` come from an Anaconda tree in jgi's home, not from a package. MuseScore 3 present. The accessibility bus runs, but the Python bindings (`python3-pyatspi`, `gir1.2-atspi-2.0`) are not installed |
| the kit's capabilities | no `.miadi/` folder. `mw-repomap capabilities scan` finds 97 skills in the kit and nothing else: its kinds are `package`, `cli`, `skill`, `decision`, `app`. The kit's 20 Claude plugins, their commands, agents, hooks and MCP servers, and its deb packages have no kind |

## What Episode 120 already specifies

`rispecs/film-toolchain/` in Episode 120 holds seven specifications and a data drawing. Two touch this
work:

- `open-on-this-computer.spec.md` (proposed 2026-11-07, not built): a button on the episode's page opens
  Kdenlive or Ardour on the person's machine with a prepared project, and sends the cut back.
- Its principles 1, 2 and 6: people decide and agents prepare; edit a project file only while its
  program is closed, on a copy first; a person works from the page, never from a terminal.

None of them says what an agent does **inside** a program a person has open, while the person watches.
