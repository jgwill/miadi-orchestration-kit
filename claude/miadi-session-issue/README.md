# miadi-session-issue

A session that asks gets one GitHub issue, opened from its first prompt, and a comment at each
exit. People read, retitle and link sessions there like any other work. A session that does not
ask is untouched: no file, no network call. jgwill/miadi-orchestration-kit#89.

The specification is
[`rispecs/chronicle-github-sessions-observability/`](../../rispecs/chronicle-github-sessions-observability/),
built from the prototype Guillaume ran on ilex in July 2026.

## How a session asks

- **At launch.** Start it with `MIADI_SESSION_ISSUE` set. An alias in your shell config does it:

  ```bash
  alias claudeissue='MIADI_SESSION_ISSUE=1 claude'
  ```

  The first prompt opens the issue. `1` uses the host's repository, and
  `MIADI_SESSION_ISSUE=owner/repo` names one.
- **During the session.** Type `/session-issue`, or `/session-issue owner/repo`. The issue opens
  then, from the session's first prompt, and the link is answered in the conversation. Typed
  as the session's very first prompt, it opens the issue at the next prompt instead.

Either way, each `/exit` afterwards adds one comment, a resumed session included.

The repository is the `/session-issue` argument, else `MIADI_SESSION_ISSUE` when it names one,
else `MIADI_CHRONICLE_SESSION_REPO`, which binscripts `etc/bash_env_common` sets on Miadi hosts
(`miadisabelle/chronicle-sessions`).

## What is posted

- **The issue**, titled `Session <first 8 characters of the id>: <first line of the prompt>`, cut
  at 80 characters. The body names the session id, when and how it was opened, the working
  folder, the host, the tmux pane, the team and the chronicle episode when the capture's binding
  line has them, then the first prompt in a fence.
- **Each comment**: the exit reason (`/exit`, `clear`, `logout`, `other`), the session's counts
  (prompts, tool uses, files touched, publications), what it published since the previous
  comment (commits, pushes, issues, pull requests, Artifact pages, npm releases), and its last
  answer, cut at 3000 characters.

## What is never posted

- Anything to a public repository. The opener asks GitHub for the repository's visibility first
  and refuses everything but `PRIVATE` and `INTERNAL`.
- A secret. The prompt and the last answer pass the capture sanitizer
  (`hooks/secret_capture_sanitizer.sh`) before they are written or sent.
- Anything from a headless session (`claude -p`, the steps of a decomposition), which inherits
  the alias's variable. `MIADI_SESSION_ISSUE_HEADLESS=1` opens issues for them too.
  `/session-issue` typed in any session is honoured: someone asked.

The plugin never edits, labels, assigns or closes an issue, and never changes a title after
creating it, because people retitle them.

## With and without the capture plugin

With `miadi-session-observability` installed and both plugins reading the same root (on ilex,
`MIADI_SESSION_DIR=/data/data/com.termux/files/srv/miadi/sessions`), this plugin's state sits in
the session's capture folder, and the comment reads `_claude_user_inputs.jsonl`,
`_claude_PostToolUse.jsonl`, `_claude_files_written.jsonl`, `_claude_publications.jsonl` and
`last_claude_AssistantResponse.json`.

Without it, the state goes to `$CLAUDE_PLUGIN_DATA/sessions/<session_id>/`, the first prompt is
read from the transcript's start, the last answer from its final 2 MB, and the comment has no
counts and no publication list.

## State, in `<root>/<session_id>/`

| File | Holds |
|---|---|
| `.issue_created` | the issue URL, one line. While it exists, no other issue opens, and each exit comments |
| `.issue_skipped` | why this session has no issue: `headless`, `public <repo>`, `attempts`, `no repository` |
| `.issue_attempts` | failed attempts. At 3 the session stops trying |
| `.issue_optin` | the repository `/session-issue` chose, until the next prompt opens the issue |
| `.issue_lock/` | present while a job opens the issue |
| `.issue_comment_offset` | publication lines already reported |
| `_session_issue_body.md`, `_session_end_comment.md` | the last text posted |
| `trace.log` | `Issue created: …`, `Session end comment posted to …`, and why not |
| `_claude_publications.jsonl` | one line per issue and comment, `by: "hook"`, never counted or listed as the session's own |

## Install

```bash
claude plugin marketplace update miadi-orchestration-kit
claude plugin install miadi-session-issue@miadi-orchestration-kit
gh auth status    # the account that posts
```

Hooks load when a session starts, so start a new one. To try it without installing:
`claude --plugin-dir <path to this folder>`.

Requires `bash`, `jq`, `perl` (the sanitizer) and `gh` logged in. Without `perl` the sanitizer
replaces the text with a refusal line instead of passing it raw.

## Tests

```bash
bash tests/session-issue.sh
```

Runs every gate against a stub `gh`, with no network.
