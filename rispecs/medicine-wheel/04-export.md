# 04 - Export

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This file gives future agents enough shape to create one concrete plugin for a
chosen harness. Do not scaffold every harness at once unless the operator asks
for a multi-harness implementation wave.

## Recommended promotion order

1. Start with a harness that is already active for the session.
2. Implement only the core skills needed for that harness.
3. Validate with a fixture or read-only live Medicine Wheel health check.
4. Add source-ledger evidence before claiming plugin readiness.
5. Create a follow-up issue for additional harnesses.

## Copilot export

Target folder:

```text
copilot/miadi-medicine-wheel-orchestration-kit/
  .github/plugin/plugin.json
  README.md
  agents/
    medicine-wheel-orchestration-steward.md
    fire-keeper-boundary-reviewer.md
    rise-spec-advisor.md
    source-ledger-keeper.md
  skills/
    medicine-wheel-session-orient/SKILL.md
    medicine-wheel-fire-keeper-gate/SKILL.md
    medicine-wheel-rise-spec-advisor/SKILL.md
    medicine-wheel-mcp-health/SKILL.md
    medicine-wheel-source-ledger/SKILL.md
```

Manifest sketch:

```json
{
  "name": "miadi-medicine-wheel-orchestration-kit",
  "description": "Miadi Copilot kit for Medicine Wheel session orientation, Fire Keeper gates, MCP health, RISE spec advising, and source-ledger-backed orchestration.",
  "version": "0.1.0",
  "author": {
    "name": "Miadi"
  },
  "repository": "https://github.com/jgwill/miadi-orchestration-kit",
  "license": "MIT",
  "agents": ["./agents"],
  "skills": [
    "./skills/medicine-wheel-session-orient",
    "./skills/medicine-wheel-fire-keeper-gate",
    "./skills/medicine-wheel-rise-spec-advisor",
    "./skills/medicine-wheel-mcp-health",
    "./skills/medicine-wheel-source-ledger"
  ]
}
```

Smoke prompt:

```text
Use the Medicine Wheel orchestration kit to inspect API/MCP health, classify
this mission by Four Directions, and prepare a source-ledger-backed session
charter. Do not execute the implementation wave.
```

## Codex export

Target folder:

```text
codex/miadi-medicine-wheel-orchestration-kit/
  .codex-plugin/
    plugin.json
  README.md
  skills/
    medicine-wheel-session-orient/SKILL.md
    medicine-wheel-fire-keeper-gate/SKILL.md
    medicine-wheel-rise-spec-advisor/SKILL.md
    medicine-wheel-mcp-health/SKILL.md
    medicine-wheel-source-ledger/SKILL.md
  templates/
    session-charter.md
    source-ledger.md
    wave-plan.md
    handoff.md
```

Manifest sketch:

```json
{
  "name": "miadi-medicine-wheel-orchestration-kit",
  "version": "0.1.0",
  "description": "Codex-native Medicine Wheel orchestration skills for session orientation, Fire Keeper gates, MCP health, RISE spec advising, and source ledgers.",
  "author": {
    "name": "Miadi",
    "url": "https://github.com/jgwill/miadi-orchestration-kit"
  },
  "repository": "https://github.com/jgwill/miadi-orchestration-kit",
  "license": "MIT",
  "keywords": ["miadi", "codex", "medicine-wheel", "orchestration", "rise", "mcp"],
  "skills": "./skills/",
  "interface": {
    "displayName": "Miadi Medicine Wheel Orchestration Kit",
    "shortDescription": "Orient Codex work through Medicine Wheel, Fire Keeper gates, MCP health, and RISE ledgers.",
    "category": "Development",
    "capabilities": ["Interactive", "Write"]
  }
}
```

Local use:

```bash
codex plugin marketplace add /workspace/repos/jgwill/miadi-orchestration-kit/codex/miadi-medicine-wheel-orchestration-kit
```

## Claude Code export

Target folder:

```text
claude/miadi-medicine-wheel-orchestrator/
  .claude-plugin/
    plugin.json
  README.md
  agents/
    medicine-wheel-orchestration-steward.md
    fire-keeper-boundary-reviewer.md
    rise-spec-advisor.md
  commands/
    medicine-wheel-orient.md
    medicine-wheel-status.md
  skills/
    medicine-wheel-session-orient/SKILL.md
    medicine-wheel-fire-keeper-gate/SKILL.md
    medicine-wheel-rise-spec-advisor/SKILL.md
```

Launch shape:

```bash
claude \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /workspace/repos/jgwill/medicine-wheel \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/claude/miadi-medicine-wheel-orchestrator
```

Claude-specific boundary:

- Commands may read live context through shell blocks.
- Agents should review and prepare, not implement, unless a later operator
  request explicitly grants implementation scope.
- If using an MCP config, record the exact config path in the source ledger.

## Gemini export

Target folder:

```text
gemini/miadi-medicine-wheel-session-prep/
  gemini-extension.json
  README.md
  GEMINI.md
  skills/
    medicine-wheel-session-orient/SKILL.md
    medicine-wheel-fire-keeper-gate/SKILL.md
    medicine-wheel-rise-spec-advisor/SKILL.md
  commands/
    medicine-wheel/
      orient.toml
      status.toml
```

Extension sketch:

```json
{
  "name": "miadi-medicine-wheel-session-prep",
  "version": "1.0.0",
  "description": "Gemini-native Medicine Wheel session preparation for Miadi orchestration work.",
  "contextFileName": "GEMINI.md"
}
```

Validation:

```bash
gemini extensions validate gemini/miadi-medicine-wheel-session-prep
gemini extensions link gemini/miadi-medicine-wheel-session-prep
gemini extensions list
```

Gemini-specific boundary:

- Use Gemini extension language, not Copilot `--plugin-dir` language.
- Recommend exact extension validation/link commands.
- Add MCP config only when the implementation needs executable Medicine Wheel
  tool access inside Gemini.

## Generic MCP-aware export

Target folder:

```text
generic/medicine-wheel-orchestration-adapter/
  README.md
  adapter-contract.md
  skills/
    session-orient.md
    fire-keeper-gate.md
    rise-spec-advisor.md
  templates/
    medicine-wheel-session.yaml
    source-ledger.md
```

Use this shape for harnesses that do not have stable plugin packaging yet.

## Shared output artifacts

Each implementation should be able to create:

```text
.pde/<tlid>--<uuid>/
  medicine-wheel-session-charter.md
  medicine-wheel-source-ledger.md
  medicine-wheel-runtime-health.md
  medicine-wheel-gate-report.md
  RISE-WAVE-PLAN.md
  HANDOFF.md
```

## Read-only smoke test

A first implementation should pass this without mutating Medicine Wheel state:

1. Read active workspace instructions.
2. Probe Medicine Wheel API health if configured.
3. List MCP tools if available.
4. Classify a sample mission by Four Directions.
5. Produce a source ledger naming claims as observed, inferred, or future.
6. Report issue #64, #65, #66, and #67 caveats.

## Write-path test

Only after explicit operator approval, test a write-capable path:

1. Create a `.pde/<tlid>--<uuid>/` artifact folder.
2. Write session charter and source ledger.
3. Run Fire Keeper gate against the proposed write.
4. Keep `act`-tier work human-approved.
5. Record changed files and validation commands in handoff.
