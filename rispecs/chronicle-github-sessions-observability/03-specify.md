# 03 · Specify: Session Issue

> Phase 3 (S). What to build, as prose code: a plugin of its own, `claude/miadi-session-issue`, with two hooks and one command, and one optional sink. Read with [`02-intent.md`](./02-intent.md) and the [kin file](./chronicle-github-sessions-observability.kin.md).

Session Issue gives a Claude Code session that asks for it one GitHub issue, opened from its first prompt and commented at each exit. People read, retitle and link sessions there like any other work.

**Revised 2026-10-14.** The first version of this file specified two hooks inside `claude/miadi-session-observability`, turned on per host by `CHRONICLE_SESSIONS_REPO`. Guillaume's word the same day: *"some of the session that I'm going to have, I will want them to create a GitHub issue from the first message and a comment on the exit. But I wouldn't want it to be in any existing kit right now. I think it would be a new plugin."* So the issue is opted into **per session**, by a plugin of its own. The capture plugin keeps recording and never publishes. This plugin publishes, and only for a session that asked.

## Desired outcome

A session that asks has one issue in a private repository, titled by its session id and first prompt. Each exit adds a comment with what the session did. A session that does not ask sees no change at all, on any host.

## Current reality

- `claude/miadi-session-observability` 0.1.14 writes every event under `<root>/<session_id>/`. Its indexes include `_claude_user_inputs.jsonl`, `_claude_PostToolUse.jsonl`, `_claude_files_written.jsonl` and `_claude_publications.jsonl`. It writes `last_claude_AssistantResponse.json` at each Stop, and the binding line to `_terminal_binding.jsonl`.
- Its root chain is `CLAUDE_SESSIONDATA_ROOT`, `MIADI_SESSION_DIR`, `MIADI_SESSIONDATA_ROOT`, `SESSION_DATA_ROOT`, then `/src/_sessiondata`. On ilex, `MIADI_SESSION_DIR=/data/data/com.termux/files/srv/miadi/sessions`.
- binscripts `etc/bash_env_common` sets `MIADI_CHRONICLE_SESSION_REPO=miadisabelle/chronicle-sessions` on Miadi hosts.
- Claude Code 2.1.299, measured on ilex (2026-10-14, a probe plugin):
  - a plugin command reaches `UserPromptSubmit` as its raw text, `/<plugin>:<command> <args>`;
  - that hook's stdout reaches the model in the same turn;
  - hooks receive `CLAUDE_CODE_SESSION_ATTENDED` (`1` interactive, `0` for `claude -p`), `CLAUDE_PID` and `CLAUDE_PLUGIN_DATA`;
  - SessionEnd's input holds `session_id`, `transcript_path`, `cwd`, `reason` and `prompt_id`.
- The ilex prototype ([`research/ilex-prototype/`](./research/ilex-prototype/)) opened issues and wrote comments, but it is wired nowhere.

## Creative Advancement Scenarios

**Creative Advancement Scenario**: A session asked for at launch

**User Intent**: Guillaume starts a session he will want to find later, read and link to an episode.
**Current Reality**: ilex has both plugins installed. His shell has `alias claudeissue='MIADI_SESSION_ISSUE=1 claude'`.
**Natural Progression Steps**:
  1. He starts it with `claudeissue`. His first prompt reaches `UserPromptSubmit`. The opener sees the variable and no `.issue_created`, takes the lock, hands the work to a detached job, and returns without a word on stdout.
  2. The job checks that `miadisabelle/chronicle-sessions` is private and creates `Session 3f2a9c1e: tidy the capture folder names`. The body holds the session's id, when and how it was opened, the folder, pane, team and episode, and the first prompt, sanitized.
  3. The URL lands in `.issue_created`, then a `trace.log` line, then a publication line.
**Achieved Outcome**: The session has a page, found by its id, before the first answer arrives.
**Supporting Features**: `SessionIssueOpener`, `SessionIssueBody`, `RepositoryGuard`, `RepositoryChoice`.

**Creative Advancement Scenario**: A session that turns out to matter

**User Intent**: Midway through a plain `claude` session, he decides it should have a page.
**Current Reality**: The session did not ask at launch. Its first prompt is in the capture.
**Natural Progression Steps**:
  1. He types `/session-issue`. The opener recognises the command, reads the session's first prompt that is not the command (from `_claude_user_inputs.jsonl`, else from the transcript's start), and opens the issue while the prompt waits.
  2. Its stdout, one line beginning `miadi-session-issue:`, names the link. The command tells the model to report that line and do nothing else.
**Achieved Outcome**: The issue reads as if the session had asked from the start, and every later exit comments on it.
**Supporting Features**: `SessionIssueCommand`, `FirstPrompt`.

**Creative Advancement Scenario**: A session's story grows across days

**User Intent**: He resumes yesterday's session, works, and exits twice in two days.
**Current Reality**: `.issue_created` holds the issue URL from the first day. Today's launch did not set the variable.
**Natural Progression Steps**:
  1. The resumed session's prompts find the marker, so the opener does nothing.
  2. Each `/exit` reaches `SessionEnd`. The commenter sees `.issue_created`, detaches and posts `## Session End`: the reason (`/exit`), the session's running totals, what it published since the previous comment (two commits, one push), and its last answer.
**Achieved Outcome**: The issue reads as the session's story, one comment per sitting.
**Supporting Features**: `SessionEndCommenter`, `PublishedSince`.

**Creative Advancement Scenario**: A session that never asked

**User Intent**: `jgi` on gaia works as before, with the plugin installed.
**Current Reality**: `MIADI_SESSION_ISSUE` is not set, and nobody types `/session-issue`.
**Natural Progression Steps**:
  1. The opener checks the variable, the prompt text and `.issue_optin`, and returns. The commenter finds no `.issue_created` and returns.
**Achieved Outcome**: No issue, no file, no network call.
**Supporting Features**: `OptIn`.

**Creative Advancement Scenario**: A prompt carrying a secret

**User Intent**: A pasted command line holds a token.
**Current Reality**: The capture sanitizer already redacts token shapes in every capture file.
**Natural Progression Steps**:
  1. The opener passes the prompt through its bundled copy of that sanitizer before building the title and the body.
**Achieved Outcome**: The issue shows the redaction marker the capture files show.
**Supporting Features**: `SessionIssueBody`.

**Creative Advancement Scenario**: A decomposition run inside an asked session

**User Intent**: A `claudeissue` session runs `miaco decompose`, which starts `claude -p` steps.
**Current Reality**: Each step inherits `MIADI_SESSION_ISSUE`, and Claude Code gives it `CLAUDE_CODE_SESSION_ATTENDED=0`.
**Natural Progression Steps**:
  1. Each step's opener finds itself headless, writes `.issue_skipped` with `headless`, and logs it once.
**Achieved Outcome**: The asked session keeps its issue, and its steps open none. (A proposed default, held by Guillaume. `MIADI_SESSION_ISSUE_HEADLESS=1` opens issues for them too.)
**Supporting Features**: `HeadlessRule`.

**Creative Advancement Scenario**: The phone is offline

**User Intent**: He works on ilex with no network.
**Current Reality**: `gh` cannot reach GitHub.
**Natural Progression Steps**:
  1. The job's `gh` call fails, so it writes `Issue creation failed: …`, counts one attempt and releases the lock.
  2. The next prompt tries again, up to three attempts. After the third failure the opener writes `.issue_skipped` with `attempts` and stops trying. `/session-issue` clears that and tries once more.
**Achieved Outcome**: The session runs undisturbed. The capture folder holds the whole session, and `trace.log` says why there is no page.
**Supporting Features**: `SessionIssueOpener` § Attempts.

## Supporting structures

The two hooks advance, and do not oscillate, because each step leaves a file the next step reads:
- `.issue_created` ends the opener's work for the life of the session, and starts the commenter's;
- `.issue_skipped` ends the opener's work the same way when the answer is "no issue";
- `.issue_optin` carries a `/session-issue` typed before any prompt to the next prompt;
- `.issue_comment_offset` lets each comment say only what is new.

Nothing is read back from GitHub but the repository's visibility, nothing waits on GitHub but `/session-issue`, and nothing is retried after the session decided.

## Components

### OptIn
Decides, in the opener, whether anything is to be done. A session that did not ask costs one regular-expression match on the hook's input and one `stat`.
- **Behavior:** A session asks when `MIADI_SESSION_ISSUE` is set and not empty at launch, or when `/session-issue` was typed in it (`.issue_optin`, then `.issue_created`). Otherwise the opener exits 0 before running `jq`.
- **Behavior:** The commenter needs no opt-in. A session with `.issue_created` comments at each exit, however it was started.

### RepositoryChoice
- **Behavior:** The repository is the first of these that has the shape `owner/repo`: the `/session-issue` argument (kept in `.issue_optin` when it waits for the next prompt), `MIADI_SESSION_ISSUE`, then `MIADI_CHRONICLE_SESSION_REPO`. `MIADI_SESSION_ISSUE=1` therefore means "the host's repository".
- **Behavior:** When none names one, the automatic path writes `.issue_skipped` holding `no repository`. `/session-issue` answers how to name one, and writes nothing.

### HeadlessRule
- **Behavior:** A session is headless when `CLAUDE_CODE_SESSION_ATTENDED` is `0`. When that variable is absent (an older Claude Code), it is interactive only when `~/.claude/sessions/$CLAUDE_PID.json` exists with `kind: "interactive"`.
- **Behavior:** A headless session asked by the variable opens no issue unless `MIADI_SESSION_ISSUE_HEADLESS=1`. Its first prompt writes `.issue_skipped` holding `headless` and one `trace.log` line, `Session issue skipped: headless at <time>`.
- **Behavior:** `/session-issue` is honoured in any session, headless or not: someone asked.

### SessionIssueOpener
A `UserPromptSubmit` hook, `hooks/first_prompt_issue.sh`.
- **Behavior:** Reads `session_id`, `prompt`, `cwd` and `transcript_path`. It returns at once when `OptIn` finds nothing, when the prompt is blank, or when `.issue_created` or `.issue_skipped` exists.
- **Behavior:** Takes the lock `mkdir <root>/<session_id>/.issue_lock`, which is atomic on every host including Termux. When the directory exists and is younger than 120 seconds, it returns: another prompt's job is at work. An older lock is stale, and it is removed and taken again.
- **Behavior:** Applies `HeadlessRule`, then hands everything below to a detached job (`setsid`, else `nohup`) and returns. It prints nothing on stdout, and exits 0 on every path.
- **Behavior (detached job):** Runs `gh` as the host user.
  1. `RepositoryGuard`.
  2. `TracingSink` opening, when it is active.
  3. `gh issue create --repo <repo> --title <SessionIssueTitle> --body-file <SessionIssueBody>`.
  4. On success, the URL from gh's output goes to `.issue_created` (that line alone). `trace.log` gets `Issue created: <url> at <ISO-8601 time>`. `_claude_publications.jsonl` gets `{timestamp, session_id, kind: "issue", action: "session issue", url, repo, number, by: "hook"}`, under `.publications.lock` when `flock` exists.
  5. On failure, `trace.log` gets `Issue creation failed: <first line of gh output> at <time>`.
  6. The lock is released on every path.
- **Attempts:** Each failure, of the guard's visibility call or of the create, adds one to `.issue_attempts`. At 3 the job writes `.issue_skipped` holding `attempts`, and the session tries no more on its own.
- **Behavior:** It never edits, labels, assigns or closes an issue, and never changes a title after creating it.

### SessionIssueCommand
`commands/session-issue.md`, answered by the opener before the model reads it.
- **Behavior:** The opener treats a prompt as the command when it matches `^\s*/(miadi-session-issue:)?session-issue(\s|$)`. A prompt that only mentions it is an ordinary prompt.
- **Behavior:** It runs while the prompt waits (the hook's timeout is 30 s), and prints one line beginning `miadi-session-issue:` with the answer, then a second telling the model to report it in one line and run nothing. The second line is there because `claude -p` does not resolve a bare `/session-issue` to the command, so the model may never read the command's text. The answers:
  - `.issue_created` exists: the link.
  - a job holds the lock: the issue is being opened, ask again in a moment.
  - no repository (`RepositoryChoice`): how to name one.
  - no earlier prompt (`FirstPrompt` is empty): it writes `.issue_optin` with the repository, and says the next prompt opens the issue.
  - otherwise it clears `.issue_skipped` and `.issue_attempts`, takes the lock, and runs the job's steps 1 to 6 in the foreground: the link, the refusal, or the first line of gh's failure.
- **Behavior:** The command's text tells the model to report that line in one line, to run no `gh` itself, and, when no such line is in the context, to say that hooks load at session start.

### FirstPrompt
- **Behavior:** The session's first prompt that is not blank and is not `/session-issue`: the first such `.prompt` in `_claude_user_inputs.jsonl`, else, from the transcript's first 4 MB, the first `user` entry that is not `isMeta` or `isCompactSummary`, whose text does not begin with `<command-`, `<local-command`, `<bash-` or `<system-reminder`.
- **Behavior:** Cut at 8000 characters, with the count of the rest passed to the body.

### RepositoryGuard
- **Behavior:** Calls `gh repo view <repo> --json visibility -q .visibility`. `PRIVATE` and `INTERNAL` pass. `PUBLIC` writes `.issue_skipped` holding `public <repo>` and `trace.log` `Session issue refused: <repo> is public at <time>`, and nothing is posted. Any other answer is refused the same way (`visibility <repo>`). A failed call counts as a failed attempt.

### SessionIssueTitle
- **Behavior:** `Session <first 8 characters of session_id>: <text>`. `<text>` is the first non-empty line of the sanitized prompt, with runs of whitespace collapsed to one space. It is cut at 80 characters, counted in characters rather than bytes, so a multi-byte character is never split. `...` follows when `<text>` is not the whole prompt.

### SessionIssueBody
- **Layout:** Two sections, with the prototype's headings:
  ```markdown
  ## Session

  - **ID**: `<session_id>`
  - **Opened**: <ISO-8601 time>, by <the first prompt | /session-issue>
  - **CWD**: <cwd>
  - **Host**: <hostname -s>                · not when it is localhost (Android names every phone so)
  - **Pane**: <tmux session:window.pane>   · only when the binding line has tmux
  - **Team**: <team id>                    · only when the binding line has a team other than unassigned
  - **Episode**: miadi-chronicle://<n> (`<episode id>`)   · only when the binding line resolved one
  - **Trace**: `miadi-tracing:<domain>/trace/<id>`   · only when the tracing sink opened one

  ## First Prompt

  <fence>
  <the sanitized prompt>
  <fence>
  ```
- **Behavior:** The pane, team and episode come from the session's last `_terminal_binding.jsonl` line (`tmux.session`, `tmux.window`, `tmux.pane`, `team.id`, `episode.id`). A missing file or field drops the line. It is never a reason to wait.
- **Behavior:** The fence is a run of backticks one longer than the longest run inside the prompt, and at least three. A cut prompt is followed by `(truncated: <n> more characters in the session's capture)`.
- **Behavior:** The body is written to `_session_issue_body.md` in the session folder and passed with `--body-file`, so no shell quoting touches the prompt.

### SessionEndCommenter
A `SessionEnd` hook, `hooks/exit_comment.sh`.
- **Behavior:** Returns at once unless `.issue_created` holds a URL. Otherwise it hands the rest to a detached job and returns well inside the 1.5 s Claude Code allows a SessionEnd hook. It prints nothing.
- **Behavior (detached job):**
  1. Waits `MIADI_SESSION_ISSUE_SETTLE` seconds (2), so the capture's own detached work on the last tool calls can land.
  2. Builds `SessionEndComment` and posts it with `gh issue comment <url> --body-file _session_end_comment.md`.
  3. `trace.log` gets `Session end comment posted to <url> at <time>`, or `Session end comment failed: <first line> at <time>`. `_claude_publications.jsonl` gets `{timestamp, session_id, kind: "issue-comment", action: "session end", url, repo, number, by: "hook"}`.
  4. When the tracing sink is active, it adds the `TracingSink` closing.
- **Behavior:** Every SessionEnd comments: each exit of a resumed session adds one comment. A failed comment is not retried. The next exit's comment carries the running totals anyway.

### SessionEndComment
- **Layout:**
  ```markdown
  ## Session End

  **Reason**: /exit · **Ended**: <ISO-8601 time>

  ### Summary                                 · only when the capture's files are there

  | Metric | Count |
  |--------|-------|
  | User prompts | <lines of _claude_user_inputs.jsonl> |
  | Tool uses | <lines of _claude_PostToolUse.jsonl> |
  | Files touched | <distinct paths in _claude_files_written.jsonl> |
  | Published | <publication lines, the hooks' own excluded> |

  ### Published since the previous comment    · only when there are some

  - commit `<sha7>` <subject> · <repo>
  - push <repo> `<branch>`
  - issue <url>

  ### Last Agent Response

  <sanitized text>
  ```
- **Behavior:** **Reason** shows `/exit` for `prompt_input_exit` and the raw value otherwise (`clear`, `logout`, `other`).
- **Behavior:** `PublishedSince` reads the lines of `_claude_publications.jsonl` after the count `.issue_comment_offset` holds (0 when absent), excluding lines with `by: "hook"`. It lists at most 30, then `and <n> more`. After a posted comment it writes the line count it read to `.issue_comment_offset`.
- **Behavior:** The last answer is `last_assistant_message` from `last_claude_AssistantResponse.json` when it belongs to this session. Otherwise it is the text of the last assistant entry in the final 2 MB of the transcript. The whole transcript is never read. It passes through the sanitizer, is cut at 3000 characters with `_(truncated)_`, and becomes `_(no final message captured)_` when there is none.

### TracingSink (option, not built)
The same opening and closing, recorded as a trace that `@miadi/tracing` resolves. It is built only after a write path exists (kin file: `@miadi/tracing`, `coaia`).
- **Behavior:** Active when `MIADI_SESSION_ISSUE_SINKS` names `tracing` and the keys of `MIADI_SESSION_ISSUE_TRACE_DOMAIN` (`eng` by default, else `ceremony` or `story`) are set (`<DOMAIN>_LANGFUSE_PUBLIC_KEY`, `<DOMAIN>_LANGFUSE_SECRET_KEY`). `MIADI_SESSION_ISSUE_SINKS` is a comma list (`github`, `tracing`, `github,tracing`), `github` when unset.
- **Behavior (opening):** Runs before the issue is created, in the same job. It creates one trace:
  - its name is `SessionIssueTitle`, and its session id is Claude Code's session id;
  - its input is the sanitized first prompt;
  - its metadata holds cwd, host, pane, team and episode.
  The reference `miadi-tracing:<domain>/trace/<id>` goes to `.trace_created` and into the issue body's **Trace** line.
- **Behavior (closing):** At each SessionEnd it adds one observation named `session end` under that trace. Its input is the reason, its output the last answer, and its metadata the summary counts.
- **Behavior:** Both texts pass through the sanitizer, as for GitHub. `@miadi/tracing` 0.1.0 never returns a trace's input or output, only its name, session and observations.
- **Behavior:** `MIADI_SESSION_ISSUE_SINKS=tracing` alone records traces and opens no issue.

## Data

### Configuration (environment)
| Name | Meaning | Default |
|---|---|---|
| `MIADI_SESSION_ISSUE` | Set at launch, the session asks. `1`, or `owner/repo` to name the repository | unset: the session does not ask |
| `MIADI_CHRONICLE_SESSION_REPO` | The host's session repository, set by binscripts `etc/bash_env_common` | unset |
| `MIADI_SESSION_ISSUE_HEADLESS` | `1` opens issues for headless sessions that inherited the variable | unset |
| `MIADI_SESSION_ISSUE_SETTLE` | Seconds the commenter waits for the capture's last work | `2` |
| `MIADI_SESSION_ISSUE_SINKS`, `MIADI_SESSION_ISSUE_TRACE_DOMAIN` | The tracing option, not built | `github`, `eng` |
| `CLAUDE_SESSIONDATA_ROOT`, `MIADI_SESSION_DIR`, `MIADI_SESSIONDATA_ROOT`, `SESSION_DATA_ROOT` | The root, in the capture plugin's order. Then `/src/_sessiondata` when it exists, then `$CLAUDE_PLUGIN_DATA/sessions` | the chain |

### Files in `<root>/<session_id>/`
| File | Written by | Holds |
|---|---|---|
| `.issue_created` | opener | the issue URL, one line. The state indicator named in chronicle-sessions `CLAUDE.md` |
| `.issue_skipped` | opener | `headless`, `public <repo>`, `visibility <repo>`, `attempts` or `no repository`: why this session has no issue |
| `.issue_attempts` | opener | failed attempts, a number |
| `.issue_optin` | `/session-issue` | the repository, until the next prompt opens the issue |
| `.issue_lock/` | opener | present while a job creates the issue |
| `.issue_comment_offset` | commenter | publication lines already reported |
| `.trace_created` | tracing sink | `miadi-tracing:<domain>/trace/<id>`, one line |
| `_session_issue_body.md`, `_session_end_comment.md` | both | the last text posted, kept for reading |
| `trace.log` | both | the lines named above, in the prototype's words |
| `_claude_publications.jsonl` | both | one line per issue or comment, `by: "hook"` |
