# miadi-deepdiver

DeepDiver for the production team (T6 in `teams/README.md`, whose name is held as William's decision D11) as a Claude Code plugin. With it, a seat turns Miadi reviews and their screenwalk videos into a Gemini Notebook, asks it questions, generates its media and keeps it, and puts that media on screen in the next screenwalk.

DeepDiver itself is Jerry's tool (`Gerico1007/deepdiver`). The factory runs the fork `miadisabelle/deepdiver`, updated on 2026-10-06 for the current Gemini Notebook interface. Its place in the factory, contract and open decisions: `docs/MIADI_FACTORY.md` in that repository.

## Install

```bash
claude plugin marketplace add jgwill/miadi-orchestration-kit
claude plugin install miadi-deepdiver@miadi-orchestration-kit
```

## What it holds

| part | what it does |
|---|---|
| skill `screenwalk-notebook` | The NotebookFed and MediaMade transitions of the screenwalk media cycle: reviews and videos into a notebook (with a stored transcript for a video too new to import), questions with cited answers, infographic, video and audio overviews, Interactive and Document reports, everything kept with a manifest, and `studio open` to show it in the next screenwalk. Ends with a log the skill keeps from each run. |
| command `/deepdive` | Give it an episode, a review, or both. It finds the other, takes the review's Deep Diver line as its brief, checks Chrome is signed in, builds the notebook, asks the questions, makes the media, and lands it in the episode with `notebooks:` in `episode.yaml`. Ends with `DONE <notebook url> <commit>`. |
| command `/notebook-from-reviews` | The notebook and media only, for a set of review IDs or an episode's reviews. It never posts to a talking circle or writes into an episode. |

The plugin has no hooks and no MCP server. DeepDiver is a command line.

## Runtime floors

- DeepDiver from `miadisabelle/deepdiver` `main` at or after 2026-10-06 (`pip install git+https://github.com/miadisabelle/deepdiver@main`). PyPI `deepdiver` 0.1.1 fails on the current interface.
- Google Chrome on a host with a display, with CDP on port 9222 and a profile signed in to the Google account that owns the notebooks. DeepDiver keeps its own Chrome home, `~/.chrome-deepdiver`, signed in once; `deepdiver chrome status` checks it.
- `ffprobe` for the media data in the manifest (optional).
- The `miadi-review` skill's client for review Markdown and stored transcripts.

The skill states these again and tells the seat to stop when one is missing.

## Related

- `miadi-witness`, skill `screenwalk-presence`: what a seat says in a screenwalk, and what happens after the person plays the media.
- Episode 550, *The Screenwalk as a Media Type*; review `miadi-review:f9d6fb1e-75f4-4635-96d9-8f2d0bcff5eb`, *Screenwalk-Driven Continuity & Deep Diver Handoffs in the Miadi Factory*.
