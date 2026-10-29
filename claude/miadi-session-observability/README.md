# miadi-session-observability

Session capture for Miadi hosts, as a Claude Code plugin. Install it once on a host and every
Claude Code session there is captured. Nobody edits `settings.json` by hand.
jgwill/miadi-orchestration-kit#56.

- **Capture.** Every event is written under `<root>/<session_id>/` exactly as
  `/opt/binscripts/hooks/claude_hooks` writes it. The token counter, the `/token-usage` page
  and the session observers keep working unchanged.
- **Binding line.** Every session start, end and rename appends one line to
  `<root>/data/terminal_bindings.jsonl` and to the session's own `_terminal_binding.jsonl`. The line holds the session id, the tmux
  `session:window.pane` and pane id, the agent's command line, its name and name history, and
  its team, the chronicle episode it works in, and the miadi-run mission that started it (the
  pinned tracing prompt and its trace, from the seat's prompt that names the mission's
  `prompt.md`, or from `MIADI_RUN_MISSION`). tmux restore and `tide agents restore` read
  these lines to bring agents back.
- **Workspace clone guard** (0.1.13). A repo that `stc-workspaces.json` maps to a working
  directory is not written, committed or pushed from its second clone under the auto-clone
  root (`/workspace/repos` on gaia). `hooks/workspace_clone_guard.sh` refuses and names the
  working directory. It reads `$MIADI_SRC/config/stc-workspaces.json`, so a host without a
  Miadi checkout gets the capture and no guard. jgwill/workspace#60.
- **Skill.** `session-continuity` carries T1's practice: the binding line, tmux save and
  restore, tide, and rebuilding what each pane held after a crash.

## Install

```bash
claude plugin marketplace add jgwill/miadi-orchestration-kit      # or the path of a checkout
claude plugin install miadi-session-observability@miadi-orchestration-kit
```

Then remove the `hooks` block from `~/.claude/settings.json` on that host, in the same step. If
both are wired, every event fires twice and every capture line is written twice.

The plugin's hooks load when a session starts. Removing the `hooks` block takes effect at once,
so a running session captures nothing from that edit until it is restarted. Restart it right
after the edit (seen on gaia, 2026-09-30).

To try the plugin without installing it: `claude --plugin-dir <path to this folder>`.

## Where captures go

`<root>` is `CLAUDE_SESSIONDATA_ROOT`, else `MIADI_SESSION_DIR`, `MIADI_SESSIONDATA_ROOT`,
`SESSION_DATA_ROOT`, else `/src/_sessiondata` when it exists, else `_sessiondata` beside this
folder (`hooks/claude_hooks/lib.sh`).

## Files written

Every file a tool call creates, changes or moves is copied to
`<root>/<session_id>/written/<its absolute path>`, sanitized, and listed in
`_claude_files_written.jsonl` with the call that touched it. Since 0.1.11,
jgwill/miadi-orchestration-kit#82.

- **Bash and MCP calls.** PreToolUse marks the start of the call, PostToolUse (or
  PostToolUseFailure) marks its end, and a detached `files_written.sh` copies each file whose
  inode changed between the two marks. It scans the cwd the call started in, the cwd it ended
  in and the session's scratchpad, and one level of each directory the command names.
  `.git`, `node_modules`, `dist`, `build`, `target`, virtualenvs and caches are skipped.
- **Write, Edit, NotebookEdit.** The file as it stands after the tool. `proposed/` still
  receives what the tool is about to write, as before.
- **Index line.** `tool_use_id`, `tool_name`, `agent_id`, `prompt_id` (the user prompt the call answered), `kind` (`created`, `changed`, or
  `moved` for a rename, a move or a chmod), `path`, `size`, `sha256`, `copy`, `note` and the
  first 240 characters of the command.
- **Versions.** When a path is written again with other content, the last copy is kept as
  `<name>.~N~`. A file that only grew (a log) replaces its copy.
- **Limits.** Text files up to 512 KB are copied, 40 per call, and 200 per call are listed.
  Binary and larger files are listed with their `sha256`. A scan stops after 5 s, and a cwd
  that slow (`/workspace`, a home folder) is then scanned three levels deep
  (`CLAUDE_WRITTEN_MAX_BYTES`, `CLAUDE_WRITTEN_MAX_FILES`, `CLAUDE_WRITTEN_MAX_LINES`,
  `CLAUDE_WRITTEN_SCAN_SECONDS`).
- **Credential files.** A file whose name says it may hold credentials (`.env*` except
  `.example`, `.sample` and `.template`, keys, `.netrc`, `.pgpass`, `.npmrc`, cloud
  credentials, Terraform state) is listed without a copy or a hash. Passwords inside
  `scheme://user:password@host` URLs are redacted in every copy.
- **What it cannot see.** A file deleted by the call that created it. What a `run_in_background`
  command writes after its PostToolUse. A file written by another process during the call is
  listed as if the call wrote it.

## Subagents, forks and what a person said to them

A person can open a running subagent in the agent view and talk to it, or fork a `/btw` side
question with `f`. Those words reach the subagent or fork, never the main session. At every
SubagentStop the hook archives the agent's transcript to
`<root>/<session_id>/agents/<agent_id>.transcript.jsonl`, beside `.meta.json`, `.launch.json`
(when the main session launched it) and `.output.md` (its last reply only).
`scripts/agent-talk.mjs` reads them back for any agent that can run node:

```bash
node scripts/agent-talk.mjs list   <session>            # each subagent and fork, person messages, replies
node scripts/agent-talk.mjs show   <session> <agent>    # directive, each person message, each reply
node scripts/agent-talk.mjs person <session>            # only what the person said, across all of them
```

`<session>` is an id, a prefix, a tmux name or a session name. A fork with no launch manifest is
listed as `btw-fork`: the person made it. An image pasted into a subagent arrives as the text
`[Image #N]` only, and `show` says so. Since 0.1.15, after three messages from Guillaume to the
witness-editor sat unread on 2026-10-15.

## /btw side questions and their forks

No hook fires for `/btw`. Claude Code keeps the question in `~/.claude/history.jsonl` only (its
pasted text in `paste-cache/`), and the answer in its panel only. Pressing `f` forks it, and the
fork's transcript keeps the question, the answer and everything after. Each archive pass (Stop,
SubagentStop, SessionEnd, the SessionStart sweep) writes the events of the session's `/btw`
questions to `<root>/<session_id>/_claude_btw.jsonl`, each once, in time order. Since 0.1.17,
jgwill/miadi-orchestration-kit#95.

| kind | the line holds |
|---|---|
| `asked` | every `/btw` question, forked or not: `btw_id` (`btw-<history ms>`), `at`, `question`, `pasted`, `cwd` |
| `forked` | `agent_id`, `name`, `question`, `directive`, and `parent_last_uuid`, the main transcript message it branched after |
| `answered` | the panel's answer, as the fork keeps it |
| `person` | each message the person sent the fork, with its `prompt_id` |
| `reply` | each reply, with `tools_before`, the tools called since the previous reply |
| `notified` | each time the main session was told the fork `completed` or was `resumed` |
| `delivered` | the result reaching the main session: `via: "prompt"` with its `prompt_id`, or `via: "attachment"` inside a running turn |

Every line of a fork carries the `btw_id` of its question, so `asked` without `forked` is a side
question that was closed. Its answer is not kept anywhere: only a fork keeps the answer. A fork
the Agent tool launched has no question and writes no line. SubagentStop names a `/btw` fork by
its question in `agents/<id>.output.md` and `trace.log`, from Claude Code's `meta.json`.
`tests/btw.sh` holds the rules.

## Uncommitted, not written

At each Stop, `hooks/claude_hooks/uncommitted_not_written.sh` reads `git status` in the repository
the session runs in and in every repository it wrote a file into, and lists the uncommitted files
that neither the session nor its subagents wrote (`_claude_files_written.jsonl`) in
`<root>/<session_id>/_claude_uncommitted_not_written.json`. The session's own capture folder is
left out, an untracked folder is the session's when it wrote inside it, and a repository reached
through a link is named by its real path. When the reply that ends the turn counts one of those
files as work done (a sentence that names it, by path or by a file name with an extension only
one of them carries, says wrote, updated, committed and does not say not, another, someone), the
hook stops the turn once, names them, and asks for those sentences corrected with nothing else.
A reply that only mentions them is never stopped, so the agent never answers the check.
`MIADI_UNCOMMITTED_IGNORE` (shell patterns separated by `:`, matched against the absolute path,
set in the shell or in `settings.json` `env`) leaves files out of the list and the check, for
example `*/.claude/skills/*:*/.mino/session-inventory/*`.
It never stops a turn twice in a row. R6 of the requirements of 2026-10-19, lane K6e.
`tests/uncommitted-not-written.sh` holds the rules. On gaia's largest trees a Stop takes 1 to 3 s,
most of it `git status` in `/home/mia/workspace`.

## Publications

What a session put where other people can see it is one line in
`<root>/<session_id>/_claude_publications.jsonl`, with the tool call and the prompt
(`prompt_id`) that produced it. Since 0.1.12, jgwill/miadi-orchestration-kit#82.

| kind | from | the line holds |
|---|---|---|
| `artifact`, `artifact-asset` | an Artifact publish | `url`, `path` (the source file), `title`, `artifact_id`, `updated` |
| `issue`, `issue-comment`, `pr`, `pr-comment`, `release`, `gist` | `gh issue`, `gh pr`, `gh release`, `gh gist` that write, and `gh api` that writes | `url`, `repo`, `number`, `action` (`issue create`, `pr comment`, `api`) |
| `issue` | `inquiry-weave open`, `issue` and `inquire`, which call gh themselves (0.1.18): each `owner/repo#N [created]` line | `url`, `repo`, `number`, `action` (`inquiry-weave inquiry`, `inquiry-weave actions`, `inquiry-weave issue`) |
| `pr` | Claude Code's `gitOperation.pr` | `url`, `number`, `action` |
| `commit` | `gitOperation.commit`, or git's output (`[branch sha] subject`, a `git log --oneline -1` after a quiet commit) | the full `sha`, `repo`, `dir`, `subject`, `url`, `verified` |
| `push` | `gitOperation.push`, or git's `To <remote>` and `a..b src -> dst` lines | `repo`, `branch`, `from`, `to`, and a compare `url` |
| `npm` | `npm`, `pnpm` or `yarn publish` | `package`, `version`, `url` |

Each commit is checked in the tree the command worked in (`git -C`, a `cd`, then the cwd). A
commit read from output must be in such a tree and committed during the call, and one read
from `git log` or `git show` after a quiet commit must be that tree's `HEAD`. A gh URL counts
only when it ends its line (alone, or after a label in a batch) and the command ran the gh
write that makes that kind of URL. A command that only reads (`gh issue view`,
`git log --grep`, `gh api -X GET`) records nothing, and neither does a push or publish whose
every invocation in the command is a `--dry-run`. A chain that publishes, then fails, is read from
PostToolUseFailure. PostToolUse matches the raw input first, so a
call that cannot have published costs nothing, and a call that may have costs one `jq` call
before the parse runs detached.

## Artifact comments

The threads people open on a published Artifact page are lines of
`<root>/<session_id>/_claude_artifact_comments.jsonl`, keyed by `artifact_url` and
`thread_id`, with the tool call or prompt that brought them in. Since 0.1.16,
jgwill/miadi-orchestration-kit#56.

| kind | from | the line holds |
|---|---|---|
| `sent` | a prompt headed `[Artifact comment sent to Claude]` | `sent_at`, the comment `text` without its `>` quote marks, the `anchor` context |
| `auto-reply` | an `artifact-auto-react` task notification | the posted `comment_id`, `artifact_title` |
| `thread` | `ArtifactComments` read, or resolve | `anchor_label`, `anchor_path`, `span_quote`, `resolved`, `claude_activated`, `comments` (count) |
| `comment` | `ArtifactComments` read, or reply | `comment_id`, `author` (the viewer's name, or `Claude`), `role`, `sent_to_claude`, `created_at`, `text` |

A read hands the hook every thread with its full text, even when the model is shown a capped
list. Each comment is written once. A thread line is written when the thread is first seen and
again when it is resolved or activated for Claude. A comment that nobody reads in the session
and nobody sends to Claude never reaches it: read the artifact's comments
(`ArtifactComments`, action `read`) to bring every thread in. One thread in order:

```bash
jq -c 'select(.thread_id == "<thread id>")' _claude_artifact_comments.jsonl
```

## Teams

The binding line's `team` is `{"id": "T1", "source": "session"}`. It is resolved in this
order:

1. a declared team: `MIADI_TEAM` in the agent's environment, or the tmux session option
   (`tmux set-option -t <session> @miadi-team T1`)
2. the session names in `teams/teams.json`, matched against the tmux session name and the agent
   session's name
3. its folders, where the agent's folder or one below it matches and the longest prefix wins
4. its name patterns
5. otherwise `unassigned`

The list is `MIADI_TEAMS_FILE`, else `$MIADI_ORCHESTRATION_KIT_ROOT/teams/teams.json`. An
installed plugin is a copy of this folder, so it cannot reach the kit by a relative path.
`teams/README.md` is the text people read, and the two are kept in step.

## Which copy is canonical

- `hooks/claude_hooks/` is canonical for Claude Code capture since version 0.1.0.
  `/opt/binscripts/hooks/claude_hooks` stays a live copy for hosts and users that have not
  switched. Change the plugin first, then carry the change there.
- `hooks/secret_capture_sanitizer.sh` and `hooks/git_command_validator.sh` are copies bundled
  from `/opt/binscripts/hooks/`. The plugin's copies are canonical for Claude capture.
  binscripts keeps its own for the other agents' suites until they join (A6,
  jgwill/binscripts#158).

## Host integrations it uses when present

- A presented plan is kept as `plans/session_<id>_<yyMMddHHmm>.md`. Until 0.1.19 the hook also ran
  `/opt/binscripts/plan-insight/miette_claude_plan_perspective_claude.sh`. Miette's perspective is
  now the [`miette-plan-insight`](../miette-plan-insight) plugin's: a session that loads it opens a
  Miette seat beside itself on the same event.
- `jq` and `perl` are required. The sanitizer is written in perl.

## Check

```bash
bash tests/team-resolution.sh
bash tests/episode-resolution.sh
bash tests/transcript-archive.sh
bash tests/files-written.sh
bash tests/publications.sh
bash tests/artifact-comments.sh
bash tests/binding-agent.sh
bash tests/binding-mission.sh
bash tests/workspace-clone-guard.sh
bash tests/uncommitted-not-written.sh
CLAUDE_SESSIONDATA_ROOT=$(mktemp -d) claude --restricted --plugin-dir . --model haiku
```

`--restricted` ignores the user's settings files, so only this plugin's hooks run. One prompt
that starts a subagent, a `/rename` and an exit write the same files as today's capture, with
each event written once.
