# Orchestration Plugin Recommender

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This rispec is a simple holding surface for a still-unclear proposal: a reusable helper that prepares an orchestration by asking an LLM which Copilot plugin directories should be loaded for a given work context.

The current executable seed is the shell function `pto_orchestration_plugins_recommender` in `/src/scripts/fn_llm.sh`. It wraps `geminiidyolo`, injects the first argument as `<context>...</context>`, scans the observed plugin roots, and asks Gemini to write a launch script under `./.pde/<tlid>--<uuid>/LAUNCH.copilot-orchestration.sh`.

## Served possibility

This may later become one of these, but the choice is intentionally not resolved here:

- a Copilot plugin under `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/*`,
- a repo-local skill under `/workspace/repos/jgwill/miadi-orchestration-kit/skills/*`,
- a reusable rispec pattern under `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/*`,
- a storytelling rispec only if the primary output becomes narrative orchestration memory under `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs`.

## Inputs

- Prototype: `/workspace/scripts/PTO--orchestration-plugins-recommender.sh`
- Function surface: `/src/scripts/fn_llm.sh`
- Primary plugin root: `/workspace/repos/jgwill/miadi-orchestration-kit/copilot`
- Secondary plugin root: `/workspace/repos/miadisabelle/mia-awesome-copilot/plugins`

## What is in this folder

| File | Purpose |
| --- | --- |
| `01-reverse-engineer.md` | Captures what was observed from the prototype and function wrapper. |
| `02-intent.md` | States desired outcome, current uncertainty, and boundaries. |
| `03-specify.md` | Defines the provisional invocation and output contract. |
| `04-export.md` | Gives future launch, promotion, and handoff shapes. |
| `05-source-ledger.md` | Tracks claim provenance and status. |
| `artefacts/prototype-observation.md` | Small artefact describing the current prototype-to-function extraction. |

## Acceptance criteria

- The first function argument remains the work context.
- The helper recommends exact plugin directories, not vague plugin categories.
- The generated launch script path is concrete and under `./.pde/`.
- The report gives each selected plugin title with reasoning under 55 words.
- The rispec keeps the future skill/plugin decision provisional.

