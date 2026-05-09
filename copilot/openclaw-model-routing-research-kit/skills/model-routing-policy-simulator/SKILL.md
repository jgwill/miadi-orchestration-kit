---
name: model-routing-policy-simulator
description: Generate an OpenClaw model-routing matrix from task, risk, context, tool, cost, latency, memory, confidence, and review inputs.
---

Use this skill when creating or revising `model-routing-matrix.md`.

## Inputs

For each task class, collect:

- task class
- track source: A1, A2, A3, T1, T2, T3, T4, N1, N2, or N3
- sensitivity
- context size
- tool/action risk
- latency need
- cost ceiling
- memory write risk
- confidence threshold
- available evidence

## Outputs

For each row, produce:

- recommended tier: `local/small`, `cheap/bulk`, `premium`, or `reviewer`
- candidate model or model family
- escalation trigger
- fallback model or path
- human review point
- evidence source

## Seed Rows

Start from `templates/model-routing-matrix.md`, which includes rows for:

- low-risk classification
- duplicate detection
- bulk summarization
- source extraction
- code patch planning
- architecture review
- permission escalation decision
- durable memory write-back
- Discord delivery
- final synthesis

## Routing Heuristics

1. Prefer `local/small` for reversible, low-sensitivity classification and duplicate detection.
2. Prefer `cheap/bulk` for high-volume extraction or summarization when source checks are required.
3. Prefer `premium` for architecture judgment, code patch planning, contradiction resolution, and final synthesis.
4. Prefer `reviewer` when durable memory, permissions, identity, safety, or external delivery surfaces are affected.
5. Escalate when confidence falls below threshold, sources conflict, context exceeds the tier, or tool/action risk becomes irreversible.
6. Require human review for permission escalation, high-impact memory writes, public Discord delivery, and final synthesis acceptance.

## Process

1. Copy or open `templates/model-routing-matrix.md`.
2. Fill input columns before choosing the tier.
3. Record evidence source for every decision.
4. Add escalation and fallback rules that a future orchestrator can execute.
5. Mark weakly sourced rows as provisional.
6. Include matrix changes in the track handoff.
