---
description: Build a Gemini Notebook from a handoff or a spec written in a repository (not a Miadi review), ask it the handoff's open questions, and generate and keep its media beside the handoff
argument-hint: "<handoff.md> [more .md or URLs] [\"question\" ...]"
allowed-tools: Bash, Read, Write
---

Follow the `screenwalk-notebook` skill of this plugin for the runtime floor, the notebook and the
media. What differs from `/notebook-from-reviews`: the sources are Markdown files in a repository —
a session's handoff (`docs/handoffs/*.md`), the specs it links (`rispecs/*.md`), a skill — and the
media lands beside the handoff, not in an episode.

Arguments: `$ARGUMENTS`

1. **The sources.** The first argument is the handoff. Read it. Add each file it links that the
   arguments do not already name and that holds what it is about — its spec, its skill — at most
   four. A raw GitHub URL is read as given; a local path must exist. Quoted arguments are questions.
2. **The brief is in the handoff.** Its `## Intended Use & Continuation` section's **The Deep Diver
   path.** line says what the notebook is asked and which media it wants. No such line: the media's
   focus is the handoff's `## The ask`, else its title.
3. **The questions**, two to four: the quoted arguments, word for word; else each item of the
   handoff's `### Open inquiries for the community`, asked whole; else two written here from its
   `## Aspects` against its `## Results` — what it shows working against what it only states — and
   the README says so.
4. **Runtime floor** (`deepdiver chrome status`): stop with `SIGN-IN NEEDED` or `CHROME BLOCKED:
   <tab>` as the skill says. Never close a person's tab, never `--fresh`.
5. **NotebookFed**: `deepdiver notebook create --source <handoff.md>`, then the other sources in one
   `deepdiver notebook add-source`. Each question into one `asked.md`.
6. **MediaMade**: what the Deep Diver line asks for — by default an infographic focused on its
   subject and a video overview — then an Interactive report whose prompt names them.
7. **Keep it beside the handoff**: `deepdiver studio download -n <id> -o <handoff dir>/<handoff
   stem>.notebook-<id> --keep`, `asked.md` in the same folder, and a short `README.md` there:
   sources (imported and not), questions, each kept file, and that the answers are the notebook's
   reading, not verified facts. Commit only the kept files and the README, by name, in the
   repository that holds the handoff, on the branch it is on; never the raw downloads, never
   `git add -A`. Do not push to another branch, post to a circle, or write into an episode.
8. **Report**: the notebook URL, the sources, the questions and their file, each artifact with its
   path, every failure in the command's own words. End with one line:

   `DONE <notebook url> <commit or "not committed: <why>">`
