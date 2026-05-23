---
name: review-plan
description: >
  Full plan-review cycle: read a proposed/ file, run 5-point gap analysis,
  create or update the jgwill/src tracking issue, output revision prompt.
  Use when the user says "review the plan", "check the proposal", or when
  a new proposed/ file has landed and needs analysis before the implementing
  agent gets the next prompt.
version: 0.1.0
---

# Review Plan Skill

This skill runs the full complementary-review cycle for a Miadi proposed plan file.

## Steps

1. **Locate the plan** — find the target `proposed/*.md` file (passed as argument or most recent)
2. **Read platform context** — check `/src/Miadi/app/api/` for existing routes that overlap
3. **Run gap analysis** — apply the 5-point checklist (payload, idempotency, failure path, write-back, naming)
4. **Check tracking issue** — search `jgwill/src` for an existing issue; create one if absent
5. **Output revision prompt** — paste-ready instructions for the implementing agent

## 5-Point Checklist

| # | Check | Pass condition |
|---|-------|---------------|
| 1 | `plan_content` inline | POST payload contains content, not just file path |
| 2 | Idempotency key | API deduplicates on `session_id + plan_filename` |
| 3 | Failure observability | Langfuse error trace on async failure, not just success |
| 4 | Write-back resolved | One of: return-content pattern OR explicit mount documented |
| 5 | Naming consistent | `plan_file` / `plan_filename` unified across schema + tables |

## Output contract

Always produce both:
- **Gap Report** (numbered, severity-tagged)
- **Revision Prompt** (under 250 words, paste-ready, references tracking issue)

Never implement. Never modify the proposed/ file directly. Hand the prompt to the user.
