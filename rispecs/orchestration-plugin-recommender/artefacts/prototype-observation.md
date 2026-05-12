# Prototype Observation

## Prototype source

`/workspace/scripts/PTO--orchestration-plugins-recommender.sh`

## Prototype behavior

The prototype asks Gemini to choose orchestration plugins from two plugin roots for a supplied work context, then produce:

- a replayable `copilot --plugin-dir ...` recommendation,
- a launch script saved under `./.pde/<tlid>--<uuid>/LAUNCH.copilot-orchestration.sh`,
- a short report explaining each selected plugin in 55 words or less.

## Extracted executable seed

`/src/scripts/fn_llm.sh` now contains:

```bash
pto_orchestration_plugins_recommender "<context>" [include-dir ...]
```

The first argument is the context payload. Extra arguments are optional directories forwarded to `geminiidyolo`.

## Deferred decision

The future form may be a skill, Copilot plugin, or rispec-backed orchestration pattern. This artefact records the seed only; it does not decide promotion.

