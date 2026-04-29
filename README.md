# miadi-orchestration-kit

Miadi-native Copilot orchestration assets for resumable STCKin and deep-search waves.

## Included kits

| Kit | Purpose | Path |
| --- | --- | --- |
| STCKin Orchestration Kit | First-wave Miadi plugin with bootstrap, kit-scaffolding, artefact reporting, and orchestration agents. | `copilot/stckin-orchestration-kit` |
| Miadi Promotion Context Kit | Promotion-boundary review for deciding what stays provenance, becomes spec, or remains context-layer only. | `copilot/miadi-promotion-context-kit` |
| Miadi Adversarial Review Kit | Dissenting review kit for RISE separation, outcome drift checks, and revision pressure. | `copilot/miadi-adversarial-review-kit` |

## Reusable operator skills

| Skill | Purpose | Path |
| --- | --- | --- |
| `deep-research` | Multi-agent research orchestration pattern used as a source reference for decomposition and synthesis. | `skills/deep-search/SKILL.md` |
| `use-design-bundle-integration-kit` | Main-session conductor skill for running design-bundle integration waves with an existing plugin kit. | `skills/use-design-bundle-integration-kit/SKILL.md` |
| `miadi-mightyeagle-issue-263` | Issue-aware conductor skill for the issue-263-derived security-remediation first wave: reusable rispecs plus an operational resume/review contract. | `skills/miadi-mightyeagle-issue-263/SKILL.md` |

## Reusable RISE outputs

- `rispecs/security-remediation-orchestration/` — reusable reverse-engineer, intent, specification, export, and provenance docs extracted from the issue-263 security-remediation evidence set.

## Launch patterns

### Core STCKin launch

```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /workspace/repos/miadisabelle/mia-awesome-copilot \
  --add-dir /src/Miadi
```

### Security-remediation review stack

Compose the existing kits instead of creating a new plugin:

```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-promotion-context-kit \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-adversarial-review-kit \
  --plugin-dir /workspace/repos/miadisabelle/mia-awesome-copilot/plugins/software-engineering-team \
  --plugin-dir /workspace/repos/miadisabelle/mia-awesome-copilot/plugins/context-engineering \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir <active-issue-workspace> \
  --add-dir <active-issue-orchestration-folder> \
  --add-dir /src/Miadi \
  --add-dir /workspace/repos/miadisabelle/mia-awesome-copilot
```

Use the issue-specific skill and rispec together for the first wave:

- `skills/miadi-mightyeagle-issue-263/SKILL.md`
- `rispecs/security-remediation-orchestration/`

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
3. Keep the security-remediation first wave as rispec + skill, with review carried by existing promotion, adversarial, context, and security-review kits.
4. Keep Miadi-specific logic in prompt assets and artefact notes, not in broad edits to `/src/Miadi`.
