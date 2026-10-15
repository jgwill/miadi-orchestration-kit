---
description: Give it an episode, a review, or both, and run the whole Deep Diver pass - notebook, the episode's questions, media, and the media landed in the episode
argument-hint: "<episode number or folder> [review id ...] | <review id> [\"questions\" ...]"
allowed-tools: Bash, Read, Write, Edit
---

Follow the `screenwalk-notebook` skill of this plugin, from the first step to the landing in the episode.

Arguments: `$ARGUMENTS`

## 1. Resolve the episode and the reviews

- **An episode** (number like `140`, or its folder name): the reviews are its `episode.yaml` `reviews:` list.
- **A review id**: the episode is the one whose `episode.yaml` lists it under `reviews:`:
  `grep -l '<review id>' "$MIADI_CHRONICLE_ROOT"/*/episode.yaml`. If no episode holds it, stop with `NO EPISODE HOLDS <review id>`. Putting a review into an episode is the `chronicle-episode` skill's episode door, a separate act.
  Several episodes can hold one review (4346d23a: Episode 552 `discusses` it, Episode 555 `surveys` it with twelve others). The media lands in the episode the review is about: a map of where reviews belong (Episode 555's `review-episode-map.md`) names it; otherwise the one whose relation is not a survey. If two remain, stop with `SEVERAL EPISODES HOLD <review id>: <folders>`.
- **Both**: use them. A review the episode does not list yet enters through the episode door before the notebook is made (`chronicle-episode` skill, S16). The door writes the `reviews:` entry and the review's node and edge on the wheel, which a hand edit does not:
  ```bash
  curl -s -X POST "$MIADI_API_URL/api/chronicle/episodes/<episode folder name>/reviews" \
    -H "Authorization: Bearer $MIADI_API_TOKEN_WRITER" -H 'content-type: application/json' \
    -d '{"review":"<review id>","relation":"is-screenwalked-in","ceremony":false}'
  ```
  Name the episode by its folder name: a number can answer for two folders (`episode_ambiguous`, Episode 120). `relation` completes "Episode <relation> Review"; `is-screenwalked-in` when the review covers the episode's screenwalk. `ceremony: false` because a talking circle opens only for a person. The door pins the version; never rewrite a `reviews:` version by hand.
- Read each review's current version and Markdown: `https://miadi-review-service.vercel.app/review/<id>/raw`. Its header names the video (`> https://youtu.be/...`) and its `branches:`.

## 2. The brief comes from the review

A review says how it will be used next, under `## Intended Use & Continuation` (older reviews: `## Intent`).

- **A line that names the Deep Diver** (`**The Deep Diver path.**`, or `production/deepdiver` in the header's `branches:`) is the brief: what the notebook questions the review against, and which media it wants (an image of the episode's essence, a short cut, a report).
- **No Deep Diver line** (Episode 120's reviews had none): the media's focus is the episode's `goal:` in `episode.yaml`.
- **Questions**, two to four: the ones given in the arguments, word for word. Otherwise the person's own questions for the run. Otherwise one per review: that review's `### Open inquiries for the community` paragraph, asked whole as one question. Otherwise its `## Potential Future questions` headings. A review with none of these (4346d23a) gets two written here, and the README says so: what its screenwalk shows working against what it states only as requirements (its `## Aspects` and `### Results` draw that line), and what the episode's goal asks of what the review describes.
- **Other sources the brief names** ("against Episodes 339, 550 and 551"): those episodes' reviews, as Markdown.
- **Not done here**: a video cut by timecode (DeepDiver does not edit video), publishing anywhere, talking circle posts.

## 3. Chrome, signed in

```bash
deepdiver chrome status            # 0 signed in · 2 not signed in · 1 no Chrome on 9222 · 3 a tab hangs
deepdiver chrome launch            # when 1: starts DeepDiver's own home, ~/.chrome-deepdiver
```

When status says 3, stop with one line, `CHROME BLOCKED: <the tab that hangs>`. That Chrome is also a person's browser: never close or reload their tab. The run resumes when every tab answers (DeepDiver 0e9fe65 names the open tabs). When status says 2, stop with one line, `SIGN-IN NEEDED`. The person signs in once in that window, and the home keeps it for every later run. Never use `--fresh` for a run: a fresh clone is not signed in.

## 4. The notebook

If the episode's `notebooks:` already lists a notebook made from these reviews, continue that one: add only the missing sources (`deepdiver notebook resume <id> -s …`), ask only the new questions into the same `asked.md`, and generate only the media it lacks. Otherwise, as the skill says: `notebook create` from the first review's Markdown, then every other review and every video in one `notebook add-source`. A video that does not import gets the review's stored transcript instead. Then each question into one `asked.md`.

## 5. The media

An infographic focused on what the Deep Diver line asks for (for "an image of the episode's essence": the episode's essence; with no line: the episode's goal), a video overview, then an Interactive report whose prompt names those two. The saved report never holds the media: in all four runs (Episodes 550, 140, 120, 552) its HTML shows "Recommended · Infographic" and "Recommended · Video" tiles where they would be, whatever the order they were made in. The media are kept as their own files, and the README says so.

```bash
deepdiver studio download -n <id> -o <episode>/captures/notebook-<id> --keep
```

`--keep` (DeepDiver 59888d3 or later) makes what git keeps: the infographic as WebP (quality 90, no metadata, PNG removed; 4.5 MB became 280 KB), video and audio re-encoded into `keep/` (31 MB became 6.5 MB), reports as downloaded, and `kept` beside each download in `manifest.json`. The chronicle ignores `.mp4` and `.m4a` outside `keep/`, so the downloads stay on disk, out of git. `deepdiver studio keep <folder>` does the same on a folder already downloaded. Put `asked.md` beside the media.

## 6. Land it in the episode

Commit the kept files first (below), then hold the notebook through the episode's notebook door, the `chronicle_episode_notebook` tool of the chronicle-episode kit (`inquiry-weave-mcp`). It writes the `notebooks:` entry, the `notebook:<uuid>` node and the episode's edge on the wheel, which a hand edit does not:

```
chronicle_episode_notebook {episode: "<episode folder name>", notebook: "<notebook id>", relation: "cites",
  made_by: "miadisabelle/deepdiver <commit> with /deepdive (miadi-deepdiver <version>), <who ran it>",
  sources: ["miadi-review:<review id> v<version used>", "<video url>"], land: false}
```

`land: false`, then commit `episode.yaml` by name: landing stages more of the vessel than the entry. The door lists every file in the folder, the git-ignored downloads too (Episode 552, 2026-10-15); remove those from `files:` so the entry names only what git keeps. It writes quoted strings, so edit the quoted line.

The version a notebook used goes in its `sources:`; the `reviews:` entry keeps the version the door pinned. Write a short `README.md` in the notebook folder: sources (imported and not), questions, each kept file, anything a reader should check (the answers are the notebook's reading, not verified facts).

The chronicle is main-only and shared by several seats: stage the kept files by name, `git commit -- <paths>`, `git fetch` and integrate before `git push`, never reset, never `git add -f`. Main is never rewound, so every committed byte stays: commit the kept files, never the downloads.

## 7. Report

The notebook URL, the sources, the questions and their file, each artifact with its path, every failure in the command's own words. End with one line:

`DONE <notebook url> <chronicle commit>`
