---
name: factory-session
description: >
  Witness a session the Miadi factory started: a person approved a request made through the
  Miadi connector (mcp.sanctuaireagentique.com, @miadi/connector), the connector wrote a brief to
  the factory queue, and the factory runner (@miadi/factory-runner) opened a tmux session, started
  the agent with Remote Control and handed it the brief. How to recognise one, read its brief,
  follow it through the connector, keep it inside its scope and one-writer-per-repository, and say
  when it is done. Use when a session's first prompt is "From the Miadi factory queue: read
  /srv/miadi/factory/briefs/brief-…", when a session is named after a connector record, when
  someone says "babysit that factory session", "the run I approved from ChatGPT", "mission_status",
  "run_request:", "work_proposal:", or when an inventory record carries `factory[]`.
---

# A session the factory started

Learned 2026-11-04, when William asked the witness to follow `miadi-factory-result-steer-close-loop-261103` to production and to "learn about this new feature".

## The chain

1. **The request.** A person asks through the connector, from ChatGPT or claude.ai. The tools are `request_authorized_run`, `propose_work` and the other request tools. The model that asked cannot approve its own request.
2. **The decision.** The person decides on a card in the conversation (`show_decisions`) or on `/approve/<record>`. A decision names the version it decides.
3. **The brief.** The connector writes one `<input to="new:<name>" status="send" type="connector-run" record="run_request:<uuid>" …>` block into `/srv/miadi/factory/queue/`.
4. **The delivery.** The runner's user timer passes every 5 minutes (`miadi-factory-runner deliver`). It opens tmux session `<name>` in the brief's `cwd` and types the launcher, `claudeyolochronicle --remote-control <name>` on gaia. It waits for the agent to be idle, then types one line: "From the Miadi factory queue: read /srv/miadi/factory/briefs/brief-<yymmdd>-<key>.md whole first and do what it asks."
5. **The ledger.** `/srv/miadi/factory/delivered.jsonl` gets one line naming the session id, the pane, the record, the brief and the Remote Control URL. The person can follow the session from the Claude app at that URL. A brief that waits is explained in `queue/status.json`, and one held past 24 hours moves to `queue/stale/`.
6. **The return.** The session replies with what it achieved, its evidence, what is open and whether it should end. It records its receipt with `update_handoff` when a handoff names the record. Ending is a request (`propose_session_completion`), and only a person's decision closes it. Nobody closes the pane.

## What the witness does

- **Read the brief whole before judging the session.** The `<task>` is the requester's words, and the brief names the record, the approver and the scope. The session is bounded by that scope. A later word from the person widens it, and the witness relays that word, never its own.
- **Find the record.** `inventory.mjs` fills each record's `factory[]` from the ledger: record, brief, `delivered_at`, `to` and `remote_control`. With the connector (the Miadi Chimera Factory MCP), `mission_status` or `get_run_result` on that record gives the decision, the dispatch and completion state, and the receipt.
- **Treat it as a writer.** A factory session that writes to jgwill/Miadi counts as that repository's writer, and so does a rebuild of :3335. Schedule other steers around it ([[schedule-delegation-by-repository]]).
- **Steer only through a grant or the person's word.** The connector's own path is `request_session_steer`, within the run's `steering` grant (pane, attempts, expiry). Outside a grant, the witness sends at most one cross-session message carrying the person's words, and subscribes to the session's idle notice. It never types into the pane.
- **Release authority** comes from the brief's own scope ("only with valid release authority") or from the person's word to the witness, quoted. Never infer it.
- **Done** means four things: the reply with evidence; the receipt recorded through the connector; a completion proposal, which a person decides; and the witness checking the session's claims itself (the commit on main, the version live, verify-api-gate at FAIL=0, the smoke run). Then the inventory record gets the observation.

## Where things are

| what | where |
|---|---|
| queue, briefs, ledger, runner log | `/srv/miadi/factory/` (`$MIADI_FACTORY_DIR`): `queue/`, `briefs/`, `delivered.jsonl`, `runner.log` |
| runner config | `/srv/miadi/factory/factory.json`, `miadi-factory-runner config` |
| runner source | jgwill/Miadi `packages/factory-runner` (README: the brief, a pass, the settings) |
| connector source | jgwill/Miadi `packages/connector`, published at mcp.sanctuaireagentique.com |
| a session's record | `.mino/session-inventory/<session id>.json`, `factory[]` |
