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
- **Both**: use them. If the episode does not list the review yet, it is added to `reviews:` when the media lands (step 6).
- Read each review's current version and Markdown: `https://miadi-review-service.vercel.app/review/<id>/raw`. Its header names the video (`> https://youtu.be/...`) and its `branches:`.

## 2. The brief comes from the review

A review says how it will be used next, under `## Intended Use & Continuation` (older reviews: `## Intent`).

- **A line that names the Deep Diver** (`**The Deep Diver path.**`, or `production/deepdiver` in the header's `branches:`) is the brief: what the notebook questions the review against, and which media it wants (an image of the episode's essence, a short cut, a report).
- **Questions**, two to four: the ones given in the arguments, word for word. Otherwise the person's own questions for the run. Otherwise the review's `### Open inquiries for the community`, one question each, or its `## Potential Future questions` headings.
- **Other sources the brief names** ("against Episodes 339, 550 and 551"): those episodes' reviews, as Markdown.
- **Not done here**: a video cut by timecode (DeepDiver does not edit video), publishing anywhere, talking circle posts.

## 3. Chrome, signed in

```bash
deepdiver chrome status            # 0 signed in · 2 not signed in · 1 no Chrome on 9222
deepdiver chrome launch            # when 1: starts DeepDiver's own home, ~/.chrome-deepdiver
```

When status says 2, stop with one line, `SIGN-IN NEEDED`. The person signs in once in that window, and the home keeps it for every later run. Never use `--fresh` for a run: a fresh clone is not signed in.

## 4. The notebook

If the episode's `notebooks:` already lists a notebook made from these reviews, continue that one: add only the missing sources (`deepdiver notebook resume <id> -s …`), ask only the new questions into the same `asked.md`, and generate only the media it lacks. Otherwise, as the skill says: `notebook create` from the first review's Markdown, then every other review and every video in one `notebook add-source`. A video that does not import gets the review's stored transcript instead. Then each question into one `asked.md`.

## 5. The media

An infographic focused on what the Deep Diver line asks for (for "an image of the episode's essence": the episode's essence), a video overview, then an Interactive report whose prompt names those two to embed. Then `studio download` into `captures/notebook-<id>/` of the episode, with `asked.md` beside the media.

## 6. Land it in the episode

In the episode's `episode.yaml`:

```yaml
notebooks:
  - id: <notebook id>
    url: https://notebook.google.com/notebook/<notebook id>
    path: captures/notebook-<notebook id>
    reviews: [<review id>@v<version>, ...]
    made: <YYYY-MM-DD>
```

and each review's `version:` under `reviews:` set to the version used. Write a short `README.md` in the notebook folder: sources (imported and not), questions, each artifact and its file.

The chronicle is main-only and shared by several seats: stage by name, `git commit -- <paths>`, `git fetch` and integrate before `git push`, never reset. Git keeps every byte for good here, because main is never rewound. So before committing:

- **The infographic as WebP**, the room's image rule (jgwill/Miadi#743): `ffmpeg -v error -i <file>.png -c:v libwebp -quality 90 -map_metadata -1 <file>.webp`, then remove the PNG. Episode 140's went from 4.5 MB to 280 KB. `manifest.json` keeps the download's sha256; the README says it was converted.
- **Video and audio in `keep/`.** The chronicle ignores `.mp4` and `.m4a` everywhere else. Re-encode first: `ffmpeg -v error -i <in>.mp4 -c:v libx264 -preset slow -crf 30 -tune stillimage -c:a aac -b:a 64k -movflags +faststart -map_metadata -1 keep/<same name>.mp4`. Episode 140's 6-minute overview went from 31 MB to 6.5 MB with clean frames. The download stays on disk, out of git.
- Never `git add -f`.

## 7. Report

The notebook URL, the sources, the questions and their file, each artifact with its path, every failure in the command's own words. End with one line:

`DONE <notebook url> <chronicle commit>`
