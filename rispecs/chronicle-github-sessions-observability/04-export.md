# 04 · Export: into the plugin, then onto ilex

> Phase 4 (E). Who takes up [`03-specify.md`](./03-specify.md), what they change, and the gates that prove it built. Three readers, in this order: the plugin's builder, ilex's owner, and later the tracing sink's builder.

## 1. Build it into `claude/miadi-session-observability`

The plugin's rules apply (`claude/AGENTS.md` § Rules for a plugin in this lane): every path goes through `${CLAUDE_PLUGIN_ROOT}`, hooks load at session start, and runtime floors are declared.

| Change | Where |
|---|---|
| `session_issue_hook.sh`: `SinkSelection`, `HeadlessRule`, `SessionIssueOpener`, `RepositoryGuard`, title and body | `hooks/claude_hooks/` (new) |
| `session_end_comment_hook.sh`: `SessionEndCommenter`, `SessionEndComment`, `PublishedSince` | `hooks/claude_hooks/` (new) |
| One `UserPromptSubmit` entry after `accepted_redirection_hook.sh` (timeout 10), and one `SessionEnd` entry after `session_end_hook.sh` (timeout 5) | `hooks/hooks.json` |
| `tests/session-issue.sh`: the gates below | `tests/` (new) |
| A "Session issue (opt-in)" section: the variables, what is posted, what is never posted | `README.md` |
| The two files under § What is here, and a § What the port must keep entry for the opt-in and the sanitizer rule | `AGENTS.md` |
| `0.1.15` | `.claude-plugin/plugin.json`, and the kit's `.claude-plugin/marketplace.json` |

The prototype in [`research/ilex-prototype/`](./research/ilex-prototype/) is the starting point. Its file names are kept, because people and the chronicle-sessions `CLAUDE.md` know them. The capture scripts carried to `/opt/binscripts/hooks/claude_hooks` stay unchanged: these are new entries, as the workspace clone guard was.

### Gates: `tests/session-issue.sh`

Run with a stub `gh` first on `PATH`. The stub appends its arguments to a log, answers `repo view` with a visibility the test chooses, and prints `https://github.com/acme/sessions/issues/7` for `issue create` and `https://github.com/acme/sessions/issues/7#issuecomment-1` for `issue comment`. Set `HOME` to a temporary folder, so that `~/.claude/sessions/<pid>.json` can be written to make a session interactive, or left out to make it headless. Detached jobs are awaited by polling for their files, at most 10 s.

| # | Given | Expect |
|---|---|---|
| G1 | `CHRONICLE_SESSIONS_REPO` unset, a prompt | no `gh` call, no new file in the session folder |
| G2 | set, a registered session, a first prompt | one `issue create --repo acme/sessions`. Title `Session 99999999: <first line>`, `.issue_created` holds the URL alone, `trace.log` has `Issue created: …`, and one publication line `kind: "issue"`, `by: "hook"` |
| G3 | a second and a third prompt, one sent while the first job holds `.issue_lock` | still one `issue create` |
| G4 | a resumed session (`.issue_created` present) | no `issue create` |
| G5 | `repo view` answers `PUBLIC` | no `issue create`, `.issue_skipped` holds `public acme/sessions`, and `trace.log` has `Session issue refused` |
| G6 | an unregistered session | no `issue create`, `.issue_skipped` holds `headless`. With `CHRONICLE_SESSIONS_HEADLESS=1`, one `issue create` |
| G7 | a prompt holding a token shape the sanitizer knows (the plugin's `hook_secret_self_test` sample) | neither title nor body holds it |
| G8 | a prompt of three lines, the first 120 characters with an `é` at character 80 | title cut at 80 characters, `é` whole, `...` appended |
| G9 | a prompt holding a run of four backticks | body fence of five |
| G10 | the stub fails three times | three `Issue creation failed` lines, then `.issue_skipped` holds `attempts` and the fourth prompt calls nothing |
| G11 | either hook | nothing on stdout, exit 0 |
| G12 | SessionEnd with `.issue_created` | the hook returns in under 1 s. One `issue comment` whose body has `**Reason**: /exit`, the four counts, and `last_assistant_message` from `last_claude_AssistantResponse.json` |
| G13 | two publication lines, a SessionEnd, one more line, a second SessionEnd | the first comment lists two, the second lists one, and the hooks' own lines are never listed |
| G14 | SessionEnd without `.issue_created` | no `gh` call |
| G15 | no `last_claude_AssistantResponse.json`, a 30 MB transcript | the answer comes from its last 2 MB, under 2 s |

Also run the existing suites (`tests/*.sh`), and one live session against a private test repository:

```bash
CLAUDE_SESSIONDATA_ROOT=$(mktemp -d) CHRONICLE_SESSIONS_REPO=<owner>/<private-test-repo> \
  claude --restricted --plugin-dir claude/miadi-session-observability --model haiku
# one prompt, /exit, then: gh issue view <url> --comments
```

### After it ships, tell the relatives (kin file)

- jgwill/Miadi: an issue naming the two publication line kinds (`action: "session issue"`, `"session end"`, `by: "hook"`) for `@miadi/hooks-interpreter`.
- jgwill/binscripts: an issue saying that the `hooks/portable-session-dir` hooks now live in the plugin.
- miadisabelle/chronicle-sessions: an issue asking `CLAUDE.md` § State Indicators to add `.issue_skipped`.
- jgwill/miadi-orchestration-kit#56: a comment linking #89.

## 2. Install on ilex

**When:** after the home folder's move into a jgwill/eury checkout has landed (tmux pane 2, 2026-10-14). `~/.claude/` lives in that home, and the install writes there. **Who:** Guillaume, or an agent on his word. A user's `settings.json` is theirs (the plugin's cutover rule).

**Never on this phone:** a `next build`, `mw-fw-upgrade.sh`, or any other app build. Android kills Termux under memory pressure, and this install needs none.

```bash
df -h /data                        # an npm-sized margin; clear ~/.npm when under 2 GB
gh auth status                     # the account that will post (miadisabelle on 2026-10-14)
claude plugin marketplace add jgwill/miadi-orchestration-kit
claude plugin install miadi-session-observability@miadi-orchestration-kit
```

Then add to `~/.claude/settings.json`, beside the `LD_PRELOAD` entry already in `env`:

```json
"CLAUDE_SESSIONDATA_ROOT": "/data/data/com.termux/files/repos/jgwill/chronicle-sessions",
"CHRONICLE_SESSIONS_REPO": "miadisabelle/chronicle-sessions"
```

- The prototype named the root `CLAUDE_SESSION_DIR`, and the plugin does not read that name. Without `CLAUDE_SESSIONDATA_ROOT`, an installed plugin captures to the `_sessiondata` beside its own scripts, inside `~/.claude/plugins/cache/`, which every plugin update replaces.
- ilex's `settings.json` has no `hooks` block, so there is nothing to remove. The herdr `SessionStart` hook of `settings.json.with-hooks` is not part of the plugin. Wiring it again on its own is the owner's choice.
- Hooks load when a session starts. The session that makes the edit is not captured, so start a new one.

**Check, in a new session:** one prompt, then `/exit`, then:

```bash
root=/data/data/com.termux/files/repos/jgwill/chronicle-sessions
sid=$(ls -t "$root" | head -1)
cat "$root/$sid/.issue_created"                 # the issue URL
tail -3 "$root/$sid/trace.log"                  # Issue created … / Session end comment posted …
gh issue view "$(cat "$root/$sid/.issue_created")" --comments
wc -l "$root/$sid/_claude_user_inputs.jsonl"    # 1: each event written once
```

Then write the date, the plugin version and the result under the plugin's `AGENTS.md` § Where it is installed.

## 3. The tracing sink (later)

Begin where the write lives (kin file, `@miadi/tracing`):

1. Confirm whether the `coaia` CLI on the host writes a trace and an observation in a domain's Langfuse project, and write the exact commands into `05-source-ledger.md`. If `@miadi/tracing` should own the write instead, open an issue in jgwill/Miadi, publish there, and only then build here.
2. Build `TracingSink` with its own gates:
   - T1: `CHRONICLE_SESSIONS_SINKS=tracing` with keys set gives `.trace_created`, and no issue.
   - T2: `github,tracing` gives an issue body with a **Trace** line naming the same reference.
   - T3: each SessionEnd adds one `session end` observation.
   - T4: the trace's input holds the sanitized prompt.
3. `@miadi/tracing` `describe("miadi-tracing:eng/trace/<id>")` returns the trace's name and session id.

## Recorded

- A row in [`../README.md`](../README.md), with issue #89.
- The plugin's `AGENTS.md` names this packet.
- The chronicle episode holding this work, if any, lists the packet under `rispecs:` as `rise://jgwill/miadi-orchestration-kit/rispecs/chronicle-github-sessions-observability/README.md`. *To confirm*: no episode was named on 2026-10-14.
