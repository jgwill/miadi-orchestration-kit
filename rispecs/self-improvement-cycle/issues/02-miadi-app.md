## Context

Part of jgwill/miadi-orchestration-kit#160. Domain: Engineering, the interface. Team: T8, software
development.

Zach Lloyd's talk shows the person's side of a self-improving factory on four pages: Runs, a run's
page with Scores, Artifacts and Metadata, the Self-improvement inbox with its approval rate, and a
Dashboard with Scorers and Spending (screenshots 03 to 08, 12, 13 in
`rispecs/self-improvement-cycle/screenshots/`, jgwill/miadi-orchestration-kit).

What the app has today, checked on 2026-11-19:

- `app/missions` lists miadi-run missions, and `app/token-usage` shows token use per session from
  `_sessiondata`. jgwill/Miadi#1019 asks for verified cost per session and mission.
- `@miadi/connector` lists sessions (`list_sessions`, `get_session`), records `propose_work` and
  `record_evaluation`, and shows decision cards (`show_decisions`).
- The session inventory and the publications index (`_claude_publications.jsonl`) hold, for each
  session, its source, what it made, who asked and its state. No page lists them together.
- No page shows scores, proposals with their ruling, or a pass rate over time.

## Desired State

Four views in the app, reading what the kit's passes write and writing nothing themselves:

- **Runs:** every session newest first, with its team, state, source (tmux, mission, connector
  request, phone take, scheduled pass), what it made, who asked, its scores and its exit reason.
- **A run:** its digest, its five links, its scores with their verdicts in words, the files it wrote.
- **Self-improvement:** the cycle's proposals in two columns, Problem and Solution, then target,
  evidence (sessions that open as runs), expected effect and the experience it creates. Needs
  ruling and ruled, with the approval rate. A ruling links to its turn in the talking circle.
- **Dashboard:** each scorer's pass rate per day and per team; spending per session and per landed
  proposal, by source, with self-improvement as its own source.

## Action Steps

- [ ] Runs, read from the inventory records and the publications index (S1)
- [ ] A run's page, read through `@miadi/hooks-interpreter` (S1), after jgwill/Miadi#1062
- [ ] Self-improvement, read from the proposals the kit's pass records with `propose_work` (S5, S6)
- [ ] Dashboard, Scorers, from each record's `scores[]` (S9)
- [ ] Dashboard, Spending, from what jgwill/Miadi#1019 makes (S9)
- [ ] Each view checked on gaia against the records of one real day

## Structural Tension

The factory holds everything a person needs to judge its sessions, in files no person opens.
Showing the runs, their scores and the proposals they lead to on pages a person reads in the
morning is what lets Guillaume rule on the cycle without opening a folder.

## Related

- Parent: jgwill/miadi-orchestration-kit#160
- Specification: `rispecs/self-improvement-cycle/03-specify.md` S1, S5, S6, S9 (jgwill/miadi-orchestration-kit)
- jgwill/Miadi#1062, jgwill/Miadi#1019
- jgwill/miadi-orchestration-kit#161 (the passes that write scores and proposals), jgwill/miadi-orchestration-kit#162
- miadi-review:d47ef197-8fc2-4f81-be25-67d4e335d104
