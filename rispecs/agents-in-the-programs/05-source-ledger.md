# 05 · Source ledger

Every claim of `01` to `04` and where it was measured. "measured" means the command was run on the date and its
output read. Nothing here is from memory.

| # | claim | source | state |
|---|---|---|---|
| L1 | the ten acts of 2026-11-25 and their proofs | Episode 120 `film/proposal-timeline-261124/agent-actions-261125.md`, Chronicle commit `91518819` | measured |
| L2 | Kdenlive 22.04.3 on gaia | `kdenlive --version` | measured |
| L3 | `/kdenlive/MainWindow_1` exposes 27 action objects under `actions/` | `qdbus org.kde.kdenlive-571907` | measured |
| L4 | `org.kde.KMainWindow.actions` lists 775 action names, among them `monitor_play`, `monitor_pause`, `seek_start`, `seek_end`, `monitor_seek_guide_forward`, `monitor_seek_guide_backward`, `monitor_seek_forward-one-second`, `file_save`, `file_revert` | `dbus-send ... org.kde.KMainWindow.actions` on the person's open window (read only) | measured |
| L5 | `activateAction` by name moves the playhead to the guides and plays | `film_desk_check.sh` on a copy of `variation-a.kdenlive`, Xvfb, 2026-11-25: monitor at "Stage 2: The choice" after two `seek next-guide` | measured |
| L6 | `activateAction file_save` writes the project | same run: the copy differed from its state before the save | measured |
| L7 | `xdotool search --name 'Kdenlive$'` finds no window although the title ends with "Kdenlive" | on gaia's `:0`, 2026-11-25; `Kdenlive` without the anchor finds it | measured |
| L8 | `xdotool windowactivate` and `wmctrl` fail without a window manager | Xvfb runs of `film_desk_check.sh` | measured |
| L9 | the improvised-act hook logs display commands and program launches, skips `grep kdenlive`, and costs about 19 ms on a command it skips | sample inputs to `log_improvised_act.sh`, `time` | measured |
| L10 | `mw-repomap capabilities scan` finds 97 skills in the kit and no other kind | `mw-repomap` 0.27.17, kit at `e9be0aa` | measured |
| L11 | the scanner's kinds are `package`, `cli`, `skill`, `decision`, `app` | jgwill/medicine-wheel `src/developer-repository-mapping/src/capability-scan.ts:24` | measured |
| L12 | the accessibility bus runs on gaia, its Python bindings are not installed | `pgrep at-spi`, `python3 -c 'import pyatspi'`, `apt-cache policy python3-pyatspi gir1.2-atspi-2.0` | measured |
| L13 | Ardour 6 and MuseScore 3 are installed on gaia | `ls /usr/bin/ardour* /usr/bin/musescore*` | measured |
| L14 | Ardour has an OSC surface on UDP 3819 and Lua scripting | Ardour's manual | not measured here |
| L15 | Episode 120's film-toolchain principles 1, 2, 6 | Episode 120 `rispecs/film-toolchain/SPEC.md` | read |
| L16 | the decomposition of the request: 13 secondary intents, 23 actions, 10 flags, 14 of 33 settled from evidence, 1 for the author | Episode 120 `.pde/2611251420--5bc53aab-5844-4b25-9c6b-8b18d7074c5c/` | measured |
