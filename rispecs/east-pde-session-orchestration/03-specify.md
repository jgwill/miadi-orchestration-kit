# Specify

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Proposed plugin name

`miadi-east-pde-session-kit`

## Plugin purpose

Prepare the first orchestration surface for a Miadi coding/research session by transforming a first prompt, transcript excerpt, or hook event bundle into a direction-aware session charter and launch recommendation.

## Inputs

The plugin accepts one or more of:

- raw user prompt,
- Gemini/Copilot/Claude hook event JSON,
- transcript excerpt,
- active workspace path,
- candidate evidence roots,
- optional medicine-wheel direction hint.

## Required outputs

| Output | Requirement |
| --- | --- |
| Direction assessment | Names EAST when the work is initiation/orientation/PDE setup. |
| PDE summary | Compresses the first prompt into topic, strategic intent, implied tasks, and stop gates. |
| Source ledger | Lists exact paths consulted and claim status. |
| Session charter | Uses `copilot/session-charter-template.md` shape. |
| Plugin recommendation | Prefers native `miadi-orchestration-kit/copilot/*` paths and marks external inspiration separately. |
| Narrative seed | Captures Tushell/Miadi resonance in 1-3 sentences for future chronicle use. |

## Agent surfaces

A future plugin should include:

- `agents/east-session-orchestrator.md` — owns direction classification and charter assembly.
- `agents/pde-source-ledger-reviewer.md` — checks evidence and claim status.
- `agents/native-plugin-independence-reviewer.md` — identifies remaining reliance on `mia-awesome-copilot/plugins`.

## Skill surfaces

A future plugin should include:

- `skills/east-pde-session-bootstrap/SKILL.md` — first prompt to charter workflow.
- `skills/direction-classification/SKILL.md` — medicine-wheel direction rules.
- `skills/native-plugin-recommendation/SKILL.md` — exact plugin-path selection and external-inspiration separation.

## Creative advancement scenario

**Creative Advancement Scenario**: First prompt becomes an orchestration charter

**Desired Outcome**: The operator begins with a replayable, direction-aware session plan.

**Current Reality**: A raw prompt or hook event contains intent, constraints, and story signals, but they are not yet arranged.

**Natural Progression**: EAST identifies the entrance, decomposes intent, maps evidence roots, chooses native plugin surfaces, and writes the charter.

**Resolution**: The next agent can launch with exact paths, known boundaries, and preserved narrative orientation.
