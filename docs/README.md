# Miadi Orchestration Kit guides

The kit is the agent-host side of the Miadi Factory. [`jgwill/Miadi`](https://github.com/jgwill/Miadi) runs the services: the app, the Chronicle, reviews, circles. This kit is what an agent session loads to work with them, and what a machine installs to host them.

Its center is one skill, [`chronicle-episode`](../skills/chronicle-episode/SKILL.md). A Chronicle episode is where a piece of work keeps its question, its sessions, its reviews and the circles that judged it. Most plugins in the kit exist to put something into an episode or to read something out of one.

## Guides

| Guide | Read it when |
| --- | --- |
| [Chronicle Episodes](chronicle-episodes.md) | an agent is about to mint, land, relate, report on or hold a ceremony in an episode |
| [Glossary](glossary.md) | a word in a skill, an issue or a session is unclear: vessel, wheel, receipt, seat, binding line, screenwalk |
| [Machine Setup and Recovery](machine-setup-and-recovery.md) | setting up a Miadi host, or bringing sessions back after a reboot or a crash |
| [Adding to the Kit](adding-to-the-kit.md) | writing a plugin, a skill or a package for this repository |

## Sources of record

These guides give the order of work and the words. The files below hold the detail, and when a guide and one of them disagree, the file wins.

- [`README.md`](../README.md): every plugin, package, skill and team, and what each does for an episode.
- [`skills/chronicle-episode/SKILL.md`](../skills/chronicle-episode/SKILL.md): sections S0 to S17, the doors and proofs for every episode verb.
- [`llms.txt`](../llms.txt): the same inventory for agents, with the Miadi package index.
- [`teams/README.md`](../teams/README.md): the seven teams, their leads and what each makes.
