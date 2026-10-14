# 05 · Source ledger

> Every source the packet drew on, how far each claim can be trusted, and what is still to confirm. Read on ilex, 2026-10-14.

## Sources

| # | Source | Where | Read for |
|---|---|---|---|
| S1 | Guillaume's prompt and folder note, 2026-10-14 | quoted in the kin file | the ask, the tracing option |
| S2 | `session_issue_hook.sh`, `session_end_comment_hook.sh`, `lib.sh` | jgwill/binscripts (private), branch `hooks/portable-session-dir` at 1208e81. Copy: `research/ilex-prototype/` | 01 § B, the beloved qualities |
| S3 | `git log origin/main..origin/hooks/portable-session-dir` | jgwill/binscripts | the branch's four commits, 2026-07-22, never merged |
| S4 | `~/.claude/settings.json.with-hooks` (2026-08-15) and `settings.json` | ilex | the wiring, and that ilex wires no hooks today |
| S5 | the capture root `/data/data/com.termux/files/repos/jgwill/chronicle-sessions` | ilex | 59 folders, markers, `trace.log` lines, `reason` and `source` counts |
| S6 | `gh issue list --repo miadisabelle/chronicle-sessions --state all` and `gh issue view` on #22, #34, #35, #39, #42 | GitHub (private) | 01 § E |
| S7 | `gh repo view --json visibility` | GitHub | chronicle-sessions, binscripts and eury are private; this kit is public |
| S8 | miadisabelle/chronicle-sessions `CLAUDE.md` | private | the folder contract, the lifecycle, the episode-linking future |
| S9 | `claude/miadi-session-observability`: `README.md`, `AGENTS.md`, `hooks/hooks.json`, `hooks/claude_hooks/lib.sh`, `terminal_binding.sh`, `stop_hook.sh`, `session_end_hook.sh` (0.1.14) | this repository | what the plugin carries, its root chain, its helpers, the 1.5 s SessionEnd rule |
| S10 | jgwill/miadi-orchestration-kit#56 | GitHub | the plugin's plan, and transcript sizes |
| S11 | jgwill/Miadi `packages/tracing` and `packages/tracing-langfuse` (0.1.0): README and `src/index.ts` | jgwill/Miadi | the provider contract has no write call |
| S12 | `~/.claude/plugins/installed_plugins.json`, `known_marketplaces.json` | ilex | the kit plugin is not installed on ilex |
| S13 | jgwill/llms-txt `llms-rise-framework.txt` 2.2.0, `llms-rispecs-layout.md` 1.3.0, `llms-rispecs-kinship.md` 2.0.0 | jgwill/llms-txt | the method, the layout, the kin file |
| S14 | the user's word in this session, 2026-10-14 | this session | another agent (tmux pane 2) is moving ilex's home into a jgwill/eury checkout |

## Claims and confidence

| Claim | Confidence | From |
|---|---|---|
| The prototype opens one issue at the first prompt and comments at every SessionEnd | high: code read, and output seen | S2, S6 |
| The two hooks never reached binscripts `main`, and the plugin does not carry them | high | S3, S9 |
| 37 issues carry the title shape, 36 are open, 7 came from headless PDE runs, none is duplicated | high: counted on 2026-10-14 | S6 |
| ilex's logs hold 36 creations and 55 end comments, with no failure | high: counted | S5 |
| The 9 issues with no comment are sessions that ended without a clean exit | medium: consistent with the 25 `other` endings, not joined session by session | S5, S6 |
| Claude Code cancels SessionEnd hooks after 1.5 s | high on gaia, from the plugin's own record. Not re-measured on ilex | S9 |
| A `claude -p` run is not registered in `~/.claude/sessions/` | high for `claude -p` started inside a session (plugin test). *To confirm* for a top-level `claude -p` | S9 |
| `@miadi/tracing` 0.1.0 cannot write | high: the provider interface lists reads only | S11 |
| The home move on ilex is in progress | as told by the user. Not read from its own issue | S14 |

## Still to confirm

- jgwill/src#319: what the refinement issue named in binscripts `hooks/claude_hooks/CLAUDE.md` holds.
- The `coaia` commands that write a trace and an observation (`04-export.md` § 3).
- The issue or branch carrying ilex's home move into jgwill/eury.
- Whether a chronicle episode holds this work (`04-export.md` § Recorded).

## Promotion status

Specified (phases R, I, S, E) on 2026-10-14 under jgwill/miadi-orchestration-kit#89. Not built. When the hooks are built, this packet gains a `STATUS.md` (the Return).
