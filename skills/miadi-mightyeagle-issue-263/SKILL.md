---
name: miadi-mightyeagle-issue-263
description: >
  Use this skill for jgwill/Miadi#263 security-remediation orchestration work:
  resume from the live issue workspace, revise the issue-263-derived rispecs,
  and run explicit implementer/review/promotion handoffs without creating a
  new plugin.
version: 0.1.0
---

# Miadi Mightyeagle Issue 263

This skill is for the main-session orchestrator when working on `jgwill/Miadi#263` or when revising the issue-263-derived first-wave security-remediation rispecs.

It does **not** create a new plugin. First wave is:

1. reusable rispecs,
2. an issue-aware operational skill,
3. issue-local artefacts that future agents can resume from.

## When this skill applies

Use this skill when:

- the active work is about `jgwill/Miadi#263`,
- the goal is to continue or refine security-remediation orchestration,
- the session must turn branch-local evidence into reusable kit knowledge,
- review and revision must be delegated instead of implied,
- a future agent needs a clean starting point with exact paths and launch rules.

Do not use this skill for general application-security advice or for unrelated issues without first checking whether the same orchestration pattern really applies.

This skill is therefore **issue-aware, not fully issue-agnostic**. Reusable knowledge lives in the rispecs; the skill keeps the current-instance issue-263 paths and handoffs operational.

## Invocation shape

Invoke with an explicit prompt payload:

```text
Use the skill `miadi-mightyeagle-issue-263`.

Inputs:
- issue_id: jgwill/Miadi#263
- issue_workspace: /usr/local/src/263-miadi-vulnerabilities-260429
- issue_orchestration_dir: /usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263
- issue_review_source: /usr/local/src/263-miadi-vulnerabilities-260429/.mia/review-security-vulnerability-260429.md
- execution_log: /usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/EXECUTION_LOG.md
- rispec_root: /workspace/repos/jgwill/miadi-orchestration-kit/rispecs/security-remediation-orchestration
- latest_findings: <paths or "none">
- current_goal: <revise rispecs | prepare implementer handoff | run security review handoff | run RISE revision loop>
- lanes_in_scope: <comma-separated lanes>
```

First instruction:

> Read the required sources in order, state what is reusable versus issue-bound, then execute only the requested lane handoffs. Leave exit artefacts with changed files, test evidence, exploit-regression evidence, blockers, defer/reject rationale, and the next safe relaunch command.

## Required reading order

1. `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/review-security-vulnerability-260429.md`
2. `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/ORCHESTRATION_PLAN.md`
3. `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/QUICKSTART.md`
4. `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/EXECUTION_LOG.md`
5. latest review findings still open for revision
6. `/usr/local/src/263-miadi-vulnerabilities-260429/llms/llms-rise-framework.txt`
7. `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/security-remediation-orchestration/README.md`
8. `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/security-remediation-orchestration/01-reverse-engineer.md`
9. `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/security-remediation-orchestration/02-intent.md`
10. `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/security-remediation-orchestration/03-specify.md`
11. `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/security-remediation-orchestration/04-export.md`
12. `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/security-remediation-orchestration/05-issue-263-source-ledger.md`

## Path ledger

| Path | Role |
| --- | --- |
| `/usr/local/src/263-miadi-vulnerabilities-260429` | Live issue workspace |
| `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263` | Issue-local orchestration artefacts |
| `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/review-security-vulnerability-260429.md` | Security review source |
| `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/EXECUTION_LOG.md` | Live resume and blocker state |
| `/workspace/repos/jgwill/miadi-orchestration-kit` | Reusable orchestration repo |
| `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/security-remediation-orchestration` | Reusable issue-263-derived rispecs |
| `/src/Miadi` | Canonical broader Miadi reference root |
| `/workspace/repos/miadisabelle/mia-awesome-copilot` | Source plugin patterns |

## Wave model

### Wave 0: Read and classify

- read the review and issue artefacts,
- classify surfaces into clusters,
- identify the foundational move,
- state what is reusable and what remains issue evidence.

### Wave 1: Reverse-engineer into reusable patterns

- use issue evidence to extract orchestration rules,
- preserve exact paths and provenance,
- do not flatten the work into generic security prose.

### Wave 2: Specify the durable contract

- define lanes,
- define review gates,
- define required inputs, outputs, and handoff triggers,
- define blocked-state handling.

### Wave 3: Export launch, resume, and audit patterns

- write explicit commands,
- define skill invocation parameters,
- define report shape,
- define handoff instructions,
- keep issue linkage intact.

### Wave 4: Adversarial review and promotion boundary check

- run dissenting review,
- revise from findings,
- decide what stays issue-local and what remains reusable.

## Subagent guidance

Prefer the already-loaded agents instead of inventing issue-specific copies:

- `stckin-orchestration-kit:miadi-deep-search-synthesizer` for evidence synthesis and replayable launch patterns
- `context-engineering:context-architect` for file/surface mapping and dependency boundaries
- `software-engineering-team:se-security-reviewer` for exploitability and security-quality review
- `miadi-adversarial-review-kit:rise-revision-critic` for RISE-structured dissent review
- `miadi-promotion-context-kit:miadi-promotion-architect` for deciding what belongs in reusable rispec/skill form

If implementation changes are in scope, keep implementer and reviewer lanes separate.

## Lane-specific handoff expectations

### Coordinator -> implementer

Provide:

- exact files or rispec sections in scope,
- acceptance criteria,
- required tests or exploit-regression expectations,
- latest open findings to preserve.

### Implementer -> security review

Provide:

- exact files changed,
- commands run,
- test evidence,
- exploit-regression evidence,
- unresolved risk list,
- sanitization note for any secrets, headers, or payload excerpts.

### Implementer or synthesis -> RISE review

Provide:

- revised rispec or skill files,
- source-ledger references for promoted claims,
- note of any issue-specific examples retained on purpose.

### Revision -> promotion-boundary review

Provide:

- final changed reusable assets,
- explanation of what stayed issue-local,
- explanation of why no new plugin was created.

## Security review scope

Security review is not limited to auth and HTTP checks. Require review for:

- prompt injection paths,
- tool abuse or over-broad tool grants,
- memory poisoning or untrusted context ingestion,
- model or data leakage through prompts, logs, or artefacts,
- secret/header/payload exposure,
- authn/authz regressions,
- shell, path traversal, SSRF, webhook, and callback surfaces.

## Review loop

Minimum required loop:

1. draft or implementer handoff,
2. security review,
3. RISE/dissent review for reusable assets,
4. revise,
5. promotion-boundary check if reusable scope changed,
6. update export/handoff guidance if review changed the launch contract.

Do not stop at review production alone. Either revise the artefacts or record an explicit defer/reject decision with rationale.

## Exit artefacts

Every completed run using this skill should leave:

- exact paths read,
- exact files changed,
- lane owner and subagents used,
- test evidence and exploit-regression results,
- blocker/defer/reject carriage with rationale,
- sanitization note for secrets, headers, payloads, and customer data,
- next safe relaunch command.

## Current-instance launch example

```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-promotion-context-kit \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-adversarial-review-kit \
  --plugin-dir /workspace/repos/miadisabelle/mia-awesome-copilot/plugins/software-engineering-team \
  --plugin-dir /workspace/repos/miadisabelle/mia-awesome-copilot/plugins/context-engineering \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /usr/local/src/263-miadi-vulnerabilities-260429 \
  --add-dir /usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263 \
  --add-dir /src/Miadi \
  --add-dir /workspace/repos/miadisabelle/mia-awesome-copilot
```

Treat this as an issue-263 example from the current drafting environment, not a universal requirement for every future security issue.

## Hard rules

- Always cite `jgwill/Miadi#263`.
- Always preserve exact source paths.
- Always keep reusable rules separate from issue-specific evidence.
- Do not create a new plugin for a single issue.
- Do not duplicate existing plugin agents into issue-local markdown.
- Do not treat the issue branch folder itself as the reusable artefact.
- Do not bury relaunch commands in long narrative prose.

## Expected outputs

- updated rispecs under `rispecs/security-remediation-orchestration/`
- compact issue-local handoff or execution-log updates
- delegated review findings
- revised reusable assets
- issue linkage carried where commits or artefacts are produced

## Anti-patterns

- converting the rispec into only a vulnerability inventory
- converting the skill into only a command cheat sheet
- copying the entire issue artefact tree into the kit repo
- making generic claims without path-based provenance
- letting the same lane both implement and approve the work
