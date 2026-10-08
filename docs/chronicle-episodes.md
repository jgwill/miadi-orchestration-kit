# Chronicle Episodes

The canonical text is [`skills/chronicle-episode/SKILL.md`](../skills/chronicle-episode/SKILL.md). This page gives the order of the work and where each step is written. Read the named section before acting on a step.

## The doors

Every verb has up to three doors, tried in this order:

1. **API**: the Miadi app at `MIADI_API_URL`, under `/api/chronicle/episodes`, `/api/circles` and `/api/ceremony`.
2. **MCP**: `inquiry-weave-mcp`, loaded by the `miadi-chronicle-episode-kit` plugin with `miadi-voice` and the chronicle wheel server.
3. **CLI**: `mkepisode`, `inquiry-weave`, `passages`, from npm or from the `miadi-chronicle-client` apt package.

Raw `git` and `curl` serve as proof, not as the way to act.

## The order of work

| Step | API | MCP | CLI | Skill |
| --- | --- | --- | --- | --- |
| Claim a number | `GET /api/chronicle/episodes?number=N` | `chronicle_episode_number` | compare the ledger and `origin/main` | S4 |
| Mint the vessel | `POST /api/chronicle/episodes` | `chronicle_episode_mint` | `mkepisode -n -t -g -r --register` | S4 |
| Commit and push it | done by the API (`land: true`) | | named files, `Ref: owner/repo#n`, main only | S5 |
| Report its stages | `GET /api/chronicle/episodes/<ref>` | `chronicle_episode_status` | `inquiry-weave resolve miadi-chronicle:<N> --verify` | S6 |
| Relate an artefact, author lineage | the episode API | `inquiry-weave-mcp` | `inquiry-weave` | S7, S8 |
| Ask the person something | `/api/chronicle/attention` | `chronicle_attention_*` | `passages attention` | S9 |
| Add a Miadi review | `POST …/episodes/<ref>/reviews` | `chronicle_episode_review` | | S16 |
| Open a ceremony in a circle | `POST /api/circles/<circle>/ceremonies` | | | S15 |
| Name a ceremony in the text | | | | S17 |
| Repair a hand-made directory, a receipt | | | `mkepisode --adopt`, `reconcile.py`, `redeem-receipt.sh` | S10 |

## Five stages, five proofs

An episode exists when all five are proven. Report the last stage proven, never the last stage attempted. `mkepisode` exits 0 whether or not registration happened.

| Stage | Proof |
| --- | --- |
| 1 created | `episode.yaml` is in the directory under `MIADI_CHRONICLE_ROOT` |
| 2 committed | `git log -1 -- <ledger>/<directory>`, run from the ledger's git root, prints a line |
| 3 pushed | `git rev-list --count origin/main..main` prints 0 after a fetch |
| 4 registered | `GET $MIADI_CHRONICLE_MW_URL/api/nodes/chronicle:<directory>` answers 200 |
| 5 receipt verified | `.mw-registration.json` reads `registered` or `already-registered`, with the url of `MIADI_CHRONICLE_MW_URL` |

The app's chronicle pages answer 200 for any name, so only the wheel's `/api/nodes/` proves stage 4. The exact commands are in S1.

## Rules that prevent the usual failures

- **Never `mkdir` an episode.** The plugin's hook refuses it and answers with the `mkepisode` command. A directory without `episode.yaml` registers and reads healthy on the wheel while lineage and `/chronicle` cannot see it.
- **Environment names, never literals.** `MIADI_CHRONICLE_ROOT`, `MIADI_CHRONICLE_MW_URL`, `MIADI_API_URL` (S2). The host `mw.tail3b11eb.ts.net` is offline since 2026-07-29, and a receipt naming it is repaired, not committed.
- **The ledger is main only.** Add files by name, never `git add .`. No branches, no force push, no stash to make a tree look clean.
- **Raw media stays out of git.** Takes go under `captures/<stem>/` and are ignored at the git root (S12).
- **People speak for themselves.** Opening a circle or speaking a turn needs the person's token (`MIADI_PERSON_TOKEN`) or a seat's own; the shared writer token is refused (S15).
- **Link a ceremony, never copy it.** Write `miadi-ceremony:<id>` in the vessel's text. The page then shows the turns only to the people the circle admits (S17).

## What a vessel holds

```
<date>-episode-NNN-<slug>/
  episode.yaml            the manifest
  .mw-registration.json   the receipt
  script.md               the spine; chapter-NN-*.md are its segments
  attention.json          questions for the person
  inquiry/                related artefacts (inquiry-weave)
  captures/<stem>/        capture.json and transcriptions
  ceremonies/<id>/notes.md
  episode.mp3             rendered voice
```

The room at `/chronicle/<episode>` reads these by filename (S11).

## Not in this skill

Book promotion to Twine, voice and playback, finding related episodes, and which host a name points to each have their own skill. S13 lists them with their owners.
