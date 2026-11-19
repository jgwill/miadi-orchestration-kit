# 02 · Intent: how the Miadi Factory uses what the talk shows

## The desired outcome

Every agent session in the factory is a run that can be scored. Recurring failures come back as a
proposal to change a factory definition, with the sessions that show the failure as evidence, and
with the experience the change creates. A person rules on each proposal in the cycle's talking
circle. The next cycle shows whether the change held. The cycle is visible as an episode, so a
person can watch the factory change itself and judge it.

## Current reality

Sessions are captured in full (`miadi-session-observability`), recorded (the session inventory),
and some carry a human ruling (talking circles, `closing-a-cycle`). Nothing scores them. Nothing
groups their failures, except the exit-reasons pass, which is specified but not built. No proposal
targets a definition, and nothing counts whether a change held. The same agent mistake is fixed
by hand in a skill or a CLAUDE.md when Guillaume notices it, and the next seat repeats it when he
does not.

## The cycle on the Wheel

The loop is the development cycle of the Medicine Wheel, EAST to SOUTH to WEST to NORTH, applied
to the factory itself.

| direction | the step | Warp (screenshot) | ours |
|---|---|---|---|
| 🌅 EAST | the run's question is received: what the session was asked, by whom, from where | runs list (13) | the inventory record's `question` link, the binding line, the mission or connector request |
| 🔥 SOUTH | the runs are read and learned from: scorers, then the investigation of a failure group | scorers (07, 08), failed runs (04), the investigation (05) | S2 scorers, S3 patterns, S4 the investigation |
| 🌊 WEST | the change is made, and only for a missing instruction: a proposal against a definition | the proposal and its PR (01, 03, 14) | S5 the proposal |
| ❄️ NORTH | the person rules, and what was learned returns: approval, recurrence, the episode | approval rate (06), daily rates (08) | S6 the ruling in the circle, S7 recurrence, S10 the episode |

The ruling sits in NORTH because it is where the circle receives what the cycle made and decides
what goes forward. The next EAST starts from the definitions as the ruling left them.

## By level

### Plugins (jgwill/miadi-orchestration-kit)

- `miadi-session-observability` keeps capturing every session, and its `/inventory-exit-reason`
  (0.1.49) gives the human feedback on a run: why the person stopped it.
- `miadi-witness` keeps the inventory, runs the passes (exit reasons, then scorers) and Jev's
  one-choice decisions.
- The scorers and the list of factory definitions are kept as code in the kit, beside the
  plugins they judge (S2, S8).
- `miadi-operator-desk` `closing-a-cycle` carries the ruling: each proposal is one turn.

### Factory packages and the app (jgwill/Miadi)

- `@miadi/hooks-interpreter` reads sessions for every pass (`exits`, then scores).
- `@miadi/connector` records proposals (`propose_work`) and evaluations (`record_evaluation`), and
  shows the decision card.
- `@miadi/tracing-langfuse` holds score configurations, if Langfuse is chosen for them (S2 answers
  Guillaume's question in the review).
- The app shows the runs, a run's scores, the proposals inbox with its approval rate, and the
  scorers and spending on one dashboard (S1, S6, S9).

### The wheel and its ceremonies (jgwill/medicine-wheel)

- The cycle is recorded on the wheel: each proposal a node, the sessions that are its evidence
  related to it, the ruling a turn in a talking circle, the recurrence a NORTH return.

### The episode (jgwill/episodes)

- A pilot episode shows one full cycle on a real failure: the sessions, the scores, the proposal,
  the ruling and the next cycle's count (S10). The production team decides whether to make it.

## What the person experiences

- **Guillaume, in the morning:** one page lists the cycle's proposals. Each shows the failure in
  words, the sessions that show it, what changes and what he will be able to do once it lands. He
  answers each in the circle, by voice if he likes. He no longer finds the same mistake again in
  the next seat.
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
