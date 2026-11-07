# `potential-threads.yaml`: what a staged folder leaves the writers

Written 2026-11-07 by the T5 session `t5-what-the-writers-receive`. Nothing has been carried with it yet. The door checks below were dry runs and wrote nothing.

## Why a file

The writer's page, `https://ecrire.sanctuaireagentique.com`, reaches only the Author's Desk and sign-in (Episode 567, miadi-chronicle://567, `rispecs/writing-subdomain/`). The desk reads a beat in any episode's `threads.yaml` and a group in any episode's `proposals/*.yaml`. Neither reads a staged folder, and the threads door answers 404 for one. `script.md`, `source-ledger.md` and `.mia/` reach no door: `app/ncp/desk` and `packages/authors-desk` have 0 references to `script.md`.

So the folder holds this file until its episode is minted. Its fields are the door's fields, so the seat that mints can carry it without interpreting it.

## The file

The example comes from `why-a-seat-did-not-find-what-was-there-261015`. It shows the shape and was not left in that folder.

```yaml
# Potential plot threads of this production context exploration. Nothing here is a thread yet.
# A seat that mints this folder's episode carries this file:
# skills/production-context-exploration/references/potential-threads.md in jgwill/miadi-orchestration-kit.
#
# Beats are what happened or what was said, with exact words where a person spoke.
# wanted_result, current_reality, and each group's name and why are the seat's reading.

exploration: why-a-seat-did-not-find-what-was-there-261015
left_by: t5-what-the-writers-receive
left_at: 2026-11-07
for: miadi-chronicle:560
threads:
  - code: PT1
    thread: a seat reports missing what is in front of it
    domain: creative
    wanted_result: The reason a seat misses what is in front of it is known, and a writer can use the moment
    current_reality: cases.md rebuilds six misses of 2026-10-15 from their records. The foundations packet names which layer holds each cause. No scene exists.
    state: emerging
    opened_at: 2026-10-15
    opened_by_beat: Guillaume, 2026-10-15, quoted in AGENTS.md
    beats:
      - { ref: "b607b1a5", at: "2026-10-15", by: "t5-what-the-writers-receive", what: 'Guillaume: "there is a reason why these agents did not found what they did not found"' }
groups:
  - id: looking
    name: The seat that looks and does not find
    why: One person knows the thing is there while the agent beside them reports it missing
    beats:
      - { thread: PT1, ref: "b607b1a5" }
```

## Rules for each field

| field | rule | why |
|---|---|---|
| `code` | `PT` and a number, distinct in the file | The door refuses anything else |
| `thread` | At most 200 characters | The door's limit |
| `domain` | `creative`, `ceremony` or `engineering`, always written. `creative` only when a writer could write from it | A thread without one reads as engineering, and the agents' turn waits for one `creative` thread at its desk's episode (`app/ncp/desk/lib/turn.ts`) |
| `wanted_result`, `current_reality` | At most 2000 characters each, and the seat's reading | The door's limit. The header tells the reader whose words these are |
| `state` | `emerging`, unless the person said otherwise | One of the door's six states |
| `opened_at`, `beats[].at` | A day, `YYYY-MM-DD`, the true day of the record | The door's format. A later date would misreport when it happened |
| `beats[].ref` | A chronicle commit, `owner/repo@sha`, `take <12 digits>`, `miadi-review:<uuid>` or a desk card | The door checks it, and a path is refused with 422 |
| `beats[].what` | At most 500 characters, with a person's words exact and the person named in the text | The desk shows this text, and a bare chronicle commit opens nowhere (`refHref` in `app/chronicle/lib/takes.ts`), so the text has to stand alone |
| `beats[].by` | The seat that recorded the beat, never the speaker | Latest shows it as who recorded the beat, and the door records who acted |
| `groups[].beats` | `{ thread, ref }`, one beat per ref on a thread | The desk finds a group's beat by thread and ref, and the last beat with that pair wins (`beatTexts` in `app/ncp/desk/lib/proposals.ts`) |
| `for` | One `miadi-chronicle:<N>` or a list, naming a desk that exists | A proposal shows only at the desks it names. 7 of the 8 proposal files that carry `for:` name Episode 560, where the writer landed on 2026-11-06 |

**Land the source first.** A beat cannot name the commit that adds the file holding it. Commit and push the folder's source, then write the file with that commit as the ref. A staged commit passes the door's check, because the folder and the episodes share a repository.

**Keep observation and proposal apart.** A beat is what happened or what was said. A group's `name` and `why` are a proposal, and the desk records them as `proposed` (`suggestionOfGroup`). An invented scene or line has no field here, because the words are the writer's.

`script.md` reaches the writer only through a beat that cites the commit that landed it. The foundations packet does not belong in this file: once the episode holds it, the agents' turn reads it.

## Carrying it at mint

The seat that mints carries the file. This is the only work that puts it in front of a writer, and it runs after the person's choice (Gate 1).

1. **Ask with the file named.** When asking for the birth, say how many threads it would carry and which desk `for` names. A yes covers those threads, unless the person leaves some out.
2. **Open each thread through the door.** After the mint proves its five stages, `POST $MIADI_API_URL/api/chronicle/episodes/<N>/threads` with `{ act: "open", code, thread, domain, wanted_result, current_reality, state, opened_at, opened_by_beat, keeper, by, dryRun: true }`, then again without `dryRun`. `keeper` is the seat that mints, until T9 names another.
3. **Add each beat through the door.** `{ act: "beat", code, ref, at, what, by, dryRun: true }`, then again without `dryRun`. Never write `threads.yaml` by hand. The door edits only `  - code:` lines at two spaces, so Episode 572's record (miadi-chronicle://572), at zero indent, answers 409 to a beat.
4. **Add one beat dated the carry day** on each `creative` thread, or on the first thread if none is: the commit that minted the episode as `ref`, and `carried from the exploration <slug>` as `what`. Latest opens on "Since you last opened" and hides a beat whose day is earlier (`app/ncp/desk/[episode]/desk-client.tsx`), so a concept staged weeks ago would arrive unseen without it.
5. **Write the groups into the episode** as `proposals/potential-threads-<yymmdd>.yaml`, with `episode`, `for`, `proposed_by`, `proposed_at` (the carry day), `source: threads.yaml` and `groups`, and commit it by path. No door writes this file. Add the new number to `for` when the writer should also see the groups at the new episode's desk.
6. **Read it back.** `GET …/episodes/<N>/threads` returns each code with its `domain`. `GET $MIADI_API_URL/api/ncp/desk/<for episode>/latest?author=<key>`, with the writer token and a key that is not the writer's and does not start with `agent-`, returns the rows and records no opening (measured: `desk-opened.json` unchanged).
7. **Mark the file.** Add `carried_to: miadi-chronicle:<N>` at its top and commit it by path. What happens to the rest of the folder is A2 in the staging circle, and this does not settle it.

If the concept is set aside, the file stays in the folder and reaches nobody.

## What a carried file gives the writer

- **On Latest, at any desk:** each beat, because the panel reads every episode's `threads.yaml`.
- **At the desk `for` names:** each group as a proposal. Accepting keeps the acceptance at the desk. It does not make a Creative version yet (jgwill/Miadi#956).
- **At the new episode's desk:** a `creative` thread is one condition of the agents' turn. The frame and the switch stay the writer's (Episode 567, `rispecs/writing-subdomain/readiness-261106.md`, F2).
- **Not reached:** nothing here reaches the non-linear engine, because the desk has no connection to it (jgwill/Miadi#957).

## Before the mint

The desk has a third door, `POST /api/ncp/desk/<episode>/suggestions?author=<key>`: a question or a spark at one author's desk, which needs no thread and no new episode. Do not send a staged concept through it yet. The desk's citation check accepts `miadi-chronicle:_staging_for_new_episodes/<slug>` and the open door answers 404 for that address, so the writer could not open the source. A suggestion also lands a commit on that person's desk, so ask them first. Whether a spark should reach a desk before its episode exists stays open.

## What was checked, 2026-11-07

Dry runs with this example on the live door, as the shared writer token. Nothing was written.

| call | answer |
|---|---|
| `open` on Episode 560 (miadi-chronicle://560), code `PT999` | 200, `domain: creative` kept |
| `beat` on Episode 560's PT1, `ref: b607b1a5` (a staged folder's commit) | 200, `a commit in the chronicle` |
| `beat` with a path in the staged folder as `ref` | 422 |
| `open` on `_staging_for_new_episodes` | 404 |
| `beat` on Episode 572's PT2 | 409, `No thread PT2 in this record` |

No person has read a file like this, and no seat has carried one.
