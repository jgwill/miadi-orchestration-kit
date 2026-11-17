---
description: Draft this session's release note with the road ahead, keep it, beat it and send it
argument-hint: "[repository path or owner/repo] [episode number]"
---

Load the `release-notes-road-ahead` skill and follow it for the release this session made.

- The repository is `$ARGUMENTS` when it names one, else the git checkout the session worked in.
- The episode is the one `$ARGUMENTS` names, else the episode this session serves. When none
  is known, write the note and say there is no episode for the beat.
- Show the note before it is sent. Send it only on the person's word or a standing word the
  factory mail skill records.
