# Export

This document turns the orchestration contract into replayable launch and handoff patterns.

## Current-instance launch surfaces from issue 263

The issue-263 drafting wave used these plugin directories:

- `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit`
- `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-promotion-context-kit`
- `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-adversarial-review-kit`
- `/workspace/repos/miadisabelle/mia-awesome-copilot/plugins/software-engineering-team`
- `/workspace/repos/miadisabelle/mia-awesome-copilot/plugins/context-engineering`

These are **current-instance examples**, not a durable hard rule. The durable rule is:

- load the reusable kit repo,
- load the active issue workspace and its orchestration folder,
- load only the additional review or reference plugin dirs the wave actually needs.

## Current-instance `--add-dir` examples from issue 263

- `/workspace/repos/jgwill/miadi-orchestration-kit`
- `/usr/local/src/263-miadi-vulnerabilities-260429`
- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263`
- `/src/Miadi`
- `/workspace/repos/miadisabelle/mia-awesome-copilot`

Load substitute paths for other issues; keep the same class split between kit repo, issue workspace, and optional reference roots.

## Invocation shape

Use the skill with explicit parameters in the first prompt:

```text
Use the skill `miadi-mightyeagle-issue-263`.

Inputs:
- issue_id: <owner/repo#issue>
- issue_workspace: <absolute path>
- issue_orchestration_dir: <absolute path>
- issue_review_source: <absolute path>
- execution_log: <absolute path>
- rispec_root: /workspace/repos/jgwill/miadi-orchestration-kit/rispecs/security-remediation-orchestration
- latest_findings: <paths or "none">
- current_goal: <revise rispecs | resume implementation handoff | run review wave>
- lanes_in_scope: <coordinator, implementer, security-review, rise-review, promotion-boundary>

First instruction:
Read the required sources in order, state reusable vs issue-bound scope, then execute only the requested lane handoffs and leave exit artefacts with test evidence, blockers, and next safe relaunch command.
```

## Standard launch example

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

Then invoke the relevant skill and point it at:

- the issue review source,
- the issue-specific orchestration folder,
- the current execution log,
- the reusable rispec folder,
- any current review findings that still require revision.

## Resume pattern

On resume:

1. read the issue execution log first,
2. read the latest changed files or handoff notes,
3. inspect the last review findings,
4. read the reusable rispec folder,
5. query any local todo tracker if present,
6. relaunch only the next wave.

For issue 263, the current-instance examples are:

- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/EXECUTION_LOG.md`
- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/ORCHESTRATION_PLAN.md`
- `/usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263/QUICKSTART.md`

## Cheap audit pattern

```bash
copilot --resume --model gpt-5-mini --reasoning-effort high \
  --add-dir /usr/local/src/263-miadi-vulnerabilities-260429 \
  --add-dir /usr/local/src/263-miadi-vulnerabilities-260429/.mia/branches/fix/security-vulnerabilities-263 \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  -p "Read the latest wave report, changed files, EXECUTION_LOG.md, and the security-remediation-orchestration rispecs. Verify path provenance, lane separation, review loop completion, test evidence, exploit-regression evidence, redaction discipline, and whether the output stays reusable instead of issue-only. Report concretely with file:line. Do not broaden write scope."
```

## Output report template

Each orchestration wave should emit a report with:

```markdown
# Wave Report: <name>

## Scope
- issue / branch
- goal of this wave

## Inputs Read
- exact paths

## Subagents Used
- agent name
- role

## Files Changed
- exact paths

## Review Findings
- security review
- RISE/dissent review
- promotion-boundary review

## Test Evidence
- commands run
- exploit-regression results
- gaps or not-applicable note

## Decisions
- what became reusable
- what stayed issue-specific
- what was deferred and why
- what was rejected and why

## Sanitization
- secrets/tokens/headers/payloads/customer data redacted? yes/no
- any sensitive evidence retained only by path reference

## Next Wave
- exact next entry point
- relaunch command
- blocker classification if not ready
```

## Issue linkage contract

Preserve:

- `jgwill/Miadi#263` in Miadi-side artefacts and commits,
- the related `jgwill/miadi-orchestration-kit` issue in kit-side artefacts and commits,
- exact source paths for every durable rule that came from issue 263.

## Handoff to review and promotion waves

After drafting or changing reusable assets:

1. hand implementer output to a security-focused reviewer with changed files and test evidence,
2. send reusable rispec/skill changes to a dissenting RISE reviewer,
3. revise from findings,
4. send them to a promotion-boundary reviewer if the revision changes what belongs in reusable form.

Do not merge or close the wave on draft alone.
