# Specify

This document defines the durable execution contract for security-remediation orchestration.

## Required reading order

Before editing or delegating:

1. the live issue review document,
2. the issue-specific orchestration folder,
3. the current `EXECUTION_LOG.md` or equivalent live state tracker,
4. the latest review findings already produced for the issue,
5. the RISE reference,
6. the relevant Miadi kit guidance,
7. this rispec folder.

## Path classes

Treat paths as belonging to one of these classes:

| Class | Role |
| --- | --- |
| Issue workspace | Live evidence and branch-local execution traces |
| Kit repo | Reusable orchestration knowledge |
| Canonical Miadi source | Broader STC and Miadi pattern references |
| Source plugin repo | Packaging and prompt conventions to adapt, not copy blindly |

## Wave sequence

### Wave 0 - Read and classify

Required outputs:

- a surface cluster map,
- a foundational move,
- a short statement of what is reusable vs issue-specific.

### Wave 1 - Reverse-engineer issue evidence

Required outputs:

- reusable orchestration patterns,
- issue-specific details that must not be generalized,
- a first pass at the lane model.

### Wave 2 - Specify the contract

Required outputs:

- subagent/lane contract,
- review loop contract,
- deliverables contract,
- blocked-state handling,
- implementer-to-review handoff contract.

### Wave 3 - Export execution patterns

Required outputs:

- launch recipe,
- resume recipe,
- audit recipe,
- report template,
- handoff instructions.

### Wave 4 - Review, revise, and promotion-boundary check

Required outputs:

- adversarial review findings,
- revision changes,
- statement of what remains artefact-only,
- statement of what was promoted into rispec/skill form.

## Lane contract

Every lane must declare minimum inputs, exit artefacts, and handoff trigger.

### Coordinator lane

| Field | Contract |
| --- | --- |
| Owns | reading order, path ledger, wave decomposition, delegation, issue linkage, blocker classification |
| Minimum inputs | issue review, issue orchestration folder, current execution log, latest review findings, rispec folder |
| Exit artefacts | wave scope statement, exact paths read, agent delegation plan, next handoff target |
| Handoff trigger | once the next lane has exact scope, paths, and success criteria |
| Does not own | self-approving implementation quality |

### Context architecture lane

| Field | Contract |
| --- | --- |
| Owns | file/surface mapping, dependency awareness, scope boundaries for each wave |
| Minimum inputs | issue review, issue plan, current repo surfaces, coordinator scope statement |
| Exit artefacts | surface map, dependency map, out-of-scope list |
| Handoff trigger | when the implementer or synthesis lane can act without rediscovering dependencies |
| Recommended agent | `context-engineering:context-architect` |

### Implementer lane

| Field | Contract |
| --- | --- |
| Owns | repository changes, tests, exploit-regression updates, implementation notes |
| Minimum inputs | scoped file list, acceptance criteria, prior exploration findings, exact tests to run or create |
| Exit artefacts | changed files, test evidence, exploit-regression evidence, unresolved risks, sanitized implementation handoff |
| Handoff trigger | after implementation is complete enough for independent review and includes evidence, not just claims |
| Does not own | final approval, promotion decisions, dismissing review findings unilaterally |

### Synthesis lane

| Field | Contract |
| --- | --- |
| Owns | converting issue evidence into reusable orchestration findings, preserving provenance, proposing replayable launch patterns |
| Minimum inputs | issue artefacts, current rispec drafts, source ledger, latest review findings |
| Exit artefacts | revised rispec/skill text with claim-level provenance and issue-bound examples clearly labeled |
| Handoff trigger | when security and RISE reviewers can test the promoted claims directly |
| Recommended agent | `stckin-orchestration-kit:miadi-deep-search-synthesizer` |

### Security review lane

| Field | Contract |
| --- | --- |
| Owns | exploitability review, auth and boundary checks, missing validation, redaction/sanitization review |
| Minimum inputs | changed files, test evidence, exploit-regression evidence, implementation handoff, latest execution log |
| Exit artefacts | findings categorized as fix/defer/reject, required tests, security review scope coverage |
| Handoff trigger | when findings clearly state what must change, what can wait, and what evidence supports each call |
| Review scope | include prompt injection, tool abuse, memory poisoning, model/data leakage, secret/header/payload exposure, authz gaps, shell/path/SSRF surfaces |
| Recommended agent | `software-engineering-team:se-security-reviewer` |

### Dissenting RISE review lane

| Field | Contract |
| --- | --- |
| Owns | checking whether reverse engineering, intent, specification, and export remain distinct; checking whether reusable claims are supported by evidence; checking for outcome drift |
| Minimum inputs | current rispecs, source ledger, latest revision notes |
| Exit artefacts | explicit R/I/S/E boundary findings plus revision asks |
| Handoff trigger | when revision work can be executed without reinterpreting the critique |
| Recommended agent | `miadi-adversarial-review-kit:rise-revision-critic` |

### Promotion boundary lane

| Field | Contract |
| --- | --- |
| Owns | deciding what stays issue evidence, what stabilizes into reusable spec, and whether a new plugin is warranted |
| Minimum inputs | revised rispec/skill set, source ledger, issue-local evidence references, latest review results |
| Exit artefacts | keep/promote/defer decisions with rationale and provenance |
| Handoff trigger | when export guidance can reflect the final boundary honestly |
| Recommended agent | `miadi-promotion-context-kit:miadi-promotion-architect` |

## Review loop contract

The minimum review loop is:

1. draft or implementation handoff,
2. security review,
3. RISE/dissent review for reusable assets,
4. revise,
5. promotion-boundary check if reusable scope changed,
6. final export update if review changed the launch or resume contract.

No wave is complete if the review findings are merely recorded. They must either:

- be fixed,
- be explicitly deferred with rationale,
- or be rejected with evidence.

Implementer output must be handed to review lanes as a separate package: changed files, tests run, exploit-regression results, known gaps, and redaction notes.

## Deliverables contract

Every completed orchestration wave should leave:

- exact paths read,
- exact files changed,
- the subagents used,
- the lane owner that produced the output,
- test evidence and exploit-regression results, or an explicit statement that none were applicable,
- the commands needed to resume,
- the next wave entry point,
- blocker/defer/reject status with rationale,
- confirmation that secrets, tokens, headers, payloads, and customer data were redacted or sanitized in reports.

## Failure and blocked-state handling

If blocked:

1. record the blocker with exact path and reason,
2. do not silently narrow the scope,
3. leave the next safe relaunch command,
4. state whether the blocker is:
   - missing context,
   - missing permissions,
   - unresolved design choice,
   - failing review,
   - or unrelated repo dirtiness.
5. state whether the blocker stops implementation, review, promotion, or only reporting.

## Promotion boundary

Use this split:

| Belongs in issue artefacts | Belongs in reusable rispecs/skills |
| --- | --- |
| Raw vulnerability findings | Reusable wave model |
| Branch-local execution logs | Reusable launch and audit contract |
| Temporary TODO IDs | Reusable lane model |
| One-off workaround notes | Durable review loop |
| Exact current branch tactics | Stable path/reference conventions |

Do not create a new plugin folder until repeated use confirms a stable reusable behavior set beyond issue 263.
