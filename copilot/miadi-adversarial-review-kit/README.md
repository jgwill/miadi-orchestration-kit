# Miadi Adversarial Review Kit

Deliberately skeptical review and revision orchestration for Miadi waves that must survive more than a friendly reread.

This kit exists to pressure-test work before it is promoted, not to help it sound finished. It compares the active draft or implementation against the originating ask, provenance artefacts, nearby rispecs, wiki targets, and the intended STCKin/context-layer outcomes.

## Use this kit when

- a wave needs dissent, not encouragement
- a draft may have drifted from its originating prompt or issue
- promotion into spec or wiki form is being considered
- STCKin or context-layer claims need to be checked against what the corpus actually says

## Review contract

Every serious review should try to assemble these layers:

1. originating prompt, issue, or session charter
2. provenance artefacts from the active deep-search or PDE folder
3. implementation or draft surfaces under review
4. nearby rispecs and companion docs
5. wiki targets or promotion claims
6. explicit STCKin and context-layer outcome statements

If a layer is missing, say so as a review limitation instead of silently assuming alignment.

## Included surfaces

| Surface | Role |
| --- | --- |
| `miadi-adversarial-reviewer` | Runs the main dissenting review and issues promotion vetoes when evidence is weak. |
| `rise-revision-critic` | Forces Reverse Engineering, Intent extraction, Specification fit, and Export readiness to stay separate. |
| `context-outcome-auditor` | Checks whether STCKin and context-layer outcomes were actually met or only implied. |
| `adversarial-rise-review` | Review pipeline for evidence gathering, contradiction finding, and revision scoping. |
| `artefacted-revision-report` | Writes replayable review notes for later RISE and wiki waves. |
| `outcome-drift-audit` | Audits outcome drift against STCKin/context-layer intent before promotion. |

## Standard launch

Before launching, prefer to work from:
- `/workspace/repos/jgwill/miadi-orchestration-kit/.github/copilot-instructions.md` for durable orchestration behavior
- `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/session-charter-template.md` for the per-wave prompt skeleton


```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-adversarial-review-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /src/Miadi \
  --add-dir /workspace/wikis/Miadi \
  --add-dir /src/IAIP/prototypes/artefacts/deep-search--Miadi-STCKIN--copilot-orchestration-kit--2604251232--a4b4ed72-13a4-453d-9585-1c2fbcc5533a \
  --add-dir /src/IAIP/prototypes/artefacts/deep-search--karpathy--LLM-Wiki--and--RISE-Framework--QMD-Episodic--implication--2604210620--c08d048c-8710-439f-b1a2-542d3ed39df5 \
  --add-dir /src/IAIP/prototypes/artefacts/deep-search--CTXL--Context-Layers-in-Agentic-AI--Semantic-Layers--Ontologies--Provenance--and--Decision-Memory--2604230252--b1708f9f-328f-4fa0-b775-16c45b7c5d85
```

## Expected outputs

- evidence ledger with exact paths
- contradictions and overclaims, named explicitly
- revision brief grouped by severity
- promotion status: `BLOCK`, `HOLD`, or `ADVANCE WITH CONDITIONS`
- artefact-friendly markdown note in the active artefact folder when one is available
- execution method note stating whether subordinate lanes/subagents were used

## Recommended lane split

For bigger waves, do not keep all inspection in one main pass.
Use subordinate lanes for at least:
- provenance and artefact reading
- implementation and rispec comparison
- wiki/promotion claim checking

Keep the main session focused on synthesis, vetoes, and final revision prioritization.

## Cheap smoke test

```bash
tmpdir=$(mktemp -d)
cd "$tmpdir"
copilot --model gpt-5-mini --reasoning-effort high --yolo --no-ask-user \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-adversarial-review-kit \
  --add-dir /src/Miadi \
  --add-dir /workspace/wikis/Miadi \
  -p "Name this kit's review surfaces, then explain how it would block premature promotion of a weak Miadi draft."
```
