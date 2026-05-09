# Reverse-Engineer

This document reconstructs what the security-remediation evidence set around `jgwill/Miadi#263` actually shows.

It does **not** define the desired future, durable contract, or export behavior. Those belong in later RISE stages.

## Source surfaces inspected

- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/review-security-vulnerability-260429.md`
- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/ORCHESTRATION_PLAN.md`
- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/QUICKSTART.md`
- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/EXECUTION_LOG.md`
- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/COORDINATOR_SUMMARY.md`
- `/usr/local/src/263-miadi-vulnerabilities-260429/llms/llms-rise-framework.txt`
- `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/AGENTS.md`

## Evidence-backed observations

| Claim reconstructed from evidence | Evidence surfaces |
| --- | --- |
| Issue 263 is framed as a multi-surface remediation effort rather than a single-file fix. | Security review plus `ORCHESTRATION_PLAN.md` phase breakdown and vulnerability matrix. |
| The execution model separates parallel exploration from sequential implementation. | `ORCHESTRATION_PLAN.md` "Subagent Orchestration Model" and `QUICKSTART.md` "Three-Phase Strategy" / execution workflow. |
| The issue workspace expects a live execution state tracker, not just a plan. | `QUICKSTART.md` step order and artifact list; `COORDINATOR_SUMMARY.md` references to `EXECUTION_LOG.md`; issue folder contents. |
| Review is a distinct phase after implementation and testing. | `ORCHESTRATION_PLAN.md` Subagents 15-16 and validation section. |
| The issue artefact tree is intentionally structured by exploration, implementation, validation, and architecture outputs. | `ORCHESTRATION_PLAN.md` artifact structure and issue folder contents. |

## What the issue evidence contains

From the inspected issue artefacts, the evidence set contains:

1. a foundational auth problem affecting many routes,
2. multiple remediation surfaces grouped into phases,
3. a plan that expects coordination across many subagents,
4. an execution log contract for resume and blocker tracking,
5. a final validation/review stage after implementation work.

## Surface clusters visible in the issue artefacts

The source review and orchestration plan repeatedly group work by surface cluster:

| Surface cluster | Typical concerns | Typical wave |
| --- | --- | --- |
| Auth foundation | route classification, fail-closed auth, public allowlists | Foundation |
| Execution and filesystem | agent execution, subprocesses, path traversal, command injection | Critical lock-down |
| Network boundaries | SSRF, proxying, outbound allowlists, QStash destinations | Critical lock-down |
| Ownership and data integrity | sessions, Redis-backed memory, job ownership, unguessable IDs | Data integrity |
| Provider callbacks and expensive jobs | webhook verification, SMS, AI/media quotas, background workers | Protection |
| Regression and review | exploitability checks, tests, adversarial dissent | Validation |

This table is a reconstruction of how the issue artefacts grouped the work. It is not yet a durable contract for future issues.

## Lane separation already implied by the issue evidence

The issue artefacts already imply distinct roles even before any reusable promotion:

- coordinator,
- exploration agents,
- implementation agents,
- validation / test agent,
- final review agent.

The evidence therefore supports the need for lane separation, but it does not by itself define a final reusable lane contract.

## Current-instance operator environment observations

While drafting this first wave, the working context also included:

- the reusable kit repo at `/workspace/repos/jgwill/miadi-orchestration-kit`,
- broader Miadi reference surfaces such as `/src/Miadi`,
- source plugin patterns from `/workspace/repos/miadisabelle/mia-awesome-copilot`.

These are **observations about the current operator environment**, not durable rules for every future run.

## Evidence that should stay issue-bound

The following details are present in the evidence and should remain issue-specific unless later stages justify promotion:

- exact vulnerability counts,
- the branch name `fix/security-vulnerabilities-263`,
- exact issue folder naming,
- exact todo IDs or SQL state,
- exact current plugin-dir and add-dir combinations,
- any assumption that auth is always the foundational move in future issues.

## Boundary of this document

This reverse-engineer stage stops at evidence reconstruction:

- what the issue artefacts contain,
- what they imply about sequencing and state tracking,
- what remains issue-bound,
- what current-instance environment details were merely observed.
