# Copilot orchestration substrate for Miadi waves

Use these instructions when Copilot is launched from this repository for Miadi, STCKin, RISE, provenance, context-layer, or wiki work.

## 1. Treat the context layer as four parts

1. Orchestration substrate
   - this file
   - plugin README and agent/skill definitions
2. Session charter
   - the per-run prompt file
   - must name the mission, roots, artefact folder, and output contract
3. Lane contract
   - explicit subordinate lanes/subagents
   - preserves the main lane for synthesis and final decisions
4. Artefact ledger
   - replayable markdown note/report with exact evidence paths

Do not collapse all four parts into a single chatty prompt.

## 2. When subordinate lanes are mandatory

Use subordinate lanes when two or more of these are in scope:
- provenance or deep-search artefacts
- implementation/code changes
- rispec/spec documents
- wiki targets or promotion decisions
- context-layer / retrieval / ontology / decision-memory boundaries

If you do not use subordinate lanes in a multi-surface wave, explain why in the final report.

## 3. Default lane patterns

### Adversarial / review wave
- Lane A: provenance and artefact reading
- Lane B: implementation and rispec comparison
- Lane C: wiki or promotion-claim checking
- Main lane: synthesis, vetoes, severity ranking, final recommendation

### Promotion / context-layer wave
- Lane A: source-trace and provenance inventory
- Lane B: spec vs context-layer boundary check
- Lane C: wiki draft shaping and cross-link review
- Main lane: promotion matrix and keep/promote/defer decisions

## 4. Main-lane preservation rule

The main lane should not read every raw file if subordinate lanes can inspect and summarize first.
Use subordinate lanes to absorb detail.
Use the main lane to compare, decide, and compose final outputs.

## 5. Required output sections

Every serious wave should end with:
- Scope reviewed
- Evidence checked
- Execution method
- Subagents or task lanes used
- Context-preservation notes
- Final decision / blockers / next actions

## 6. Context-pollution discipline

Name any extra context that influenced the run, including:
- unrelated AGENTS.md or instruction files
- unrelated plugin or skill inventories
- broad workspace mounts that were unnecessary

If pollution is detected, tighten the next wave:
- fewer `--add-dir` roots
- more explicit lane boundaries
- a cleaner launch directory
- a more explicit session charter

## 7. Promotion discipline

Do not promote material just because it sounds coherent.
Keep provenance, spec, wiki, and context-layer concerns distinct.
Defer when evidence is thin.

## 8. Audit expectation

After the main wave, expect a cheap `--resume --model gpt-5-mini` audit asking:
- whether subordinate lanes were actually used
- what each lane inspected
- whether the main lane stayed clean
- what to improve next time

Write the main wave so that this audit can be answered concretely.