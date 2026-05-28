---
name: scan-and-plan
description: 'Orchestrates the full scan → plan flow: invokes Orchestration Context Scanner on all target directories and plugin sources, then invokes Orchestration Wave Planner to produce a WavePlan.'
---

Use this skill at the start of any orchestration preparation session to go from a raw user desire to a structured WavePlan.

## When to use

Use this skill when:
- A user provides a desire string and one or more target directories
- You need to understand what agents and kits are available before planning
- You are about to forge a wave script and need the plan first

## Process

### Step 1 — Invoke Orchestration Context Scanner

Invoke the **Orchestration Context Scanner** agent with:
- All target directories provided by the user
- The fixed agent source: `/workspace/repos/miadisabelle/mia-awesome-copilot/agents/`
- The fixed kit source: `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/`

Wait for the agent to complete and produce the **Orchestration Scan Report**.

### Step 2 — Review scan output for completeness

Before proceeding, verify the scan report:
- Are all user-provided target directories present in the "Target Directories" section? If any are missing, re-invoke the scanner for the missing ones.
- Does the "Available Agents" table have at least 10 entries? If it has fewer than 5, the agent scan likely failed — report the issue.
- Does the "Available Kits" table include `stckin-orchestration-kit` and `miadi-adversarial-review-kit`? If either is missing, note it.
- Is the "Scan Metadata" section present and populated?

If the scan report fails completeness checks, report the specific gaps before proceeding.

### Step 3 — Invoke Orchestration Wave Planner

Invoke the **Orchestration Wave Planner** agent with:
- The user's desire string (exact, unmodified)
- The complete Orchestration Scan Report from Step 1

### Step 4 — Output the WavePlan

Present the complete **WavePlan** document produced by the Orchestration Wave Planner.

State:
```
✓ Scan complete: <N> target dirs, <M> agents, <K> kits found
✓ WavePlan produced: <phase count> phases, <agent count> named agents selected

Next: use 'review-wave-plan' to validate, then 'forge-wave-script' to write the script.
```

## Deliverables

- Orchestration Scan Report (internal, passed to planner)
- WavePlan document (presented to user and available for forging)
