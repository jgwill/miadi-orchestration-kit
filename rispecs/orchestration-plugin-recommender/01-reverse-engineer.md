# Reverse-Engineer

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Observed prototype

The prototype at `/workspace/scripts/PTO--orchestration-plugins-recommender.sh` calls `geminiidyolo` directly with:

- a prompt asking which orchestration plugins should be loaded,
- a `<context>...</context>` payload describing the work,
- the Miadi orchestration-kit Copilot plugin root,
- the `mia-awesome-copilot/plugins` root,
- an instruction to save `LAUNCH.copilot-orchestration.sh` under `./.pde/<tlid>--<uuid>/`,
- an output report where each plugin has a title and a reason under 55 words.

## Observed wrapper surface

`/src/scripts/fn_llm.sh` already defines:

- `geminii` as the default Gemini wrapper,
- `geminiiyolo` for YOLO Gemini calls,
- `geminiid` and `geminiidyolo` for directory-aware Gemini calls,
- existing Miadi orchestration-kit plugin path constants near the STCCanvas helper.

## Current extraction

The extracted function is `pto_orchestration_plugins_recommender`.

It:

- takes the orchestration context as its first argument,
- creates a concrete `.pde/<tlid>--<uuid>` launch directory,
- asks Gemini to write `LAUNCH.copilot-orchestration.sh`,
- includes both observed plugin roots by default,
- forwards any extra arguments as additional include directories to `geminiidyolo`.

## Boundary

This stage only records what exists. It does not decide whether the concept becomes a skill, a Copilot plugin, a storytelling rispec, or a broader orchestration platform feature.

