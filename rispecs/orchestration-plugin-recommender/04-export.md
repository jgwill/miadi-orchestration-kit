# Export

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Current invocation

```bash
source /src/scripts/fn_llm.sh
pto_orchestration_plugins_recommender "./ is a python project + its MCP into ./mia_simexp_mcp/ and we will want to conceive a command like <command>mia-simexp skill install</command>"
```

## Optional invocation with extra context roots

```bash
source /src/scripts/fn_llm.sh
pto_orchestration_plugins_recommender "<work context>" \
  /workspace/repos/jgwill/miadi-orchestration-kit \
  /workspace/repos/miadisabelle/mia-awesome-copilot
```

## Handoff prompt for future agents

```text
Read the orchestration-plugin-recommender rispec.
Use the function `pto_orchestration_plugins_recommender` only as the executable seed.
Do not create a skill or Copilot plugin until repeated-use evidence supports the interface.
If you promote it, preserve the first-argument context contract and the `.pde/.../LAUNCH.copilot-orchestration.sh` output shape.
```

## Promotion options

| Option | When it fits |
| --- | --- |
| Keep shell function | The helper remains a personal/global convenience wrapper. |
| Promote to skill | Agents need instructions, examples, and policy around when to use the recommender. |
| Promote to Copilot plugin | Copilot needs bundled behavior, prompt files, or plugin-local orchestration affordances. |
| Promote to storytelling rispec | The main value becomes narrative memory of orchestration choices rather than launch execution. |

## Review gate

Any promotion should update `05-source-ledger.md` with concrete runs, launch scripts, selected plugin paths, reviewer notes, and any bad recommendations.

