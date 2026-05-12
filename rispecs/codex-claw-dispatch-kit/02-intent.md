# Intent

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Desired Outcome

Codex has a reusable plugin surface that can dispatch a bounded mission to MiaClaw or another Claw through Gaia, capture acknowledgement, preserve provenance, and prepare follow-up artifacts without leaking secrets or confusing a message handoff with completed work.

## Current Reality

The workflow exists as an operator habit:

1. inspect the Gaia endpoint,
2. compose a mission prompt,
3. call the endpoint manually,
4. wait for acknowledgement,
5. write a memory note,
6. decide what specs or issues should follow.

This is usable once, but not yet repeatable enough for multi-agent ceremonial work.

## Natural Progression

Move the workflow into a Codex kit that creates a **Claw Commission Packet**, sends it through Gaia, captures an **Acknowledgement Ledger**, and routes the next artifact surface:

- local memory note,
- issue draft,
- ceremonial folder decision,
- Storyweaver episode extraction,
- later implementation ticket.

## Vocabulary

| Term | Meaning |
| --- | --- |
| Claw | A named agent/persona reachable through a Gateway-backed runtime, such as MiaClaw. |
| Claw Dispatch | The act of sending a bounded mission packet to a Claw. |
| Claw Commission | The relational work packet being entrusted to the Claw. |
| Pickup Plan | A dated plan for resuming a session or artifact thread. |
| Acknowledgement Ledger | The preserved response proving what the target Claw accepted or clarified. |
| Episode Handoff | A follow-up request to transform session learning into an episode artifact. |

## Non-goals

- Do not store, rotate, or print Gateway tokens.
- Do not claim that a dispatch message is proof of future execution.
- Do not create public issues unless the user explicitly asks or the session already grants that scope.
- Do not choose a ceremonial folder without inspecting the target workspace.
- Do not turn source facts into fictional story beats without source and inference labels.

## Success Criteria

- The operator can dispatch to a Claw with one skill invocation and an exact session ID.
- The output folder records the mission packet, command shape, acknowledgement, source ledger, and follow-up plan.
- The kit can identify when Storyweaver should take over for episode/StoryForm/StoryBeat extraction.
- The kit can recommend core-feature work for the target Claw to plan, while preserving uncertainty about what the target will actually do.
