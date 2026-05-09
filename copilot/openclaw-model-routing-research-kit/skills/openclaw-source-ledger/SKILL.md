---
name: openclaw-source-ledger
description: Maintain OpenClaw study source ledgers with evidence types, evidence quality, contradiction handling, and strict claim-to-source rules.
---

Use this skill whenever a track gathers, reviews, or synthesizes sources.

## Evidence Types

Use one of these types for every source row:

- `transcript`: video transcript, talk notes, or quoted walkthrough material.
- `repo-evidence`: code, config, issue, commit, README, or path-level repository evidence.
- `paper-docs`: academic paper, arXiv abstract, standards text, or technical report.
- `official-docs`: vendor or project documentation.
- `comparative-example`: external implementation pattern, case study, or adjacent framework.
- `user-instruction`: explicit instruction from Iris, Hermes, the issue, or the launch manifest.
- `operational-observation`: command output, smoke test result, runtime inspection, or local file check.
- `authorial-synthesis`: the agent's interpretation assembled from cited sources.

Do not create a standalone `mythology-archetype-search` source type. Narrative or archetype material belongs in the same ledger under `comparative-example`, `paper-docs`, or `authorial-synthesis` with clear provenance.

## Evidence Quality

Grade each source:

- `A`: primary, official, directly inspected, or path-level evidence.
- `B`: credible secondary source with enough detail to verify.
- `C`: useful but incomplete, indirect, or transcript-only.
- `D`: weak, uncited, speculative, stale, or contradicted.

Major claims should not depend only on `C` or `D` evidence.

## Claim-To-Source Rules

1. Every major conceptual claim needs at least two independent sources.
2. Every implementation claim needs repo evidence with path, symbol, commit, URL, or command output.
3. Every source-derived quote or paraphrase needs a source row.
4. Every synthesis claim must list the source rows it combines.
5. Transcript-only claims must be marked provisional until independently supported.
6. User instructions can establish scope, but they do not prove external facts.
7. If source support is missing, mark the claim as `hypothesis` or remove it from synthesis.

## Contradiction Handling

1. Record contradictions in the ledger instead of smoothing them away.
2. Name the conflicting source rows.
3. Classify contradiction status as `open`, `resolved`, `scope-dependent`, or `needs-human-review`.
4. Prefer primary or directly inspected evidence when resolving.
5. Keep unresolved contradictions out of final claims unless the final output explicitly names the uncertainty.

## Process

1. Start from `templates/source-ledger.md`.
2. Add source rows as soon as sources are consulted.
3. Add claim rows only after source rows exist.
4. Review quality and independence before synthesis.
5. Produce a short ledger status in each track handoff.

## Output

The ledger must include:

- source inventory
- claim inventory
- contradiction register
- claims cleared for synthesis
- claims still provisional
