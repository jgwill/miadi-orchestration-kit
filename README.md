# miadi-orchestration-kit

Miadi-native Copilot orchestration assets for resumable STCKin and deep-search waves.

## Included kits

| Kit | Purpose | Path |
| --- | --- | --- |
| STCKin Orchestration Kit | First-wave Miadi plugin with bootstrap, kit-scaffolding, artefact reporting, and orchestration agents. | [`copilot/stckin-orchestration-kit`](copilot/stckin-orchestration-kit) |
| Miadi Promotion Context Kit | Promotion-boundary review for deciding what stays provenance, becomes spec, or remains context-layer only. | [`copilot/miadi-promotion-context-kit`](copilot/miadi-promotion-context-kit) |
| Miadi Adversarial Review Kit | Dissenting review kit for RISE separation, outcome drift checks, and revision pressure. | [`copilot/miadi-adversarial-review-kit`](copilot/miadi-adversarial-review-kit) |
| Miadi Orchestration Kit — Hermes Closure Layer | Hermes-facing launch/closure governance: machine-readable payloads, lane contracts, validation scripts, transcript audit, commit partitioning, and Chronicle event gates. | [`copilot/miadi-orchestration-kit-hermes`](copilot/miadi-orchestration-kit-hermes) |
| Miadi Storyweaver Orchestration Kit | Story, Chronicle episode, voice packet, visual prompt packet, foundations bridge, review, continuity, protocol, and export orchestration. | [`copilot/miadi-storyweaver-orchestration-kit`](copilot/miadi-storyweaver-orchestration-kit) |
| Miadi Design Bundle Integration Kit | Integrating Claude Design bundles into target codebases with token codification and fidelity audits. | [`copilot/miadi-design-bundle-integration-kit`](copilot/miadi-design-bundle-integration-kit) |
| Miadi Wave Forge Kit | Turning user desire and target directories into ready-to-run orchestration bash scripts. | [`copilot/miadi-wave-forge-kit`](copilot/miadi-wave-forge-kit) |
| OpenClaw Model-Routing Research Kit | Launch surface for model-routing study, RISE scaffolding, and integration handoffs. | [`copilot/openclaw-model-routing-research-kit`](copilot/openclaw-model-routing-research-kit) |

## Companion exports

| Companion | Purpose | Path |
| --- | --- | --- |
| Gemini Storyweaver Companion | Lightweight Gemini CLI prompt contract mirroring the Storyweaver pipeline. | [`gemini/miadi-storyweaver-orchestration-kit`](gemini/miadi-storyweaver-orchestration-kit) |
| Claude Code Storyweaver Companion | Lightweight Claude Code prompt contract for smoke checks and session bootstrap routing. | [`claude-code/miadi-storyweaver-orchestration-kit`](claude-code/miadi-storyweaver-orchestration-kit) |
| Codex Storyweaver Plugin | Codex-native plugin with Storyweaver skills, agent references, and templates. | [`codex/miadi-storyweaver-orchestration-kit`](codex/miadi-storyweaver-orchestration-kit) |
| Gemini Session Prep Extension | Repeatable session preparation ritual for reliable Miadi orchestration work in Gemini. | [`gemini/miadi-gemini-session-prep`](gemini/miadi-gemini-session-prep) |
| Codex Orchestration Kit | Codex-native workflows for session control, bootstrap, and chartering. | [`codex/miadi-codex-orchestration-kit`](codex/miadi-codex-orchestration-kit) |

## Reusable operator skills

| Skill | Purpose | Path |
| --- | --- | --- |
| `deep-research` | Multi-agent research orchestration pattern used as a source reference for decomposition and synthesis. | [`skills/deep-search/SKILL.md`](skills/deep-search/SKILL.md) |
| `use-design-bundle-integration-kit` | Main-session conductor skill for running design-bundle integration waves with an existing plugin kit. | [`skills/use-design-bundle-integration-kit/SKILL.md`](skills/use-design-bundle-integration-kit/SKILL.md) |
| `miadi-mightyeagle-issue-263` | Issue-aware conductor skill for the issue-263-derived security-remediation first wave: reusable rispecs plus an operational resume/review contract. | [`skills/miadi-mightyeagle-issue-263/SKILL.md`](skills/miadi-mightyeagle-issue-263/SKILL.md) |

## Major RISE Specifications

Major envisioned and existing RISE Framework specifications for orchestration kits.

| Rispec | Purpose | Path |
| --- | --- | --- |
| Miadi Storyweaver Orchestration Kit | Copilot-first storytelling orchestration specs for story agents, skills, state, review gates, and export packets. | [`rispecs/miadi-storyweaver-orchestration-kit`](rispecs/miadi-storyweaver-orchestration-kit) |
| Agent Memory Provenance Framework | Specs for carrying auditable memory across sessions and model swaps without turning context into false authority. | [`rispecs/agent-memory-provenance-framework`](rispecs/agent-memory-provenance-framework) |
| Codex Claw Dispatch Kit | Plugin surface for dispatching bounded missions between agents (Claws) through Gaia endpoints. | [`rispecs/codex-claw-dispatch-kit`](rispecs/codex-claw-dispatch-kit) |
| EAST PDE Session Orchestration | Turning prompt or hook events into PDE session charters, plugin recommendations, and chronicle seeds. | [`rispecs/east-pde-session-orchestration`](rispecs/east-pde-session-orchestration) |
| Orchestration Plugin Recommender | Turning work context into recommended Copilot plugin launch scripts and explaining the "why" behind each plugin choice. | [`rispecs/orchestration-plugin-recommender`](rispecs/orchestration-plugin-recommender) |
| Claude Session Orchestrator Plugin | Complementary review role for plan-insight pipelines: gap reports, revision prompts, and audit contracts. | [`rispecs/claude-session-orchestrator-plugin`](rispecs/claude-session-orchestrator-plugin) |
| Security Remediation Orchestration | Reusable RISE outputs extracted from the issue-263 security-remediation evidence set. | [`rispecs/security-remediation-orchestration`](rispecs/security-remediation-orchestration) |

## Reusable RISE outputs

Additional RISE artefacts and patterns:

- [`rispecs/agent-memory-provenance-framework/`](rispecs/agent-memory-provenance-framework/) — memory record auditing, confidence levels, and human confirmation state.
- [`rispecs/permission-scoping-orchestration/`](rispecs/permission-scoping-orchestration/) — evidence-led intent for permission scoping across model-routing waves.
- [`rispecs/openclaw-runtime-patterns/`](rispecs/openclaw-runtime-patterns/) — observed and envisioned runtime patterns for OpenClaw model routing.


## Launch patterns

### Codex Storyweaver launch

After the kit is available on the local `main` checkout:

```bash
codex plugin marketplace add /workspace/repos/jgwill/miadi-orchestration-kit/codex/miadi-storyweaver-orchestration-kit
```

Then invoke one of the Storyweaver skills from Codex, for example:

```text
Use storyweaver-session-bootstrap to create a workspace for this premise.
```

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
