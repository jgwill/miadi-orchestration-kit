---
name: screenwalk-notebook
description: Turn Miadi reviews and their screenwalk videos into a Gemini Notebook, ask it the episode's questions, generate and keep its media (infographic, video and audio overviews, interactive and document reports), and put that media on screen in the next screenwalk. Performs the NotebookFed and MediaMade transitions of the screenwalk media cycle with the DeepDiver CLI. Use when asked to "make a notebook from these reviews", "add the reviews and their videos to NotebookLM", "ask the notebook", "generate an infographic / video overview / report for the episode", "prepare media to play in the next screenwalk", or "deep diver", or "deep dive this episode / this review".
---

# Screenwalk notebook

The production team (T6) makes the factory's own media. A screenwalk is reviewed, the review and its video go into a notebook, the notebook answers questions and makes media, and the person plays that media in the next screenwalk and talks over it. This skill is the notebook part, done with DeepDiver (`miadisabelle/deepdiver`, a Python CLI that drives Gemini Notebook in Chrome).

It performs two transitions of the screenwalk media cycle (`~/workspace/.mino/stateloom/screenwalk-media-cycle.smdf.json`, which continues Episode 550's machine after Reviewed):

| transition | from → to | done here by |
|---|---|---|
| NotebookFed | Enriched → Notebooked | `notebook create`, `notebook add-source` |
| MediaMade | Notebooked → MediaGenerated | `notebook ask`, `studio generate`, `studio report`, `studio download` |
| PlayedWhileRecording | MediaGenerated → Watched | the person, with `studio open` putting the media on screen |

What happens after Watched (the person's spoken corrections into the talking circle diary) belongs to `screenwalk-presence` in the `miadi-witness` plugin.

DeepDiver's own operating manual is canonical in `miadisabelle/deepdiver` and is read with `deepdiver skills show notebooklm-automation`. This skill does not copy it.

## Before you start

1. **DeepDiver** from `miadisabelle/deepdiver` `main` at or after 2026-10-06. PyPI `deepdiver` 0.1.1 predates the current Gemini Notebook interface and fails on it. `pip install git+https://github.com/miadisabelle/deepdiver@main`, or from a checkout `python -m deepdiver.deepdive …`. Commands below are written as `deepdiver …`.
2. **Chrome with CDP on 9222**, signed in to the Google account that owns the notebooks (on gaia: ava@jgwill.com). DeepDiver keeps its own Chrome home, `~/.chrome-deepdiver`, where a person signs in once and every later launch reuses it. `deepdiver chrome status` answers 0 signed in, 2 not signed in, 1 no Chrome; `deepdiver chrome launch` starts the home. On 2, stop with `SIGN-IN NEEDED`. Never `--fresh` for a run: a fresh clone is not signed in, which cost a sign-in on every run until 2026-10-09. If you do not know which account holds the notebooks, ask. Never guess an account.
3. **Where the media will be kept.** In an episode: `<episode>/captures/notebook-<notebook id>/`, with `manifest.json` and `asked.md` beside the media, as Episode 550 keeps `captures/notebook-0ae51b4c-8ed2-4ee2-a641-2c7e88b7e2ea/`. The episode room shows that folder to the episode's readers (`@miadi/episode-vessel` 0.4.0). Writing there is a chronicle write: follow the `chronicle-episode` skill and the episode owner's word. Outside an episode: DeepDiver's `output/artifacts/<notebook id>/`.

## The run

Given an episode, a review, or both, `/deepdive` runs every step below and lands the media in the episode. The steps stay here so a seat can run any one of them alone.

### 1. Choose the sources

- From an episode: the `reviews:` list in its `episode.yaml`.
- From a review: the episode whose `episode.yaml` lists it (`grep -l <id> "$MIADI_CHRONICLE_ROOT"/*/episode.yaml`).
- The review's `## Intent` line that names the Deep Diver (`**The Deep Diver path.**`) is the brief: what to question the review against, and which media it wants.
- By subject: `miadi_review.py search '<words>'` (the `miadi-review` skill's client) matches review text, titles and video IDs.
- For each review: its Markdown from `https://miadi-review-service.vercel.app/review/<id>/raw`, and its video URL from the `Source` line at the top.

### 2. NotebookFed

```bash
deepdiver notebook create --source review-a.md          # prints the notebook ID
deepdiver notebook add-source <id> review-b.md review-c.md https://youtu.be/A https://youtu.be/B
```

All URLs go in one insert; files upload one by one. Read every `Not imported:` line. A video uploaded the same day has no YouTube transcript yet ("This video cannot be imported. Transcript not available."). Use the transcript the review service keeps instead:

```bash
python3 <miadi-review>/scripts/miadi_review.py transcript <review id> --out screenwalk-<stem>-transcript.txt
deepdiver notebook add-source <id> screenwalk-<stem>-transcript.txt
```

When a review has no stored transcript, say so. Generating one writes into the shared review record and costs a full video pass, so it needs the person's word.

### 3. Questions

Ask what the episode is trying to learn, one question per call, all into one file:

```bash
deepdiver notebook ask <id> "<question>" -o <dir>/asked.md
```

Answers come back as Markdown with the notebook's citations as `[n]`. They are the notebook's reading of the sources, not verified facts. Quote them as "the notebook answered".

### 4. MediaMade

```bash
deepdiver studio generate infographic -n <id> --focus "<what it should show>"
deepdiver studio generate video_overview -n <id> --focus "<audience and point>"
deepdiver studio audio -n <id> --focus "..."                       # not run on 2026-10-06
deepdiver studio generate mind_map -n <id>
deepdiver studio report --prompt "Include only the infographic and the video overview. <what to walk through>" -n <id>
deepdiver studio report --format document --template "Briefing Doc" -n <id>
```

- Make the report last, after the infographic and video have finished. Made then, an Interactive report embeds them (Episode 120, 2026-10-10); made earlier, it shows "Recommended · Infographic / Video" tiles in their place (Episodes 550 and 140).
- Video Overview has two formats: `--format short` (vertical 9:16, about a minute) and `--format explainer` (16:9, several minutes). A one-minute Short took 17 minutes to generate.
- Audio Overview can take ten minutes or more.
- Each command exits 1 when nothing was generated. A command that times out may still leave a card; `deepdiver studio list -n <id>` shows what exists.

### 5. Keep

```bash
deepdiver studio download -n <id> -o <episode>/captures/notebook-<id> --keep   # or -o output/artifacts/<id> outside an episode
```

Put `asked.md` from step 3 in the same folder. In an episode, `--keep` (DeepDiver 59888d3) makes what git keeps: the infographic as WebP, video and audio re-encoded into `keep/` (the only place the chronicle's `.gitignore` lets `.mp4` and `.m4a` in), and `kept` beside each download in `manifest.json`; commit the kept files, never the downloads. `deepdiver studio keep <folder>` does it after the fact. Then record the notebook in `episode.yaml` under `notebooks:` (`id`, `url`, `path`, the reviews with their version, the date), as Episode 550 does.

Audio `.m4a`, video `.mp4`, infographic `.png`, reports as `.md` and `.html` (read from the report viewer, since reports have no file download), and `manifest.json` with sha256, size and ffprobe codec and duration. Mind maps have no download and are listed as not downloadable. The command exits 1 when an artifact that offered a download did not land.

### 6. On screen, in the next screenwalk

```bash
deepdiver studio open --family reports -n <id>                 # Interactive report, full screen, with its table of contents
deepdiver studio open --title "<artifact title>" -n <id>
deepdiver studio open --family video_overview --play -n <id>   # starts playback; the person pauses and talks over it
```

## What to report

1. The notebook URL (`https://notebook.google.com/notebook/<id>`) and its sources: imported, and not imported with the reason.
2. The questions asked and the file that holds the answers.
3. Each artifact: family, title, and the path it was kept at.
4. Everything that failed, with the command's own words.

## When DeepDiver breaks

Gemini Notebook changes without notice. When a command fails on the interface:

1. Read the live page over CDP (Playwright `connect_over_cdp`): the controls' `aria-label`s, the dialog's text, the card's DOM.
2. Fix DeepDiver in `miadisabelle/deepdiver`, add a test, run `python -m pytest`, commit and push.
3. Add one line to the log below: the date, what changed in the interface, what was fixed.

If downloads stop starting after a file upload, look for an "Open Files" window of the debug Chrome and close it: while a file picker is open, Chrome blocks the `window.open` every Studio Download uses. DeepDiver names this cause in its failure reason.

Selectors that broke before, so they are not reintroduced: a bare `button:has-text("Add")` matches the header's "add_2 Create notebook" and creates empty notebooks; a generating card already shows its family and title; Mind Map cards say only "Artifact"; a card's identity is the UUID in its inner `id="artifact-labels-<uuid>"`; a report is read from the `labs-tailwind-doc-viewer` inside `artifact-viewer`, because every chat answer is the same element and comes first.

## Log

- **0.1, 2026-10-06.** Written by Mia from the first two production notebooks: `78507190…` (review `f9d6fb1e` and its screenwalk) and `0ae51b4c…` (Episode 550's screenwalk reviews `d64a2fdf`, `6c3f477f`, `b2558ceb`, `6a2b5b59`, their videos, and one stored transcript). That day DeepDiver was fixed for the card-menu download, notebook creation, the "Websites" source panel, completion detection and card identity, and gained Reports, `notebook ask`, `studio open` and import-failure reporting. Two of four same-day videos could not be imported.
- **0.1.1, 2026-10-07.** From the second notebook's video and downloads: Video Overview formats are Short and Explainer, and video takes far longer than other media; an open file picker blocks downloads, which DeepDiver now avoids and names.
- **0.1.2, 2026-10-07.** The T6 lead, carrying notebook 0ae51b4c into Episode 550, found that the saved Interactive report was the notebook's first chat answer. Reports saved from a notebook with chat history before `miadisabelle/deepdiver` 9cefb64 hold a chat answer and must be saved again. A signed-out Chrome profile now fails with "Not signed in" instead of reporting zero cards.
- **0.1.3, 2026-10-09.** On William's word, relayed by the Deep Diver seat: an episode keeps a notebook's media in `<episode>/captures/notebook-<notebook id>/` with `manifest.json` and `asked.md`, the shape Episode 550 set and the episode room serves. Deep Diver's open items are kept in Episode 251, `owner/open-261009.md`.

- **0.2.0, 2026-10-09.** From the Episode 140 run, on William's word ("a skill that we give it the episode or the review … and the whole process starts"): `/deepdive` takes an episode, a review, or both and runs to the landing in the episode. Every DeepDiver launch had cloned the profile into a new folder that Google did not keep signed in, so each run needed a new sign-in; DeepDiver now keeps `~/.chrome-deepdiver` signed in once, and `chrome status` says whether it is (`miadisabelle/deepdiver` 5ef6f00, Episode 251 DD8; verified live that night: the folder William signed in to was moved into the home and relaunched signed in). The first run, Episode 140, kept its 31 MB video overview out of git and its video traveled re-encoded in `keep/` at 6.5 MB. `/trynow` counts as signed out.

- **0.2.1, 2026-10-10.** From `/deepdive 120`, the command's first run by a seat that did not write it (findings F4 to F8): a review the episode lacks enters through the episode door, which writes its wheel node and edge (a hand edit left them out); the door's pinned `reviews:` version is never rewritten; the media's focus falls back to the episode's goal; each review's open inquiries are one question; one `notebooks:` shape for every episode; `studio download --keep` replaces the hand conversion, and its manifest records what is kept.

## Related

- `screenwalk-presence` (plugin `miadi-witness`): what a seat says in a screenwalk, and what happens after the playback.
- `miadi-review`: the review client, step 1 of the review process.
- `miadisabelle/deepdiver` `docs/MIADI_FACTORY.md`: DeepDiver's place in the factory, its contract and open decisions.
- Episode 550, *The Screenwalk as a Media Type*, and review `miadi-review:f9d6fb1e-75f4-4635-96d9-8f2d0bcff5eb`, where this use of Deep Diver was first discussed.
