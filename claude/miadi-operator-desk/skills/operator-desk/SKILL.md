---
name: operator-desk
description: Answer William's questions about how the Miadi Factory works (a tool's commands, tmux and other multiplexers, which team a session is on and how to set it, where a practice lives, what a plugin does) from the owning team's text, checked against the tool itself, then keep the question in the desk ledger and send any question the docs or tools could not answer to the team that owns them. Use in a T7 session, when William asks "how do I…", "is it possible to…", "what could that be", "inform me shortly", or runs /desk-record.
---

# Operator desk

The operator desk is team T7 (`teams/README.md`). William asks how a part of his own factory works, and the desk answers. Other teams are defined by what they make. The desk makes answers and a record of the questions, and it grows from that record.

Each answer comes from the text of the team that owns the part, and the tool itself decides when the text and the tool disagree. The desk never copies another team's text into this skill. It points to it.

## Before answering

1. Search the ledger for the same question: `grep -i '<words>' "$MIADI_ORCHESTRATION_KIT_ROOT/claude/miadi-operator-desk/desk/ledger.jsonl"`.
2. Read **Questions that came back** below. If the question is there, start from its pointer.

## Answering

1. **Find the owner.** In `teams/README.md`, the team whose **Makes** line names the part. Its plugin or skill in this kit holds the text. For a repo, path, host or service, use the `miadi-stack-map` skill.
2. **Check against the tool.** Run its `--help`, read the file, look at the running state (`tmux show-options`, the binding line in `/src/_sessiondata/data/terminal_bindings.jsonl`). When the text and the tool disagree, the tool is right and the text is a gap.
3. **Answer short.** Give the command or the fact, the `path:line` it came from, and the team that owns it. If what William expected does not exist, say so first, then give what does.

Do not build anything in answer to a question. The answer is the work. A change it calls for goes to the owning team as a handoff.

## Recording

Every question gets one line in the ledger, in the kit checkout:

`$MIADI_ORCHESTRATION_KIT_ROOT/claude/miadi-operator-desk/desk/ledger.jsonl`

Never write to `${CLAUDE_PLUGIN_ROOT}`. An installed plugin is a copy, and an update replaces it. If `MIADI_ORCHESTRATION_KIT_ROOT` is not set, stop and say so.

```json
{"at": "2026-10-07", "session": "<tmux session>", "agent_session": "<agent session id>",
 "question": "<William's words>", "answer": "<one or two sentences>",
 "sources": ["<path:line or command>"], "owner": "<team id, or William>",
 "outcome": "answered | gap", "gap": "<what the docs or tools did not answer, or null>",
 "handoff": {"team": "<team id>", "ref": "<owner/repo#number, or null>"}}
```

- **outcome `gap`** when the answer was in no text, a text was wrong, or a tool lacks what William expected it to have.
- **handoff** for each gap. When a text is missing or wrong, file an issue in the repo that holds it (load `structural-issue-authoring`) and put its `owner/repo#number` in `ref`. When the gap asks another team to build something, leave `ref` null and tell William in one line. What a team builds is for that team and William to decide.

Commit the ledger with the question in the message and push. Reference jgwill/miadi-orchestration-kit#71 until the desk has its own issue for the work.

## How the desk grows

- When a question appears a second time in the ledger, add it to **Questions that came back** as one row: the question, the pointer (a path or a command), the owner. The next desk session answers it from there.
- When the practice in this file changes, bump the version in `.claude-plugin/plugin.json` and in the kit's `.claude-plugin/marketplace.json`, and add a line to the **Log**.
- When a pointer here goes stale because the owner's text moved, fix the pointer and leave the owner's text alone.

## Putting a session on T7

- A tmux session named `desk-…` is on T7 by its name (`teams/teams.json`, `name_patterns`).
- Any other session: `tmux set-option -t <session> @miadi-team T7`. The binding line reads it the next time it writes a line for the session (a start, resume, rename or end). To keep the team after a tmux restore, also add the session's name to T7's `sessions` in `teams/teams.json` and to its section in `teams/README.md`, and keep the two in step.

## Questions that came back

None yet. The first two questions are in the ledger.

## Log

- **0.2.1, 2026-11-14.** Related names T1's `codex-setup` skill, for a desk asked how to get an account ready to start Codex sessions for ceremonies (Jerry's desk on the gmusic account among them).
- **0.1.0, 2026-10-07.** Written by Mia in `miadi-how-to-set-with-tide-a-team`, the session where William named T7. The ledger starts with that session's two questions: setting a team with `tide` (a gap: `tide` has no team command) and which team such a session belongs to (answered by naming T7).

## Related

- `teams/README.md`, section T7. `teams/teams.json`.
- `claude/miadi-session-observability/skills/session-continuity/SKILL.md`, section Teams (T1): how the binding line finds a session's team.
- `claude/miadi-session-observability/skills/codex-setup/SKILL.md` (T1): setting up Codex on an account so its sessions are observed, which future ceremonies require (Guillaume, 2026-11-14). The skill marks which steps are the person's.
- jgwill/miadi-orchestration-kit#71
