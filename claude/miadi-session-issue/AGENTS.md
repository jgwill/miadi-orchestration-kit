# miadi-session-issue — for agents changing this plugin

The specification is `rispecs/chronicle-github-sessions-observability/03-specify.md`, and its
gates are `04-export.md` § Gates. A change to behaviour changes `tests/session-issue.sh` first,
then the hooks, then the version in `.claude-plugin/plugin.json` and in the kit's
`.claude-plugin/marketplace.json`. Issue: jgwill/miadi-orchestration-kit#89.

## What is here

| Path | What |
|---|---|
| `hooks/hooks.json` | two entries: `UserPromptSubmit` and `SessionEnd`. Nothing else fires |
| `hooks/first_prompt_issue.sh` | opens the issue at the first prompt of a session that asked, and answers `/session-issue` |
| `hooks/exit_comment.sh` | one comment per exit, for a session that has an issue |
| `hooks/lib.sh` | the root chain, the lock, the repository guard, the title, body and comment |
| `hooks/secret_capture_sanitizer.sh` | a copy. The canonical one is `claude/miadi-session-observability/hooks/secret_capture_sanitizer.sh`. A plugin cannot read another plugin's files, because each sits in its own cache folder. Copy it again when that one changes |
| `commands/session-issue.md` | `/session-issue`. The hook acts before the model reads the command, and the command only reports the hook's line |
| `tests/session-issue.sh` | the gates, against a stub `gh` |

## What must stay true

- **A session that did not ask costs one stat.** The opener checks the variable, the prompt
  text and `.issue_optin` before running `jq`. Do not add reads before those checks.
- **Nothing on stdout but the `/session-issue` answer.** Claude Code adds a `UserPromptSubmit`
  hook's stdout to the conversation. The answer is one line beginning `miadi-session-issue:`,
  and a second line tells the model to report it and run nothing. The command says the same,
  but `claude -p` does not resolve a bare `/session-issue` to the command, so the hook's lines
  must stand alone.
- **SessionEnd returns at once.** Claude Code cancels a SessionEnd hook after 1.5 s. The comment
  is a detached job (`setsid`).
- **Private repositories only**, checked by `gh repo view` before each create.
- **Sanitize before writing or sending** the prompt and the last answer.
- **Never edit, label, assign or close an issue, or change its title.** People retitle them.
  `.issue_created` keeps its URL on its first line: miadisabelle/chronicle-sessions `CLAUDE.md`
  names that marker.
- **Do not reimplement capture.** Counts and publications come from
  miadi-session-observability's files. A need there begins in that plugin's rules and tests.

## Verified on Claude Code 2.1.299 (ilex, 2026-10-14)

- A plugin command typed as `/plugin:command args` reaches `UserPromptSubmit` as that raw text,
  and the hook's stdout reaches the model in the same turn.
- Hooks get `CLAUDE_CODE_SESSION_ATTENDED` (`1` interactive, `0` for `claude -p`), `CLAUDE_PID`
  and `CLAUDE_PLUGIN_DATA`. `~/.claude/sessions/<pid>.json` carries `kind: "interactive"`.
- SessionEnd's input holds `session_id`, `transcript_path`, `cwd`, `reason`, `prompt_id`, and no
  last message.
- Interactive: typing `/session-issue` offers `/miadi-session-issue:session-issue`, and Enter
  runs it. `claude -p "/session-issue"` passes the bare text to the model unresolved, and the
  hook still answers it.

## Where it is installed

| Host | Since | Version | Result |
|---|---|---|---|
| ilex (Termux, Pixel 2), u0_a194 | 2026-10-14, from the GitHub marketplace, on Guillaume's word | 0.1.0 (06f2412) | The installed copy passes `tests/session-issue.sh`. A new session loads it (`miadi-session-issue:session-issue` listed), and one that did not ask wrote no issue file. State goes to `MIADI_SESSION_DIR`, beside the capture. The live issues were opened with `--plugin-dir` from the same commit: miadisabelle/chronicle-sessions#58, #59. The `claudeissue` alias is not set: the shell config is Guillaume's |
