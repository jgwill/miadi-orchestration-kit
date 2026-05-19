---
name: miadi-source-ledger
description: Use when claims, context, rispec decisions, memory candidates, plugin-readiness decisions, or synthesis outputs need explicit source evidence, confidence, contradiction status, and promotion state.
---

# Miadi Source Ledger

Use this skill to keep evidence separate from inference. It is appropriate for
research, session planning, rispec review, closeout, and memory-provenance
preflight. It does not perform memory write-back.

## Claim status vocabulary

Use the narrowest status that fits:

- `observed`: directly supported by a cited path or command output.
- `inferred`: reasoned from evidence but not directly stated.
- `user-confirmed`: explicitly confirmed by the human in this conversation.
- `provisional`: plausible but awaiting more evidence.
- `contradicted`: conflicting evidence exists.
- `deprecated`: retained for audit, no longer active.

## Required fields

Each ledger row must include:

| Field | Requirement |
| --- | --- |
| `id` | Stable row id such as `C001`. |
| `claim` | Narrow claim, not a broad summary. |
| `status` | One of the status values above. |
| `confidence` | `low`, `medium`, or `high` with reason. |
| `source` | Exact path, URL, command, transcript pointer, or confirmation event. |
| `observed_at` | Date or timestamp when evidence was inspected. |
| `scope` | Where this claim may be reused. |
| `promotion` | `none`, `candidate`, `approved`, `blocked`, or `deferred`. |
| `notes` | Contradictions, caveats, or next evidence needed. |

## Workflow

1. Create or open `SOURCE_LEDGER.md` in the active artifact folder.
2. Add one row per claim. Do not combine unrelated claims.
3. Mark inferred claims clearly and include the inference rationale.
4. If evidence conflicts, keep both claims and mark each affected row.
5. Before synthesis, list:
   - claims cleared for synthesis,
   - claims still provisional,
   - contradictions,
   - evidence gaps.

## Promotion gates

A claim can be promoted only when:

- source is exact enough for another agent to verify,
- confidence is medium or high,
- contradiction status is resolved or explicitly accepted,
- scope is named,
- user confirmation is present when the claim concerns user preference, identity,
  memory, authority, or external action permission.

## Output contract

When complete, report:

- ledger path,
- rows added or changed,
- claims blocked from promotion,
- contradictions requiring human or future-agent review.
