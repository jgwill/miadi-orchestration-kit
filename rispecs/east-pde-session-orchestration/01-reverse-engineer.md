# Reverse-Engineer

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Observed hook event

The session data at `/src/_sessiondata/ca226890-bae0-4936-bc27-3c3f3b0db9f2` records a Gemini CLI session whose prompt asked for a GitHub label description for `pde` under 100 characters.

Observed surfaces:

- `last_gemini_user_inputs.json` contains the initial prompt and hook metadata.
- `_gemini_transcript_latest.jsonl` shows Gemini setting topic metadata before answering.
- `last_gemini_AssistantResponse.json` records the generated label description and Miette-style resonance.
- The session topic was `PDE Label Creation` with strategic intent: shortening a GitHub label description.

## Extracted pattern

The prompt is small, but the behavior is an EAST-direction seed:

1. receive first intent,
2. name the topic,
3. compress the mission into a usable label,
4. preserve a relational tone marker,
5. leave a trace that later orchestration can read.

## Current kit evidence

`/workspace/repos/jgwill/miadi-orchestration-kit/copilot` already contains Miadi-native plugin folders with `agents/`, `skills/`, and `.github/plugin/plugin.json` surfaces. `copilot/session-charter-template.md` provides a per-run prompt skeleton with objective, roots, artifact folder, plugin dir, lanes, boundaries, and audit note.

## External inspiration

`/workspace/repos/miadisabelle/mia-awesome-copilot/plugins` remains useful as inspiration for plugin packaging and roles such as project planning, context engineering, and software-engineering review. The EAST plugin should learn from those patterns while becoming independent by naming native Miadi surfaces and exact source ledgers.

## Beloved quality to preserve

The useful quality is not merely brevity. The session turns a raw first prompt into a compact orientation artifact: title, intent, description, and story warmth. That is the moment where Tushell opens the portal and Miadi begins arranging the house.
