# Miadi Promotion Context Kit

Promotion and drafting orchestration for Miadi material that has already been reviewed and now needs a clean decision about what advances, what stays provenance, and what must remain outside the wiki.

This kit is not the adversarial critic. Its job is to route stable material across the promotion lifecycle:

`provenance -> spec -> wiki`

while keeping retrieval and context-layer concerns distinct from general wiki explanation.

## Use this kit when

- a review wave has ended and promotion decisions are needed
- you need to separate provenance, spec, wiki, and context-layer material
- you want artefact-friendly promotion records for later RISE or wiki drafting waves
- you need wiki-facing drafts that preserve what stays outside the wiki on purpose

## Layer contract

| Layer | What belongs there | What does not |
| --- | --- | --- |
| Provenance | raw artefacts, wave reports, source traces, unresolved findings | polished explanations pretending to be stable knowledge |
| Spec | stable intent, behavior, structure, lifecycle, boundaries | raw session evidence or vague wiki prose |
| Wiki | concise explanatory language, navigation, cross-links | raw provenance or spec replacement |
| Context-layer / retrieval | context assembly, provenance, lineage, ontology, decision-memory, MCP or graph-facing boundaries | generic wiki simplifications that hide retrieval concerns |

## Included surfaces

| Surface | Role |
| --- | --- |
| `miadi-promotion-architect` | Decides what moves forward, in what form, and why. |
| `wiki-promotion-curator` | Drafts concise wiki-facing material from already-reviewed evidence. |
| `context-layer-boundary-keeper` | Prevents retrieval/context-layer material from being flattened into the wiki. |
| `context-layer-promotion` | Promotion matrix for provenance, spec, wiki, and context-layer decisions. |
| `wiki-promotion-draft` | Draft contract for wiki-facing notes with explicit boundaries and omissions. |
| `promotion-decision-record` | Artefact-friendly markdown record for promotion choices and blockers. |

## Standard launch

Before launching, prefer to work from:
- `/workspace/repos/jgwill/miadi-orchestration-kit/.github/copilot-instructions.md` for durable orchestration behavior
- `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/session-charter-template.md` for the per-wave prompt skeleton


```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-promotion-context-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /src/Miadi \
  --add-dir /workspace/wikis/Miadi \
  --add-dir /src/IAIP/prototypes/artefacts/deep-search--Miadi-STCKIN--copilot-orchestration-kit--2604251232--a4b4ed72-13a4-453d-9585-1c2fbcc5533a \
  --add-dir /src/IAIP/prototypes/artefacts/deep-search--karpathy--LLM-Wiki--and--RISE-Framework--QMD-Episodic--implication--2604210620--c08d048c-8710-439f-b1a2-542d3ed39df5 \
  --add-dir /src/IAIP/prototypes/artefacts/deep-search--CTXL--Context-Layers-in-Agentic-AI--Semantic-Layers--Ontologies--Provenance--and--Decision-Memory--2604230252--b1708f9f-328f-4fa0-b775-16c45b7c5d85
```

## Expected outputs

- promotion decision matrix with exact evidence paths
- explicit keep / promote / defer decisions
- clear separation between wiki-facing explanation and context-layer retrieval concerns
- draftable markdown for later wiki waves
- reusable promotion notes that later sessions can pick up without guessing
- execution method note stating whether subordinate lanes/subagents were used

## Recommended lane split

For larger promotion waves, delegate at least:
- provenance and source-trace inspection
- spec and context-layer boundary checking
- wiki-draft shaping and cross-link review

Keep the main session responsible for the promotion matrix and final keep / promote / defer decisions.

## Cheap smoke test

```bash
tmpdir=$(mktemp -d)
cd "$tmpdir"
copilot --model gpt-5-mini --reasoning-effort high --yolo --no-ask-user \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-promotion-context-kit \
  --add-dir /src/Miadi \
  --add-dir /workspace/wikis/Miadi \
  -p "Explain how this kit decides whether Miadi material stays provenance, moves to spec, becomes wiki-facing, or should remain a context-layer note."
```
