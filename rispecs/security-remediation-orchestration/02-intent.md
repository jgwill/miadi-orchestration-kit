# Intent

This document states the structural tension and desired outcome for reusable security-remediation orchestration.

## Desired outcome

A future agent can enter a live Miadi security issue with a similar evidence shape, read the issue evidence, select the right loaded kits and subagents, execute a reviewed remediation sequence, and leave replayable artefacts without inventing the workflow from scratch.

## Current reality

Security-remediation work often begins as:

- a large vulnerability review,
- a branch-local execution plan,
- several available plugins and review agents,
- uncertain boundaries between reusable orchestration and issue-specific evidence.

Without a reusable contract, later agents tend to:

- repeat the same decomposition work,
- flatten evidence into generic security prose,
- skip review separation,
- or prematurely create issue-specific plugin scaffolding.

## Advancing move

Convert the issue-specific orchestration into:

1. a RISE-based reusable rispec set,
2. an issue-aware execution skill for the first wave,
3. explicit launch and audit patterns,
4. a review-and-revision loop that is delegated instead of implied.

## Why this becomes kit knowledge

The value is not “security advice.” The value is **how Miadi runs security-hardening waves**:

- with path-explicit evidence,
- with STCKin-aware orchestration,
- with existing kits composed together,
- with review separation,
- with promotion boundaries kept intact.

## Success criteria

This orchestration knowledge is successful when:

1. the issue-263 evidence can be resumed and reviewed without rediscovering the workflow,
2. any future reuse is scoped as an informed adaptation, not assumed portability,
3. review and revision are mandatory parts of the workflow,
4. launch commands and skill invocation shape are explicit and replayable,
5. issue-specific evidence remains linked and inspectable,
6. no new plugin is created unless repeated use proves a stable kit boundary.

## Non-goals

This rispec set is not intended to:

- define Miadi’s full runtime security policy,
- replace application-level implementation specs,
- duplicate OWASP guidance,
- replace issue-specific execution logs,
- force all future security issues into the exact same surfaces, launch stack, or path layout.

## Structural tension

| Current reality | Desired outcome | Advancing move |
| --- | --- | --- |
| Security issues are evidence-heavy and easy to overfit. | Security-remediation waves are repeatable and reviewable. | Extract stable orchestration from evidence and keep the evidence linked. |
| Existing kits are available but not always composed intentionally. | Agents choose the right existing kits and roles without reinvention. | Declare the lane model, wave model, and launch patterns explicitly. |
| Implementation and approval often blur together. | Review, dissent, and revision remain separate lanes. | Make review loops part of the contract, not optional cleanup. |

## What “good” looks like

Good security-remediation orchestration produces:

- one clear reading order,
- one path ledger,
- one wave model,
- explicit review gates,
- explicit resume and audit commands,
- explicit separation between issue evidence and reusable kit knowledge.
