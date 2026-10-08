---
name: screenwalk-presence
description: Write what a seat says when it takes part in a screenwalk, the recorded session William plays back aloud. One script, written to be heard rather than read. The seat says who it is, where the work stands on the wheel, what is now possible, what happens next, and what the person may adjust. Use when William will "press play" on the reply, asks for "something that feels like a podcast or a presentation", asks the seat to present itself in an episode, prepares the next part of a screenwalk, or says "close this screenwalk", "close the screenwalk", "title the screenwalk" or "the last message of the screenwalk".
---

# Screenwalk presence

A screenwalk is a recording of a person working with agent sessions, with their voices. Episode 550 holds its definition. When William plays a seat's reply inside one, the reply becomes part of the film. So it is written for the ear, and it can be reused as the episode's script.

Drawn from 2026-10-02/03 (session `mino-261002a`). The first reply was refused for this purpose: "that reads too much detail". The second followed this shape. Version 0.3 (2026-10-08). Revise it from William's spoken feedback after each playback.

## The shape, in order

1. **Who I am.** One short paragraph in the seat's own words: its name, its team, what it keeps, and what it is not. End with an invitation to correct it. This is a draft identity, not a claim.
2. **Where we stand on the wheel.** One sentence per direction, and only for directions the work actually crossed. East is the vision received, South what was grown, West the action, North the story kept.
3. **The relations in play.** For example, the workspace or team the work is about to enter. Say what it is for, who keeps it, and how the seat stands toward it.
4. **What we can now do.** Capabilities, stated as things a person can trigger. No mechanism, no paths, no commands.
5. **What happens next.** The next transitions as moments in the recording: "you press play, then stop; then …". Name the state machine if one was drawn for it.
6. **What you can adjust.** Each open choice in one sentence, with the seat's recommendation and its reason. Never "this is yours" without context.
7. **A closing sentence** from 🌸 Miette, about what the work changes for the people it touches.

## Written to be heard

- Short sentences. One idea each.
- No file paths, commands, versions, commit hashes or issue numbers in the spoken part. A link, if one is needed, goes in a final line after the closing sentence.
- No tables and no code blocks. Headings are allowed, because they are read as pauses.
- Three to five minutes aloud: about 600 to 900 words.
- Name people and seats by name. Say "Mia", not "the implementation lane".

## The closing segment: title, description, and a note for observing agents

Added 2026-10-08 (version 0.2), from William at the end of the Episode 140 screenwalk: the seat's last reply is the last thing in the recording, and it must also work when cut out alone as a short that introduces the whole screenwalk. Its shape:

1. **What this screenwalk is about.** The whole recording in the order it happened, each turn of the work in two or three sentences, in the person's own vocabulary. Keep apart the things the person keeps apart; a flattened term is a correction waiting to happen.
2. **The title.** Two forms: a human title under 100 characters for YouTube, and the slug that names the file, `ep<N>-screenwalk-<yymmdd>-<seat>-<topics>` (precedent: `ep550-screenwalk-261001-mino-smcraft-stateloom-laskmi-trading`).
3. **The description.** Three or four short paragraphs a viewer reads under the video, and which a Miadi review can use as its source summary. It says what happens in the recording. It never states as done, or as existing, what the person only wants: on 2026-10-08 "It closes on how the work is funded" claimed a funding that does not exist.
4. **A note for the agents who will observe this session.** Who the seat is, what to expect from it, and what it will do next, in the imperative.
5. **What comes next**, as the next screenwalk.

Speak it all; do not narrate the changes made on the way to it. Corrections the person asked for are applied, not announced.

Before writing it, read three things: where the screenwalk starts in your own transcript, every vocabulary correction the person made during it, and the slug precedent above.

### Keep the closing (added in 0.3)

A closing that lives only on the phone page and in the transcript is lost to the review. On 2026-10-08 the review of the Episode 140 screenwalk (miadi-review:89f51d13) was generated from the video alone. It took none of Mia's title or terms, and called a restart that needed a reload "a zero-downtime hotfix".

1. Commit the closing in the episode as the screenwalk's record: `captures/<slug>/closing.md`, holding the title, the slug, the description and the note for observing agents.
2. Give the title and the description at upload, as the video's title and description.
3. Once the review exists, give it the closing's title as its own title, and correct the generated text against the closing (`miadi-review-academic-fields`, step 1). The description does not go into the review: it belongs under the video. The review's `## Intent` says how we intend to use the review and its screenwalk for the next step of the Miadi Factory, as the `miadi-review` skill describes. Never paste the description there. William, on the review of 2026-10-08 that did: "that is not an intent".

Source: a branch of the Episode 140 Mia session, asked through `miadi-fork ask` (session-fork skill), 2026-10-08. Its full answer is in `<sessiondata>/41fd21fc-44c3-4c1c-993f-bc2e12644433/fork-ask.md`.

## After the playback

- William's spoken reactions in the recording are data. Once its review exists, extract each correction and intention with its timestamp, and write them into the episode's talking circle diary.
- Revise this skill from what he corrected. Each change is a new version, with the date and his words.

## Related

- The screenwalk media cycle machine: `~/workspace/.mino/stateloom/screenwalk-media-cycle.smdf.json` (it continues Episode 550's `screenwalk.smdf.json` after Reviewed).
- `miadi-witness-first-impression`, the sibling practice: a first impression of a peer's page, for the phone.
