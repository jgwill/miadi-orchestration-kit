---
name: screenwalk-names
description: Name a screenwalk. Gives its safe title (the file-safe name starting with the stamp), its title and its YouTube description, and where the record keeps them. Load whenever a person is stopping, uploading or publishing a screenwalk, or asks for a "safe title", a "title" or a "description" for one, whichever agent or seat is asked. Triggers on "safe title", "safetitle", "title for the screenwalk", "description for the video", "I'm going to press stop", "publish that on YouTube".
---

# The names of a screenwalk

A screenwalk is a recording of a person working with agent sessions, with their voices (Episode 550, miadi-chronicle://550). When the person stops one, they need three things from you, without having to repeat these rules.

| name | what it is | form |
|---|---|---|
| **safe title** | the file-safe name, used for the video file, for search and in intake | `screenwalk-<stamp>-<relation to the tmux session>[-<topic>][-part-NNN]` |
| **title** | what a viewer reads on YouTube | `screenwalk-<stamp> \| Human Title`, 100 characters at most |
| **description** | what a viewer reads under the video | three or four short paragraphs |

"Safe" in "safe title" means safe for a file name and a URL. Do not read it as safe to publish. That is a separate check, below.

## The stamp

The stamp is the minute the person named when they pressed record, as `yymmddHHMM`. It is also the screenwalk's id: `miadi-screenwalk:2611071342`, folder `captures/screenwalk-2611071342/` (`@miadi/episodic-memory-schema`, `screenwalk.ts`).

- When the person gives it, use theirs exactly.
- When they have not, use the stamp in the name of the session that was recorded, and say so in one clause so they can correct it.
- Do not use the old `yymmdd-NNN` form.

## Safe title

Something always follows the stamp, and it relates the recording to the tmux session it shows. A bare `screenwalk-<stamp>` is the record's id and folder, so never give it as the name.

The script builds it from the session and checks it:

```bash
S=$MIADI_ORCHESTRATION_KIT_ROOT/claude/miadi-chronicle-episode-kit/skills/screenwalk-names/scripts/screenwalk-name.mjs
node $S --tmux <recorded session> [--stamp yymmddHHMM] [--part 1] [--topic "words as script"]
node $S --stamp 2611071342 --tail film-apt-fork1-t5        # keeps a start the person gave
node $S --check "<safe title>" --title "<title>"           # run this before giving the names
```

- **The relation:** the words of the tmux session's name, with its time stamps removed. Shorten it to the words that tell the session apart, and keep the start the person gave if they gave one.
- **The topic:** optional words after it for search. Name the work and not the people.
- **The characters:** ASCII letters, digits and hyphens, with no spaces and no colons.
- **A tree:** sessions of one tree share words from the root's name, so both recordings below carry `film-apt`.

Real ones, newest form first:

- `screenwalk-2611071211-mino-t3-fork1-t5-miadi-film-apt-part-001`, from tmux `mino-t3-2611071211-fork1-t5-miadi-film-apt-2611071058`
- `screenwalk-2611071342-film-apt-fork1-t5-words-as-script`, from tmux `fork1-t5-miadi-film-apt-what-can-I-do-2611071058`, keeping William's start `screenwalk-2611071342-film-apt`
- `screenwalk-2611060853-001-t3-t7-on-teams`, naming the two teams' sessions
- `screenwalk-2610271518-my-research-ui-and-inquiry-weave`
- `screenwalk-26102211-Session-Continuity-Rehydration-and-Three-Independent-Lineages-part-001`, an older shorter stamp
- `screenwalk-261015-from-review-to-action-epistemic-handoff-semantic-delegation-miadirun`, an older shorter stamp

## Title

Real ones:

- `screenwalk-261015 | From Research to Action: Epistemic Handoff, Deep Diver & MiadiRun`
- `screenwalk-2611071342 | Writing with the Voice: A Fork Keeps the Words and Proposes a Film Room`

`--check` counts the characters. YouTube stops at 100.

## Description

- Say what happens in the recording, in the order it happened. Open with "This is a screenwalk: a recording of William working with agent sessions, with his voice" and the date.
- Never state as done or as existing what the person only wants. Say what has not happened yet.
- Relate things with Miadi addresses (`miadi-chronicle://120`, `miadi-ceremony://<uuid>`, `owner/repo#n`). Do not use a full URL.
- The description goes under the video. It does not go in a review's `## Intent`.

## Safe to publish: a separate check

The title and the description name no person except William, and no host, path or permission. Agents and characters may be named.

Then check who the recording itself names. When it names someone who has not consented, say so before upload, and recommend publishing it unlisted and registering it as withheld. Asking them goes through `request_participant_consent` (jgwill/Miadi#925), and the relationship is the person's to open. Precedent: miadi-chronicle://250, `captures/screenwalk-261104-001/closing.md`.

## Keep it

Commit it in the episode the recording belongs to:

- `captures/screenwalk-<stamp>/closing.md`, holding the title, the safe title, the description and a note for observing agents.
- `captures/screenwalk-<stamp>/screenwalk.json`, with `screenwalk`, `reference`, `stamp`, `episode`, `video: { title, safe_title }` and `closings`. The episode room's Screenwalks card reads only that folder.

Give the person the three names first, labelled, ready to paste. The closing's spoken form and the note for observing agents are in `screenwalk-presence` (miadi-witness), for a seat that takes part in the recording.

## More samples

`python3 <miadi-review skill>/scripts/miadi_review.py search screenwalk --limit 40` lists reviews, many of them titled by their safe title. `captures/*/screenwalk.json` holds the rest.

Earned 2026-11-07. A seat read "safe title" as "safe to publish" and gave one human title and a slug `ep120-screenwalk-261107-…`, and then called a bare `screenwalk-<stamp>` a corrected name. William: "There is a Screenwalk title, which you produced, and a safe-title which looks like more 'screenwalk-2611071342-film-apt' … any fucking agent that have to generate their screenwalk safetitle, title and description will know how in the future". Then: "A safe title has to have something after screenwalk-<timestamp>-<here to relate to the tux session or something>".
