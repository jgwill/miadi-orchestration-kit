# EAST PDE Session Orchestration

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This RISpec defines the EAST-direction plugin that prepares a ceremonial coding session from the first prompt or hook event. EAST is the orientation and first-light direction: it names the intent, gathers enough context, maps the likely orchestration lanes, and leaves a replayable launch surface.

The seed evidence is the Gemini CLI hook session `ca226890-bae0-4936-bc27-3c3f3b0db9f2`, where a small PDE-label request caused Gemini to set a topic, summarize strategic intent, and return a compact label description with Miette narrative resonance. The desired kit makes that beginning reusable without depending on `mia-awesome-copilot/plugins`.

Upgrade issue: `jgwill/miadi-orchestration-kit#37`, child of `#24`, adds strategy-aware decomposition and the Intent Analyst role to this RISpec.

## What is in this folder

| File | Purpose |
| --- | --- |
| `01-reverse-engineer.md` | Captures the hook event, current kit shape, and source inspiration. |
| `02-intent.md` | Defines EAST as the direction of session initiation and PDE orientation. |
| `03-specify.md` | Specifies the future Copilot plugin contract. |
| `04-export.md` | Provides launch, artifact, and future promotion shapes. |
| `05-source-ledger.md` | Tracks evidence and provisional claims. |

## Acceptance criteria

- The plugin receives a first prompt, transcript excerpt, or hook-event bundle.
- It identifies whether the work is EAST initiation, not a later-direction execution wave.
- It consults the portable Intent Analyst guidance at `/workspace/repos/jgwill/llms-txt/skills/intent-analyst/` without vendoring that source into this kit.
- It selects an explicit `miaco decompose run --strategy` value and records why `standard`, `iterative-refinement`, or `adversarial-consensus` was chosen.
- It preserves parent/child PDE lineage when `--parent`, `--parent-path`, or `--child-kind` applies.
- It creates a session charter, source ledger, and recommended plugin set without copying from `mia-awesome-copilot/plugins`.
- It can still cite external plugins as inspiration until native kit equivalents exist.
- It treats narrative resonance as orientation metadata, not as a substitute for evidence.
