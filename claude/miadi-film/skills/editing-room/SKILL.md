---
name: editing-room
description: Prepare an episode's editing room, the assistant editor's work for the production team (T6). Every medium of the episode (Deep Diver videos, voice takes, the episode's rendered voice, other video and audio) goes into one Kdenlive project's bins, labelled with its address and the first words said in it. A take recorded on another host is fetched when its sha256 matches. The room sheet lists what is in the room, what is not and where it is, the stringouts already cut, and the screenwalks online. Use when asked to "prepare the editing room", "get the media ready for the director / the editor", "put all the episode's media in Kdenlive", "what media does this episode have", or before an editing or scoring session.
---

# Editing room

In a film, the assistant editor prepares the editing room. They receive the media, put it in bins, label it, log
what is said in it, lay out stringouts and hand the editor and the director a project that opens with everything
in place. This skill is that work for a Chronicle episode. The `assistant-editor` agent of this plugin carries the
role. Cutting a video into scenes on a timeline is the `scenes-to-timeline` skill.

First room: Episode 575 (miadi-chronicle://575), `film/editing-room-261113/`, on 2026-11-13. Its README is the
room sheet to copy.

## Before you start

The `scenes-to-timeline` skill's floor (the `miadi-film` package, Python 3.8), plus `scp` to the host that
recorded the takes when they are not on this one.

## The pass

1. **Look at the episode.** The script finds the media from the episode's own records, so read them first if
   something looks off:

   | bin | found from |
   |---|---|
   | Deep Diver | `captures/notebook-*/manifest.json`: `downloads[].kept.path`, `title`, `kept.transcript.path` |
   | Voice takes | `captures/<tlid>/capture.json`: `audio.relativePath`, `audio.sha256`, `transcription.outputs[0]` |
   | Episode voice | `episode.mp3`, `chapter-*.mp3` at the root |
   | Other media | any other video or audio file in the episode |
   | Screenwalks (sheet only) | `captures/*/screenwalk.json`: `video.title`, `video.url` |
   | Stringouts (sheet only) | `film/*/scenes.json` |

2. **Build the room** in a new folder, `<episode>/film/editing-room-<yymmdd>/`:

       ${CLAUDE_PLUGIN_ROOT}/scripts/editing_room.py <episode dir> --out <folder> --fetch-from <host> \
         --note "Prepared by an agent as the assistant editor on <date>, at <person>'s request in Episode <n>: a proposal until a person keeps it."

   Without `--fetch-from`, a take that is not on this host is listed under "Not in the room". With it, the
   script copies the take from the same path on that host and keeps it only when its sha256 matches
   `capture.json`. Raw takes are gitignored in the episodes repo: a fetched take is on this host only.
   Episode 575's 4 takes were on gaia, not on hu, where the person edits.

   The script writes `room.kdenlive` (bins, empty timeline, the project profile from the first landscape
   video), `room.json` (every medium with its state: here, fetched, not on this host, unreadable) and
   `README.md` (the room sheet). A Deep Diver video with a stringout carries a marker at each scene start.

3. **Cut stringouts** when they are asked for, before the room so the sheet lists them: the
   `scenes-to-timeline` skill, into `<episode>/film/<what>-<yymmdd>/`.

4. **Check the room in Kdenlive** on a host with Xvfb (gaia), from a temporary folder you remove after:

       ${CLAUDE_PLUGIN_ROOT}/scripts/kdenlive_check.sh room.kdenlive <out folder>

   It prints the bin: entries, named clips, descriptions, markers and folders. Episode 575: 6 clips, 6
   descriptions, 33 markers, folders Deep Diver and Voice takes. Keep the screenshot as
   `kdenlive-<version>-on-<host>.webp` in the room folder.

5. **Finish the room sheet.** Append a "Made and checked" section: the commands, what was fetched and how it
   was verified, the check's numbers, and what only a person can confirm.

6. **Commit and push** the room folder in the episodes repo: README, `room.json`, `room.kdenlive`, the
   screenshot. Named files only. Never a take, never a render.

## The room's rules

- The timeline of `room.kdenlive` stays empty. The editor makes the cuts, as Episode 120's phase plan says.
  A stringout is a separate project, cut only when a person asks for it.
- Every clip's description starts with how it was made, then the first words said in it, then its address.
  The words come from machine transcripts nobody checked. A Deep Diver transcript is an English rendering of
  narration that can be in French. The sheet says so.
- The room is rebuilt in a new dated folder, never over an existing one.
- Media found nowhere is listed with its recorded path, never dropped silently.

## What the room is for next

The director looks at the material from the sheet and the bins. The editor works in the room and the
stringouts. The composer works on the stringouts' "Music (later)" track, at the guides. Bringing the music
back into the room is the `miadi-music` package's work and a later practice.
