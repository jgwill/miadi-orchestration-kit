---
description: Prepare an episode's editing room as the assistant editor - every medium in Kdenlive bins with its address and first words, takes fetched from the recording host, the room sheet, checked in Kdenlive
argument-hint: "<episode number or folder> [--fetch-from <host>] [--scenes]"
allowed-tools: Bash, Read, Write, Edit
---

Follow the `editing-room` skill of this plugin. With `--scenes`, cut the episode's Deep Diver videos into
stringouts first with the `scenes-to-timeline` skill, so the room sheet lists them.

Arguments: `$ARGUMENTS`

1. Resolve the episode with the `chronicle-episode` skill. Say it by its address (miadi-chronicle://<n>).
2. The room folder is `<episode>/film/editing-room-<yymmdd>/`. If it exists, stop and say so.
3. Run `editing_room.py`, with `--fetch-from` when a host was named. Report what is in the room and what
   is not.
4. Run `kdenlive_check.sh` where Xvfb exists (gaia), from a temporary folder removed after. Keep its
   screenshot in the room folder.
5. Append "Made and checked" to the room sheet, commit the named files in the episodes repo and push.
6. Report: the command that opens the room, the bins and their counts, what was fetched and verified, what
   is missing and where, the check's numbers.
