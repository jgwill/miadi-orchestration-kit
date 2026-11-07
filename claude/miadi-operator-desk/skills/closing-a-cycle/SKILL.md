---
name: closing-a-cycle
description: How a cycle of work closes in the Miadi Factory, for the person and for the agent. The agents bring back what needs the person as an explainer to listen to and as one turn per item in a talking circle, the person answers each turn "makes sense" or "does not make sense", and the agents act on each answer (including starting, resuming or steering sessions) and record what they did. Use when a person asks "what needs my attention", "close the cycle", "I'm not going to open folders", "how do I give feedback", "how does the talking circle work", "what do I do with this notebook", or when a seat ends a day of work that left decisions for a person. Points to the skills that do each step and copies none of them.
---

# Closing a cycle

A cycle closes when what the agents could not decide has gone back to the person in a form they will actually
take in, and their answers have moved the work. Teaching this is the operator desk's part: the steps belong to
the teams named at each one.

The first cycle closed this way is in Episode 572 (miadi-chronicle://572, `cycle-close-261107.md` and
`captures/notebook-756c1ee0-5cbf-4364-b142-e45b22f02d79/`). The practice is held by Episode 573
(miadi-chronicle://573), where Miette explains it for someone who has never seen the factory.

## For the person: how you take part

1. **Listen.** The explainer video, or its audio, says what the cycle made, what the agents decided without
   you, and each item that needs you, by its code (D5, A9, G1…). The agents decide everything they can, and an
   item reaches you only when it needs your name, your relationships, your writing, your money, or an outside
   audience.
2. **Answer each turn in the talking circle.** Every item is one turn in the ceremony named in the closing
   message (an address like `miadi-ceremony://<uuid>`). Under a turn, choose **makes sense** to take the
   recommendation, or **does not make sense** and add a note saying what you want instead. One word is enough.
3. **Or answer another way.** Name the code while you talk over the video in your next screenwalk, or say it to
   the seat directly. A screenwalk made over an explainer is read with the `explainer-feedback-loop` skill
   (plugin `miadi-witness`).
4. **Reverse anything.** A decision the agents made on their own is listed by code. Naming its code with a new
   direction undoes it.

What happens next is the agents' work: they act on each answer in the same cycle, reply under the turn with
what they did, and the item leaves the list of what waits for you.

## For the agent: the steps, and who owns each

1. **Sort what is waiting.** Read the seat's waiting ledger (`~/workspace/.mino/WAITING-ON-WILLIAM.md` for the
   witness seat) and the charts. Decide every item that is reversible and that a person's name, relationship,
   writing, money or outside audience does not hold. Write each decision with its code, so it can be reversed.
   Only the rest goes to the person, each with a recommendation and what the answer unlocks.
2. **Write the source in the episode the items belong to:** `cycle-close-<yymmdd>.md`, with what the person
   asked, what exists now (each line checked), the structure kept (the master charts), what the agents decided,
   what needs the person, how to answer, and the next cycle. Episode 572's file is the shape. Staged
   explorations that are not episodes enter as sources.
3. **Make the explainer.** Use `screenwalk-notebook` (plugin `miadi-deepdiver`): a notebook from the source and
   at most four more files, an explainer video with its plan read first (`plan-read.mjs words` and `jev`),
   feedback when Jev sends the plan to a person, then the render, `studio download --keep`, the notebook door
   and a beat for the writers. Read the kept transcript and the infographic against the source, and write what
   they say that the source does not into the notebook's README (V1…, I1…).
4. **Post one turn per item** in the person's circle with `circle-dialogue.mjs` (skill `mia-ava-podcast`,
   plugin `miadi-witness`): `check-dialogue.py`, then `post --dry-run`, then `post`. Every host must be seated:
   the facilitator or an admin seats a member (`POST /api/circles/<id>/members`). If a post stops, resume with
   `--from <n>`. Answers are kept by jgwill/Miadi's turn answer route
   (`app/api/ceremony/[id]/turns/[beatId]/respond`).
5. **Listen for the answers, and say who acts on what.** `circle-dialogue.mjs await` wakes on any turn a host
   has not replied to, including the person's own turns. When another seat listens to the same ceremony, agree
   in one message which turns each one acts on, and listen only for answers under your own turns
   (`pending --json`, filtered by turn number). Each answer is then acted on once.
6. **Act on each answer.** For **makes sense**, apply the recommendation as written, in full. For **does not
   make sense**, apply the note, and ask only if the note leaves the act open. Acting may mean:
   - starting a session for the work: Jev chooses the worker (`choose-worker.mjs`), the task becomes a mission
     (skill `miadi-run`), and `mct new <team> <tmux name> --mission <prompt>.v<N> --authorized-by <person>`
     starts it on its team;
   - resuming a session that holds the work: `session-door <id> --open` (witness seat's `~/workspace/.mino/bin`);
   - steering a running one, through `.mino/threads/`, or a pane message only when that seat is idle;
   - minting an episode, filing a request, or changing a chart step.
   One writer per repository and one :3335 rebuild at a time (`schedule-delegation-by-repository`).
7. **Record it.** Reply under the turn with what was done and its evidence (`circle-dialogue.mjs reply
   --turn <id>`), move the item to Answered in the ledger, and mark or update the chart step.
8. **Close the loop.** What the answers opened is the next cycle's source. A screenwalk the person makes over
   the explainer starts `explainer-feedback-loop`.

## Capabilities this practice uses

Held in Episode 573 on the medicine wheel, in the registry's grammar
(`miadi-capability:<owner>/<repo>/<kind>/<name>`, Episode 568): this skill, `mia-ava-podcast`, the turn answer
route, `screenwalk-notebook` and the `deepdiver` CLI, `explainer-feedback-loop`, `@miadi/chronicle-tui`
(`mct`), `session-door` and `@miadi/inquiry-weave`. When one of them changes how a step is done, revise the
step here and the holding there.

## What this skill does not do

- It does not decide for the person what only they can decide, and it does not ask them what the agents can
  decide.
- It does not copy the steps of the skills it points to. Their text is canonical.
- It does not treat a person's own turn at the end of the circle as an answer to an item. That turn is a new
  input, for the seat that holds the person's turns.

## Log

- **0.1.0, 2026-11-07.** Written by the Mino witness seat
  (`mino-t3-2611071211-fork1-t5-miadi-film-apt-2611071058-fork2-2611071646`) from the first cycle it closed, at
  Guillaume's word: "create something that would help us understand how to use what was conceived right now …
  if that fits on the operator's desk team T7 that would make sense … by loading the plugin, our agent would
  also be capable of getting skills that tells us exactly what we need to do and where we're going with this."
  That cycle found two things this skill now says: a host that is not seated is refused (Mia had to be seated
  before her turns could post), and two seats listening to one ceremony must split the turns they act on.
