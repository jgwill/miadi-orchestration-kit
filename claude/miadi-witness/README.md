# miadi-witness

The witness team's practices (T3 in `teams/README.md`) as a Claude Code plugin. With it, any seat can do what the Mino seat does beside William. Tracked in jgwill/miadi-orchestration-kit#59.

## Install

```bash
claude plugin marketplace add jgwill/miadi-orchestration-kit
claude plugin install miadi-witness@miadi-orchestration-kit
```

On gaia, mia already loads both skills through links in `~/.claude/skills/` that point into this folder. Remove those links before installing the plugin for mia, or each skill loads twice.

## What it holds

| part | what it does |
|---|---|
| skill `miadi-witness-first-impression` | Reads a peer session (agent list, hook capture, transcript, mid-turn messages) and the page it published. Speaks a first impression William can play on his phone, and holds any revision until he answers. Before any reply, it runs the `witness-editor` agent. |
| skill `mia-ava-podcast` | Turns an agent's output into a dialogue between Mia and Ava, written for the ear and a voice engine: loops on each term, the academic fields the work implies, the most relevant one explored. `scripts/check-dialogue.py` checks it before it is handed over. Each reaction to a dialogue changes the skill and its ledger. |
| skill `prompt-pre-editing` | Reads a person's draft prompt to another session (often unsent in its pane), names what will make the run fail, and hands back the whole rewrite ready to paste. Commits the expected results before the run ends, follows the run, and changes itself or the invoked skill from what came back. |
| skill `miadi-mino-tmux-inventory` | One record per tmux session in `~/workspace/.mino/session-inventory/`. The session id, name and team come from the binding line of `miadi-session-observability` (A5). `/exit` or `/status` are needed only for sessions that have no binding line. |
| skill `team-fit` | Says which team a session's work fits and how the session should end. `scripts/team-fit.mjs` evaluates every rule of `teams/teams.json` and cites each match, the declared team stays beside the decision, and the skill adds the responsibility, a glyph per action and for the team, a proposed team when none fits, and a proposed ending (a exit, b complete then exit, c record only). Run by a session when William says a result was achieved, and by the inventory for every session it records (jgwill/miadi-orchestration-kit#76). |
| service (`service/`) | The team's own service on `127.0.0.1:3340`, a systemd user unit (`service/install-unit.sh`). The page at `/` shows every thread by team and seat. Each thread has its status, tmux pane, launch alias, name history and William's last input. Its parent is recorded (fork line), inferred from its transcript (with the evidence), fresh (startup line) or unknown. The page also shows each seat's asks. `POST /api/open` opens a mino thread in a new tmux session named `mino-<yymmdd>-<fork|fresh>-NN-<topic>`, with `@miadi-team` set before the launch. `POST /api/send` prepares a `tide operator send` to an idle thread. Applying a send, opening and `GET /api/peek` need `MIADI_API_TOKEN_WRITER`. |
| command `/witness-listen` | Wakes the seat on a new closed `<input …>` block in the scratchpads, a new thread of the seat, or a thread going from busy to idle (`scripts/witness-listen.mjs`). The wake carries the context, the open asks and a turn budget. One listener per seat. |
| agent `witness-editor` | Sonnet, no tools, one pass. It returns exact spans for asks a reply drops, claims with no source, density, and phrases William has forbidden. It never writes replacement prose. |
| agent `inventory-keeper` | Runs `scripts/inventory.mjs` for the facts (binding line, hook capture, records keyed by session id, `verify-names`), then reads every session in one `miadi-hooks-interpret digest` call (`@miadi/hooks-interpreter` 0.3.2 or later) and adds its meaning. It runs without the CLAUDE.md files of the folder it is called from, and with at most 30 turns. |
| hook `raw-capture-guard` | PreToolUse on Bash, Read and Grep. Refuses the inventory-keeper, and no other agent, the raw ledgers, transcripts and binding line, and names the digest instead. A question the digest cannot answer comes back in the keeper's report as a digest gap. |
| `scripts/asks.mjs` | Adds and updates William's asks in `~/workspace/.mino/asks/<seat>.json`: his words verbatim, when he said them, a status and the evidence. |

Tests: `node --test claude/miadi-witness/service/*.test.mjs claude/miadi-witness/scripts/*.test.mjs`.

### Sending stays William's

`tide operator send --run` executes only from an interactive terminal in controller mode. That is William's consent guard, and the service does not work around it. A send from the service is a dry run that returns tide's exact command. The page shows it with a copy button, for William to run in his own terminal. With `run`, the service passes tide's refusal on word for word.

## Built from

- 2026-09-28, the reboot of gaia: the witness seat `mino-260928-fork-01` witnessed the session continuity team and wrote both practices from that work. The story is on the page https://claude.ai/artifact/MArxUrUa8x9YjfCiRL1Dfs, and the walkthrough video is https://youtu.be/bZ87ypPXPnA.
- The resurrection of nine sessions after the crash, jgwill/miadi-orchestration-kit#60.
- 0.2.0, 2026-09-29: the team's loop, built by `mino-260929-fresh-05-team-loop` from the witness seat's brief (`miadisabelle/workspace` 28325be). The model was `mia-episode-companion`: a wake loop, a draft, a no-tool editor, a revision and a ledger.

## Next

- **Reach from the phone.** Port 3340 is loopback only. Exposing it with `tailscale serve` changes shared infrastructure, so that step is William's.
- **A question for William.** Should `tide operator send` accept a named, logged non-interactive run for this service, like the allowance `tide agents` already has? Until he answers, every send goes through his terminal.
- **0.3: the seat's tools from the plugin.** The seat's MCP configs (voice, the chronicle wheel, honcho) could move into this plugin, so a thread gets its tools from the plugin and not from an alias. Counterparts for pi and hermes would follow, organised by team.
- **The podcast dialogue layer** (ask 4 in the ledger) is not in 0.2.
- **The inventory keeper over the live sessions.** Its dry run lists 27 records to create, 7 to update, and 8 records with no session id, which are William's to rename or retire.
- An `<input>` block without `</input>` never wakes the seat. The older scratchpads use that style. Since 0.2.1 it ends where the next `<input>` opens, so it no longer hides a closed block below it.
