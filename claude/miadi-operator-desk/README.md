# miadi-operator-desk

The operator desk (T7 in `teams/README.md`) as a Claude Code plugin. William asks how a part of the factory works, such as a tool's commands, tmux, which team a session is on, or where a practice lives. The desk answers from the owning team's text, checked against the tool, and keeps the question.

## Install

```bash
claude plugin marketplace add jgwill/miadi-orchestration-kit
claude plugin install miadi-operator-desk@miadi-orchestration-kit
```

## What it holds

| part | what it does |
|---|---|
| skill `operator-desk` | Answers a question from the owning team's text, checks it against the tool and records it. Sends a question the docs or tools could not answer to the team that owns them, and turns a question that comes back into a pointer in the skill. |
| skill `closing-a-cycle` | How a cycle of work closes, for the person and the agent: the explainer, one circle turn per item answered makes sense or does not, and the agents acting on each answer, including starting or resuming sessions. Points to the skills that do each step. Its case is Episode 573 (miadi-chronicle://573). |
| skill `planning-with-miette` | How to plan with Miette, for the person and the agent: what the `miette-plan-insight` plugin gives us, what to do when a seat opens beside a session, where the reading lands, and what is not confirmed. Points to the plugin for the mechanics. Its case is Episode 75 (miadi-chronicle://75). |
| command `/desk-record` | Writes the conversation's questions to the ledger, makes the handoffs, grows the skill, commits and pushes. |
| `desk/ledger.jsonl` | One line per question: William's words, the answer, its sources, the owning team, whether it was a gap, and the handoff. |

The plugin has no hooks and no MCP server.

## Where the ledger is written

The skill writes to the kit checkout at `$MIADI_ORCHESTRATION_KIT_ROOT/claude/miadi-operator-desk/desk/ledger.jsonl`, never to the installed copy, which an update replaces. It stops when `MIADI_ORCHESTRATION_KIT_ROOT` is not set.

## Related

- `teams/README.md`, section T7. `teams/teams.json`, where `^desk-` puts a tmux session named `desk-…` on T7.
- jgwill/miadi-orchestration-kit#71
