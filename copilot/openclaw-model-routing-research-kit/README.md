# OpenClaw Model-Routing Research Kit

Purpose-built Copilot plugin dir for the Miadi/OpenClaw model-routing study. It gives Iris/Hermes a reusable launch surface for study preflight, source ledgers, RISE rispec scaffolding, plugin-gap contracts, model-routing matrix work, and final integration handoffs.

## Included Agents

| Agent | Use |
| --- | --- |
| `openclaw-study-orchestrator` | Runs preflight, validates the launch manifest, enforces track order, scopes, token caps, and stop conditions. |
| `openclaw-source-ledger-reviewer` | Reviews claim ledgers, evidence quality, contradictions, and claim-to-source coverage before synthesis. |
| `openclaw-rispec-scaffold-reviewer` | Checks OpenClaw rispec folders against the RISE phase wording and the standard 5-file shape. |
| `openclaw-final-integrator` | Integrates track handoffs, source ledgers, routing matrix updates, plugin gaps, and acceptance status. |

## Included Skills

| Skill | Use |
| --- | --- |
| `openclaw-model-routing-bootstrap` | Fixed-order study bootstrap, launch manifest validation, write-scope discipline, token caps, issue links, and stop rules. |
| `openclaw-source-ledger` | Source ledger rules for evidence types, quality ratings, contradiction handling, and claim-to-source mapping. |
| `openclaw-rise-rispec-scaffold` | RISE scaffold process using `Reverse-engineer -> Intent-extract -> Specify -> Export`. |
| `openclaw-plugin-gap-contracts` | Reconciles missing plugin names and prevents live connector gaps from blocking read-only research. |
| `model-routing-policy-simulator` | Produces or revises the model-routing matrix from task, risk, context, cost, latency, and review constraints. |

## Included Templates

| Template | Use |
| --- | --- |
| `templates/launch-manifest.md` | Control file for track order, write paths, plugin dirs, add-dir paths, issue links, token caps, and stop conditions. |
| `templates/track-handoff.md` | Required closeout format for each delegated wave or Copilot track. |
| `templates/source-ledger.md` | Claim ledger with source type, evidence quality, contradictions, and verification status. |
| `templates/model-routing-matrix.md` | Seed model-routing matrix with required input and output columns. |
| `templates/acceptance-checklist.md` | Preflight and final acceptance checks for the study kit and track outputs. |

## Cheap Smoke Test

```bash
copilot --model gpt-5-mini --reasoning-effort high --yolo --no-ask-user \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/openclaw-model-routing-research-kit \
  --add-dir /workspace/repos/miadisabelle/workspace-openclaw \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  -p "List the loaded OpenClaw model-routing research kit agents and skills. Then identify the launch-manifest template path. Do not edit files."
```

## Next Launch Shape

```bash
cd /workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE

copilot --yolo \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/openclaw-model-routing-research-kit \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit \
  --add-dir /workspace/repos/miadisabelle/workspace-openclaw \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs \
  --add-dir /workspace/repos/miadisabelle/mia-awesome-copilot \
  --add-dir /workspace/repos/jgwill/llms-txt \
  -p "@/deep-research
TODAY: 2026-05-08
Use the OpenClaw model-routing research kit. First validate launch-manifest.md, source-ledger template, and rispec scaffold status. Launch only the approved track named in the manifest. Respect token caps and write scopes."
```

## Operating Scope

This kit is orchestration infrastructure. It does not implement live Discord, OpenClaw runtime, arXiv, web discovery, or GitHub code-search connectors. Those gaps are captured as contracts so the study can proceed with source ledgers and explicit mitigations.
