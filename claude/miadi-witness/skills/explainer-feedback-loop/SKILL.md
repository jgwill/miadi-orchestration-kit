---
name: explainer-feedback-loop
description: >
  Turn William's screenwalk over a Deep Diver video (a "DD-VideoExplainerFeedback" screenwalk)
  into a revision loop. His points come with timestamps, each mapped to the repository and seat
  that owns the change. The lanes run one writer per repository, and the loop ends with Deep
  Diver's full revision of the notebook and its videos. Use when a screenwalk named
  screenwalk-<stamp>-DD-VideoExplainerFeedback-<n> arrives, when William reviews a Deep Diver
  explainer aloud, or when he says the explainer "makes it look too great", "revise the sources
  and recreate the explainer", or "a full revision of the DeepDiver" after packages change.
---

# From his feedback on an explainer to the next explainer

William, 2026-10-25, giving this seat the first one: *"that would not be the first time I'd do a
session like that, I would expect a full revision of the DeepDiver session continuity after the
whole revision loop of any packages down the line is completed."* The first run's map is
`captures/screenwalk-2610221013-DD-VideoExplainerFeedback-001/feedback-map.md` in Episode 297.

## The loop

1. **Find the video and what made it.** The screenwalk's video names the Deep Diver video it
   plays. The episode's `captures/notebook-<id>/perspectives.md` gives that video's prompt, its
   audience and the sources the notebook read.
2. **Read his turns, not the review.** Store the review's transcript beside the map
   (`miadi_review.py transcript <id> --out`). The review's generated text repeats the video's
   claims. In the transcript the video's voice and William alternate. Quote only his turns, with
   their timestamps, and say that Gemini assigned the speakers.
3. **Write the map in the episode,** at `captures/<screenwalk stem>/feedback-map.md`. Give one
   row per point, coded `V1`, `V2`, …, with when he said it, what the video claims, and his
   correction. Then write "what exists today", measured by command. An explainer overclaims
   because its sources do, so check the sources too.
4. **Sort each point into one kind:**
   - a correction to a source the notebook read (files on disk in the episode)
   - a change in a package, one per lineage repository. Lineages evolve independently, and a
     map draws a dependency only where the code has one.
   - a change in a practice (a skill, a record the seat keeps)
   - a foundation to document, sent to its home as information
   - a decision he made on the video: end the matching delayed step with his words
   - held: outward-facing, said with "probably", or naming something nobody can identify yet
5. **Order the lanes.** One writer per repository, and lanes in different repositories run side
   by side. Each lane names its seat by full tmux name, its repository, when it starts and what
   proves it done. Every lane sends its DONE line to the witness seat. **The last lane is always
   the full Deep Diver revision:** remove the outdated sources (`notebook remove-source`), add
   the revised ones, and regenerate each video from its prompt, as a new prompt version where the
   instruction changes. Keep the new videos and hand them to William for his next screenwalk,
   which starts the next cycle (R18: screenwalks move from one cycle to the next).
6. **Steer only the first lane of each repository.** The seat relays the next one on its DONE
   line (MINO §5, 2026-10-21). Read the pane and run `pane-write-guard.sh` before writing into it.
7. **Report to him with session doors.** Name each seat by its full tmux name and the line
   `session-door <id> --open` (witness-editor E6), and give the map's path.

## What the first run found (Episode 297, 2026-10-25)

- The T1 video called coaia-narrative, coaiajs and the medicine wheel "a fully unified
  ecosystem". They are three independent lineages applying one principle. One notebook that holds
  several lineages blurs them, so each revised source names its lineage at its top.
- The video said rehydration was "flawless" and "you can rely on this right now". The clock it
  depends on did not run: two suspended sessions passed their resume date with nothing happening.
- He answered a held decision, who runs the clock, inside the screenwalk at 27:43. Before writing
  the map, list the episode's open delayed steps and look for his answers to them.
- The suspension he described composes a follow-up prompt at the moment of the decision. The
  inventory records now carry it (`suspension.follow_up_prompt`, SCHEMA.md 2026-10-25).
- Deep Diver had no command to remove a source, so the loop's first lanes include adding it.
