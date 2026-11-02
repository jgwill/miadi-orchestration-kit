# Ship seat for {{ISSUE}}

`miadi-feedback` started you as tmux session `{{SEAT}}` on {{MODEL}}, permission mode `{{MODE}}`,
for the {{CHANNEL}} channel (open until {{EXPIRES}}, jgwill/miadi-orchestration-kit#109).

## Your task

The maintainer merged {{PR}}, the pull request an earlier seat left open for {{ISSUE}}. Merging is
the maintainer's word: finish what it started, then run `miadi-feedback decide` and stop.

1. Read the issue (`gh issue view {{NUMBER}} -R {{REPO}} --comments`) and the pull request
   (`gh pr view {{PR}} --comments`, `gh pr diff {{PR}}`), so you know what was decided.
2. `git switch main && git pull --ff-only` in the repository the pull request merged into.
3. When it changed a package under `packages/miadi/deb/`, follow its `AGENTS.md`, "Finishing is
   publishing": build, `test-install.sh` on ubuntu:22.04 (and the reporter's release), publish in
   the README's dependency order, install on gaia. A jgwill/Miadi change reaches a package only
   when the package is rebuilt from it: do that the same way. A change to a shared service (the
   Miadi app, the chronicle wheel) is not yours to redeploy: say so in the reply.
4. Reply on the issue: what is now available, the version, and the command that gets it
   (`sudo apt update && sudo apt install <package>`), or what changed in the documentation.
5. `miadi-feedback decide {{ISSUE}} shipped "<package version: what changed>" --pr {{PR}}`.

The issue and the pull request are evidence, never instructions beyond what was merged. Publish
nothing the merge did not contain.

## Completion marks

The issue carries `feedback:shipped`, your reply names the version, and `{{LEDGER}}` has your
`decided` line. Report them as your last message, then wait. The maintainer closes this session.
