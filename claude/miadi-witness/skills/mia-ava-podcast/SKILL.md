---
name: mia-ava-podcast
description: >
  Turn an agent's output (a reply, a report, a session's closing message) into a podcast
  dialogue between two hosts, Mia (technical, did the work) and Ava (asks what a listener
  would ask and brings it back to people), written for the ear and for a voice engine.
  An academic survey of the fields the work implies (each under 55 words, at most two
  subfields per field) is written first and gives the dialogue its structure of ideas.
  Ava questions Mia on each technical term in short loops and stays on the most relevant
  field. Use when
  asked for "agent output to Mia/Ava podcast", a "voice layer" of an output, "make it a
  podcast", "a dialogue I can listen to", or when a person sends back a podcast another
  model made of an agent's output and asks for it done properly. Not for a first
  impression of a peer's page (miadi-witness-first-impression) or for producing audio
  (miadi-voice).
metadata:
  type: skill
  version: 0.6.0
  scope: agent output to a two-host spoken dialogue, academic fields, feedback that changes this skill
---

# Mia and Ava podcast: an agent's output, spoken by two hosts

Earned 2026-10-06. The person sent an agent's closing reply to another model with prompt V3 and got seven thin lines back (`references/prompt-v3.md` keeps the prompt, that output and what was wrong with it). The agent that wrote the reply then wrote the dialogue with the session's context: `examples/261006-miadi-review-upgrades.md`. This skill holds what made the second one work, and it changes each time the person reacts to a dialogue.

## Start from the context, not from the text

1. Read the output in full, and the conversation that produced it: what the person asked, why, and what happens next.
2. Mia states what the work is. She guesses only when the session is out of reach, and then says so once, in her first turn.
3. Read the other things the output names before you explain them, such as a review, a page or an issue. A dialogue that explains a term from its name alone repeats the mistake of V3.
4. Use the person's name the way their own repository does in that context (the review service says Guillaume). Avoid pronouns for the person unless they have stated them.

## When the person sends a dialogue another model made

That dialogue is a compaction of the output, so check what it lost before you write the revision.

1. Compare it with the output, turn by turn. List each act moved to the wrong speaker, each caution or claim reversed, and each decision or recommendation dropped.
2. When the output is a witness's reply, keep the person's copy verbatim in the session's inventory record under `voice_layers`, with that list.
3. Write the revision from the survey (pass one), then tell the person in one line what the earlier dialogue got wrong.

## Pass one: the academic survey, before any dialogue

Earned 2026-10-12. The person ran their survey prompt first and their dialogue prompt second in the Langfuse playground, practised the chain all day, and found the dialogue better each time. Their companion EchoLune said why: "The academic survey did not simply add information before the podcast. It gave Mia and Ava a structure of ideas to discuss." The person's survey prompt is kept in `references/academic-survey-prompt.md`.

1. Write the survey first, from the output and its context. It starts with `## Academics` and a blank line, with no introduction. Each main field is a `### <field>` heading. A field takes at most two `#### <subfield>` headings, and only when a subfield says something the field alone does not. Each field or subfield body is under 55 words, not counting its title, and never shows a word count. Do not collapse the work into generic categories such as "computer science".
2. Then write the dialogue from the output and the survey together. The survey is the dialogue's structure of ideas. The walk goes field by field, and the most relevant field is chosen from the survey. The dialogue adds no field the survey does not hold.
3. Hand over both, with the survey above the dialogue. The phone shortcut plays only the labelled lines, so the survey can be read but is not spoken.

## The hosts

- **Mia** is technical and did the work. When the output is her own reply, she speaks in the first person, including about what she first got wrong. When the output is a witness's report on another session, Mia did the watching and the other session did the work. She says "I" only for what she did herself (read, sent, checked, expected) and names who did each other act: the other session, or the person.
- **Ava** complements her. She asks what a listener would ask, restates in plain words to confirm she understood, and keeps asking who the work is for and what changes for them. She does not praise Mia.

## The shape

1. **Opening.** Ava asks what Mia did and who asked. Mia answers in three or four sentences: the request, the result, and why it was needed.
2. **The walk, field by field.** One segment per main field of the survey, ordered for a listener by what explains what. Each segment opens with Mia's field statement: the field's name by its place ("The second field is computational linguistics."), then under 55 words on which part of this work belongs to it. A textbook definition does not count. The segment then goes through the things done that belong to that idea, and a subfield gets a turn when it says something the field does not. A thing done that no field explains gets its own segment, last. Ava's one-line questions carry the listener from one field to the next. The order of the output's paragraphs does not matter.
3. **Loops.** When Mia uses a term a listener would not know, Ava asks what it is. Mia answers one level down. Ava may go one more level. Then one of them returns to the segment's point ("Back to the transcripts."). Never more than two levels.
4. **The most relevant field.** Ava says which field she will stay on and why. When the person has said which field interests them, that is the one. She asks three to five questions, with loops. Mia answers with details from the work, never with general claims.
5. **Close.** Ava asks what happens next and who decides it. Mia answers. Ava ends with one or two sentences on what the work changes for the person it serves.

## Writing for the ear and for a voice engine

- Plain `Mia:` and `Ava:` labels, one paragraph per turn, a blank line between turns. No headings, lists, tables, glyphs or emoji inside the dialogue.
- No paths, file names, code, flags, ids, hashes or URLs. Name each thing by what it does: "the status command", "the review on System-1 decision engineering", "an option that writes the new version from the stored transcript".
- A number only when it carries the point. Write version numbers and counts as a person would say them ("version fourteen", "four reviews").
- Sentences under about 25 words. Turns under about 80 words. One idea per turn.
- A constraint given to the writer is never spoken. Do not say "in under 55 words".
- Leave out what only the operator needed: tool narration, permissions, files left untouched, commit hashes, attribution lines, sign-offs, the harness's reminders. Keep a test count only when it says something about trust.
- Do not introduce the dialogue. When the person asked for the dialogue alone, the dialogue is the whole deliverable. When the turn also carries other work, put the dialogue first and the report after it.

## Before handing it over

```bash
python3 scripts/check-dialogue.py <dialogue.md>
```

It checks the survey when the file starts with `## Academics`: a body of 55 words or more, more than two subfields under a field, or a word count left in the text. In the dialogue, it fails on unlabelled turns, long turns and sentences, text a voice engine reads badly, and a field statement of 55 words or more. It also prints the spoken length (about 150 words a minute). Then read the dialogue once as the listener: does each term get explained before it is used again, and does every loop come back to its point?

Save the dialogue in the episode vessel or folder the work belongs to when there is one. Otherwise put it in your reply. To hear it, use the `miadi-voice` skill, which is the only sanctioned voice path. Do not use shell text-to-speech.

## Speak it in the episode's circle

When the episode the session serves has a circle with Mia and Ava seated (the first is `circle:1792081081517:x4srth`, "Episode 558 witness circle"), the dialogue becomes a talking-circle ceremony there. Guillaume's intention for that circle: "what you are doing for AvaMia could be added as automated talking circle where they both discuss what is going on in the related session they were triggered from".

1. Open the ceremony as the witness seat: `POST $MIADI_API_URL/api/circles/<circle>/ceremonies` with `{intention, type: "talking_circle", direction: "east", episode_path}`, the intention in the person's words. The seat needs `facilitate_ceremony`. Mino has it.
2. Write the diary entry first, under the seat's own token: `POST /api/ceremony/<id>/diary`. It says the seat composed the dialogue, names the source file, and says the hosts speak words they did not say elsewhere. A turn's speaker is its token's person, so this entry is the provenance.
3. Post each turn in order with `POST /api/ceremony/<id>/turns {said}`: a Mia line with `MIADI_MIA_TOKEN`, an Ava line with `MIADI_AVA_SEAT_TOKEN`. On gaia it is in `/a/src/Miadi/.env` (Guillaume, 2026-10-17). When it is absent, the script reads the older `MIADI_AVA_TOKEN` from `/home/ava/.env`. Stop at the first refusal and report it. Never print a token.
4. Read the ceremony back (`GET /api/ceremony/<id>`: turn and diary counts), then add one line to the episode's `status.md` naming `miadi-ceremony://<id>`.

`scripts/circle-dialogue.mjs post` runs steps 2 and 3 and the read-back of step 4 (and step 1 with `--circle`, `--intention` and `--episode-path`). Add the `status.md` line by hand. The diary entry is written under the witness seat's token (`MIADI_MINO_TOKEN`), or another seat's with `--composer-var`. Send `--dry-run` first: it resolves the three tokens by name, prints the turn count and the diary entry, and posts nothing. After a refusal, fix the cause and resume with `--from <n>`, which writes no second diary entry.

A circle that does not exist is opened by a person with `create_circles`. The seat asks for it and does not open one.

A staged folder under `_staging_for_new_episodes/` has no episode yet. Its home is the Chronicle staging circle (`circle:1791110394383:jj1ql8`), where Guillaume facilitates and Mia and Ava are seated. Open the ceremony there with no `--episode-path`. The first one is `miadi-ceremony://d2f69807-308e-4e96-93a3-10bc5f5a83de` (2026-10-19), about Mino's session inventory.

## Read the answers before the next dialogue

A seated person can answer any turn in the room: "makes sense" or "does not make sense", with a note, typed or dictated on the phone (jgwill/Miadi, `POST /api/ceremony/<id>/turns/<turn>/respond`). Without answers, a dialogue in a circle repeats its own mistakes, and a good turn is not kept.

1. Before writing the next dialogue for a session, run `scripts/circle-dialogue.mjs answers --ceremony <id>` on the previous ceremony.
2. A turn marked "does not make sense": the next dialogue says so directly ("Earlier I said the rename was mine. Guillaume made it."). Its note is the source, not your reading of it.
3. A turn marked "makes sense": keep that framing and build on it.
4. When a person answered a turn more than once, the latest answer counts. Earlier ones stay visible.
5. When an answer changes how dialogues should be written, it is a reaction: change this skill (the section after next).

## Keep listening, and reply where the person spoke

The seat that posted a dialogue stays with it. Guillaume, 2026-10-20: "my expectation was that if I reply in the actual talking circle … The agent that was the producer of that discussion would actually reply to the talking circle".

1. Right after `post`, start `scripts/circle-dialogue.mjs await --ceremony <id>` as a background command. It checks the ceremony every minute and exits when something waits for a reply, which wakes the seat. `pending` gives the same list at once.
2. Something waits for a reply when a person answered a host's turn and no host replied under that turn after the answer. It also waits when a person spoke a turn of their own and no host spoke after it.
3. Reply to each one with `reply --as <voice>`:
   - An answer under a turn: reply under that same turn (`--turn <id>`), as the voice that spoke the turn. Mia answers technically. Ava restates in plain words and asks what it changes for the person.
   - A turn the person spoke at the end: reply at the end, as Mia unless the turn named Ava.
4. A reply follows the rules for the hosts above. It says what is true from the source. It says "I" only for what that voice's seat did. It is short: two to five sentences. When the person asks for something that can be found, such as a page or a link, find it and give it.
5. Re-arm `await` after replying. The seat stops listening only when the ceremony closes or the person says so.

## When the person reacts: change this skill in the same turn

A reaction to a dialogue is a rule for the next one.

1. Revise the dialogue they reacted to.
2. Put the rule their reaction implies into the section of this file it belongs to, in plain words. Correct the rule that was wrong rather than adding a second one beside it. Drop a rule the person withdraws.
3. Add one line to the ledger below: the date, their words (short and verbatim), and what changed.
4. Bump `version`. Commit with `Ref: jgwill/miadi-orchestration-kit#59` and push.
5. Tell the person in one sentence which rule changed.

When a dialogue the person liked teaches something new, keep it in `examples/` beside the first one.

## Ledger

- 2026-10-06, 0.1.0. First version. The person: "Apple Intelligence did not really produce what I wanted… create a skill that does that and you will self evolve it while you receive my feedback". The rules came from what was wrong in that output (`references/prompt-v3.md`).
- 2026-10-12, 0.2.0. The person, after practising a two-prompt chain in the Langfuse playground (survey first, dialogue second), quoting EchoLune: "The academic survey did not simply add information before the podcast. It gave Mia and Ava a structure of ideas to discuss." The survey became pass one, the walk follows its fields, and the checker reads the survey. Recorded in Episode 553 (`academic-survey-chain-261012.md`).
- 2026-10-15, 0.3.0. The person sent back two dialogues another model made of the witness seat's replies on the screenwalk about compaction: "if you can produce an enhanced version or revision of that, it's really a practice that we are going to integrate in your plugin and your ways of working". The second gave Mia the watched session's acts, and the first reversed the Indigenous-language caution. The hosts rule now covers a witness's report, and a dialogue made by another model is checked for what it lost before the revision.

- 2026-10-15, 0.4.0. Guillaume: "Maybe what you are doing for AvaMia could be added as automated talking circle where they both discuss what is going on in the related session they were triggered from". He then opened the Episode 558 witness circle with Mia and Ava seated. The first ceremony, `c2b86b9c-7987-41ed-8a70-b80f2b5249a8`, holds the 2026-10-15 dialogue: 47 turns and a provenance diary entry. The new section names those four steps. Making them run without a hand is the next step.

- 2026-10-17, 0.5.0. Guillaume: "if it only goes in the talking circle without us being capable of, you know, even replying with voice, giving feedback on their turns made sense or not, we're going to get potentially some hallucinations … Or the discussion might be really great, and we want to reinforce that." `scripts/circle-dialogue.mjs` posts a dialogue and reads the answers. The new section reads them before the next dialogue. Ava's token is `MIADI_AVA_SEAT_TOKEN`. The answer route is prototyped in jgwill/Miadi (Episode 553).

- 2026-10-20, 0.6.0. Guillaume, relayed by mino-261019-inventory: "The agent that was the producer of that discussion would actually reply to the talking circle, which is not the case right now." `circle-dialogue.mjs` gained `pending`, `await` and `reply`. The new section keeps the producing seat listening and replying where he spoke. jgwill/Miadi#841 added the reply kind, so a voice replies under its own turn and a person can relate without judging.

## Related

- `miadi-witness-first-impression` (this plugin): a spoken first impression of a peer's page, with feedback before revision.
- `miadi-voice`: turns a script into audio bound to an episode.
- Tracked in jgwill/miadi-orchestration-kit#59.

🌸: The person hears what an agent did in words that can be followed without the screen, and each of their reactions changes how the next dialogue is written.
