# miadi-deepdiver

DeepDiver for the production team (T6 in `teams/README.md`, whose name is held as William's decision D11) as a Claude Code plugin. With it, a seat turns Miadi reviews and their screenwalk videos into a Gemini Notebook, asks it questions, generates its media and keeps it, and puts that media on screen in the next screenwalk.

DeepDiver itself is Jerry's tool (`Gerico1007/deepdiver`). The factory runs the fork `miadisabelle/deepdiver`, updated on 2026-10-06 for the current Gemini Notebook interface. Its place in the factory, contract and open decisions: `docs/MIADI_FACTORY.md` in that repository.

## Install

On amd64 Ubuntu 22.04/24.04 or Debian 12, after adding the [Sanctuaire APT source](../../packages/miadi/deb/README.md):

```bash
sudo apt install miadi-deepdiver -y       # deepdiver is also an APT alias
miadi-deepdiver setup --claude            # desktop user, no sudo; preserves existing settings
miadi-deepdiver doctor --offline --claude
deepdiver chrome launch                  # persistent user profile, loopback CDP
# Human signs in once. Until then: SIGN-IN NEEDED.
deepdiver chrome status
```

`setup --claude` uses the existing marketplace plugin and the fork's embedded
`skills install --agent claude`; it does not copy this plugin or overwrite an
existing skill. A disabled plugin stays disabled: enable only its intended scope
explicitly. Restart Claude Code after installation: hooks load at session start,
not mid-session. On a host that already has the runtime, install this plugin with:

```bash
claude plugin marketplace add jgwill/miadi-orchestration-kit
claude plugin install miadi-deepdiver@miadi-orchestration-kit
```

## What it holds

| part | what it does |
|---|---|
| skill `screenwalk-notebook` | The NotebookFed and MediaMade transitions of the screenwalk media cycle: reviews and videos into a notebook (with a stored transcript for a video too new to import), questions with cited answers, infographic, video and audio overviews, Interactive and Document reports, everything kept with a manifest, and `studio open` to show it in the next screenwalk. Ends with a log the skill keeps from each run. |
| skill step 4a, a plan before the render | A Slide Deck or Video Overview stopped at its outline or producer notes by default, saved as a numbered file before anything is sent on, and each new version started from a kept one. DeepDiver `studio outline`, `studio proceed`, `--review`, `--from-outline`. |
| skill step 7, a beat for the writers | What a landing leaves the writer's page: one beat on a plot thread through the threads door, which Latest shows at every desk. The media stays in the episode. With no thread to hold it, the pass reports `NO THREAD FOR THE WRITERS` and opens none. T6's line in `teams/README.md` says the same in short. |
| `scripts/plan-read.mjs` | The seat's checks on a saved plan: `words` against `forbidden-words.txt`, and `jev`, which asks `plan-questions.json` and says whether the plan goes on, gets revised, or goes to a person. Tests: `node --test claude/miadi-deepdiver/scripts/plan-read.test.mjs`. |
| command `/deepdive` | Give it an episode, a review, or both. It finds the other, takes the review's Deep Diver line as its brief, checks Chrome is signed in, builds the notebook, asks the questions, makes the media, and lands it in the episode with `notebooks:` in `episode.yaml`. Ends with `DONE <notebook url> <commit>`. |
| command `/notebook-from-reviews` | The notebook and media only, for a set of review IDs or an episode's reviews. It never posts to a talking circle or writes into an episode. |
| command `/notebook-from-handoff` | A notebook from a handoff or spec written in a repository — a session's `docs/handoffs/*.md` and the spec it links — asked the handoff's open inquiries, with its media kept beside it (`<handoff>.notebook-<id>/`). The brief is the handoff's **The Deep Diver path.** line. First handoff written for it: jgwill/smcraft `docs/handoffs/2026-10-18-stage-and-marks.md`. |
| hook `word-gate` | PreToolUse on Write and Edit. Refuses a prompt or kept text (a file named for a prompt or under `prompts/`, and what a notebook keeps: `captures/notebook-<id>/`, `keep/`, `<handoff>.notebook-<id>/`) whose added text carries a word from `forbidden-words.txt`, and names the word and the system rule. The first entry is the word for the space between current reality and the desired outcome, written as "resolve tension". A package name that carries it (`@medicine-wheel/gap-analysis`) passes. A list and a match, no model. Tests: `node --test claude/miadi-deepdiver/hooks/word-gate.test.mjs`. |

The plugin has no MCP server. DeepDiver is a command line. `scripts/plan-read.mjs` reads Jev through lane-check's decider (`jgwill/smcraft`, `LANE_CHECK_DIR`) with `JEV_AI_API_KEY`.

## Runtime floors

- DeepDiver from `miadisabelle/deepdiver` at or after 2026-10-06. APT 0.1.0-1 pins commit `91898f367d519f8468943afcec356b839652a58c`, hash-verified with captured wheels and a hash-pinned direct upstream Chromium installer; `/usr/share/miadi-deepdiver/SOURCE.json` is authoritative. Its upstream Python metadata still says 0.1.1; it is NOT the obsolete PyPI artifact. A developer installation must pin a verified fork commit, not mutable `main`.
- Chrome on a host with a display, with CDP on 127.0.0.1:9222 and a profile signed in to the account that owns the notebooks. The fork's home is `~/.chrome-deepdiver`; the APT launcher defaults to **`~/.chrome-deepdiver-apt`** so a different browser/keyring cannot modify an existing sign-in. No profile migration is automatic; the person signs in once. `deepdiver chrome status` checks it. APT fetches the pinned browser directly from upstream (network needed first time), but never network-pips Python.
- `ffprobe` for the media data in the manifest (optional).
- The `miadi-review` skill's client for review Markdown and stored transcripts.

The skill states these again and tells the seat to stop when one is missing.

## Related

- `miadi-witness`, skill `screenwalk-presence`: what a seat says in a screenwalk, and what happens after the person plays the media.
- Episode 550, *The Screenwalk as a Media Type*; review `miadi-review:f9d6fb1e-75f4-4635-96d9-8f2d0bcff5eb`, *Screenwalk-Driven Continuity & Deep Diver Handoffs in the Miadi Factory*.
