---
name: in-the-program
description: Work in a production program (Kdenlive first, Ardour and MuseScore in part) on the person's own display while they watch. Find the episode's film projects, open one, show it, play it, walk its guides, check the sound, and save or reload only when the person asks, through film_desk.py, which reaches Kdenlive by action name over D-Bus rather than by screen coordinates and logs every act. Use when asked to "open the timeline", "find the workspace with the timeline and open it", "show me the project", "can you interact with it", "play it", "go to stage 2", "next guide", "pause", "is there sound", "open it in Ardour / MuseScore", or after a crash when a person never saw what an agent prepared.
---

# In the program, with the person

The editor and the director work in Kdenlive and Ardour. This skill is what an agent does in those programs
**while the person watches**: it opens, shows, moves, plays and listens, and leaves every choice to them.
Preparing a project is the `editing-room` and `scenes-to-timeline` skills. Specification:
`rispecs/agents-in-the-programs/` of this kit (rise://jgwill/miadi-orchestration-kit/rispecs/agents-in-the-programs/03-specify.md).
Born in Episode 120 (miadi-chronicle://120) on 2026-11-25, when a person had not seen a proposal timeline
because the computer crashed.

## Before you start

`miadi-film` 0.1.0 (Kdenlive, Ardour), plus `xdotool`, `wmctrl`, ImageMagick's `import`, `pactl` and
`dbus-send` on the host whose display the person is in front of. The script names what is missing and stops.

```bash
D="${CLAUDE_PLUGIN_ROOT}/scripts/film_desk.py"
python3 "$D" --help
```

The display is `MIADI_FILM_DISPLAY`, else `DISPLAY`, else `:0`. A seat started from tmux usually has no
`DISPLAY`: `:0` is the person's screen on a desktop host.

## Three kinds of act

| group | verbs | rule |
|---|---|---|
| look | `list`, `open`, `look`, `sound`, `probe`, `acts` | free |
| drive | `raise`, `play`, `pause`, `seek`, `action NAME` | say what you are about to do before the first drive of a sequence. It moves what the person sees and may take their focus. Look after each drive |
| write | `save --person-asked`, `reload --person-asked` | only when the person asked for that act in this conversation |

Never quit the program, delete, cut or paste for the person. Never edit a project file while its program has
it open (film-toolchain principle 2 of Episode 120). An agent's proposal is a **new file**, opened after it is
written.

## The order

1. **Find.** `python3 "$D" list` shows every Kdenlive, Ardour and MuseScore project in the Chronicle,
   newest first, with its kind (proposal timeline, editing room, stringout). Read the README beside the
   one you choose: it says what the project is for and what the person does in it.
2. **Open.** `python3 "$D" open <project>` says the project's git state, then opens it on the display,
   maximized, or raises it when it is already open.
3. **Look.** `python3 "$D" look` and read the screenshot. Say what is on screen from the screenshot, not
   from what you expected.
4. **Drive, saying so.** "I'm moving the playhead to the start of stage 2." Then
   `python3 "$D" seek next-guide` (guides are the stages of a proposal timeline), `play --from-start`,
   `pause`, `seek +N`. Look again.
5. **Listen.** `python3 "$D" sound` says whether the program sends sound and whether it is muted.
6. **Write only on their word.** `save --person-asked` after the person said "save it". Kdenlive's
   `reload --person-asked` shows a confirmation the person answers.

`action NAME` reaches any of Kdenlive's 775 actions by name (`probe --all` lists them), except the write and
destructive ones, which it refuses.

## Kdenlive, Ardour, MuseScore

- **Kdenlive**: every drive is `org.kde.KMainWindow.activateAction` on `org.kde.kdenlive-<pid>`. No coordinate,
  no key.
- **Ardour and MuseScore**: `open`, `look`, `sound`, `raise` as for Kdenlive. Their drives press the program's
  own keys on its activated window, which takes the person's focus, so say so first. A verb a program does not
  offer is refused with the reason.

## The acts log

Every verb writes a line to `~/.local/state/miadi-film/acts.jsonl` (or `MIADI_FILM_ACTS_LOG`), refusals
included. This plugin's PostToolUse hook adds a line, as `improvised`, for any shell command you run that
touches a display or a program outside the script. Those lines are how the next verb gets found: if you had to
improvise, say what and why in the episode. `python3 "$D" acts --episode <number>` reads one episode's acts.

## Hazards of a person's desktop

- **One mouse for two.** If the person is working in the window, wait. A drive that takes the focus lands
  where their layout is.
- **The layout moves.** Never reuse a coordinate from an earlier screenshot. Kdenlive needs none.
- **Their choice is theirs.** In a proposal timeline, dragging a card to the kept track and saving is how they
  choose. Read the choice from the saved file after they say they saved.

## Checked

`scripts/film_desk_check.sh <project.kdenlive>` runs every verb on a copy, in Kdenlive on a private display
and a private D-Bus session, and keeps a screenshot after each drive. First run 2026-11-25 on gaia (Kdenlive
22.04.3): 18 of 18, the monitor at the Stage 2 guide after two `seek next-guide`.
