# The ilex prototype, as it ran

Evidence for [`../../01-reverse-engineer.md`](../../01-reverse-engineer.md). **Do not run these files, and do not edit them.** They are copies kept for reading. The plugin's own hooks are built from [`../../03-specify.md`](../../03-specify.md).

| File | Copied from |
|---|---|
| `session_issue_hook.sh` | jgwill/binscripts (private) `hooks/claude_hooks/session_issue_hook.sh` at 1208e81 (added in 85ca6ea, 2026-07-22) |
| `session_end_comment_hook.sh` | the same branch, `hooks/claude_hooks/session_end_comment_hook.sh` (added in 9ec22a0, 2026-07-22) |
| `lib.sh` | the same branch, `hooks/claude_hooks/lib.sh` (`CLAUDE_SESSION_DIR`, from ce6bd04). It sources `../secret_capture_sanitizer.sh`, which is not copied here: the plugin bundles its own as `hooks/secret_capture_sanitizer.sh` |
| `settings.json.with-hooks.hooks.json` | the `hooks` block of `~/.claude/settings.json.with-hooks` on ilex (2026-08-15), the wiring of the whole suite with these two hooks in it |

The scripts were copied byte for byte with `git show 1208e81:<path>` from branch `hooks/portable-session-dir`, which was never merged to `main`. The settings block was extracted with `jq '{hooks: .hooks}'`. It holds paths and timeouts only.

What these hooks wrote to GitHub stays in miadisabelle/chronicle-sessions, which is private. This packet is public, so it cites those issues by number and counts. It quotes no prompt and no answer, only the opening words of a few titles, to show how people retitled them, and one design sentence from that repository's `CLAUDE.md`.
