## Context

Part of jgwill/miadi-orchestration-kit#160. Domain: Ceremonial.

The factory's self-improvement cycle (specified in `rispecs/self-improvement-cycle/`,
jgwill/miadi-orchestration-kit) runs EAST to NORTH: a session's question is received, sessions are
scored and their failures investigated, a proposal changes one factory definition, and a person
rules on it, after which the next cycle shows whether the change held.

What the wheel has today:

- A Miadi review is one `knowledge` node with `metadata.kind: miadi_review`, related to episodes by
  edges, and held in talking circles (`talking_circle` ceremonies with `subject_id: review:<uuid>`).
- `community-review` holds circles, turns and consensus. `transformation-tracker` tracks what a
  piece of work transformed. `session-reader` reads session events.
- A proposal, the sessions that are its evidence, the ruling on it and what came of it are recorded
  nowhere on the wheel. The ruling happens in a talking circle (`closing-a-cycle`, miadi-operator-desk),
  and its turn is not tied to what it ruled on.

## Desired State

Each cycle is on the wheel:

- each proposal is a `knowledge` node with `metadata.kind: self_improvement_proposal`, its target
  definition and its pattern, as reviews are
- the sessions that are its evidence are related to it by edges, each with its scorer verdict
- the ruling is a turn of a `talking_circle` whose `subject_id` is the proposal's node, and the
  proposal's node carries the answer and the turn
- what came of it (held, partly, returned) is a transformation record on the proposal
- the cycle is one record that names its proposals, so a person can open one cycle and see all of it

## Action Steps

- [ ] Agree the node kind and the edge types with the wheel's owners, on this issue
- [ ] A proposal's node and its evidence edges, written through the wheel's API by the kit's pass (jgwill/miadi-orchestration-kit#161 S5)
- [ ] The ruling's turn tied to the proposal's node (`subject_id`)
- [ ] The recurrence result kept with `transformation-tracker`
- [ ] The cycle record, readable by the app (jgwill/Miadi#1063) and by an episode (the pilot)

## Structural Tension

The factory's rulings already happen in talking circles, and what they rule on lives outside the
wheel. Recording the proposal, its evidence and its ruling on the wheel keeps the person's judgment
tied to what it judged, across cycles.

The cycle places the ruling in NORTH, following `DIRECTION_INFO` (the session altitude), where
integration sits. `narrative-engine` places `integrating` on west. That question is held for a
knowledge holder in jgwill/medicine-wheel#113, and this issue does not settle it.

## Related

- Parent: jgwill/miadi-orchestration-kit#160
- jgwill/miadi-orchestration-kit#161, jgwill/Miadi#1063, jgwill/medicine-wheel#113
- Specification: `rispecs/self-improvement-cycle/02-intent.md` (the cycle on the Wheel) and `03-specify.md` S6, S7 (jgwill/miadi-orchestration-kit)
- Episode 573 (miadi-chronicle://573, closing a cycle)
- miadi-review:d47ef197-8fc2-4f81-be25-67d4e335d104
