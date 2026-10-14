# 03 · Specify: Session Issue

> Phase 3 (S). What to build, as prose code: two hooks of `claude/miadi-session-observability`, and one optional sink. Read with [`02-intent.md`](./02-intent.md) and the [kin file](./chronicle-github-sessions-observability.kin.md).

Session Issue gives a Claude Code session one GitHub issue, opened at its first prompt and commented at each exit. People read, retitle and link sessions there like any other work.

## Desired outcome

On a host whose user names a repository, every interactive session has one issue in it, titled by its session id and first prompt. Each exit adds a comment with what the session did. A host that names no repository sees no change at all.

## Current reality

- The capture plugin writes every event under `<root>/<session_id>/` (`CLAUDE_SESSIONDATA_ROOT`). Its indexes include `_claude_user_inputs.jsonl`, `_claude_PostToolUse.jsonl`, `_claude_files_written.jsonl` and `_claude_publications.jsonl`. It also writes `last_claude_AssistantResponse.json` at each Stop, and the binding line to `_terminal_binding.jsonl`.
- `lib.sh` provides `claude_sanitize_text`, `claude_write_jsonl`, `claude_write_json` and `claude_detach` (`setsid`, else `nohup`).
- The ilex prototype ([`research/ilex-prototype/`](./research/ilex-prototype/)) opened issues and wrote comments, but it is wired nowhere.

## Creative Advancement Scenarios

**Creative Advancement Scenario**: A session finds its page

**User Intent**: Guillaume starts a session on ilex and later wants to find it, read it and link it to an episode.
**Current Reality**: ilex has the plugin installed, with `CHRONICLE_SESSIONS_REPO=miadisabelle/chronicle-sessions` set in `settings.json`.
**Natural Progression Steps**:
  1. His first prompt reaches `UserPromptSubmit`. The opener sees no `.issue_created`, takes the lock, hands the work to a detached job, and returns without a word on stdout.
  2. The job checks that the repository is private and creates `Session 3f2a9c1e: tidy the capture folder names`. The body holds the session's id, time, folder, host, pane, team and episode, and the first prompt, sanitized.
  3. The URL lands in `.issue_created`, then a `trace.log` line, then a publication line.
**Achieved Outcome**: The session has a page, found by its id, before the first answer arrives.
**Supporting Features**: `SessionIssueOpener`, `SessionIssueBody`, `RepositoryGuard`.

**Creative Advancement Scenario**: A session's story grows across days

**User Intent**: He resumes yesterday's session, works, and exits twice in two days.
**Current Reality**: `.issue_created` holds the issue URL from the first day.
**Natural Progression Steps**:
  1. The resumed session's prompts find the marker, so the opener does nothing.
  2. Each `/exit` reaches `SessionEnd`. The commenter detaches and posts `## Session End`: the reason (`/exit`), the session's running totals, what it published since the previous comment (two commits, one push), and its last answer.
**Achieved Outcome**: The issue reads as the session's story, one comment per sitting.
**Supporting Features**: `SessionEndCommenter`, `PublishedSince`.

**Creative Advancement Scenario**: A host that never asked

**User Intent**: `jgi` on gaia works as before.
**Current Reality**: The plugin is installed there, and `CHRONICLE_SESSIONS_REPO` is not set.
**Natural Progression Steps**:
  1. Both hooks see that no sink is active and return before reading anything else.
**Achieved Outcome**: No issue, no file, no network call. The capture is exactly 0.1.14's.
**Supporting Features**: `SinkSelection`.

**Creative Advancement Scenario**: A prompt carrying a secret

**User Intent**: A pasted command line holds a token.
**Current Reality**: The capture sanitizer already redacts token shapes in every capture file.
**Natural Progression Steps**:
  1. The opener passes the prompt through `claude_sanitize_text` before building the title and the body.
**Achieved Outcome**: The issue shows the redaction marker the capture files show.
**Supporting Features**: `SessionIssueBody`.

**Creative Advancement Scenario**: A decomposition run inside a session

**User Intent**: A session runs `miaco decompose`, which starts `claude -p` steps.
**Current Reality**: Each step is a session of its own, and none is registered in `~/.claude/sessions/`.
**Natural Progression Steps**:
  1. Each step's opener finds itself headless, writes `.issue_skipped` with `headless`, and logs it once.
**Achieved Outcome**: The interactive session keeps its issue, and its steps leave a capture folder each but open no issue. (A proposed default, held by Guillaume. `CHRONICLE_SESSIONS_HEADLESS=1` opens issues for them too.)
**Supporting Features**: `HeadlessRule`.

**Creative Advancement Scenario**: The phone is offline

**User Intent**: He works on ilex with no network.
**Current Reality**: `gh` cannot reach GitHub.
**Natural Progression Steps**:
  1. The job's `gh` call fails, so it writes `Issue creation failed: …`, counts one attempt and releases the lock.
  2. The next prompt tries again, up to three attempts. After the third failure the opener writes `.issue_skipped` with `attempts` and stops trying.
**Achieved Outcome**: The session runs undisturbed. The capture folder holds the whole session, and `trace.log` says why there is no page.
**Supporting Features**: `SessionIssueOpener` § Attempts.

## Supporting structures

The two hooks advance, and do not oscillate, because each step leaves a file the next step reads:
- `.issue_created` ends the opener's work for the life of the session;
- `.issue_skipped` ends it the same way when the answer is "no issue";
- `.issue_comment_offset` lets each comment say only what is new.

Nothing is read back from GitHub, nothing waits on it, and nothing is retried after the session decided.

## Components

### SinkSelection
Decides, in each hook, whether anything is to be done. It costs no more than reading environment variables.
- **Behavior:** The GitHub sink is active when `CHRONICLE_SESSIONS_REPO` holds `owner/repo` and `CHRONICLE_SESSIONS_SINKS` is unset or names `github`. The tracing sink is active when `CHRONICLE_SESSIONS_SINKS` names `tracing` and the domain's keys are set (see `TracingSink`). With no active sink, the hook exits 0 at once: it reads no file, writes no file and calls no network.
- **Behavior:** The value of `CHRONICLE_SESSIONS_SINKS` is a comma list (`github`, `tracing`, `github,tracing`). Unknown names are ignored.

### HeadlessRule
- **Behavior:** A session is headless when no `~/.claude/sessions/<pid>.json` names its session id. These are the files the binding line reads to find its own agent (`terminal_binding.sh`, `_tb_agent_pid`), and a `claude -p` run is not registered there.
- **Behavior:** A headless session opens no issue unless `CHRONICLE_SESSIONS_HEADLESS=1`. Its first prompt writes `.issue_skipped` holding `headless` and one `trace.log` line, `Session issue skipped: headless at <time>`.

### SessionIssueOpener
A `UserPromptSubmit` hook, `hooks/claude_hooks/session_issue_hook.sh`, with its own entry in `hooks/hooks.json` after the three capture commands of that event.
- **Behavior:** Reads `session_id`, `prompt` and `cwd`. It returns at once when `SinkSelection` finds nothing active, when the prompt is empty, or when `.issue_created` or `.issue_skipped` exists.
- **Behavior:** Takes the lock `mkdir <root>/<session_id>/.issue_lock`, which is atomic on every host including Termux. When the directory exists and is younger than 120 seconds, it returns: another prompt's job is at work. An older lock is stale, and it is removed and taken again.
- **Behavior:** Applies `HeadlessRule`, then hands everything below to `claude_detach` and returns. The hook prints nothing on stdout, because Claude Code adds a `UserPromptSubmit` hook's stdout to the conversation. It exits 0 on every path.
- **Behavior (detached job):** Runs `gh` as the host user.
  1. `RepositoryGuard`.
  2. `TracingSink` opening, when it is active.
  3. `gh issue create --repo <repo> --title <SessionIssueTitle> --body-file <SessionIssueBody>`.
  4. On success, the URL from gh's last output line goes to `.issue_created` (that line alone) and `trace.log` gets `Issue created: <url> at <ISO-8601 time>`. `_claude_publications.jsonl` gets `{timestamp, kind: "issue", action: "session issue", url, repo, number, by: "hook"}, written under the capture's `.publications.lock``.
  5. On failure, `trace.log` gets `Issue creation failed: <first line of gh output> at <time>`.
  6. The lock is released on every path.
- **Attempts:** Each failure, of the guard's visibility call or of the create, adds one to `.issue_attempts`. At 3 the job writes `.issue_skipped` holding `attempts`, and the session tries no more.
- **Behavior:** It never edits, labels, assigns or closes an issue, and never changes a title after creating it.

### RepositoryGuard
- **Behavior:** Calls `gh repo view <repo> --json visibility -q .visibility`. `PRIVATE` and `INTERNAL` pass. `PUBLIC` writes `.issue_skipped` holding `public <repo>` and `trace.log` `Session issue refused: <repo> is public at <time>`, and nothing is posted. A failed call counts as a failed attempt.

### SessionIssueTitle
- **Behavior:** `Session <first 8 characters of session_id>: <text>`. `<text>` is the first non-empty line of the sanitized prompt, with runs of whitespace collapsed to one space. It is cut at 80 characters, counted in characters rather than bytes, so a multi-byte character is never split. `...` follows when `<text>` is not the whole prompt.

### SessionIssueBody
- **Layout:** Two sections, with the prototype's headings:
  ```markdown
  ## Session

  - **ID**: `<session_id>`
  - **Started**: <ISO-8601 time of the first prompt>
  - **CWD**: <cwd>
  - **Host**: <hostname>
  - **Pane**: <tmux session:window.pane>   · only when the binding line has tmux
  - **Team**: <team id>                    · only when the binding line has a team other than unassigned
  - **Episode**: <the episode the binding line resolved>   · only when it resolved one
  - **Trace**: `miadi-tracing:<domain>/trace/<id>`   · only when the tracing sink opened one

  ## First Prompt

  <fence>
  <the sanitized prompt>
  <fence>
  ```
- **Behavior:** The pane, team and episode come from the session's last `_terminal_binding.jsonl` line (`tmux.session`, `tmux.window`, `tmux.pane`, `team.id`, `episode`). A missing file or field drops the line. It is never a reason to wait.
- **Behavior:** The fence is a run of backticks one longer than the longest run inside the prompt, and at least three. A prompt longer than 8000 characters is cut there and followed by `(truncated: <n> more characters in the session's capture)`.
- **Behavior:** The body is written to a file in the session folder and passed with `--body-file`, so no shell quoting touches the prompt.

### SessionEndCommenter
A `SessionEnd` hook, `hooks/claude_hooks/session_end_comment_hook.sh`, with its own entry in `hooks/hooks.json` after `session_end_hook.sh`.
- **Behavior:** Returns at once unless a sink is active and `.issue_created` holds a URL (or `.trace_created` a reference, for the tracing sink). Otherwise it hands the rest to `claude_detach` and returns well inside the 1.5 s Claude Code allows a SessionEnd hook. It prints nothing.
- **Behavior (detached job):**
  1. Waits 2 seconds, so the capture's own detached work on the last tool calls can land.
  2. Builds `SessionEndComment` and posts it with `gh issue comment <url> --body-file <file>`.
  3. `trace.log` gets `Session end comment posted to <url> at <time>`, or `Session end comment failed: <first line> at <time>`. `_claude_publications.jsonl` gets `{timestamp, kind: "issue-comment", action: "session end", url, repo, number, by: "hook"}, under the same lock`.
  4. When the tracing sink is active, it adds the `TracingSink` closing.
- **Behavior:** Every SessionEnd comments: each exit of a resumed session adds one comment. A failed comment is not retried. The next exit's comment carries the running totals anyway.

### SessionEndComment
- **Layout:**
  ```markdown
  ## Session End

  **Reason**: /exit · **Ended**: <ISO-8601 time>

  ### Summary

  | Metric | Count |
  |--------|-------|
  | User prompts | <lines of _claude_user_inputs.jsonl> |
  | Tool uses | <lines of _claude_PostToolUse.jsonl> |
  | Files touched | <distinct paths in _claude_files_written.jsonl> |
  | Published | <publication lines, the hooks' own excluded> |

  ### Published since the previous comment

  - commit `<sha7>` <subject> · <repo>
  - push <repo> `<branch>`
  - issue <url>

  ### Last Agent Response

  <sanitized text>
  ```
- **Behavior:** **Reason** shows `/exit` for `prompt_input_exit` and the raw value otherwise (`clear`, `logout`, `other`).
- **Behavior:** `PublishedSince` reads `_claude_publications.jsonl` from the line `.issue_comment_offset` names (0 when absent), excluding lines with `by: "hook"`. It lists at most 30, then `and <n> more`, and omits the section when there are none. After posting, it writes the current line count to `.issue_comment_offset`.
- **Behavior:** The last answer is `last_assistant_message` from `last_claude_AssistantResponse.json`. When that file is absent, it is the text of the last assistant entry in the final 2 MB of the transcript. The whole transcript is never read. It passes through `claude_sanitize_text`, is cut at 3000 characters with `_(truncated)_`, and becomes `_(no final message captured)_` when there is none.

### TracingSink (option, not built)
The same opening and closing, recorded as a trace that `@miadi/tracing` resolves. It is built only after a write path exists (kin file: `@miadi/tracing`, `coaia`).
- **Behavior:** Active when `CHRONICLE_SESSIONS_SINKS` names `tracing` and the keys of `CHRONICLE_SESSIONS_TRACE_DOMAIN` (`eng` by default, else `ceremony` or `story`) are set (`<DOMAIN>_LANGFUSE_PUBLIC_KEY`, `<DOMAIN>_LANGFUSE_SECRET_KEY`).
- **Behavior (opening):** Runs before the issue is created, in the same detached job. It creates one trace:
  - its name is `SessionIssueTitle`, and its session id is Claude Code's session id;
  - its input is the sanitized first prompt;
  - its metadata holds cwd, host, pane, team and episode.
  The reference `miadi-tracing:<domain>/trace/<id>` goes to `.trace_created` and into the issue body's **Trace** line.
- **Behavior (closing):** At each SessionEnd it adds one observation named `session end` under that trace. Its input is the reason, its output the last answer, and its metadata the summary counts.
- **Behavior:** Both texts pass through the sanitizer, as for GitHub. `@miadi/tracing` 0.1.0 never returns a trace's input or output, only its name, session and observations. Miadi pages can link a session to its trace without showing what was asked.
- **Behavior:** `CHRONICLE_SESSIONS_SINKS=tracing` alone records traces and opens no issue.

## Data

### Configuration (environment, set in the host user's `settings.json` `env` or shell)
| Name | Meaning | Default |
|---|---|---|
| `CHRONICLE_SESSIONS_REPO` | `owner/repo` receiving session issues. The prototype's name | unset: no issues |
| `CHRONICLE_SESSIONS_SINKS` | `github`, `tracing`, or both | `github` |
| `CHRONICLE_SESSIONS_HEADLESS` | `1` opens issues for headless sessions | unset |
| `CHRONICLE_SESSIONS_TRACE_DOMAIN` | `eng`, `ceremony` or `story` | `eng` |
| `CLAUDE_SESSIONDATA_ROOT` | The capture root, as the plugin already reads it | the plugin's chain |

### Files in `<root>/<session_id>/`
| File | Written by | Holds |
|---|---|---|
| `.issue_created` | opener | the issue URL, one line. The state indicator named in chronicle-sessions `CLAUDE.md` |
| `.issue_skipped` | opener | `headless`, `public <repo>` or `attempts`: why this session has no issue |
| `.issue_attempts` | opener | failed attempts, a number |
| `.issue_lock/` | opener | present while a job creates the issue |
| `.issue_comment_offset` | commenter | publication lines already reported |
| `.trace_created` | tracing sink | `miadi-tracing:<domain>/trace/<id>`, one line |
| `_session_issue_body.md`, `_session_end_comment.md` | both | the last text posted, kept for reading |
| `trace.log` | both | the lines named above, in the prototype's words |
| `_claude_publications.jsonl` | both | one line per issue or comment, `by: "hook"` |
