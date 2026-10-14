# 02 · Intent: a session that has a page

> Phase 2 (I). What the prototype's creator wanted to bring into being, the current reality, and the tension between them.

## Desired outcome

Every session on a host that asks for it has one GitHub issue, opened by its first prompt and found by its session id. A person opens that issue to read what the session was asked. After each `/exit` they read what it did: how many prompts and tool calls it ran, which files it wrote, what it published (commits, pushes, issues, releases, pages), and its last answer. They retitle it, link it to an episode, and comment on it like any other issue.

The page comes from the capture plugin a host already installs, so it needs no hand-wired `settings.json`. It also travels with the plugin to any host whose owner turns it on.

When a host also records sessions as traces, the same opening and closing land as a trace under a `miadi-tracing:` reference, and the issue names that reference.

**How they know it holds:** one issue per session id, one comment per exit, nothing posted unsanitized, nothing posted to a public repository, and nothing at all on a host that did not ask.

## Current reality

- The behaviour exists as two shell hooks on an unmerged binscripts branch, wired by hand on ilex from 2026-07-22. Their last issue is dated 2026-07-29.
- ilex's `settings.json` holds no `hooks` block today. The full wiring is kept beside it as `settings.json.with-hooks`.
- `miadi-session-observability` 0.1.14 is installed on gaia (users `mia`, `jgi` and `ava`) and on eury (`mia`). It carries every other hook of that suite, but not these two.
- The plugin already keeps what a richer closing comment needs: `_claude_files_written.jsonl`, `_claude_publications.jsonl`, `last_claude_AssistantResponse.json` (written at each Stop), and the binding line with pane, team, episode and mission.
- The receiving repository, miadisabelle/chronicle-sessions, is private, and people now also use it for episode staging.
- `@miadi/tracing` 0.1.0 resolves and describes traces, prompts and sessions. It has no write call.
- On ilex, the home directory is being moved into a jgwill/eury checkout by another agent (tmux pane 2, 2026-10-14). `~/.claude/` lives inside that home.

## Structural tension

The desired page exists today as a pattern people used and kept: they retitled issues around the session id and turned one issue into a ceremony record. It is held by two scripts that no installed host runs. The plugin that every Miadi host installs already captures richer material than the prototype could, and it has no place on GitHub to put it.

The tension resolves when the two hooks become part of the plugin. They stay off by default, turn on with one variable naming the repository, and draw the closing comment from the plugin's own indexes. Then ilex installs the plugin, and the page returns, on the host where it was born.

## Beloved qualities

What people would miss, and what must survive the port:

1. **One session, one issue, found by its id.** The title prefix `Session <id8>:` is what people kept when they retitled. The opener never changes a title after creating it.
2. **The first prompt is the body.** The issue says what was asked, in the asker's words.
3. **A comment at every exit.** A resumed session's issue grows a comment per `/exit` with running totals, so the issue reads as the session's story across days.
4. **It never slows the session.** Both calls run detached. A hook prints nothing and exits 0, even when GitHub is unreachable.
5. **The marker contract.** `.issue_created` holds the URL on its first line. The chronicle-sessions `CLAUDE.md` names it as a state indicator.
6. **Failures are written where a person looks.** `trace.log` lines in the same words as the prototype's.
7. **The repository is chosen, not assumed.** The prototype's `CHRONICLE_SESSIONS_REPO` keeps its name.

## What the port changes, and why

| Prototype | Port | Because |
|---|---|---|
| Default repository when unset | No repository, no issue | The plugin runs on hosts and users that never asked for issues |
| Raw prompt and answer | Through `claude_sanitize_text` | The capture already redacts token shapes everywhere else |
| Any repository | A public repository is refused | Prompts and answers are private material |
| Marker written after `gh` returns | A lock taken before `gh` runs | One issue per session, even with fast prompts |
| Title of 80 raw characters | The first non-empty line, whitespace collapsed, at most 80 characters | Multi-line prompts made broken titles |
| `jq -rs` over the transcript | `last_claude_AssistantResponse.json`, then the transcript's tail | Transcripts reach tens of MB on a phone |
| Files touched = Write and Edit only | `_claude_files_written.jsonl` | Bash, MCP and moves write files too |
| Background subshell at SessionEnd | Detached with `setsid` | Claude Code cancels SessionEnd hooks after 1.5 s |
| Headless runs open issues | Headless runs open none unless asked (proposed default, held by Guillaume) | On 2026-07-27, seven PDE steps opened seven issues among the sessions people read |
| Nothing about publications | The comment lists what the session published since the previous comment | The plugin already indexes it |

## Boundaries

- **Not a second capture.** The issue is a page *about* the capture folder. The folder stays the record, and nothing is read back from GitHub.
- **No closing, labelling or retitling by the hooks.** Those stay with people until Guillaume decides otherwise (kin file, § What others hold).
- **No edits to a user's `settings.json` by the plugin.** Turning the feature on is that user's act (the plugin's cutover rule).
- **The tracing sink is an option, specified but not built.** It waits for a write path, and that begins in jgwill/Miadi.
- **No change to the capture scripts carried to `/opt/binscripts`.** The two hooks are their own entries in `hooks.json`, as the workspace clone guard was (0.1.13).
