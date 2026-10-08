---
name: team-fit
description: >
  Say which team in this kit a session's work fits, what that team makes it responsible for,
  and how the session should end. One report for William and for the agent: the team found by
  measured teams.json rules (or a proposed team when none fits), the team the session is
  declared on beside it, the responsibility for that kind of work, a glyph per action and for
  the team, and a proposed ending (a exit, b complete then exit, c record only) with its
  `team_fit` and `disposition` fields for the inventory record. Use when William signals a
  result was achieved ("great work", "we succeeded", "pivoting after we succeeded", "which team
  does this fit", "where does this session fit", "team fit"), and in every session inventory
  (miadi-mino-tmux-inventory, inventory-keeper) for each session recorded.
---

# Team fit

William's question, first asked on 2026-10-08 of `gaia-cpufreq-cap-rebooted-fix-261008` after its work landed:

> is there an existing team that your actions fits into in terms of responsibility when you look into `/workspace/repos/jgwill/miadi-orchestration-kit/` - show which team you found and what could be your responsability (when doing the type of work you just did) and include glyphs that matches action you take and glyph for founded team and team proposal if you did not find any

This skill answers it the same way every time, from measurement. It belongs to T3 Witness because the inventory calls it, and it reads the teams that `teams/README.md` and `teams/teams.json` define. Tracked on jgwill/miadi-orchestration-kit#76 and jgwill/Miadi#746.

## Who runs it

- **The session itself**, when William signals a result was achieved. It reports on its own work.
- **The witness seat**, during a session inventory, for each session it records. It reports on another session, from that session's digest (`miadi-hooks-interpret digest <id>`), never by typing into its pane.

## 1. Measure the team

Run the script. It evaluates every rule of `teams.json` on its own and decides in the documented order: declared, sessions, folders (longest prefix), name patterns.

```bash
K=${CLAUDE_PLUGIN_ROOT:-/workspace/repos/jgwill/miadi-orchestration-kit/claude/miadi-witness}
node $K/scripts/team-fit.mjs --tmux <tmux session name>          # or --session <id>
node $K/scripts/team-fit.mjs --tmux <tmux session name> --json   # for the record
```

Cite every rule it prints, not only the deciding one. Two rules naming the same team is stronger evidence than one, and two rules naming different teams (`also matched`) is a finding to report.

A session's **declared team** (binding line `source: declared`, tmux `@miadi-team`, `MIADI_TEAM`) is shown beside the decision. When the work fits a different team than the one the session is declared on, say both and change neither.

## 2. Read the team's section

Open the team's section in `teams/README.md`: level, desired outcome, Makes, Uses, Next. The responsibility is what the session's work adds to that team's **Makes**, or which of its **Next** items it advances. Name the line it connects to. Write it as one or two plain sentences about this kind of work, so the next session doing it knows it is on that team.

## 3. When no team fits: propose one

The script says `❔ unassigned`, or the rules matched a team whose section does not describe the work. Then propose a team, written in the shape of a README section:

- a working name and the glyph 🆕 (the team's own glyph is chosen with its name)
- level (the machine, the application, between William and the teams, before or after an episode)
- desired outcome, in William's words when he has said any
- Makes and Uses
- the sessions that would be on it, starting with this one

A proposal goes into the session's inventory record and as a comment on jgwill/miadi-orchestration-kit#76. It never enters `teams.json` or `teams/README.md` without William's word, because naming a team is his.

## 4. Actions with glyphs

List what the session did as A1, A2 … with one glyph each, from this table:

| glyph | action |
|---|---|
| 🔍 | read, measure, investigate |
| 🔧 | change, fix, configure |
| 🧪 | test, verify against the live thing |
| 📝 | write a document, skill, issue or record |
| 🚀 | commit, push, publish, deploy |
| 🤝 | hand off, message another seat, ask |
| 🧭 | decide, or propose a decision for William |

**Team glyphs, draft (held for William, jgwill/Miadi#746 H2):** 🔁 T1 Session continuity · 📡 T2 Event path · 👁️ T3 Witness · 📈 T4 Chart path · 🌱 T5 Production context exploration · 🎬 T6 Production · 🛎️ T7 Operator desk · ❔ unassigned · 🆕 proposed. The script prints `glyph: draft` until `teams.json` carries a `glyph` for the team.

## 5. Propose the ending

| | ending | when |
|---|---|---|
| 🚪 | **a** exit | the work is committed, pushed and verified, nothing is held |
| ✅ | **b** complete then exit | a small reversible remainder is left that the seat can finish itself (commit, push, a record) |
| 📋 | **c** record only | William is still working with the session, or holds a choice in it |

The ending is a **proposal**. Exiting a session, or working inside its pane, happens on William's word for that session (the Sunwise Law). The session that reports on itself proposes too, and does not exit itself.

## 6. The report

Plain part first, for William. Then the coded part, one item per line with an empty line between items, so each can be annotated.

```markdown
🧠: <glyph> <team id> · <team name>. <one sentence: why, citing the rules>. <one sentence: the responsibility>.

## Team found: <glyph> <team id> · <team name>      (or: ## Team proposed: 🆕 <working name>)

F1 <rule evidence, e.g. teams.json puts it on T1 by folder /a/src/gaia and by pattern ^gaia->

F2 <how the work relates to the team's Makes or Next>

## Actions

A1 🔍 <what was read or measured>

A2 🔧 <what was changed, with its commit>

A3 🧪 <what was verified, with the live reading>

## Ending proposed: 🚪 a · exit      (or ✅ b · complete then exit, 📋 c · record only)

<one sentence: why, and what William decides>
```

## 7. The record fields

The inventory record carries the measured part as the script printed it with `--json`, plus what this skill adds:

```json
"team_fit": {
  "team": { "id": "T1", "name": "Session continuity", "glyph": "🔁", "glyph_source": "draft" },
  "decided_by": "folders",
  "matches": [ { "rule": "folders", "team": "T1", "evidence": "/a/src/gaia" },
               { "rule": "name_patterns", "team": "T1", "evidence": "^gaia-" } ],
  "declared": null,
  "also_matched": [],
  "responsibility": "Removes a cause of the crash T1 recovers from: the CPU ceiling holds at boot.",
  "proposal": null,
  "measured_at": "2026-10-08T15:30:00Z",
  "by": "<who ran the skill>"
},
"disposition": {
  "proposed": "a",
  "reason": "committed (jgwill/gaia@df01d9a) and verified live, nothing held",
  "decided": null,
  "decided_by": null
}
```

`decided` and `decided_by` stay `null` until William answers for that session. Keep `team` (the older single field) as it is. `team_fit` is the measured version beside it.

## Reference example

`gaia-cpufreq-cap-rebooted-fix-261008`, session `70636b35-8172-405a-9050-7cdbba67344e`, 2026-10-08. Answered by hand before this skill existed, and reproduced by the script:

```
🔁 T1 · Session continuity (the machine), decided by folders
  folders: T1 by /a/src/gaia
  name_patterns: T1 by ^gaia-
```

Its actions were A1 🔍 read the boot journal, A2 🔧 moved the boot script and set the ceiling (jgwill/gaia@df01d9a), A3 🧪 checked the service and the live limits.

🌸: When every session ends with this report, William can see which team each piece of work belongs to and decide how the session ends, without reconstructing it from the transcript.
