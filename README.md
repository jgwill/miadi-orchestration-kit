# miadi-orchestration-kit

The agent-host side of the Miadi Factory: Claude Code plugins, host-neutral skills, hooks and apt packages. With them an agent opens and closes Chronicle episodes, records its own session, comes back after a reboot, and puts its work in front of a person who can judge it.

- Docs site: https://docs.miadi-orchestration-kit.jgwill.com
- For agents: [`llms.txt`](llms.txt)

## Start here: the chronicle-episode skill

The Miadi Factory makes agent-made work inspectable and revisitable. It connects the originating question, the session trace, the interface evidence, explicit criteria, and a person's judgment. A Chronicle episode is where they meet, so [`skills/chronicle-episode`](skills/chronicle-episode/SKILL.md) is the skill this kit is used for. It is the one entry point for episode work on any host: mint a vessel, prove its five stages, register it on the chronicle wheel, relate inquiries and lineage, raise Attention items, open ceremonies and talking circles, add Miadi reviews.

One copy of the skill lives here. The `miadi-chronicle-episode-kit` plugin links it in, and [`scripts/install-chronicle-skill.sh`](scripts/install-chronicle-skill.sh) points every other skill layer on a host at it. [`jgwill/Miadi`](https://github.com/jgwill/Miadi) builds the runtime the skill calls: the episode API, the `@miadi/*` packages, the web app, the chronicle and review services.

| An episode needs | Carried by |
| --- | --- |
| its vessel, five stages, ceremonies and reviews | [`claude/miadi-chronicle-episode-kit`](claude/miadi-chronicle-episode-kit): the skill, a hook that refuses `mkdir` under the chronicle root, and the inquiry-weave, miadi-voice and chronicle wheel MCP servers |
| the sessions that worked in it | [`claude/miadi-session-observability`](claude/miadi-session-observability): each session's binding line names the episode it works in |
| a companion seated in it | [`claude/mia-episode-companion`](claude/mia-episode-companion): a voice take from the phone lands in the episode and wakes Mia |
| its screenwalks | `screenwalk-presence` in [`claude/miadi-witness`](claude/miadi-witness), and `/close-screenwalk` in `mia-episode-companion`, whose closing reaches the review |
| media from its reviews | [`claude/miadi-deepdiver`](claude/miadi-deepdiver): Gemini notebooks from the episode's reviews and screenwalk videos |
| a person's judgment | `miadi-witness`: first impressions William can play, revisions held until he answers |
| its commands on a machine | the `miadi-chronicle-client` package (`mkepisode`, `inquiry-weave`, `passages`, the MCP servers) and `miadi-terminal` (clickable `miadi-chronicle:` references) |
| explicit criteria | no kit lane yet |

Guides that go with this README: [the order of episode work](docs/chronicle-episodes.md), [the glossary](docs/glossary.md), [machine setup and recovery](docs/machine-setup-and-recovery.md), [adding to the kit](docs/adding-to-the-kit.md).

## Teams

Seven teams share this kit since 2026-09-28. Each writes its practice here as a skill or a plugin. Leads, sessions and status: [`teams/README.md`](teams/README.md), and [`teams/teams.json`](teams/teams.json) for machines.

| Team | Works at | Ships here |
| --- | --- | --- |
| T1 Session continuity | the machine | `miadi-session-observability`, the `miadi-tide`, `miadi-tmux` and `miadi-terminal` packages |
| T2 Event path | the application | nothing yet |
| T3 Witness | between William and the building teams | `miadi-witness` |
| T4 Chart path | the application | [`skills/chart-path`](skills/chart-path/SKILL.md) |
| T5 Production context exploration | before an episode | nothing yet |
| T6 Production | after an episode | `miadi-deepdiver` |
| T7 Operator desk | between William and the whole factory | `miadi-operator-desk` |

Results the teams made that can be used again, in an episode, a documentary or a Page post: [`catalogue/README.md`](catalogue/README.md).

## Claude Code plugins

Add the marketplace once, then install by name:

```bash
claude plugin marketplace add jgwill/miadi-orchestration-kit
claude plugin install miadi-chronicle-episode-kit@miadi-orchestration-kit
```

A plugin outside the marketplace loads from a checkout with `claude --plugin-dir <kit>/claude/<plugin>`.

| Plugin | Use it for | In the marketplace |
| --- | --- | --- |
| [`miadi-chronicle-episode-kit`](claude/miadi-chronicle-episode-kit) | minting, registering and closing Chronicle episodes. A hook refuses `mkdir` under the chronicle root. Carries the inquiry-weave, miadi-voice and chronicle medicine-wheel MCP servers | yes |
| [`miadi-session-observability`](claude/miadi-session-observability) | every Claude Code event under `<root>/<session_id>/`, a binding line per session (tmux pane, command line, names, team, episode), and the session-continuity skill | yes |
| [`miadi-witness`](claude/miadi-witness) | threads by team and seat, William's asks ledger, an editor pass on replies, the session inventory with team fit, spoken first impressions, screenwalk presence | yes |
| [`mia-episode-companion`](claude/mia-episode-companion) | Mia bound to one episode: a voice take from the phone wakes the session, and answers pass a developmental editor | yes |
| [`ava-companion`](claude/ava-companion) | `/ava` invites Ava into a session, her presence returns after a resume, and her diary is written from the transcript | yes |
| [`miadi-stateloom`](claude/miadi-stateloom) | the stateloom MCP server and its design skills: data, behaviours and scenarios designed as one system, checked and replayed | yes |
| [`miadi-deepdiver`](claude/miadi-deepdiver) | Miadi reviews and screenwalk videos into a Gemini Notebook, cited answers, generated media kept with a manifest | yes |
| [`miadi-operator-desk`](claude/miadi-operator-desk) | questions about how the factory works, answered from the owning team's text and kept in a ledger | yes |
| [`miadi-pi-network`](claude/miadi-pi-network) | a Claude Code session as a peer on the [Pi Network hub](pi/miadi-pi-network), through the `mpn` CLI | no |
| [`miette`](claude/miette) | a Two-Eyed Seeing check: a Stop hook measures Mia's and Miette's share of an output | no |
| [`miadi-session-orchestrator`](claude/miadi-session-orchestrator) | the review role in plan-insight pipelines | no |

## Apt packages

`sudo apt install miadi` makes a machine a Miadi host. A client installs `miadi-terminal` and `miadi-chronicle-client`. Every package, its build and its tests: [`packages/miadi/deb`](packages/miadi/deb/README.md).

```bash
curl -fsSL https://apt.sanctuaireagentique.com/sanctuaire-agentique.gpg \
  | sudo tee /usr/share/keyrings/sanctuaire-agentique.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/sanctuaire-agentique.gpg] https://apt.sanctuaireagentique.com stable main" \
  | sudo tee /etc/apt/sources.list.d/sanctuaire-agentique.list
sudo apt update && sudo apt install miadi
```

| Package | Gives the machine |
| --- | --- |
| `miadi` | the host: the packages below join it as dependencies |
| `miadi-config` | `/etc/miadi/miadi.env` and the `miadi-config` command |
| `miadi-tide` | the review loop (`tan`, `plannotator-tui`) and the tide runtime that brings agents back after a reboot |
| `miadi-tmux` | tmux 3.7c in place of the distribution's, so a host runs one tmux version |
| `miadi-terminal` | clickable `miadi-chronicle:`, `miadi-circle:` and `miadi-ceremony:` references in the desktop, Terminator, tmux and Termux, and the tmux restore layer |
| `miadi-chronicle-client` | `inquiry-weave`, `passages`, `mkepisode` and the chronicle MCP servers, run by a private Node 24 (`miadi-node`) |
| `miadi-chronicle-server` | the capture service, transcription, the hooks and `plan-insight-register` |
| `miadi-perms` | group read and write on the shared session capture |
| `miadi-music` | ABC to MIDI, audio, engraved pages and score videos for an album or an episode |

## Host-neutral skills and scripts

Hosts set `MIADI_ORCHESTRATION_KIT_ROOT` to their checkout of this repository.

| Item | Use it for |
| --- | --- |
| [`skills/chronicle-episode`](skills/chronicle-episode/SKILL.md) | the one entry point for Chronicle episode work on any host, with `redeem-receipt.sh` and `reconcile.py` beside it |
| [`skills/chart-path`](skills/chart-path/SKILL.md) | how a structural tension chart an agent writes reaches Asterion, and the words the teams use for it |
| [`skills/proposal-visualization`](skills/proposal-visualization/SKILL.md) | a proposal as one HTML page to read, comment on and approve |
| [`skills/miadi-react`](skills/miadi-react/SKILL.md) | the emoji reactions on GitHub issues, as Miadi stores them |
| [`scripts/install-chronicle-skill.sh`](scripts/install-chronicle-skill.sh) | pointing every skill layer on a host at the kit's one `chronicle-episode` |
| [`scripts/kit-mcp-upgrade.sh`](scripts/kit-mcp-upgrade.sh) | moving each plugin's pinned MCP packages to the version the registry serves |
| [`scripts/miadi-agent`](scripts/miadi-agent) | launching Pi or Claude Code as a named peer in a Pi Network room |

## Other hosts

Codex ([`codex/`](codex)), Copilot ([`copilot/`](copilot)), Gemini CLI ([`gemini/`](gemini)), Antigravity ([`antigravity/`](antigravity)) and Pi ([`pi/`](pi)) each have a folder whose `AGENTS.md` says how that host's plugins are written. [`llms.txt`](llms.txt) lists what each folder holds.

## Specifications and research

- [`rispecs/`](rispecs): RISE specifications (Reverse Engineering, Intent, Specifications, Exportation), one folder per subject.
- [`foundations/`](foundations/INDEX.html): research packets with their sources.

## Working in this repository

An agent that changes files here commits its own work by path and links each change to a GitHub issue. See [`AGENTS.md`](AGENTS.md).
