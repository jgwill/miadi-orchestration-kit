---
name: scenes-to-timeline
description: Cut one or more videos into their scenes and lay the scenes on a Kdenlive timeline with a pause of black between them (6 s unless asked otherwise), the scene's sound under its picture, an empty "Music (later)" track and a guide at each pause, so an editor and a composer can work on it. Checks the project through melt and in Kdenlive itself. Use when asked to "cut the deep diver into scenes", "put each scene on the timeline", "black between the scenes", "leave room for music or silence", "prepare a timeline for the composer", or to make a Kdenlive project from an episode's videos.
---

# Scenes to timeline

The first film work done this way was Episode 575 (miadi-chronicle://575) on 2026-11-13: the two Deep
Diver explainers of notebook ee40e1cb, cut at each change of picture, 6 s of black between scenes, in
`film/deepdiver-scenes-261113/` of that episode. Its README is the worked example and its tables are what
the composer reads.

The film's home is Episode 120 (miadi-chronicle://120). Its phase plan said agents only add markers and the
editor makes every cut. Here the person asked for the cuts, so the agent makes them as in and out points on
the source: nothing is re-encoded, and the editor moves, trims or deletes any of them. Say in the project
notes who prepared it (`--note`): a proposal until a person keeps it.

## Before you start

- The `miadi-film` package (`miadi-film check` exits 0): Kdenlive, melt, ffmpeg 4.4 or later (the `scdet`
  filter), ffprobe.
- Python 3.8 or later, standard library only.
- For the Kdenlive check: `xvfb-run`, `dbus-run-session`, ImageMagick's `import`. gaia has them. hu has no
  Xvfb, its Xvnc is RealVNC and needs a license, and Kdenlive 21.12 crashes on Qt's `vnc` and `offscreen`
  platforms, so on hu run the check on gaia (the episodes have the same paths there).

## The pass

1. **Find the videos.** A Deep Diver explainer is kept at
   `<episode>/captures/notebook-<id>/keep/<title>-<stamp>.mp4`. The notebook's `manifest.json` names each
   one (`downloads[].kept.path`, `title`, `media.duration_seconds`). The files under `keep/` are tracked in
   the episodes repo, so every checkout of `/srv/miadi/episodes` has them once pulled. Check with `ls`
   before saying a video is only on gaia.
2. **Probe.** `ffprobe` each video: size and frame rate. A Deep Diver explainer can be landscape
   (1280x720, 24 fps) or vertical (720x1280, 30 fps). The script writes one project per video, each in the
   video's own profile, so different sizes never share a timeline.
3. **Write the projects** into the episode, in `film/<what>-<yymmdd>/`:

       ${CLAUDE_PLUGIN_ROOT}/scripts/scenes_to_kdenlive.py <video>... --out <folder> \
         --note "Prepared by an agent on <date> at <person>'s request in Episode <n>: a proposal until a person keeps it."

   `--pause` sets the black in seconds (6), `--threshold` the scdet score that starts a scene (8). A Deep
   Diver explainer is slides: at 8, Episode 575 found 22 changes in 6 min 13 s, every one inside a pause of
   the narration. Pairs of high scores about 6 s apart (33 to 36) are a section title card, a scene of its
   own. The script writes `<slug>.scenes.kdenlive` per video and `scenes.json` for the run.
4. **Check through melt** (Kdenlive's engine):

       ${CLAUDE_PLUGIN_ROOT}/scripts/verify_timeline.py <folder>

   It renders each project small and fast, then compares the length and each black (blackdetect) and the
   silence under it (silencedetect) with `scenes.json`. Exit 0 means every black is in its place. It takes
   about 5 minutes for 10 minutes of timeline.
5. **Check in Kdenlive**, on a host with Xvfb:

       ${CLAUDE_PLUGIN_ROOT}/scripts/kdenlive_check.sh <project> [out folder]

   A copy opens on a hidden display, Kdenlive saves it through its own Save action, and the script counts
   what Kdenlive kept: clips per track, guides, groups. Look at the screenshot it writes. Keep one
   screenshot in the folder (convert to webp) as the evidence a person can see.
6. **Write the folder's README**: what was asked and by whom, the files, the tracks, where the cuts fall
   against the narration, the commands, the check results with their numbers, what is not proven, and one
   table per project (scene, from the source, length, on the timeline, black after). Episode 575's README
   is the shape.
7. **Commit** the folder in the episodes repo with the named files only, then push (the `chronicle-episode`
   skill's rules and the repo's `AGENTS.md`). Never commit a render: `.mp4` is ignored there outside `keep/`.

## What the timeline holds

| track | holds |
|---|---|
| V1 Scenes | each scene, then a black color clip of the pause, then the next scene |
| A1 Narration | the sound of each scene, grouped with its picture (AVSplit), nothing under a black |
| A2 Music (later) | empty, for the composer |

A guide sits at the start of each black ("Black 6 s, after scene N: silence or music"). The source clip has
a marker at each scene start. The project notes say what was cut, how, and by whom.

## Things learned the hard way

- **`/tmp/kdenlivelock`.** Kdenlive writes it at start and removes it at a clean exit. A killed Kdenlive
  leaves it, and the next start, the person's included, asks "Kdenlive crashed on last startup. Do you want
  to reset the configuration files?". Give a test run its own `TMPDIR` (`kdenlive_check.sh` does). If a run
  of yours left one, remove it.
- **A Kdenlive-saved project and melt.** Kdenlive sets the main tractor's `out` far past the end (29 min for
  an 8 min timeline). melt then renders the extra black. The script writes `out` at the last frame, and
  `verify_timeline.py` renders the script's file, not a Kdenlive-saved copy.
- **Groups.** A leaf is `"<track position>:<frame>"`, positions counted from the bottom track, black track
  excluded: with A2, A1, V1 that is 0, 1, 2. Kdenlive 22.04.3 kept all 23 groups written this way.
- **Format 1.04** is what Kdenlive 22.04 writes, and 21.12 carries the same constants. A file with a format
  newer than the running Kdenlive is refused ("This project type is unsupported").
- **The cut and the words.** scdet cuts the picture. When the picture changes before the narration pauses
  (Episode 575's vertical video, about 0.2 s), the end of a word lands after the black. Say so in the README
  with the scene numbers. Moving the audio cut is the editor's choice.

## What comes next for the composer

The composer works in the same project, on A2, at the guides. The README's tables and `scenes.json` give
each black's place on the timeline in seconds, which is what a conversation about timing needs. Rendering
the music and setting it to picture is the `miadi-music` package's work (`miadi-music check`).
