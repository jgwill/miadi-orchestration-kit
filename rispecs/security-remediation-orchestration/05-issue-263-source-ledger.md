# Issue 263 Source Ledger

This ledger preserves provenance for the first-wave security-remediation orchestration extraction.

## Primary issue linkage

- Miadi issue: `https://github.com/jgwill/Miadi/issues/263`

## Issue workspace

- Working repo root: `/usr/local/src/263-miadi-vulnerabilities-260429`
- Issue orchestration folder: `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263`

## Issue review sources

- Security review: `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/review-security-vulnerability-260429.md`
- Orchestration plan: `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/ORCHESTRATION_PLAN.md`
- Quickstart: `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/QUICKSTART.md`
- Coordinator summary: `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/COORDINATOR_SUMMARY.md`

## RISE and launch context

- RISE reference: `/usr/local/src/263-miadi-vulnerabilities-260429/llms/llms-rise-framework.txt`
- Resume script: `/usr/local/src/263-miadi-vulnerabilities-260429/RESUME--COPLUGGEDIN--2604290937--ef22081f-4b60-4bd3-9709-458c7203de24.sh`

## Reusable kit repo

- Kit repo root: `/workspace/repos/jgwill/miadi-orchestration-kit`
- This rispec folder: `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/security-remediation-orchestration`
- Issue skill: `/workspace/repos/jgwill/miadi-orchestration-kit/skills/miadi-mightyeagle-issue-263/SKILL.md`

## Current-instance launch surfaces observed while drafting the first wave

These are provenance for the issue-263 drafting session. They are examples of what was loaded, not durable rules for every future run.

- `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit`
- `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-promotion-context-kit`
- `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-adversarial-review-kit`
- `/workspace/repos/miadisabelle/mia-awesome-copilot/plugins/software-engineering-team`
- `/workspace/repos/miadisabelle/mia-awesome-copilot/plugins/context-engineering`

## Canonical broader Miadi pattern roots

- `/src/Miadi`
- `/workspace/repos/miadisabelle/mia-awesome-copilot`

These roots are loaded as reference surfaces for broader Miadi and source-plugin conventions. They are not a substitute for the issue workspace evidence.

## Claim-level provenance for promoted rules

| Promoted rule or example | Scope | Evidence surfaces |
| --- | --- | --- |
| Resume must read the current execution log, not only the plan. | Durable rule | `QUICKSTART.md`; `COORDINATOR_SUMMARY.md`; issue orchestration folder contains `EXECUTION_LOG.md` |
| Parallel exploration precedes sequential implementation. | Durable rule | `ORCHESTRATION_PLAN.md` subagent model; `QUICKSTART.md` execution workflow |
| Implementation and review are separate lanes. | Durable rule | `ORCHESTRATION_PLAN.md` exploration vs implementation vs validation subagents |
| Reports must carry blocker state and next actions. | Durable rule | `QUICKSTART.md` "If You Get Stuck"; `ORCHESTRATION_PLAN.md` escalation notes referencing `EXECUTION_LOG.md` |
| Test evidence and exploit-regression evidence are part of the wave contract. | Durable rule | `ORCHESTRATION_PLAN.md` acceptance criteria and Phase 3 validation section |
| Redaction of sensitive headers or payloads is required when reporting. | Durable rule | `ORCHESTRATION_PLAN.md` webhook/SMS security requirements explicitly call for redacted logs |
| AI/agent-specific review must include tool abuse and auth boundaries. | Durable rule | `ORCHESTRATION_PLAN.md` agent execution, A2A, MCP, and AI/media hardening sections |
| Exact issue-263 paths belong in provenance and current-instance examples. | Current-instance example | issue workspace paths above; resume script; current issue folder layout |
| Exact plugin-dir stack used for drafting is an example, not a global contract. | Current-instance example | launch surfaces listed above plus exported first-wave launch examples |

## Resume-critical exact paths for issue 263

- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/EXECUTION_LOG.md`
- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/ORCHESTRATION_PLAN.md`
- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/QUICKSTART.md`
- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/COORDINATOR_SUMMARY.md`

## Provenance note

Rules promoted into this rispec set should be understood as:

1. extracted from issue-263 evidence,
2. shaped by the RISE framing in `llms-rise-framework.txt`,
3. constrained by existing Miadi orchestration-kit and source-plugin conventions,
4. still open to refinement if later security issues prove a better reusable boundary.
