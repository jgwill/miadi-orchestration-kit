# Export

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Future plugin folder

```text
/workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-east-pde-session-kit/
  README.md
  agents/
    east-session-orchestrator.md
    pde-source-ledger-reviewer.md
    native-plugin-independence-reviewer.md
  skills/
    east-pde-session-bootstrap/SKILL.md
    direction-classification/SKILL.md
    native-plugin-recommendation/SKILL.md
  .github/plugin/plugin.json
```

## Launch shape

```bash
copilot --yolo   --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-east-pde-session-kit   --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit   --add-dir /workspace/repos/jgwill/miadi-orchestration-kit   --add-dir /src/_sessiondata/<session-id>   -p "Classify the medicine-wheel direction, prepare a PDE session charter, and recommend native Miadi orchestration plugins. Do not execute the full wave."
```

## Output artifact shape

```text
.pde/<tlid>--<uuid>/
  DIRECTION.md
  PDE-SUMMARY.md
  SOURCE-LEDGER.md
  SESSION-CHARTER.md
  LAUNCH.copilot-orchestration.sh
  NARRATIVE-SEED.md
```

## Independence rule

The plugin may cite `mia-awesome-copilot/plugins` as source inspiration in the ledger, but its launch recommendation should first search and select from `miadi-orchestration-kit/copilot`. If an external plugin remains necessary, the report must name the missing native capability that should be specified next.

## Review gate

Do not implement the plugin until this RISpec has at least two more EAST observations or a direct operator instruction to scaffold it now. The current action is specification and voice-episode context preparation only.
