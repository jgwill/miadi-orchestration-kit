# 04 · Export

Where each specification of `03-specify.md` lands, in build order. E1 to E4 landed with this
specification on 2026-11-25. E5 onward are the next acts.

| step | lands in | carries | state |
|---|---|---|---|
| E1 | `claude/miadi-film/scripts/film_desk.py` | S1 to S5, S6 in part (Ardour and MuseScore by keys), S7 (`save`, `reload` with `--person-asked`), S8 (the verbs' own lines) | built, plugin 0.3.0 |
| E2 | `claude/miadi-film/scripts/film_desk_check.sh` | every verb on a copy, private display and D-Bus session | built, 18 of 18 on gaia, Kdenlive 22.04.3 |
| E3 | `claude/miadi-film/skills/in-the-program/`, `commands/in-the-program.md`, the `assistant-editor` agent | the order, the groups, the hazards, for an agent | built |
| E4 | `claude/miadi-film/hooks/` | S8: the improvised acts | built |
| E5 | `.miadi/capabilities.jsonl` of this kit | S9 for the kinds the scanner knows | first file written 2026-11-25 (97 skills, `in-the-program` stated) |
| E6 | `@medicine-wheel/developer-repository-mapping` (jgwill/medicine-wheel, `src/developer-repository-mapping/`) | S9: the kinds `plugin`, `command`, `agent`, `hook`, `mcp-server`, `deb`, found from `.claude-plugin/plugin.json`, `commands/*.md`, `agents/*.md`, `hooks/hooks.json`, `.mcp.json` and `packages/miadi/deb/*/DEBIAN/control`; then the kit's inventory written again | next |
| E7 | `claude/miadi-film/skills/proposal-timeline/` | S7: Episode 120's `proposal_timeline.py`, a proposal written as data becomes a filled timeline in a new file | next |
| E8 | `film_desk.py` for Ardour | S6: drive by Ardour's OSC surface by name, measured on a session on gaia | next |
| E9 | the `miadi-film` deb | `xdotool`, `wmctrl`, `imagemagick`, `pulseaudio-utils`, `xvfb` as dependencies (with jgwill/miadi-orchestration-kit#153's list) | next |
| E10 | Episode 120's `episode.yaml` | `capabilities:` and `rispecs:` naming what this brings into being | written 2026-11-25 |

## Not exported

- Watching a project file for the person's save (S7). The person says they saved. A watch on a file a program
  rewrites whole on save is its own specification, after a person has used the kept track once.
- An MCP server carrying the same verbs for harnesses other than Claude Code. The stateloom server's `show`
  and `what_is_on_screen` are its shape. It follows E8, once the verbs hold for two programs.
