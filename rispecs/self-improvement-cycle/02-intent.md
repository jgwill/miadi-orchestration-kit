# 02 · Intent: how the Miadi Factory uses what the talk shows

## The desired outcome

Every agent session in the factory is a run that can be scored. Recurring failures come back as a
proposal to change a factory definition, with the sessions that show the failure as evidence, and
with the experience the change creates. A person rules on each proposal in the cycle's talking
circle. The next cycle shows whether the change held. The cycle is visible as an episode, so a
person can watch the factory change itself and judge it.

## Current reality

Sessions are captured in full (`miadi-session-observability`), recorded (the session inventory),
and some carry a human ruling (talking circles, `closing-a-cycle`). Proposals, drafts, lanes and
exits are already scored (`skills/proposal-visualization/scoring/`, `score-lanes.mjs`, Jev's ledgers
in `~/.miadi/decisions/`), and a session's own work is not. Nothing
groups their failures, except the exit-reasons pass, which is specified but not built. No proposal
targets a definition, and nothing counts whether a change held. The same agent mistake is fixed
by hand in a skill or a CLAUDE.md when Guillaume notices it, and the next seat repeats it when he
does not.

## The cycle on the Wheel

The loop is the development cycle of the Medicine Wheel, EAST to SOUTH to WEST to NORTH, applied
to the factory itself.

| direction | the step | Warp (screenshot) | ours |
|---|---|---|---|
| 🌅 EAST | what is received: a session's question (what it was asked, by whom, from where), and for a proposed change, the person's ruling, which is its consent | runs list (13), approve or reject (06) | the inventory record's `question` link, the binding line, the mission or connector request; S6 the ruling in the cycle's talking circle |
| 🔥 SOUTH | the runs are read and learned from: scores, failure groups, the investigation, and the proposal drafted with nothing pushed | scorers (07, 08), failed runs (04), the investigation (05), the inbox item (03) | S2, S3, S4, S5 drafted in the pass folder |
| 🌊 WEST | on a "makes sense" ruling only: the branch, the PR, the owning team's merge | the PR and its diff (01, 14) | S5's branch and PR |
| ❄️ NORTH | what was learned returns: whether the change held, the episode, the next cycle's circle | daily rates (08) | S7 recurrence, S10 the episode |

A proposal's ruling opens the change's own cycle, so it sits in EAST: under the Sunwise Law WEST
acts only on what was consented to, and nothing is pushed before the person rules. Where
integration sits between WEST and NORTH is held for a knowledge holder in jgwill/medicine-wheel#113,
and this cycle does not settle it.

## By level

### Plugins (jgwill/miadi-orchestration-kit)

- `miadi-session-observability` keeps capturing every session, and its `/inventory-exit-reason`
  (0.1.49) gives the human feedback on a run: why the person stopped it.
- `miadi-witness` keeps the inventory and Jev's one-choice decisions, and is where the passes
  (exit reasons, then scorers) would run.
- The scorers and the list of factory definitions are kept as code in the kit, beside the
  plugins they judge (S2, S8).
- `miadi-operator-desk` `closing-a-cycle` teaches the ruling: each proposal would be one turn.

### Factory packages and the app (jgwill/Miadi)

- `@miadi/hooks-interpreter` would read sessions for every pass, through `exits` once
  jgwill/Miadi#1062 is built.
- `@miadi/connector` records people's assessments (`record_evaluation`). A proposal is ruled in
  the circle, not on a decision card, so one answer opens its PR.
- `@miadi/tracing-langfuse` holds score configurations, if Langfuse is chosen for them (S2 answers
  Guillaume's question in the review).
- The app shows the runs, a run's scores, the proposals inbox with its approval rate, and the
  scorers and spending on one dashboard (S1, S6, S9).

### The wheel and its ceremonies (jgwill/medicine-wheel)

- The cycle would be recorded on the wheel: each proposal a node, the sessions that are its
  evidence related to it, the ruling a turn in a talking circle, the recurrence kept with
  `transformation-tracker` (jgwill/medicine-wheel#178).

### The episode (jgwill/episodes)

- A pilot episode shows one full cycle on a real failure: the sessions, the scores, the proposal,
  the ruling and the next cycle's count (S10). The production team decides whether to make it.

## What the person experiences

- **Guillaume, in the morning:** one page lists the cycle's proposals. Each shows the failure in
  words, the sessions that show it, what changes and what he will be able to do once it lands. He
  answers each in the circle, by voice if he likes, and his answers become graded data the model
  judges are calibrated against, which Warp's scores do not have yet (20:50). He no longer finds
  the same mistake again in the next seat.
- **A team's agent lead:** a proposal that touches their plugin or package reaches them as a
  child of the cycle's issue, with its evidence.
- **A viewer of the episode:** watches the factory read its own sessions, propose a change, receive
  a person's ruling, and see whether the change held.

## Kept as Guillaume wrote it

- "Closing the loop or in our case, it would be the cycle where the agent is actually supplying a
  PR not just to solve the problem but innovates so that we have the experience that we want"
  (screenshot 01).
- "Open a PR to enhance the factory definitions" (screenshot 03).
- From the planning prompt 2611180617: "The cycle is not closed".
