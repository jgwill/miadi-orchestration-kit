# Specify

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Provisional function contract

```bash
pto_orchestration_plugins_recommender "<context>" [include-dir ...]
```

## Required behavior

The function should:

- require a non-empty first argument,
- treat the first argument as the full `<context>...</context>` body,
- create `./.pde/<tlid>--<uuid>/`,
- ask Gemini to write `LAUNCH.copilot-orchestration.sh` into that folder,
- include `/workspace/repos/jgwill/miadi-orchestration-kit/copilot`,
- include `/workspace/repos/miadisabelle/mia-awesome-copilot/plugins`,
- pass optional extra include directories through to `geminiidyolo`,
- ask for exact `copilot --plugin-dir` paths,
- ask for a report with each plugin title and reasoning under 55 words.

## Expected output contract

Future agents should expect:

| Output | Requirement |
| --- | --- |
| Launch script | Concrete shell script under `./.pde/<tlid>--<uuid>/LAUNCH.copilot-orchestration.sh`. |
| Plugin paths | Exact directories suitable for `copilot --plugin-dir`. |
| Report | One entry per recommended plugin, each with title and reason under 55 words. |
| Context trace | The work context should be visible in the LLM prompt or output enough to audit relevance. |
| Review status | Output is a recommendation, not an automatic authority to execute. |

## Future promotion checks

Before making this a skill or plugin, gather at least three successful uses where:

- the chosen plugin set was actually useful,
- the generated launch script was replayable,
- omitted plugin candidates were not critical,
- the context argument was expressive enough without adding hidden parameters,
- a human or reviewer confirmed the recommendation quality.

