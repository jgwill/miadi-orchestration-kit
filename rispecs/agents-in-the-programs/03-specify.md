# 03 · Specify

Capability `miadi-capability://jgwill/miadi-orchestration-kit/plugin/miadi-film`.
The [Stateloom system](./agents-in-the-programs.sysdf.json) draws the Kdenlive review scenario
covered by S1, S3–S5, S7 and S8.

Nine specifications. Each says what exists when it holds, independent of the code that first carried it
(`claude/miadi-film/scripts/film_desk.py`, plugin 0.3.0). Episode 120's film-toolchain principles hold
throughout, in particular: people decide and agents prepare (1), a project file is edited only while its
program is closed, on a copy first (2).

## S1 · Three kinds of act

Every act an agent takes in a production program belongs to one group, and the group sets its rule.

| group | what it changes | rule |
|---|---|---|
| look | nothing | free. Any agent may run it at any time |
| drive | what the person sees: the playhead, the zoom, the window in front | the agent says in the conversation what it is about to do before the first drive of a sequence, and looks after each drive |
| write | the project: save, reload, an edit, a render that replaces a file | only when the person asked for that act in this conversation, or on a new file the person has not opened |

A verb that does not know its group is a write. Quitting the program, deleting, cutting and pasting are
the person's own and no verb offers them.

## S2 · Finding the projects

`list` shows the production projects of the Chronicle (`*.kdenlive`, `*.ardour`, `*.mscz`, `*.mscx`
under `$MIADI_CHRONICLE_ROOT`), newest first, each with its kind read from the file beside it:
`proposal.json` a proposal timeline, `room.json` an editing room, `scenes.json` a stringout, else a
project. The kind comes from the producer's own record, never from a guess on the name.

## S3 · Opening on the person's display

`open PROJECT`:

1. says the project's git state (committed and unchanged since a named commit, modified, untracked, or
   outside git) before anything opens;
2. raises the window when the program already has this project open, and never opens it twice;
3. starts the program from the project's folder, because media paths in these projects are relative to
   it, detached from the agent's shell so the program outlives the agent's turn;
4. waits for the window that names the project, then maximizes and raises it, and says plainly when no
   window manager answers (a hidden display);
5. refuses, naming what is missing, when the program is not installed.

The display is `MIADI_FILM_DISPLAY`, else `DISPLAY`, else `:0`.

## S4 · Looking

- `look` takes a screenshot of the display, or of the program's window, and gives its path. The agent
  reads it. A report to the person of what is on screen comes from a look taken after the last drive.
- `sound` says whether the program has a sound stream open, and whether it is corked or muted.
- `probe` names the window, the process, and for Kdenlive every action it accepts by name (775 in
  Kdenlive 22.04.3).

## S5 · Driving Kdenlive by name

Kdenlive's main window answers `org.kde.KMainWindow.activateAction <name>` on the session bus
(`org.kde.kdenlive-<pid>`, object `/kdenlive/MainWindow_1`). Every drive goes through it. No screen
coordinate, no synthetic key.

| verb | action |
|---|---|
| `play` | `monitor_play`; with `--from-start`, `seek_start` first |
| `pause` | `monitor_pause` |
| `seek start` / `seek end` | `seek_start` / `seek_end` |
| `seek next-guide` / `seek prev-guide` | `monitor_seek_guide_forward` / `monitor_seek_guide_backward` |
| `seek +N` / `seek -N` | `monitor_seek_forward-one-second` / `monitor_seek_backward-one-second`, N times (at most 600) |
| `action NAME` | any action `probe` lists, except the write and the person's own acts of S1 |

Guides are the stage marks of a proposal timeline, so `seek next-guide` is how an agent walks a person
through its stages.

## S6 · Ardour and the music programs

The same verbs, with what each program offers named rather than hidden.

- **Ardour** (Ardour 6 on gaia): `open`, `look`, `sound`, `raise` as S3 and S4. Drive presses Ardour's
  own keys on its activated window (`space` play and pause, `Home`, `End`) until its name-based route is
  measured: Ardour's OSC surface (UDP 3819, enabled in the session's preferences) and its Lua scripting
  are that route. A drive by keys moves the person's focus (H1 of `01`).
- **MuseScore** (3 on gaia): `open`, `look`, `sound`, `raise`, and `play` by `space`. MuseScore has no
  remote interface measured here.
- **The other music tools** of the production (the ABC sketches of `music/`, the `miadi-music` packages)
  render files and have no window to drive. Which further programs agents work in with the person is
  question Q1 of `STATUS.md`.

A verb a program cannot honour is refused with the reason, never imitated with a coordinate.

## S7 · Writing

- `save` and `reload` act on the project the person has open, and run only with `--person-asked`.
  Kdenlive's reload asks to confirm on screen. The person answers that dialog.
- An agent's proposal is a **new file** beside the project (a variation, a stringout, a room), written
  while no program has it open, then opened with `open`. A proposal never overwrites a file a person has
  opened (film-toolchain principle 2). The proposal timeline of Episode 120 (`proposal_timeline.py`,
  `proposal.json` → `variation-a.kdenlive`) is the prototype of this act, to be carried into the plugin as
  its own skill.
- The person's choice inside the program (a card dragged to the kept track, a save) is read from the saved
  file after the person says they saved. Nothing in this specification watches the file.

## S8 · The acts log

Every act is a line in one log per host and user, `MIADI_FILM_ACTS_LOG`, default
`~/.local/state/miadi-film/acts.jsonl`:

```json
{"at": "2026-11-25T19:28:32+00:00", "host": "gaia", "user": "mia", "display": ":0",
 "verb": "seek", "group": "drive", "argv": ["seek", "next-guide"],
 "project": "/srv/miadi/.../variation-a.kdenlive", "episode": "2026-07-10-episode-120-...",
 "tmux_pane": "%12", "seat": null, "result": "kdenlive action monitor_seek_guide_forward x1"}
```

- The verbs write their own lines, refusals included.
- A hook writes a line for every shell command an agent runs that touches a display or a production
  program outside the verbs (`xdotool`, `wmctrl`, `import -window`, `DISPLAY=`, `qdbus` or `dbus-send` to
  `org.kde.kdenlive`, `pactl`, a program started by hand), with `"group": "improvised"`, the command and
  the session id. These lines are where the next capability comes from: a set of improvised lines that
  repeats across sessions is a verb to add.
- `acts --episode <n>` reads the log for one episode. An episode keeps what matters from it by writing
  its own record (as Episode 120 did in `agent-actions-261125.md`), never by committing the raw log.

## S9 · The inventory

- The kit holds `.miadi/capabilities.jsonl` (schema `medicine-wheel/repository-capabilities`), written by
  `mw-repomap capabilities scan --write` and enriched by `mw-repomap capabilities state` with what a
  capability achieves, its stage, its specification (`rise://...`), its issue and its episodes.
- Every Claude plugin, command, agent, hook, MCP server and deb package of the kit has a record, beside its
  skills. Until `mw-repomap` knows those kinds (it knows `package`, `cli`, `skill`, `decision`, `app`),
  they are listed in this specification's `STATUS.md` as the inventory's missing kinds, and the
  extension of the scanner is the next act of `04-export.md`.
- An episode lists the capabilities it brings into being, revises or uses under `capabilities:` in its
  `episode.yaml`, each by its `miadi-capability://` address, with evidence.
