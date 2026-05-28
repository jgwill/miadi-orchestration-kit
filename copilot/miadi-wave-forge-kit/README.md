# miadi-wave-forge-kit

A Miadi-native Copilot plugin that turns a user's refactoring or enhancement desire (plus a list of target directories) into a ready-to-run orchestration bash script. The kit scans available agents and plugins, designs a multi-phase wave plan, validates it adversarially, and forges the final `copilot` command — all without the user having to know which agents exist or how to compose them.

---

## Quick start

```bash
# Source the helper function
source /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-wave-forge-kit/scripts/copilot_prepare_orchestration.sh

# Launch a wave-forge session
copilot_prepare_orchestration "refactor Ava Decomposer Studio and its ava-*js packages" \
  /workspace/repos/avadisabelle/Ava-Decomposer-Studio \
  /workspace/repos/avadisabelle/ava-langchainjs
```

The function launches an interactive Copilot session that:
1. Scans the target directories and all available plugins/agents
2. Designs a multi-phase orchestration plan matched to the desire
3. Validates the plan adversarially
4. Writes `orchestration-<slug>-<date>.sh` in the current working directory

---

## Manual launch

If you want direct control over which kits are loaded:

```bash
copilot \
  --model claude-sonnet-4.6 \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-wave-forge-kit \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-adversarial-review-kit \
  --add-dir /workspace/repos/miadisabelle/mia-awesome-copilot \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /workspace/repos/avadisabelle/Ava-Decomposer-Studio \
  -p "Use scan-and-plan then review-wave-plan then forge-wave-script for: refactor Ava Decomposer Studio"
```

---

## What's included

### Agents

| Agent | Description |
|-------|-------------|
| `Orchestration Context Scanner` | Scans target directories and plugin sources. Produces a structured Scan Report (no recommendations — pure discovery). |
| `Orchestration Wave Planner` | Takes user desire + Scan Report. Selects agents and kits, designs numbered phases, produces a WavePlan document. |
| `Wave Script Forge` | Takes a WavePlan. Writes a complete executable bash script with a comprehensive self-contained PROMPT and the final `copilot` command. |

### Skills

| Skill | Description |
|-------|-------------|
| `scan-and-plan` | Orchestrates Scanner → Planner flow. Validates scan completeness before planning. Outputs WavePlan. |
| `review-wave-plan` | Adversarial review of a WavePlan: checks agent validity, path existence, desire alignment, issue/review/synthesis phase presence. Returns ADVANCE or REVISE. |
| `forge-wave-script` | Invokes Wave Script Forge on a validated WavePlan (requires ADVANCE verdict), verifies the script with `bash -n` + preflight check, reports path and first 50 lines. |
| `resume-wave-prep` | Resumes an interrupted wave-forge session. Reads prior WavePlan, review result, and generated script to determine whether to re-review, replan, or reforge. |

---

## Example session

```
User desire: "add comprehensive integration tests to the ava-langchainjs API layer"
Target dirs: /workspace/repos/avadisabelle/ava-langchainjs

[scan-and-plan]
  → Scanned 1 target dir: TypeScript monorepo, 4 packages, Jest configured, 12% coverage
  → Found 87 agents in mia-awesome-copilot, 6 kits in miadi-orchestration-kit
  → WavePlan: 5 phases, agents: arch, tdd-refactor, test-agent, agent-governance-reviewer, miadi-deep-search-synthesizer

[review-wave-plan]
  → Check 1 (agent validity): PASS
  → Check 2 (plugin paths): PASS
  → Check 3 (add-dir paths): PASS
  → Check 4 (desire alignment): PASS
  → Check 5 (issue creation): PASS
  → Check 6 (adversarial review): PASS
  → Check 7 (synthesis): PASS
  → Verdict: ADVANCE

[forge-wave-script]
  → Written: ./orchestration-add-integration-tests-ava-langchain-250115.sh
  → Syntax valid, executable

To run:
  bash ./orchestration-add-integration-tests-ava-langchain-250115.sh
```

---

## Structure

```
miadi-wave-forge-kit/
├── .github/plugin/plugin.json
├── agents/
│   ├── orchestration-context-scanner.md
│   ├── orchestration-wave-planner.md
│   └── wave-script-forge.md
├── skills/
│   ├── scan-and-plan/SKILL.md
│   ├── forge-wave-script/SKILL.md
│   └── review-wave-plan/SKILL.md
├── scripts/
│   └── copilot_prepare_orchestration.sh
└── README.md
```
