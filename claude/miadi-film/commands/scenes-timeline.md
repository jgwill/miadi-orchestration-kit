---
description: Cut an episode's videos (its Deep Diver explainers, unless named) into scenes and lay them on a Kdenlive timeline with black between them, then check it through melt and in Kdenlive
argument-hint: "<episode number or folder> [video path ...] [--pause seconds]"
allowed-tools: Bash, Read, Write, Edit
---

Follow the `scenes-to-timeline` skill of this plugin, from finding the videos to the commit.

Arguments: `$ARGUMENTS`

1. Resolve the episode with the `chronicle-episode` skill (its number or folder name under
   `$MIADI_CHRONICLE_ROOT`). Named video paths are used as given. Without them, take every video listed
   in the episode's `captures/notebook-*/manifest.json` with a `kept.path`, and list them before cutting.
2. The folder is `<episode>/film/<what>-<yymmdd>/`, `<what>` naming the material (`deepdiver-scenes` for
   Deep Diver explainers). If it exists, stop and say so: a person may have edited its projects.
3. Run `scenes_to_kdenlive.py`, then `verify_timeline.py`. A failed check stops the pass with its lines.
4. Run `kdenlive_check.sh` where Xvfb exists. On a host without it, run it on gaia from a temporary folder
   and remove the folder after. Keep one screenshot in the episode folder.
5. Write the README, commit the named files and push. Report: projects, scene counts, timeline lengths,
   the check results, and where a cut falls during speech.
