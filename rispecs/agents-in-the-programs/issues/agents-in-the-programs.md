## Context

On 2026-11-25 Guillaume asked a seat to find the proposal timeline the Episode 120 (miadi-chronicle://120) companion seat had built the day before (`film/proposal-timeline-261124/variation-a.kdenlive`, 90 s, 11 cards, 2 music sketches), which he never saw because the computer crashed. The seat found it, opened Kdenlive on gaia's display, moved the playhead, played it through and checked the sound while he watched. No plugin carried any of it: ten acts were composed from `find`, `git`, `setsid kdenlive`, `xdotool`, `wmctrl`, `import`, `qdbus` and `pactl`, two of them clicks at measured screen coordinates. He then asked that every act become a capability of the factory: specified, built into the plugin, and inventoried in Episode 120 and in this kit under `.miadi/`.

What was measured:

- `claude/miadi-film` 0.2.0 prepares projects (editing room, stringouts) and checks a **copy** on a **hidden** display. Nothing in it works on a person's own display.
- Kdenlive 22.04.3 answers `org.kde.KMainWindow.activateAction <name>` for any of its 775 actions (`monitor_play`, `seek_start`, `monitor_seek_guide_forward`, `file_save` ...), so every drive can go by name rather than by coordinate.
- This kit has no `.miadi/`. `mw-repomap capabilities scan` 0.27.17 finds 97 skills here and nothing else: its kinds are `package`, `cli`, `skill`, `decision`, `app`, so the 20 Claude plugins, their commands, agents, hooks and MCP servers, and the deb packages have no record.

## Desired State

An agent works in Kdenlive (then Ardour and MuseScore) on the person's own display while the person watches: it finds the episode's projects, opens one, shows it, plays it, walks its guides and checks the sound, saves or reloads only when asked, and proposes changes as new files. Every act is logged, and acts an agent had to improvise are logged too, so they become the next verb. The kit lists all its capabilities in `.miadi/capabilities.jsonl`, plugins and deb packages included, each with its specification, issue and episodes, and Episode 120 lists the capabilities its film production brings into being and uses.

## Action Steps

- [x] RISE specification `rispecs/agents-in-the-programs/` (01 reverse-engineer, 02 intent, 03 specify S1 to S9, 04 export E1 to E10, 05 source ledger, STATUS)
- [x] E1 `film_desk.py`: look (`list`, `open`, `look`, `sound`, `probe`, `acts`), drive (`raise`, `play`, `pause`, `seek`, `action`), write (`save`, `reload` with `--person-asked`); Kdenlive by action name over D-Bus
- [x] E2 `film_desk_check.sh`: every verb on a copy, private display and D-Bus session (18 of 18 on gaia)
- [x] E3 `in-the-program` skill, `/in-the-program`, the `assistant-editor` agent names it; `miadi-film` 0.3.0
- [x] E4 PostToolUse hook: improvised display commands logged as acts
- [x] E5 `.miadi/capabilities.jsonl` written by `mw-repomap capabilities scan --write`, `in-the-program` stated with its specification, this issue and Episode 120 (98 skills, 56 with a statement, 42 needing one)
- [x] E10 Episode 120 `episode.yaml`: `rispecs:` and `capabilities:`; its `rispecs/film-toolchain/SPEC.md` and `STATUS.md` name this specification
- [ ] E6 `mw-repomap` learns the kinds `plugin`, `command`, `agent`, `hook`, `mcp-server`, `deb` (jgwill/medicine-wheel), then this kit's inventory is written again
- [ ] E7 Episode 120's `proposal_timeline.py` becomes the plugin's `proposal-timeline` skill
- [ ] E8 Ardour driven by name through its OSC surface, measured on a session on gaia
- [ ] E9 the `miadi-film` deb depends on `xdotool`, `wmctrl`, `imagemagick`, `pulseaudio-utils`, `xvfb`
- [ ] A person uses `/in-the-program` on a project, with a drive and a save they asked for
- [ ] Q1 (Guillaume): which music programs, besides Ardour, agents work in with him

## Structural Tension

Agents already prepare film projects, and a person can only see them if an agent improvises its way onto their screen. The person's production happens in those programs, so an agent that can open, show and play a project by name, and say what it did, is what lets the person stay the one who chooses.

## Related

- jgwill/miadi-orchestration-kit#153 (the `miadi-film` plugin: stringouts and the editing room)
- jgwill/miadi-orchestration-kit#157 (Episode 120: one embodied take becomes one film cue)
- Episode 120 (miadi-chronicle://120): `film/proposal-timeline-261124/agent-actions-261125.md` (the ten acts), `process-trace-261124.md` (X7, X8), `rispecs/film-toolchain/` (principles 1, 2, 6; `open-on-this-computer.spec.md`), PDE `.pde/2611251420--5bc53aab-5844-4b25-9c6b-8b18d7074c5c/`
- jgwill/medicine-wheel `src/developer-repository-mapping/` (the capability scanner, E6)
- Specification: rise://jgwill/miadi-orchestration-kit/rispecs/agents-in-the-programs/03-specify.md
