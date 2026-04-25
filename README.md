# miadi-orchestration-kit

Miadi-native Copilot orchestration assets for resumable STCKin and deep-search waves.

## Included kits

| Kit | Purpose | Path |
| --- | --- | --- |
| STCKin Orchestration Kit | First-wave Miadi plugin with bootstrap, kit-scaffolding, artefact reporting, and orchestration agents. | `copilot/stckin-orchestration-kit` |

## Launch patterns

### Core STCKin launch

```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /workspace/repos/miadisabelle/mia-awesome-copilot \
  --add-dir /src/Miadi
```

### Deep-search launch with current artefact folder

```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /workspace/repos/miadisabelle/mia-awesome-copilot \
  --add-dir /src/Miadi \
  --add-dir /src/IAIP/prototypes/artefacts/deep-search--Miadi-STCKIN--copilot-orchestration-kit--2604251232--a4b4ed72-13a4-453d-9585-1c2fbcc5533a \
  --add-dir /src/IAIP/prototypes/artefacts/deep-search--karpathy--LLM-Wiki--and--RISE-Framework--QMD-Episodic--implication--2604210620--c08d048c-8710-439f-b1a2-542d3ed39df5 \
  --add-dir /src/IAIP/prototypes/artefacts/deep-search--CTXL--Context-Layers-in-Agentic-AI--Semantic-Layers--Ontologies--Provenance--and--Decision-Memory--2604230252--b1708f9f-328f-4fa0-b775-16c45b7c5d85
```

## First-wave design choices

1. Reuse the existing `stckin-orchestration-kit` seed instead of fragmenting the repo with parallel kits too early.
2. Mirror `mia-awesome-copilot` packaging with markdown agents/skills plus `.github/plugin/plugin.json`.
3. Keep Miadi-specific logic in prompt assets and artefact notes, not in broad edits to `/src/Miadi`.
