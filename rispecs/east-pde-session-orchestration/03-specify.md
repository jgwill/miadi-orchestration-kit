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
- optional `/workspace/repos/jgwill/llms-txt/skills/intent-analyst/` guidance root,
- optional parent PDE UUID or parent PDE folder,
- optional child-kind hint,
- optional decomposition strategy hint,
- optional medicine-wheel direction hint.

## Required outputs

| Output | Requirement |
| --- | --- |
| Direction assessment | Names EAST when the work is initiation/orientation/PDE setup. |
| Intent read | Names primary intent, secondary intents, ambiguities held, and whether execution should proceed now. |
| Strategy selection | Chooses `standard`, `iterative-refinement`, or `adversarial-consensus`, with reason and risk note. |
| PDE summary | Compresses the first prompt into topic, strategic intent, implied tasks, lineage posture, and stop gates. |
| Lineage plan | Records parent PDE, child kind, or reason no parent/child relation applies. |
| miaco command contract | Emits the exact `miaco decompose run` command or records why no stored PDE artifact is needed. |
| Source ledger | Lists exact paths consulted and claim status. |
| Session charter | Uses `copilot/session-charter-template.md` shape. |
| Plugin recommendation | Prefers native `miadi-orchestration-kit/copilot/*` paths and marks external inspiration separately. |
| Narrative seed | Captures Tushell/Miadi resonance in 1-3 sentences for future chronicle use. |

## Agent surfaces

A future plugin should include:

- `agents/east-session-orchestrator.md` — owns direction classification and charter assembly.
- `agents/intent-analyst-adapter.md` — translates llms-txt Intent Analyst guidance into this kit without copying it blindly.
- `agents/pde-strategy-selector.md` — chooses the miaco decomposition strategy and records the tradeoff.
- `agents/pde-source-ledger-reviewer.md` — checks evidence and claim status.
- `agents/native-plugin-independence-reviewer.md` — identifies remaining reliance on `mia-awesome-copilot/plugins`.

## Skill surfaces

A future plugin should include:

- `skills/east-pde-session-bootstrap/SKILL.md` — first prompt to charter workflow.
- `skills/intent-analyst-handoff/SKILL.md` — compact intent read and action-path output shape.
- `skills/miaco-decompose-strategy/SKILL.md` — local command contract for `miaco decompose run`.
- `skills/direction-classification/SKILL.md` — medicine-wheel direction rules.
- `skills/native-plugin-recommendation/SKILL.md` — exact plugin-path selection and external-inspiration separation.

## Strategy selection rules

Use `standard` when the prompt is focused, low-lineage, and a single pass can capture the action path.

Use `iterative-refinement` when the prompt is layered, recursive, ambiguous, or tied to parent/child PDE, STC, issue, or artifact lineage. This is the preferred EAST strategy for Intent Analyst workflows.

Use `adversarial-consensus` only as an explicitly experimental path when ambiguity is high and the operator accepts the parser, cost, and non-determinism risk. Do not make it the default for production session initiation.

When strategy-aware behavior matters, prefer `miaco decompose run --strategy ...` over `mcp-pde` until `jgwill/mcp-pde` strategy parity is verified and recorded in the source ledger.

## Creative advancement scenario

**Creative Advancement Scenario**: First prompt becomes an orchestration charter

**Desired Outcome**: The operator begins with a replayable, direction-aware session plan.

**Current Reality**: A raw prompt or hook event contains intent, constraints, lineage hints, and story signals, but they are not yet arranged.

**Natural Progression**: EAST identifies the entrance, performs an Intent Analyst read, selects a decomposition strategy, maps evidence roots, chooses native plugin surfaces, and writes the charter.

**Resolution**: The next agent can launch with exact paths, known boundaries, and preserved narrative orientation.
