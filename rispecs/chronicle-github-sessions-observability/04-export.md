# 04 · Export: a plugin of its own, then onto ilex

> Phase 4 (E). Who takes up [`03-specify.md`](./03-specify.md), what they change, and the gates that prove it built. Three readers, in this order: the plugin's builder, ilex's owner, and later the tracing sink's builder.

**Revised 2026-10-14.** The first version built two hooks into `claude/miadi-session-observability` 0.1.15. They became a plugin of their own, opted into per session (`03-specify.md` § Revised). The capture plugin is unchanged at 0.1.14.

## 1. Build `claude/miadi-session-issue`

The plugin lane's rules apply (`claude/AGENTS.md` § Rules for a plugin in this lane): every path goes through `${CLAUDE_PLUGIN_ROOT}`, hooks load at session start, and runtime floors are declared.

| Part | Where |
|---|---|
| The manifest, 0.1.0 | `.claude-plugin/plugin.json`, and an entry in the kit's `.claude-plugin/marketplace.json` |
| `UserPromptSubmit` (timeout 30) and `SessionEnd` (timeout 5), nothing else | `hooks/hooks.json` |
| `OptIn`, `RepositoryChoice`, `HeadlessRule`, `SessionIssueOpener`, `SessionIssueCommand` | `hooks/first_prompt_issue.sh` |
| `SessionEndCommenter` | `hooks/exit_comment.sh` |
| The root chain, the lock, `FirstPrompt`, `RepositoryGuard`, title, body, `SessionEndComment`, `PublishedSince` | `hooks/lib.sh` |
| The capture sanitizer, a copy (a plugin cannot read another plugin's files) | `hooks/secret_capture_sanitizer.sh` |
| `/session-issue` | `commands/session-issue.md` |
| The gates below | `tests/session-issue.sh` |
| How a session asks, what is posted, what is never posted | `README.md` |
| What is here, what must stay true, what was verified, where it is installed | `AGENTS.md` |
| A row | `claude/AGENTS.md` |

The prototype in [`research/ilex-prototype/`](./research/ilex-prototype/) was the starting point. Its marker, its `trace.log` words and its headings are kept, because people and the chronicle-sessions `CLAUDE.md` know them.

### Gates: `tests/session-issue.sh`

Run with a stub `gh` first on `PATH`. The stub logs its arguments and keeps each `--title` and `--body-file`. It answers `repo view` with a visibility the test chooses, and prints `https://github.com/acme/sessions/issues/7` for `issue create` and `…/issues/7#issuecomment-<n>` for `issue comment`. A file beside its log makes it fail, and `GH_DELAY` slows it. `HOME` is a temporary folder, and `MIADI_CHRONICLE_SESSION_REPO=acme/sessions`. Detached jobs are awaited by polling for their files, at most 10 s.

| # | Given | Expect |
|---|---|---|
| G1 | `MIADI_SESSION_ISSUE` unset, a prompt | no `gh` call, no file, nothing printed |
| G2 | `MIADI_SESSION_ISSUE=1`, an interactive session, a first prompt | one `issue create --repo acme/sessions`. Title `Session <id8>: <first line>`, `.issue_created` holds the URL alone, `trace.log` has `Issue created: …`, one publication line `kind: "issue"`, `by: "hook"`, nothing printed. With `MIADI_SESSION_ISSUE=acme/other`, created there |
| G3 | a second and a third prompt, one sent while the first job holds `.issue_lock` | still one `issue create` |
| G4 | a resumed session (`.issue_created` present) | no `issue create` |
| G5 | `repo view` answers `PUBLIC` | no `issue create`, `.issue_skipped` holds `public acme/sessions`, and `trace.log` has `Session issue refused` |
| G6 | `CLAUDE_CODE_SESSION_ATTENDED=0` | no call, `.issue_skipped` holds `headless`. With `MIADI_SESSION_ISSUE_HEADLESS=1`, one `issue create`. Without the variable, a registered `~/.claude/sessions/<pid>.json` with `kind: "interactive"` opens one |
| G7 | a prompt holding a token shape the sanitizer knows | neither title nor body holds it, and the body shows the redaction |
| G8 | a prompt of three lines, the first 120 characters with an `é` at character 80 | title cut at 80 characters, `é` whole, `...` appended. A short first line of two gets `...` too |
| G9 | a prompt holding a run of four backticks | body fence of five |
| G10 | the stub fails three times | three `Issue creation failed` lines, then `.issue_skipped` holds `attempts` and the fourth prompt calls nothing |
| G11 | either hook | nothing on stdout, exit 0 |
| G12 | SessionEnd with `.issue_created` and the capture's files | the hook returns in under 1 s. One `issue comment` whose body has `**Reason**: /exit`, the four counts (the hooks' own lines not counted as published), and the last answer from `last_claude_AssistantResponse.json`. One publication line `issue-comment` |
| G13 | two publication lines, a SessionEnd, one more line, a SessionEnd with reason `clear` | the first comment lists two, the second lists one, the hooks' own lines are never listed, and the reason shows `clear` |
| G14 | SessionEnd without `.issue_created` | no `gh` call, no folder |
| G15 | no `last_claude_AssistantResponse.json`, a 30 MB transcript | the answer comes from its last 2 MB (520 ms on ilex) |
| G16 | `/session-issue` in a session that did not ask, after a prompt | one `issue create` while the prompt waits, titled by that first prompt. The answer line names the link, and the lock is released. Asked again: the link, no second create. Its `/exit` comments |
| G17 | `/miadi-session-issue:session-issue acme/named` as the first prompt | no call, the answer says the next prompt opens it. The next prompt opens it in `acme/named`, titled by that prompt, and `.issue_optin` is gone |
| G18 | `/session-issue` with no repository anywhere | no call, the answer says how to name one |
| G19 | `/session-issue` with no capture, a transcript starting with a `/model` command and a meta entry | titled by the first real prompt |
| G20 | `/session-issue acme/open` on a public repository | no issue, the refusal is the answer |
| G21 | a prompt that only mentions session-issue, the session not asked | no call, nothing printed |
| G22 | SessionEnd while the opener of the first prompt still holds `.issue_lock` | the hook returns in under 1 s. One `issue create`, then one `issue comment` |
| G23 | `MIADI_SESSION_ISSUE_REPO=acme/issues` beside `MIADI_CHRONICLE_SESSION_REPO` | created in `acme/issues` |

Also the bundled sanitizer's `--self-test`.

One live session against a private repository, after the gates:

```bash
MIADI_SESSION_ISSUE=1 MIADI_SESSION_ISSUE_HEADLESS=1 \
  claude -p "<one prompt>" --plugin-dir claude/miadi-session-issue --model haiku
# then: gh issue view "$(cat "$MIADI_SESSION_DIR/<session id>/.issue_created")" --comments
```

**Built** 2026-10-14 under jgwill/miadi-orchestration-kit#89. The gates and the live run are recorded in [`STATUS.md`](./STATUS.md).

### After it ships, tell the relatives (kin file)

- jgwill/Miadi: an issue naming the two publication line kinds (`action: "session issue"`, `"session end"`, `by: "hook"`) for `@miadi/hooks-interpreter`.
- jgwill/binscripts: an issue saying that the `hooks/portable-session-dir` hooks now live in `claude/miadi-session-issue`.
- miadisabelle/chronicle-sessions: an issue asking `CLAUDE.md` § State Indicators to add `.issue_skipped` and `.issue_optin`.
- jgwill/miadi-orchestration-kit#56: a comment linking #89.

## 2. Install on ilex

**Who:** Guillaume, or an agent on his word. His shell config is his.

**Never on this phone:** a `next build`, `mw-fw-upgrade.sh`, or any other app build. Android kills Termux under memory pressure, and this install needs none.

The capture plugin is already installed on ilex (0.1.14, 2026-10-14), writing to `MIADI_SESSION_DIR=/data/data/com.termux/files/srv/miadi/sessions` from the shell environment. This plugin reads the same chain, so its state lands in the same session folder.

```bash
gh auth status                     # the account that will post (miadisabelle on 2026-10-14)
claude plugin marketplace update miadi-orchestration-kit
claude plugin install miadi-session-issue@miadi-orchestration-kit
```

Then, in the shell config:

```bash
alias claudeissue='MIADI_SESSION_ISSUE=1 claude'
```

- `MIADI_CHRONICLE_SESSION_REPO` comes from binscripts `etc/bash_env_common`. A shell that does not load it needs `MIADI_SESSION_ISSUE=miadisabelle/chronicle-sessions` in the alias instead.
- `MIADI_SESSION_DIR` comes from the shell too. A Claude Code started outside that shell (a service, a cron) gets neither variable, and both plugins then write elsewhere. Putting `MIADI_SESSION_DIR` in `~/.claude/settings.json` `env` holds it for every start. That file is the owner's to change.
- Hooks load when a session starts. Start a new one.

**Check, in a new session started with `claudeissue`:** one prompt, then `/exit`, then:

```bash
root=/data/data/com.termux/files/srv/miadi/sessions
sid=$(ls -t "$root" | head -1)
cat "$root/$sid/.issue_created"                 # the issue URL
tail -3 "$root/$sid/trace.log"                  # Issue created … / Session end comment posted …
gh issue view "$(cat "$root/$sid/.issue_created")" --comments
```

And in a plain `claude` session: `/session-issue` answers with the link.

Then write the date, the version and the result under the plugin's `AGENTS.md` § Where it is installed.

## 3. The tracing sink (later)

Begin where the write lives (kin file, `@miadi/tracing`):

1. Confirm whether the `coaia` CLI on the host writes a trace and an observation in a domain's Langfuse project, and write the exact commands into `05-source-ledger.md`. If `@miadi/tracing` should own the write instead, open an issue in jgwill/Miadi, publish there, and only then build here.
2. Build `TracingSink` with its own gates:
   - T1: `MIADI_SESSION_ISSUE_SINKS=tracing` with keys set gives `.trace_created`, and no issue.
   - T2: `github,tracing` gives an issue body with a **Trace** line naming the same reference.
   - T3: each SessionEnd adds one `session end` observation.
   - T4: the trace's input holds the sanitized prompt.
3. `@miadi/tracing` `describe("miadi-tracing:eng/trace/<id>")` returns the trace's name and session id.

## Recorded

- A row in [`../README.md`](../README.md), with issue #89.
- `claude/miadi-session-issue/AGENTS.md` and `claude/miadi-session-observability/AGENTS.md` name this packet.
- The chronicle episode holding this work, if any, lists the packet under `rispecs:` as `rise://jgwill/miadi-orchestration-kit/rispecs/chronicle-github-sessions-observability/README.md`. *To confirm*: no episode was named on 2026-10-14.
