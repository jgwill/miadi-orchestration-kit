# STATUS · the Return

> What was built from [`03-specify.md`](./03-specify.md), what proved it, and what stays open. jgwill/miadi-orchestration-kit#89.

## Built, 2026-10-14

`claude/miadi-session-issue` 0.1.0, a plugin of its own beside the capture plugin, on Guillaume's word the same day (kin file). Two hooks (`UserPromptSubmit`, `SessionEnd`), the `/session-issue` command, a copy of the capture sanitizer, and `tests/session-issue.sh`. The capture plugin is unchanged at 0.1.14.

## Gates

`bash claude/miadi-session-issue/tests/session-issue.sh` on ilex (aarch64, Termux): every check of G1 to G21 passes, and the bundled sanitizer's self-test too. G15's comment, built from a 30 MB transcript's last 2 MB, took 470 to 520 ms.

## Live runs on ilex, Claude Code 2.1.299, against miadisabelle/chronicle-sessions (private)

| Run | What it showed |
|---|---|
| `claude -p` with `MIADI_SESSION_ISSUE=1 MIADI_SESSION_ISSUE_HEADLESS=1 --plugin-dir` | miadisabelle/chronicle-sessions#58 opened from the first prompt. The session's end posted a comment with the capture's counts and the last answer |
| the same session resumed with `claude -p "/session-issue"` | the bare form is **not** resolved to the plugin command in `claude -p`. The hook still answered from the raw text, and the model reported the link. So the hook's answer now carries its own instruction (a second `miadi-session-issue:` line) |
| the same session resumed interactively, `/session-issue` typed | autocomplete offers `/miadi-session-issue:session-issue`. Enter runs it, the hook answers, and the model reports the link in one line and runs nothing. `/exit` posted a comment with reason `/exit` |
| a fresh interactive session with `MIADI_SESSION_ISSUE=1` | miadisabelle/chronicle-sessions#59 opened from the first prompt, the pane in its body. `/exit` posted its comment |

Both test issues stay open: whether a session's issue closes is held by Guillaume.

## Open

- Installing on ilex and the `claudeissue` alias (`04-export.md` § 2). The alias goes in Guillaume's shell config.
- The model of an asked session does not know its issue was opened, and may say it opened none (#59's last answer). The opener prints nothing on purpose: its stdout would enter every first prompt's context.
- The relatives to tell (`04-export.md` § After it ships).
- The tracing sink (`04-export.md` § 3).
