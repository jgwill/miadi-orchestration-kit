# STATUS

## 2026-11-25 · specified, built in part

- **Built:** E1 to E4 in `claude/miadi-film` 0.3.0. `film_desk_check.sh` passed 18 of 18 on gaia (Kdenlive
  22.04.3, private display and D-Bus session, a copy of Episode 120's `variation-a.kdenlive`).
- **Inventory:** E5, `.miadi/capabilities.jsonl` of this kit, written by `mw-repomap capabilities scan --write`
  (0.27.17) at `b2b630c`: 98 skills, 56 with a statement and 42 needing one. `skill/in-the-program` is stated
  with what it achieves, its stage, this specification, the issue and Episode 120; `editing-room` and
  `scenes-to-timeline` with their stage, jgwill/miadi-orchestration-kit#153 and Episode 575. E10, Episode
  120's `episode.yaml`.
- **Not yet used by a person.** The first use of `/in-the-program` with a drive and a save the person asked
  for is the proof this specification waits on.
- **Next:** E6 (the scanner's missing kinds), E7 (the proposal timeline as a skill), E8 (Ardour by OSC), E9
  (the deb's dependencies).

## The inventory's missing kinds

What `mw-repomap` 0.27.17 does not record in this kit, counted on 2026-11-25. E6 resolves it.

| kind | in this kit | where it is declared |
|---|---|---|
| plugin | 20 under `claude/`, more under `copilot/`, `codex/`, `gemini/` | `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |
| command | per plugin | `commands/*.md` |
| agent | per plugin | `agents/*.md` |
| hook | per plugin | `hooks/hooks.json` |
| mcp-server | per plugin | `.mcp.json` |
| deb | about 30 under `packages/miadi/deb/` | each package's control file |

## Open question

- **Q1 (Guillaume):** besides Ardour, which music programs do agents work in with you: MuseScore (installed
  on gaia), a program for the ABC sketches such as Episode 120's `music/transition-ideas.abc`, or others? The
  answer sets which program S6 covers after Ardour.
