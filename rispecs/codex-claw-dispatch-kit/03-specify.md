# Specify

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Proposed Plugin Name

`miadi-claw-dispatch-kit`

## Future Codex Plugin Purpose

Help Codex communicate with a named Claw through Gaia by turning an operator request into a dispatch packet, sending it with the right endpoint/session/channel, capturing acknowledgement, and preparing follow-up work.

## Input Contract

A dispatch request should provide or derive:

```yaml
target_claw: MiaClaw
session_id: pde-2605111213--f32f2748-4870-45bd-bf55-49230aab96fa
gateway_cli: /home/mia/.openclaw/workspace/pto/gaia-endpoint-pebble/gaia-endpoint.mjs
channel: openclaw-planning
schedule_at: 2026-05-11T23:00:00-04:00
mission_summary: Resume a Gemini session, document what happened, create an episode, create an issue, choose ceremonial folder, map related work.
source_paths:
  - /workspace/repos/scripts/RESUME--gemini--session--8a3c1d91-4cb4-49ba-8a96-8e349ea4e3fe.creator-of--pde-2605111213--f32f2748-4870-45bd-bf55-49230aab96fa.sh
expected_acknowledgement:
  - planned pickup time
  - session ID
  - first artifact
followup_surfaces:
  - memory
  - issue
  - ceremonial folder
  - Storyweaver episode
```

## Artifact Workspace

Default output path:

```text
.claw-dispatch/<session-id>/
  commission-packet.md
  command-shape.md
  acknowledgement.md
  source-ledger.md
  followup-plan.md
```

The implementation may allow a user-provided output folder. It must never write environment variables or tokens to any artifact.

## Skill Surfaces

### claw-dispatch-preflight

Use when Codex needs to determine whether a Claw dispatch is safe and sufficiently specified.

Reads:

- user request
- endpoint README or script
- target session/resume artifacts
- local instructions about external actions

Writes:

- `commission-packet.md`
- `source-ledger.md`
- missing-fields note when blocked

Pause conditions:

- no exact target Claw
- no session ID when continuity matters
- no authorized endpoint or token surface
- requested action would publicly post, spend money, or mutate external state without permission

### claw-commission-send

Use when preflight has enough information and the user has authorized the dispatch.

Workflow:

1. Compose the mission packet with exact dates, paths, and expected acknowledgement.
2. Run the Gaia endpoint command.
3. Wait for the response to finish.
4. Save text output or JSON summary to `acknowledgement.md`.
5. Mark unresolved delivery questions explicitly.

### claw-acknowledgement-ledger

Use after dispatch or when auditing a prior dispatch.

Workflow:

1. Compare acknowledgement against expected fields.
2. Mark each field as `confirmed`, `missing`, `changed`, or `inferred`.
3. Record what Codex should remember locally.
4. Prepare a concise user-facing summary.

### claw-episode-followup

Use when the Claw dispatch creates narrative or ceremonial learning.

Workflow:

1. Decide whether Storyweaver should extract episode/StoryForms/StoryBeats.
2. Identify related rispecs, issues, PDE/STC artifacts, ceremonies, and workspace folders.
3. Draft the next commission or issue body.
4. Preserve source boundaries for any narrative artifact.

## Agent Or Playbook Surfaces

Codex plugins may not need separate runtime agents. If the implementation supports agent-like markdown playbooks, include:

- `claw-dispatch-architect.md`: owns mission packet formation and routing.
- `gateway-provenance-auditor.md`: checks endpoint, session key, command shape, token secrecy, and acknowledgement.
- `episode-handoff-steward.md`: routes meaningful sessions into Storyweaver episode extraction.

## Review Gates

- Exact session ID is mandatory for session pickup work.
- Absolute date and timezone are mandatory for scheduled pickup plans.
- The acknowledgement ledger must distinguish "MiaClaw agreed to plan" from "MiaClaw completed the work."
- Follow-up issue creation is recommended only after source review or explicit user instruction.
- Episode extraction must carry source facts, inferences, and invented framing separately.
