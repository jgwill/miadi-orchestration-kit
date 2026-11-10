---
description: Write this session's inventory record, commit only that record, then tell the person to type /exit
allowed-tools: Bash, Read, Edit
---

The person is about to close this session. Write its inventory record yourself, from what you
did in it, so nobody has to ask the witness seat for it. Then hand the `/exit` back to them.

1. **The session and the script.** The session id is `$CLAUDE_CODE_SESSION_ID` in your Bash
   environment. The writer is
   `S=$(bash "${CLAUDE_PLUGIN_ROOT}/hooks/claude_hooks/session_inventory.sh" where "$PWD")`:
   the installed miadi-witness plugin's `scripts/inventory.mjs`, else the kit checkout's at
   `$MIADI_ORCHESTRATION_KIT_ROOT`. If either is empty, say which in one line and stop.

2. **The facts.** `node "$S" write --session "$CLAUDE_CODE_SESSION_ID"`. It creates or updates
   `<inventory>/<session id>.json` (`WITNESS_INVENTORY_DIR`, else
   `~/workspace/.mino/session-inventory`) with the binding line, the hook capture, the question,
   `links.trace` (`owner/repo@sha` for each commit and push in the capture) and
   `related.issues`. Keep any `trace owed:` line it prints for step 6.

3. **The meaning.** Read `SCHEMA.md` in the inventory folder, then add with Edit, from what
   this session did:
   - `mission`: the session's purpose, in one sentence.
   - `work_completed[]`: `{title, description, related_files}`, one per piece of work, its
     commits as `owner/repo@sha`.
   - `held_decisions[]`: `{id: "H1", title, description, decision_needed_from, options}`, only
     what a person has to decide. An empty list when nothing is held.
   - `next_steps[]`: `{title, depends_on, owner}`.
   - `team_fit`: the output of `node "$(dirname "$S")/team-fit.mjs" --session <id> --json`,
     with `responsibility` (one sentence: what this work adds to the team's Makes in the kit's
     `teams/README.md`), `measured_at` and `by`.
   - `disposition`: `{proposed, reason, decided: null, decided_by: null}`. `a` exit: committed,
     pushed, verified, nothing held. `b` complete then exit: a remainder a seat can finish.
     `c` record only: the person is still in it or holds a choice in it.
   - `status`: `complete` for `a`, `held` when `held_decisions` is not empty.
   - `metadata.closed_by`: who you are in this session.
   - One `observations[]` line `{at, by, what}`, one plain sentence.
   - When the session worked in an episode: `node "$S" hold --session <id> --episode <N>`.

   Never change `binding` or `hook_capture`: the script owns them. Add to `links` and
   `related`, never remove or rewrite an entry someone else wrote. Check the file with
   `jq empty <file>`.

4. **Commit only that record** in the inventory's repository:
   `R=$(git -C <inventory> rev-parse --show-toplevel)`, then `git -C "$R" add -- <file>` and
   `git -C "$R" commit -m "inventory: <session id> · <tmux name> · <disposition>" -- <file>`,
   then `git -C "$R" push`. The pathspec keeps the commit to this record whatever else is
   staged there. Other records in that folder belong to other sessions. If the push is
   refused, `git -C "$R" pull --rebase` once and push again.

5. **Never run `/exit` yourself**, and never send keys to your own pane. The person types it.
   When they do, the SessionEnd hook runs `inventory.mjs write` once more and adds the end
   of the session to the record.

6. **Tell the person**, in at most three lines: the record's path and commit, the proposed
   ending with its reason, any `trace owed` line or held decision, and last: `Type /exit.`
