# COAIA Agent Recommended Development Path

Date: 2026-04-29
Authoring agent: Codex
Related issue: https://github.com/jgwill/miadi-orchestration-kit/issues/8

## Context

This recommendation follows the COAIA Agent RISE specification work connected to `jgwill/src#461` and the active PDE review for `coaia-agent`. The question was whether `/workspace/repos/jgwill/miadi-orchestration-kit` already has a kit that can be upgraded to develop, review, or promote this work, or whether a new kit should be created.

The relevant existing kit surfaces are:

- `copilot/stckin-orchestration-kit`
- `copilot/miadi-adversarial-review-kit`
- `copilot/miadi-promotion-context-kit`
- `copilot/miadi-design-bundle-integration-kit`

## Recommendation

Do not create a new kit immediately.

The best path is:

1. **Develop / orchestrate this work:** upgrade `copilot/stckin-orchestration-kit`
   - It already owns orchestration-kit maintenance, deep-search synthesis, launch recipes, artefact reporting, and kit scaffolding.
   - Add a `coaia-agent-runtime-orchestration` skill or lane template there, not a new plugin yet.
   - This would cover RISE spec waves, COAIA package survey, launch command generation, and next-session pack creation.

2. **Review this work:** use `copilot/miadi-adversarial-review-kit`
   - This is the right review kit for the generated `coaia-agent/rispecs/`.
   - It checks originating prompt vs artifacts, rispec fit, overclaims, omissions, promotion readiness, and contradiction handling.
   - It is especially useful for Hermes-vs-COAIA identity, Medicine Wheel authority, and spec-only boundary drift.

3. **Decide what becomes durable kit/spec/wiki:** use `copilot/miadi-promotion-context-kit`
   - After adversarial review, use this to decide what stays provenance, what becomes reusable rispec, what becomes wiki-facing, and what should become a kit feature.
   - This prevents the COAIA Agent work from being prematurely flattened into generic orchestration language.

4. **Ignore for now:** `miadi-design-bundle-integration-kit`
   - It is strong, but aimed at Claude Design bundle-to-codebase implementation.
   - It is not relevant unless `coaia-agent` later receives a design bundle or UI integration wave.

## Expected Kit Evolution

`stckin-orchestration-kit` should gain a COAIA Agent runtime lane, probably with:

- a session-charter template for `coaia-agent`,
- a COAIA package survey skill,
- a RISE spec-pack authoring skill,
- a first-demo/export lane,
- an artefact report format tied to `jgwill/src#461` and `jgwill/miadi-orchestration-kit#8`.

## New Kit Boundary Rule

Create a new `coaia-agent-runtime-integration-kit` only after the first implementation cycle repeats enough to prove a stable, reusable boundary.

Signals that a new kit is justified:

- COAIA Agent work repeatedly needs its own launch scripts, prompt contracts, agents, and skills that no longer fit cleanly inside STCKin.
- The runtime implementation work becomes broader than RISE spec orchestration and requires dedicated implementer/reviewer/test lanes.
- Multiple repos start depending on the same COAIA Agent orchestration flow.

Until then, reuse the existing circle:

- `stckin` conducts,
- `adversarial` tests,
- `promotion` decides what becomes durable.

## Next Upgrade Candidate

The first concrete upgrade should be to `copilot/stckin-orchestration-kit`, not a new plugin. The upgrade should add one focused skill:

`coaia-agent-runtime-orchestration`

That skill should instruct a future Copilot wave to:

1. Read the COAIA Agent PDE/session charter.
2. Read the COAIA Agent deep-dive and `jgwill/src#461`.
3. Survey target runtime and kinship repos.
4. Produce or update `coaia-agent/rispecs/`.
5. Produce the `miadi-orchestration-kit` next-session pack.
6. Leave an artefact report with issue links, file paths, launch commands, blockers, and promotion recommendations.

## Current Decision

Decision: **upgrade existing kits first**.

New kit status: **defer**.

Primary kit to upgrade: `copilot/stckin-orchestration-kit`.

Review kit to use: `copilot/miadi-adversarial-review-kit`.

Promotion kit to use: `copilot/miadi-promotion-context-kit`.
