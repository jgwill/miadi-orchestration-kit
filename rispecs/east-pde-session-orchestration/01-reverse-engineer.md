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
3. decide whether ordinary execution or PDE decomposition is needed,
4. compress the mission into a usable label,
5. preserve a relational tone marker,
6. leave a trace that later orchestration can read.

## Current kit evidence

`/workspace/repos/jgwill/miadi-orchestration-kit/copilot` already contains Miadi-native plugin folders with `agents/`, `skills/`, and `.github/plugin/plugin.json` surfaces. `copilot/session-charter-template.md` provides a per-run prompt skeleton with objective, roots, artifact folder, plugin dir, lanes, boundaries, and audit note.

## Intent Analyst evidence

`/workspace/repos/jgwill/llms-txt/skills/intent-analyst/` is a portable skill candidate for EAST. It defines a PDE-facing role that reads intention before implementation, chooses a decomposition strategy, and hands off a compact action path.

The dependency should be guidance-level rather than a blind copy. A future `miadi-east-pde-session-kit` can include a native peer skill, but it must keep parity with the llms-txt source when strategy support, parent/child semantics, or MCP boundaries change.

## miaco decomposition evidence

`miaco decompose run --help` exposes the concrete command surface that EAST should plan around:

- prompt input via `--prompt` or `--prompt-file`,
- engine selection across `copilot`, `claude`, `gemini`, `codex`, `pva`, and `hermes`,
- explicit strategy selection with `standard`, `iterative-refinement`, or `adversarial-consensus`,
- workspace context via repeatable `--add-dir`,
- lineage flags via `--parent`, `--parent-path`, and `--child-kind`,
- provenance via `--meta`,
- machine-readable output via `--format json` or `--json`.

`/src/mia-code/miaco/STRATEGIES.md` clarifies the current strategy posture: `standard` is stable and default, `iterative-refinement` is recommended for recursive or lineage-heavy intent analysis, and `adversarial-consensus` remains experimental until parser and artifact contracts are verified.

## External inspiration

`/workspace/repos/miadisabelle/mia-awesome-copilot/plugins` remains useful as inspiration for plugin packaging and roles such as project planning, context engineering, and software-engineering review. The EAST plugin should learn from those patterns while becoming independent by naming native Miadi surfaces and exact source ledgers.

## Issue lineage

`jgwill/miadi-orchestration-kit#37` is the child issue for adding strategy-aware decomposition and the Intent Analyst role to this RISpec under parent `#24`.

## Beloved quality to preserve

The useful quality is not merely brevity. The session turns a raw first prompt into a compact orientation artifact: title, intent, description, and story warmth. That is the moment where Tushell opens the portal and Miadi begins arranging the house.
