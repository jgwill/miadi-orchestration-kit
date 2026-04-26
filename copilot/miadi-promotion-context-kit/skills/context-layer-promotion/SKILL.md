---
name: context-layer-promotion
description: 'Evaluate reviewed Miadi material for promotion by separating provenance, spec, wiki, and context-layer concerns before drafting durable outputs.'
---

# Context-Layer Promotion

Use this skill when a review wave ends and some material may be ready to stabilize.

## Core rule

Do not confuse retrieval or context-layer material with general wiki explanation.

## Inputs to inspect

- `/src/Miadi/rispecs/context-layer.spec.md`
- `/src/Miadi/rispecs/context-layer.kin.md`
- `/workspace/wikis/Miadi/Promotion-Lifecycle.md`
- `/workspace/wikis/Miadi/Miadi-Rispecs-and-Context-Layer.md`
- relevant deep-search artefacts
- reviewed implementation notes or reports
- related wiki pages

## Promotion workflow

1. Build an evidence list with exact paths.
2. Extract candidate claims or concepts worth stabilizing.
3. For each candidate, decide one best home:
   - keep in provenance
   - promote to spec
   - promote to wiki
   - keep as context-layer note
   - defer
4. Check context-layer candidates against these boundaries:
   - Miadi is downstream of AvaLangStack here
   - the context layer sits closer to retrieval and composition than to the wiki
   - provenance, lineage, and decision-memory concerns should not be flattened into generic wiki prose
5. Produce a promotion matrix and name blockers.

## Output

- evidence checked
- promotion matrix
- blocked or deferred items
- draftable items for later spec or wiki work
- execution method
- subagents or task lanes used
- context-preservation notes

If the promotion work was done without subordinate lanes, say so explicitly and state what evidence breadth may have been lost.
