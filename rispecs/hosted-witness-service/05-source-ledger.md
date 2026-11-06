# 05 Source ledger

Confidence: **observed** (read or run this day by the witness seat), **documented** (written in a file named here), **specified** (proposed by this packet, not built).

| claim | source | confidence |
|---|---|---|
| The capture under `/src/_sessiondata/<id>/` is readable by user `mia` for a gmusic session | `ls -la` of `d8e16584…`, 2026-11-04 | observed |
| gmusic's `~/.claude` and `/run/user/1000/cc-socks` are closed to `mia` | `ls` answered Permission denied | observed |
| `witness-listen.mjs` read T5 as "not running" while it worked | `status --watch d8e16584… --only-watched`; `service/threads.mjs` reads `~/.claude/sessions` | observed |
| `mia` holds `NOPASSWD: ALL` on eury, and `sudo -n -u gmusic tmux` reaches pane `%14` | `sudo -n -l`; `tmux capture-pane` output | observed |
| `pane-write-guard.sh` answered `clear` (exit 0) before delivery | its output, 2026-11-04 11:41 UTC | observed |
| The staging script opens a chronicle-sessions issue and commits the folder | `_staging_for_new_episodes/scripts/new-future-episode-chronicle-session.sh`; run produced #103, `f259d23b` | observed |
| Plugin 0.1.31 wires the 14 scripts in gmusic's settings plus three guards | `jq` over `~/.claude/settings.json` and `hooks/hooks.json`, diffed | observed |
| The kit marketplace lists the plugin at 0.1.27 while its `plugin.json` says 0.1.31 | `.claude-plugin/marketplace.json`, `plugin.json` at `bd6131a` | observed |
| `miadi-perms` gives group read and write on the capture every 4 hours | `packages/miadi/deb/AGENTS.md` | documented |
| `miadi-feedback` turns an issue into a seat on the maintainer's host | `packages/miadi/deb/README.md`, "miadi-feedback"; jgwill/miadi-orchestration-kit#109 | documented |
| The factory connector offers `append_observation`, `request_session_steer`, `propose_session_completion`, `show_decisions`, and requests wait in `awaiting_approval` | the connector's tool list and server instructions, read in this session | observed |
| The factory runs at miadi.sanctuaireagentique.com on gaia | William, 2026-11-04 | documented |
| `miadi-config check` names hosts that still wire hooks by hand, from 0.2.10, which apt offers on eury | jgwill/miadi-orchestration-kit#126; `apt list --upgradable`, 2026-11-06 | observed |
| The capture is readable by every account on the host (files `-rw-rw-r--`, folders `drwxrwxr-x`), what the relative types included | `stat` of `0666437f…/_claude_user_inputs.jsonl`, 2026-11-06 | observed |
| The configuration, watcher, `await`, pane bridge, relay and commands | this packet | specified |
