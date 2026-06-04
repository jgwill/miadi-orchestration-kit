# Export

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Future plugin folder

```text
/workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-east-pde-session-kit/
  README.md
  agents/
    east-session-orchestrator.md
    intent-analyst-adapter.md
    pde-strategy-selector.md
    pde-source-ledger-reviewer.md
    native-plugin-independence-reviewer.md
  skills/
    east-pde-session-bootstrap/SKILL.md
    intent-analyst-handoff/SKILL.md
    miaco-decompose-strategy/SKILL.md
    direction-classification/SKILL.md
    native-plugin-recommendation/SKILL.md
  .github/plugin/plugin.json
```

## Launch shape

```bash
copilot --yolo   --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-east-pde-session-kit   --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit   --add-dir /workspace/repos/jgwill/miadi-orchestration-kit   --add-dir /src/_sessiondata/<session-id>   -p "Classify the medicine-wheel direction, prepare a PDE session charter, and recommend native Miadi orchestration plugins. Do not execute the full wave."
```

## miaco decomposition shape

For layered, recursive, or lineage-heavy EAST starts, run a stored Intent Analyst decomposition before the implementation wave:

```bash
miaco decompose run \
  --prompt-file prompt.md \
  --engine copilot \
  --strategy iterative-refinement \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /workspace/repos/jgwill/llms-txt \
  --workdir /workspace/repos/jgwill/miadi-orchestration-kit \
  --meta '{"issue":"#37","parent_issue":"#24","role":"intent-analyst"}' \
  --format json
```

For child refinements, preserve lineage instead of overlaying the prior artifact:

```bash
miaco decompose run \
  --prompt-file prompt.md \
  --engine copilot \
  --strategy iterative-refinement \
  --parent <parent-pde-uuid> \
  --child-kind refinement \
  --workdir /workspace/repos/jgwill/miadi-orchestration-kit \
  --format json
```

Use `--strategy standard` for focused one-pass starts. Treat `--strategy adversarial-consensus` as experimental unless the parser and downstream artifact shape have been verified for the current session.

## Output artifact shape

```text
.pde/<tlid>--<uuid>/
  DIRECTION.md
  INTENT-READ.md
  STRATEGY-SELECTION.md
  PDE-SUMMARY.md
  LINEAGE.md
  SOURCE-LEDGER.md
  SESSION-CHARTER.md
  LAUNCH.copilot-orchestration.sh
  NARRATIVE-SEED.md
  MIACO-DECOMPOSE.json
```

## Independence rule

The plugin may cite `mia-awesome-copilot/plugins` as source inspiration in the ledger, but its launch recommendation should first search and select from `miadi-orchestration-kit/copilot`. If an external plugin remains necessary, the report must name the missing native capability that should be specified next.

The plugin may depend on `/workspace/repos/jgwill/llms-txt/skills/intent-analyst/` as portable guidance, but the future native kit must name that dependency in the source ledger and preserve parity with `miaco decompose run --help` rather than silently forking the role.

## Review gate

Do not implement the plugin until this RISpec has at least two more EAST observations or a direct operator instruction to scaffold it now. The current action is specification and voice-episode context preparation only.
