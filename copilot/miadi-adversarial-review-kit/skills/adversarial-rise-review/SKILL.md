---
name: adversarial-rise-review
description: 'Run a dissenting Miadi review that compares prompts, provenance, implementation, rispecs, wiki targets, and intended STCKin/context-layer outcomes before approving revision or promotion.'
---

# Adversarial RISE Review

Use this skill for Miadi waves where quality matters more than agreement.

## Do not start the review until you know

- what surface is under review
- what prompted it
- where the relevant provenance artefacts live
- which rispecs or adjacent specs govern it
- whether wiki or promotion claims are in play

If one of these is missing, say so in the review limitations.

## Review sequence

1. Build an `Evidence checked` ledger with exact paths.
2. Restate the intended outcome from source materials, not from the current draft alone.
3. List the actual implementation or draft surfaces reviewed.
4. Compare:
   - intent vs implementation
   - implementation vs rispec language
   - rispec language vs wiki framing
   - current claims vs provenance trail
   - current claims vs STCKin/context-layer outcome statements
5. Run the RISE lenses separately:
   - Reverse Engineering
   - Intent extraction
   - Specification fit
   - Export readiness
6. Classify each serious finding:
   - contradiction
   - omission
   - scope drift
   - overclaim
   - promotion leak
7. Propose revisions grouped by severity.
8. End with a promotion decision: `BLOCK`, `HOLD`, or `ADVANCE WITH CONDITIONS`.

## Severity guidance

- `High`: would mislead a later wave, spec, or wiki page
- `Medium`: leaves important ambiguity or weakens replayability
- `Low`: useful refinement but not promotion-blocking

## Output sections

- Intended outcome
- Current reality
- Evidence checked
- RISE review matrix
- Contradictions and drift
- Revision proposals
- Promotion status
- Execution method
- Subagents or task lanes used
- Context-preservation notes

In `Execution method`, say whether the work stayed in one agent or was split into subordinate lanes. If it was not split, say why.

Prefer exact claims, file paths, and quoted wording over broad summaries.
