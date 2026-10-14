# chronicle-github-sessions-observability — kin

> Speaks for [`03-specify.md`](./03-specify.md) and its export [`04-export.md`](./04-export.md). Guidance: jgwill/llms-txt `llms-rispecs-kinship.md` 2.0.0.

## Who I am, where I come from

The specification of a session's GitHub issue: opened from the first prompt, commented at each exit, for a session that asks. Built as its own plugin, `claude/miadi-session-issue`, beside the capture plugin.

It came from Guillaume's words on 2026-10-14:

> *"documenting into the `rispecs/chronicle-github-sessions-observability` that part of the hooks that created github issue from first message and when we run /exit as comment. use the RISE framework obviously todo that and include the protoype that we built on this platform todo that inside of it"*

and from the note he left in this folder before it held a spec:

> *"is meant for claude that will document that github issue thing with the hooks from android. we might also consider using `@miadi/tracing` or something as option...."*

and from his word later that day, which made it a plugin of its own:

> *"some of the session that I'm going to have, I will want them to create a GitHub issue from the first message and a comment on the exit. But I wouldn't want it to be in any existing kit right now. I think it would be a new plugin."*

It also came from the prototype he built on ilex in July 2026, which [`01-reverse-engineer.md`](./01-reverse-engineer.md) reads.

## My relatives

| Relative | How we are related | Where it lives | What it asks of us |
|---|---|---|---|
| Guillaume's words above | came from | this file; jgwill/miadi-orchestration-kit#89 | Keep both asks: the issue at the first prompt, the comment at `/exit`. Keep it per session, in its own plugin. Keep tracing as an option, not a replacement |
| The ilex prototype | came from | jgwill/binscripts (private), branch `hooks/portable-session-dir` at 1208e81, `hooks/claude_hooks/`. Copy: [`research/ilex-prototype/`](./research/ilex-prototype/) | Keep what it gave (`02-intent.md` § Beloved qualities). Leave the copy as written: it is evidence, not code to run |
| `claude/miadi-session-issue` | relies on us | jgwill/miadi-orchestration-kit `claude/miadi-session-issue/` | It is built from `03-specify.md`. A change to the spec changes the plugin's `tests/session-issue.sh` first, then the hooks, then the version in `plugin.json` and `.claude-plugin/marketplace.json` |
| `claude/miadi-session-observability`'s capture: `lib.sh` (`claude_sanitize_text`, `claude_detach`, `claude_with_lock`), `last_claude_AssistantResponse.json`, `_claude_files_written.jsonl`, `_claude_publications.jsonl`, the binding line | we rely on | `claude/miadi-session-observability/`; its `AGENTS.md` § What the port must keep | Read its files, never write them, except a `by: "hook"` line in `_claude_publications.jsonl`. Its root chain is ours, so both use one session folder. Its sanitizer is copied: copy it again when it changes. A need that changes capture begins in that plugin's own rules and tests |
| `MIADI_CHRONICLE_SESSION_REPO` | we rely on | jgwill/binscripts (private) `etc/bash_env_common` | The host's session repository, read when the session's ask names none |
| miadisabelle/chronicle-sessions | relies on us | miadisabelle/chronicle-sessions (private), `CLAUDE.md` § Session Folder Contract, and its issues | Keep `.issue_created` and its first-line URL. Never change an issue's title or body after creating it, because people retitle and rewrite them. Any other change to the marker or the lifecycle: open an issue there naming it |
| Claude Code's hook contract | we rely on | Claude Code (2.1.299 on ilex): `UserPromptSubmit` (`prompt`, `session_id`, `cwd`, `transcript_path`), a plugin command reaching it as raw text, its stdout injected into the conversation, `SessionEnd` (`reason`, `transcript_path`), SessionEnd cancelled after 1.5 s, `CLAUDE_CODE_SESSION_ATTENDED` | When Claude Code changes these, re-check the gates in `04-export.md` and write the change in the plugin's README |
| The GitHub CLI on each host | we rely on | `gh`, logged in as the host user's GitHub account (`miadisabelle` on ilex, 2026-10-14) | An unauthenticated `gh` gives `trace.log` lines, not issues. The install check says which account posts |
| `@miadi/tracing`, `@miadi/tracing-langfuse` | we rely on (option) | jgwill/Miadi `packages/tracing`, `packages/tracing-langfuse`, both 0.1.0 | Read-only today. A write path begins with an issue in jgwill/Miadi, is published there, and only then is the tracing sink built here |
| The `coaia` CLI | we rely on (option) | `coaia` on the host. The `coaiajs` skill documents it | *To confirm*: the command that writes a trace and an observation, before the tracing sink is built |
| `@miadi/hooks-interpreter` | relies on us | jgwill/Miadi `packages/hooks-interpreter`. It reads `_claude_publications.jsonl` | The hooks add publication lines of kind `issue` and `issue-comment` with `action` `session issue` and `session end`. When this ships, open an issue in jgwill/Miadi naming those lines |
| jgwill/binscripts `hooks/claude_hooks` on `main` | walks beside | jgwill/binscripts (private), the live copy for hosts not yet on the plugin (jgwill/binscripts#158) | The two hooks are new `hooks.json` entries, so there is nothing to carry there. When they ship, tell binscripts in an issue that the branch's hooks now live in the plugin |
| `rispecs/claude-session-orchestrator-plugin/` | walks beside | this repository | The kit's first plugin packet. Use its words for the plugin lane; do not restate them |
| jgwill/miadi-orchestration-kit#56 | walks beside | the plugin's own plan | Link #89 there when the hooks are built |
| The ilex home, a jgwill/eury checkout since 2026-10-14 | walks beside | jgwill/eury (private), jgwill/eury#7 | `~/.claude/` is a link into the old home: keep `~/.claude/plugins/` and session data out of that repository's commits |
| jgwill/src#319 | walks beside (*to confirm*) | named as the refinement issue in binscripts `hooks/claude_hooks/CLAUDE.md` | Read it before building, and record here what it holds |
| The chronicle's episodes | walks beside | `miadi-chronicle://<n>`, under `MIADI_CHRONICLE_ROOT`; the binding line resolves a session's episode | The issue body names the episode the binding line resolved. The hooks write nothing to the chronicle |

## What others hold

| Held | By |
|---|---|
| Which repository receives session issues, and that it stays private | Guillaume (jgwill) |
| Whether a session's issue closes when the session ends | Guillaume |
| Whether headless sessions (`claude -p`) open issues | Guillaume |
| Which sinks to use: GitHub, tracing, or both | Guillaume |
| Turning it on for a user on a host | that user, on their word (the plugin's cutover rule) |
| Which GitHub account posts | the host user's `gh` login |
| What `@miadi/tracing` becomes, including a write API | jgwill/Miadi |

## Harmony

- 2026-10-14 · the commit that adds this folder (#89) · Written with the first spec. Named back from `claude/miadi-session-observability/AGENTS.md` in the same commit. Not yet named back: miadisabelle/chronicle-sessions `CLAUDE.md`, jgwill/binscripts, and jgwill/Miadi (`hooks-interpreter`, `tracing`). Each relationship above says when to ask them, which is when the hooks ship.
- 2026-10-14 · revised under #89 · The two hooks became their own plugin, `claude/miadi-session-issue`, opted into per session, on Guillaume's word. Built the same day (`STATUS.md`). The capture plugin's `AGENTS.md` now names the new plugin.
