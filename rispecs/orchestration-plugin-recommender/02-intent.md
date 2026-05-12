# Intent

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Desired outcome

Prepare orchestration faster by giving an agent one small function that turns a work context into a recommended Copilot plugin launch script and a short explanation of why each plugin belongs.

## Current reality

The need is clear, but the durable home is unclear. The current useful shape is a shell wrapper in `/src/scripts/fn_llm.sh`; a repo skill under `skills/` would be premature until the interface and repeated use are clearer.

## Structural tension

- Desired: an orchestration-preparation role that can be reused by future agents.
- Current: a one-off Gemini prompt prototype and a still-blurry idea of a global skill.
- Tension to hold: make the current action executable without pretending the long-term product shape is settled.

## Non-goals

- Do not create a skill in `skills/` yet.
- Do not scaffold a new Copilot plugin yet.
- Do not move or rename the existing plugin roots.
- Do not require the recommender output to be accepted without review.

## Stop conditions

- The function no longer treats the first argument as the work context.
- The recommender stops producing exact plugin paths.
- The generated launch script cannot be replayed with `copilot --plugin-dir`.
- Future work claims this is a finalized skill/plugin without evidence from repeated use.

