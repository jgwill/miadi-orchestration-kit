# miadi-wave-forge-kit

A Miadi-native Copilot plugin that turns a user's desire (plus target directories) into a ready-to-run orchestration bash script.

**How it works:**
1. `copilot_prepare_orchestration` runs a fast **bash scan** of target dirs, kits, and all agents (~2 seconds, no AI)
2. Writes `scan-context.md` + `prompt.md` into a **PDE working folder** at `.pde/<yyMMddHHmm>--<uuid>/`
3. Launches **one focused copilot session** via `@.pde/.../prompt.md` — direct forge, no background subagents
4. Copilot writes `orchestration-<slug>-<date>.sh` into the PDE folder
5. On failure, the PDE folder is preserved for one-command retry

---

## Quick start

```bash
source /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-wave-forge-kit/scripts/copilot_prepare_orchestration.sh

copilot_prepare_orchestration "refactor Ava Decomposer Studio and its ava-*js packages" \
  /workspace/repos/avadisabelle/Ava-Decomposer-Studio \
  /workspace/repos/avadisabelle/ava-langchainjs
```

If the session ends without writing the script, retry with:

```bash
copilot --add-dir '.pde/<ts>--<uuid>' -p '@.pde/<ts>--<uuid>/prompt.md'
```

---

## Manual / interactive use

Skills (`scan-and-plan`, `review-wave-plan`, `forge-wave-script`, `resume-wave-prep`) remain available for interactive Copilot sessions when you want fine-grained control:

```bash
copilot \
  --model claude-sonnet-4.6 \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-wave-forge-kit \
  --add-dir /workspace/repos/avadisabelle/Ava-Decomposer-Studio \
  -p "Use scan-and-plan then review-wave-plan then forge-wave-script for: refactor Ava Decomposer Studio"
```

Note: the skill chain runs background subagents sequentially — prefer `copilot_prepare_orchestration` for unattended use.

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
| `resume-wave-prep` | Resumes an interrupted wave-forge session. Locates the most recent `.pde/` folder and retries the forge from the preserved `prompt.md`. |

---

## Example flow

```
$ copilot_prepare_orchestration "add integration tests to ava-langchainjs" \
    /workspace/repos/avadisabelle/ava-langchainjs

[wave-forge] PDE working folder : /workspace/wikis/.pde/2605281015--<uuid>/
[wave-forge] Scanning directories...
[wave-forge] Scan context       : scan-context.md (287 lines)
[wave-forge] Prompt             : prompt.md (195 lines)
[wave-forge] Launching copilot...  (direct forge — no subagents)
────────────────────────────────────────────────────────────────────────────────
  copilot writes orchestration-add-integration-tests-ava-260528.sh directly
────────────────────────────────────────────────────────────────────────────────
[wave-forge] ✓ Script created: .pde/2605281015--<uuid>/orchestration-add-integration-tests-ava-260528.sh

$ bash .pde/2605281015--<uuid>/orchestration-add-integration-tests-ava-260528.sh
```

**If copilot ends the session before writing the script**, the PDE folder is intact — retry:
```bash
copilot --add-dir '.pde/<ts>--<uuid>' -p '@.pde/<ts>--<uuid>/prompt.md'
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
