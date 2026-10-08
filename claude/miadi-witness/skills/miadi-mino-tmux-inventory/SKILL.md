---
name: miadi-mino-tmux-inventory
description: Keep the session inventory. For a tmux session William names, find its session id (from its binding line, or /exit or /status), read what it did, and write one JSON record in ~/workspace/.mino/session-inventory/ following SCHEMA.md there, closed or ongoing
metadata:
  type: skill
  version: 1.1.0
  scope: session closing ritual + work archival
---

# Mino's Closing Ritual: Tmux Session Inventory

## ⚠️ CRITICAL: SESSION ID IS THE ANCHOR

The Claude Code `/exit` command prints a **SESSION ID** to the terminal. This ID is the PERMANENT reference that traces a tmux session to its transcript. It MUST be captured before the pane closes. Everything else (tmux name, file paths, inventory content) is organized around this one ID.

**If SESSION ID is not captured: the session is orphaned and the work cannot be traced back.**

## What This Is

When a tmux session completes work, Mino closes it and records what happened in the session inventory, a JSON file per session. This creates a ledger: work is traceable, returnable, findable by SESSION ID.

## The Ritual

**RULE: SESSION ID is the primary identifier. Everything else (tmux name, file paths) is secondary. Do not invert this.**

### Step 1: Receive the Session Name

User gives the tmux session name when work is ready to close:

```
"tmux 'miadi-session-name-here'"
```

Note the name but know it is NOT the permanent reference. The SESSION ID from /exit IS.

### Step 2: Peek at What Was Done

Capture the pane content and understand what the session produced:

```bash
tmux capture-pane -t 'miadi-session-name' -p -S -100
```

Observations: What commands ran? What decisions were made? What was completed? What is still open?

### Step 3: Capture SESSION ID (MANDATORY)

**First, read it from the binding line (A5, since 2026-09-28).** Every agent session started, renamed or ended in a tmux pane writes one line to `/src/_sessiondata/data/terminal_bindings.jsonl`. The line holds the session id, its current name with its history, the terminal, the launch, and the team. Given the tmux session name, the latest line answers without typing anything into the pane:

```bash
jq -c --arg s "<tmux session name>" 'select(.tmux.session==$s and ((.argv // []) | any(. == "-p" or . == "--print") | not))' /src/_sessiondata/data/terminal_bindings.jsonl \
  | tail -1 | jq -c '{event, at, session_id, name: .name.name, launch_alias, team}'
```

The `argv` filter skips headless `claude -p` / `--print` runs. They write binding lines under the pane's tmux name, so without it the latest line can name a child, not the occupant: on 2026-10-01 `mino-260929-fresh-05-team-loop` gave `875d0d3f` (a witness-editor pass) instead of the live `ea7fbc30`. `scripts/inventory.mjs verify-names` applies the same rule.

Checked on 2026-09-28: `miadi-community-posting-kherix` gave session `bbea5431-…`, renamed to `miadi-community-posting-kherix-260928`. Lines written before the team code went live have `team: null`, and `launch_alias` stays empty until launchers record their name (A7). Use `/exit` or `/status` below only when the session has no binding line, which means it started before 2026-09-28 09:53 or outside these hooks.

**If closing the session:** Run `/exit` in the tmux session. The Claude Code harness prints a SESSION ID to the terminal.

**If NOT closing (ONGOING sessions):** Run `/status` to print the SESSION ID without closing.

```bash
# For sessions being closed:
/exit

# For sessions staying open (ONGOING):
/status
```

**CRITICAL:** The SESSION ID is the PERMANENT reference for this session's work and its transcript. It MUST be captured and stored in the inventory.

Wait for output showing the SESSION ID. Read it from the pane output. Do not skip this.

**Do not proceed to Step 4 until SESSION ID is in hand.**

### Step 4: Record in Schema-Based Inventory (SESSION ID as Primary Key)

Save the session inventory in JSON format following the schema at `~/workspace/.mino/session-inventory/SCHEMA.md` (William rejected `~/.mino/` on 2026-09-27). The filename is `<SESSION_ID>.json`, and an ongoing session is `ONGOING-<tmux name>.json` with its `session_id` field filled.

**References and origin, William's rules of 2026-09-27:**
- Write every issue as `owner/repo#number`, never a bare `#number`.
- To know which repo a session worked in, read its start: `head -1 /src/_sessiondata/<session_id>/_claude_session_starts.jsonl | jq -r .cwd`, then `git -C <cwd> remote get-url origin`.
- `miadi-hooks-interpret session <session_id>` summarises a session from its hook capture before you read the transcript.

**File location:** `~/workspace/.mino/session-inventory/{SESSION_ID}.json` (use the SESSION ID from /exit, not tmux name)

**Required field in JSON:** 
```json
{
  "session_id": "<SESSION_ID_FROM_EXIT>",
  ...
}
```

The SESSION ID field must match the filename and be the value captured from /exit. This is how sessions are traced back to their transcript.

The JSON schema captures:
- **work_completed**: what the session accomplished (title, description, related files)
- **published**: npm/apt packages, GitHub issues touched
- **installation_status**: where this was deployed
- **testing**: test cases, environments, known limits
- **held_decisions**: decisions still waiting (H1, H2, H3 format)
- **artifacts**: PDE, code, markdown files produced
- **next_steps**: what work remains
- **metadata**: who closed it, when, notes

The schema is machine-readable. Code can later parse these files to:
- List all sessions by status
- Find held decisions awaiting action
- Track which packages were published in which sessions
- Cross-reference GitHub issues to sessions that touched them
- Audit who closed sessions and why

### Step 4b: Team fit and the proposed ending (since 2026-10-08)

For every session recorded, run the `team-fit` skill on it and write its `team_fit` and `disposition` into the record. The measured part is one command:

```bash
node "$KIT/claude/miadi-witness/scripts/team-fit.mjs" --tmux <tmux name> --json
```

Then propose one ending, and say it in the report to William:

- 🚪 **a, exit.** Its work is committed, pushed and verified, and it holds nothing. On his word: Step 3's `/exit`, the session end verified, the shell removed.
- ✅ **b, complete then exit.** A remainder is left that the session or the seat can finish. On his word: Step 6, steer to finish, then close.
- 📋 **c, record only.** He is still working with it or holds a choice in it. The record is written or updated, and Step 5 keeps watching it.

A series of inventories gives one line per session: `<team glyph> <team id> · <tmux name> · <ending proposed> · <why>`. An unassigned session gets a proposed team (skill `team-fit`, section 3), which never enters `teams.json` without William's word.

Earned 2026-10-08. William asked `gaia-cpufreq-cap-rebooted-fix-261008` by hand which team its work fit, then asked that the seat do it in every inventory and propose whether each session exits, is completed first, or is only recorded (jgwill/Miadi#746, jgwill/miadi-orchestration-kit#76).

### Step 5: Keep watching the sessions that are still running (since 2026-10-06)

A record is not the end of the job when the session is still `in_progress`. In the same turn as the records, start the listener on every session that is still running, and keep following them:

```bash
node "$KIT/claude/miadi-witness/scripts/witness-listen.mjs" await --seat <this seat's tmux name> --watch <session id>...   # run_in_background: true
```

- **Use this seat's own tmux name as `--seat`.** One listener runs per seat name, and the `mino` seat is often held by another session (exit 5). A second seat name does not interfere with it. Check that `status --seat <name> --watch <id>...` lists each session under `watching:`.
- **On each wake for a session going idle:** read its last reply, add an observation to its record, do the work the inventory seat owns (relay a staged handoff to the session it names, judge against criteria committed earlier), commit, re-arm. Write to William only what needs him: a staged send, a gate he owns, a choice with a recommendation.
- **One judge per run.** Before writing expected results or a score for a watched session, check who already holds that loop: the session that pre-edited or dispatched its prompt (`git log` on its examples, its last reply). The witness records and relays that judge's results, and adds only what it lacks. On 2026-10-06 the witness committed expectations for a run three minutes after the pre-editor had, and withdrew them.
- **"Come back to me" with running sessions does not mean stop watching.** Report what needs him, and leave the listener armed. Watching is reading, so it changes nothing that needs his consent.

Earned 2026-10-06. The seat inventoried four sessions, reported back, and ended its turn. One of them, `miadi-review-upgrades-261006`, kept working: it judged a run and typed a handoff into another session's draft. William had to tell the seat to go and watch it: *"why dont you monitor their session to continue … I will not babysit you like that"*.

### Step 6: Steer to finish, then close (since 2026-10-07)

When William asks to close a session that is not done, or asks what it should still be sent, the seat writes the follow-up itself. It does not ask him to write it.

1. **Find the step the session already named.** Read its last reply for a next step that waited on something. Then check whether that thing has since happened in another session or on an issue. A decision William took elsewhere is often the unblock.
2. **Send one steer while the session is idle** (`tmux send-keys -t <pane> -l "<msg>"`, then `Enter`). Sign it with the seat's tmux name and "at William's request". Name what was decided and where, the exact steps to finish with their files or issue ids, what not to start because it waits on William (and why), and the close: commit, push, live if it was live, and *end with one line: DONE, the commits, anything still held*. Read the pane back, because a pasted steer shows as `paste again to expand` until it lands in the hook capture.
   Before sending, check the time of the last human input in the session's transcript as well as running `pane-write-guard.sh`. If William wrote into it after it went idle, he is steering it, so do not steer, and only watch. The guard sees only the instant it runs. On 2026-10-07 it answered `clear` at 16:04, but William's message had landed at 16:03:59. The seat's steer was queued behind his message and contradicted it. The seat took the steer back with `Up` and then `C-u`, which clears the input box without interrupting the turn.
3. **Add the session to the listener** (Step 5) and note the steer in its record.
4. **On the DONE wake:** check each commit it names against `origin/main`, record what it finished and what it holds, run `/exit`, verify the session end, and remove the shell.

What it holds goes into the record. A package it left unreleased is for the seat or the release sweep, never for William's messages.

Earned 2026-10-07. William: *"I want to exit even thought it feels that agent was not done … you could steer him to complete what is relevant then when he's done, you inventory and exit"*. `miadi-factory-vocabulary-modularization` had named its next step on 10-07 at 03:34: update its packet once D14 was answered. William answered D12–D17 at 15:29 in another session. The seat steered at 15:31, the session answered DONE with `b74d2471` at 15:34, and it was closed. Minutes later, for `asterion-miadi-circle-threads`, William said *"I just dont know what to send that agent"*. The answer was the same: the steps the layers session had handed it (A50, A51), and nothing that waited on Q8.

## Why This Matters

- **Sessions don't disappear**: their work lives in the inventory
- **SESSION ID is the reference**: a stable identifier to return to the session's transcript
- **Work is discoverable**: "what did that closing do?" has an answer in the ledger
- **Continuity across restarts**: future instances know what was standing when this session closed
- **Proposals for audience reach**: sessions proposing episode sequences, community outreach, or communication strategies must be captured BEFORE closing—this is how planning and episode creation decisions are recorded for later execution

## Example Inventory

**Inventory record for a completed session:**

- **Session**: miadi-react-issue-688-ok-skill-57
- **SESSION ID**: (would be captured from /exit)
- **Work**: 
  - Reactions system shipped as skill
  - jgwill/Miadi#688 marked complete
  - jgwill/miadi-orchestration-kit#57 skill written and symlinked
  - Cross-links established between repos
- **Next**: Reaction-to-delegation mapping (human choices on which reaction→lane)

## Capturing Agent Proposals (Critical for Planning)

**When an agent proposes** an approach to reaching audience, structuring episodes, or orchestrating community participation—this must be captured in ONGOING inventory before the session closes. These proposals are decisions waiting for human approval and are foundational to episode creation.

Examples:
- **Episode sequencing**: "Episode about preparation" → "then Facebook post opens participation"
- **Community engagement**: "Public question in comments" rather than "collected externally"
- **Episode scope**: Distinguishing "preparation narrative" from "broker choice" (two different episodes)
- **Outreach strategy**: Story arc, opening text for posts, invitation language

Capture in inventory:
```json
"agent_proposal": {
  "proposed_by": "Hermes (gpt-6-astra, token_count)",
  "recommendation": "short description",
  "episode_scope": { /* episode details */ },
  "community_scope": { /* audience engagement approach */ },
  "key_insight": "what this teaches about reaching audience"
}
```

This transforms the session from "work done" into "decisions ready for approval + execution plan."

## Implementation Notes

Mino closes the session with `/exit`. The harness fires a SessionEnd hook that captures the SESSION ID. That ID becomes the permanent address for this session's work in the charts.

The inventory is queryable: ask "show me sessions that touched jgwill/Miadi#688" and the chart should answer.

**ONGOING sessions** (marked `do_not_close: true`) capture proposals and related infrastructure work. These sessions are held open until human decisions are made and work can proceed.

For ONGOING sessions: use `/status` (not `/exit`) to print the SESSION ID, then capture it in inventory. The session stays running.

---

*Last Updated: 2026-09-27*
*Source: Miadi session closing ritual*
