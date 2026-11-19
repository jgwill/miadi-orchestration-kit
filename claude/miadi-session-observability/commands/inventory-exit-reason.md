---
description: Write this session's inventory record when it ends before its work is done, with the person's reason for exiting (aborted, wrong model, wrong setup, superseded), then tell them to type /exit
argument-hint: "[reason, in the person's words, e.g. wrong model, this needed Opus]"
allowed-tools: Bash, Read, Edit, AskUserQuestion
---

The person is closing this session before its work is done. Write its inventory record from what
you did, add their reason for exiting, then hand the `/exit` back to them. `/inventory-exit` is
for a session that completed. This one is for a session that stops short: aborted, the wrong
model, the wrong folder or account, or another session took the work.

The reason given with the command: `$ARGUMENTS`

1. **The session and the script.** The session id is `$CLAUDE_CODE_SESSION_ID` in your Bash
   environment. The writer is
   `S=$(bash "${CLAUDE_PLUGIN_ROOT}/hooks/claude_hooks/session_inventory.sh" where "$PWD")`. If
   either is empty, say which in one line and stop.

2. **The facts.** `node "$S" write --session "$CLAUDE_CODE_SESSION_ID"`. It creates or updates
   `<inventory>/<session id>.json` (`WITNESS_INVENTORY_DIR`, else
   `~/workspace/.mino/session-inventory`). Keep any `trace owed:` line it prints for step 7.

3. **The reason.** When the reason above is not empty, it is the person's words: keep them
   verbatim. When it is empty, ask once with AskUserQuestion, "Why are you exiting this
   session?", with the options `Aborted`, `Wrong model`, `Wrong setup` (folder, account,
   plugins or permission mode) and `Superseded` (another session took the work). Keep the
   person's answer and any text they add, verbatim. Never write a reason they did not give.

4. **The model it ran.** Read `hook_capture.dir` in the record, then
   `jq -r '.model // empty' <dir>/_claude_session_starts.jsonl | tail -1` for the model the
   session started on, and
   `jq -r 'select(.type == "assistant") | .message.model' <transcript> | sort | uniq -c` for
   every model that answered (a `/model` switch shows here). The transcript is the
   `transcript_path` of the last line of `<dir>/_terminal_binding.jsonl`.

5. **The meaning.** Read `SCHEMA.md` in the inventory folder, then add with Edit:
   - `exit`: `{kind, reason, given_by, given_at, models, restart}`. `kind` is `aborted`,
     `wrong_model`, `wrong_setup`, `superseded` or `other`, from the reason. `reason` is the
     person's words verbatim. `given_by` is the person's name (`MIADI_MIA_COMPANION_PERSON_NAME`
     when set). `models` is `{started, answered}` from step 4, `answered` as
     `{"<model>": <replies>}`. `restart` is the one line that takes the work up again, or null:
     for `wrong_model`, `cd <cwd> && claude --resume <session id> --model <model>` when the
     person named the right model, else the same line with `<model>` left for them.
   - `mission`: what the session was asked to do, in one sentence.
   - `work_completed[]`: `{title, description, related_files}`, what it did before it stopped,
     its commits as `owner/repo@sha`. Never leave it empty: when it did nothing, one entry
     titled `Nothing completed` whose description gives the reason. An empty list makes the
     SessionEnd hook send the session to a reader that already has this record's answer.
   - `artifacts[]`: `{type, path, status: "uncommitted"}` for each file this session changed
     and did not commit (`git status --porcelain` in each repository it wrote to). **Commit
     none of them and revert none of them.** Work from a session that stopped short waits for
     the person, or the restart, to judge it.
   - `held_decisions[]`: `{id: "H1", title, description, decision_needed_from, options}`. One
     for the uncommitted files when there are any (keep, commit from the restart, or discard),
     and one for anything else the person has to decide.
   - `next_steps[]`: `{title, depends_on, owner}`, the restart first.
   - `team_fit`: as `/inventory-exit` writes it,
     `node "$(dirname "$S")/team-fit.mjs" --session <id> --json` with `responsibility`,
     `measured_at` and `by`.
   - `disposition`: `{proposed: "a", reason: "<person> exited it: <exit.kind>", decided: "a",
     decided_by: "<person> (/inventory-exit-reason)", decided_at}`. The command is their word
     to exit.
   - `status`: `aborted`.
   - `metadata.closed_by`: who you are in this session.
   - One `observations[]` line `{at, by, what}`: exited before its work was done, and why, in
     one plain sentence.
   - When the session worked in an episode: `node "$S" hold --session <id> --episode <N>`.

   Never change `binding` or `hook_capture`. Add to `links` and `related`, never remove or
   rewrite an entry someone else wrote. Check the file with `jq empty <file>`.

6. **Commit only that record**, as `/inventory-exit` does:
   `R=$(git -C <inventory> rev-parse --show-toplevel)`, `git -C "$R" add -- <file>`,
   `git -C "$R" commit -m "inventory: <session id> · <tmux name> · exit: <exit.kind>" -- <file>`,
   `git -C "$R" push`. If the push is refused, `git -C "$R" pull --rebase` once and push again.

7. **Never run `/exit` yourself**, and never send keys to your own pane. **Tell the person**,
   in at most four lines: the record's path and commit, the reason as recorded, the restart
   line, any uncommitted files and `trace owed` line, and last: `Type /exit.`
