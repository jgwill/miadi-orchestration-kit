# 01 · Reverse-engineer: the ilex session issue prototype

> Phase 1 (R). What the prototype does, observed. Read 2026-10-14 on ilex from the scripts, the `settings.json` that wired them, the capture folders they wrote and the issues they opened.

## Where it was seen

| What | Where |
|---|---|
| The two hooks | jgwill/binscripts (private), branch `hooks/portable-session-dir`, `hooks/claude_hooks/session_issue_hook.sh` (85ca6ea) and `session_end_comment_hook.sh` (9ec22a0), 2026-07-22, by Guillaume on ilex. The branch head is 1208e81, and it was never merged to `main`. Copied in [`research/ilex-prototype/`](./research/ilex-prototype/) |
| The wiring | `~/.claude/settings.json.with-hooks` on ilex, 2026-08-15. Its `hooks` block is copied as `research/ilex-prototype/settings.json.with-hooks.hooks.json` |
| The capture root | `/data/data/com.termux/files/repos/jgwill/chronicle-sessions`, a clone of miadisabelle/chronicle-sessions, passed to every hook as `CLAUDE_SESSION_DIR` |
| The issues | miadisabelle/chronicle-sessions (private), #1 to #42 |
| The folder contract | miadisabelle/chronicle-sessions `CLAUDE.md`, § Session Folder Contract and § Session Lifecycle |

## A. Core creative intent

A session becomes a place on GitHub that people can find, read, retitle and link. The first prompt names it, and the end of the session writes back what happened. The capture folder holds everything, and the issue is the page a person opens.

## B. Flows

**Opening.** `UserPromptSubmit` runs `session_issue_hook.sh` after the three capture hooks on the same event.
1. It reads `session_id`, `prompt` and `cwd` from the hook input.
2. It returns at once when `<root>/<session_id>/.issue_created` exists. So only the first prompt of a session opens an issue, and a resumed session keeps the issue it has.
3. It returns when the prompt is empty or `gh` is missing.
4. A background subshell runs `gh issue create --repo ${CHRONICLE_SESSIONS_REPO:-miadisabelle/chronicle-sessions}` with:
   - title `Session <first 8 of session_id>: <first 80 characters of the prompt>`, with `...` when the prompt was cut;
   - body `## Session` (ID, Started, CWD), then `## First Prompt` with the whole prompt in a fenced block.
5. On success the URL is written to `.issue_created` and `Issue created: <url> at <time>` is appended to `trace.log`. On failure `Issue creation failed: <output> at <time>` is appended instead, no marker is written, and the next prompt tries again.
6. The hook prints nothing and exits 0.

**Closing.** `SessionEnd` runs `session_end_comment_hook.sh` after `session_end_hook.sh`.
1. It returns unless `.issue_created` holds a URL and `gh` exists.
2. It takes the last assistant text from the transcript with `jq -rs` over the whole file.
3. It counts lines of `_claude_user_inputs.jsonl` (prompts) and `_claude_PostToolUse.jsonl` (tool uses), and the unique `file_path` values of `Write` and `Edit` in `_claude_PreToolUse.jsonl` (files touched).
4. It cuts the last message at 3000 characters with `_(truncated)_`.
5. A background subshell runs `gh issue comment <url>` with `## Session End`, a Summary table (User prompts, Tool uses, Files touched) and `### Last Agent Response`. Then it appends `Session end comment posted to <url> at <time>` to `trace.log`.

Every SessionEnd comments: each `/exit` of a resumed session adds one more comment to the same issue, with the session's running totals.

## C. Feature inventory

| Feature | Kind | Observed in |
|---|---|---|
| One issue per session, keyed on the session id | manifestation | the `.issue_created` marker |
| Title carries the session id prefix | vision-supporting | people kept it when they retitled: `Ethnomusicology Session 134b5f95: …` (#22), `[PR] gmtermux-225-226::Session 22bb7571: …` (#42) |
| First prompt as the body | vision-supporting | every issue |
| Closing comment at each exit | tension-resolving | 15 issues with two or more comments |
| Never blocks the session | structural | both gh calls in `( … ) &` subshells |
| A target repository chosen by environment | structural | `CHRONICLE_SESSIONS_REPO` |
| Failures written where a person looks | structural | `trace.log` lines |

## D. What its creator was working toward

- The folder contract in chronicle-sessions `CLAUDE.md` names `.issue_created` as a **state indicator**, beside `_session_env.json` (started) and `_claude_SessionEnd.jsonl` (ended), and draws the lifecycle `SessionStart → 1st Prompt → .issue_created → … → SessionEnd → closing comment`.
- That `CLAUDE.md` also names a future: *"Sessions will eventually relate to episodes in the Chronicle. … A session-to-episode index will enable navigation: session → episode → ceremony."*
- Guillaume's words on 2026-10-14 name it as *"hooks that created github issue from first message and when we run /exit as comment"*, and add an option: *"we might also consider using `@miadi/tracing` or something"*.

## E. What it left, measured

On GitHub (miadisabelle/chronicle-sessions, read 2026-10-14):

| Measure | Value |
|---|---|
| Issues with the prototype's title shape | 37, opened 2026-07-22 to 2026-07-29, all by `miadisabelle` |
| Issues retitled by hand that keep the session id | 2 (#22, #42). #35's body was rewritten as a ceremony record |
| Still open | 36 of 37. The prototype never closes an issue |
| Comments on those issues | 58. 9 issues have none, 13 have one, 15 have two or more |
| Issues opened by a headless PDE run (`claude -p`, *"You are a Prompt Decomposition Engine"*) | 7, on 2026-07-27 |
| Duplicate issues for one session | none |
| The repository since 2026-08-23 | issues #43 to #56 opened by hand for episode staging. The repository lives on as a place people use |

On ilex (the capture root above):

| Measure | Value |
|---|---|
| Session folders | 59. 38 hold `.issue_created`, and 38 hold `_claude_SessionEnd.jsonl` |
| `trace.log` lines | 36 `Issue created`, 55 `Session end comment posted`, no `Issue creation failed` |
| SessionEnd `reason` | 39 `prompt_input_exit` (`/exit`), 25 `other` (headless ends, killed sessions) |
| SessionStart `source` | 55 `startup`, 31 `resume` |

The 9 issues with no comment and the 25 `other` endings are consistent with sessions that ended without a clean exit (a Termux kill, a headless run). The two counts have not been joined session by session.

## F. Addresses

- Prototype source: `rise://jgwill/binscripts/hooks/claude_hooks/session_issue_hook.sh` at 1208e81 (branch `hooks/portable-session-dir`). A private repository, so the copy under `research/ilex-prototype/` is what most readers of this public packet can open.
- Where its output is read: `https://github.com/miadisabelle/chronicle-sessions/issues`, private.

## What it stands on, and what stands on it

- **It stands on** the Claude Code hook events `UserPromptSubmit` and `SessionEnd` and their input fields (`session_id`, `prompt`, `cwd`, `transcript_path`, `reason`), on `gh` authenticated as `miadisabelle` on ilex, on `jq`, and on the capture files written by the other hooks of the same suite.
- **What stands on it:** the chronicle-sessions `CLAUDE.md`, which documents `.issue_created`, and the people who retitled and linked the issues.
- **What came after it:** `claude/miadi-session-observability` 0.1.0 (2026-09-28, jgwill/miadi-orchestration-kit#56) carried the suite's 14 capture commands into a plugin from `/opt/binscripts/hooks/claude_hooks`. These two hooks were never merged to binscripts `main`, and the plugin's `hooks.json` has neither. The plugin also knows more than the prototype did: the binding line (tmux pane, team, episode, mission), `_claude_files_written.jsonl` (every file a call wrote, by any tool) and `_claude_publications.jsonl` (issues, commits, pushes and releases a session made).
- **The plugin's root on Termux:** it reads `CLAUDE_SESSIONDATA_ROOT`, then `MIADI_SESSION_DIR`, `MIADI_SESSIONDATA_ROOT` and `SESSION_DATA_ROOT`, then `/src/_sessiondata`, else a `_sessiondata` folder beside its own scripts. It does not read the prototype's `CLAUDE_SESSION_DIR`.

## Observed edges

Observations, not judgements. Phase 2 decides what they mean.

- The prompt and the last answer go to GitHub as written. `lib.sh` loads the capture sanitizer, but neither hook passes text through it. The repository is private.
- The title takes 80 raw characters, newlines included, so a multi-line prompt makes a title that runs across lines (the PDE issues).
- `jq -rs` reads the whole transcript into memory at SessionEnd. The plugin measured transcripts of 19 to 33 MB elsewhere.
- The marker is written after `gh` returns. A second prompt sent while the first `gh issue create` is still running would find no marker. No duplicate was seen in 37 sessions.
- The SessionEnd work runs in a background subshell inside Claude Code's process group. The plugin found that Claude Code cancels SessionEnd hooks after 1.5 s, and detaches with `setsid` for that reason (0.1.1). The prototype's comments did arrive in 55 cases.
- Headless runs opened issues like interactive sessions did.
