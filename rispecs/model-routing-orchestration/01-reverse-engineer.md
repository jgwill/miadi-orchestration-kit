# Reverse-engineer

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This stage reconstructs what the OpenClaw model-routing study evidence actually shows about model tiers, routing decisions, cost/capability tradeoffs, fallback behavior, and review gates.

It does not define the desired future policy. It prepares evidence for `02-intent.md`.

## Source surfaces to inspect later

| Surface | Evidence to extract | Minimum handling |
| --- | --- | --- |
| Study manifest | Authorized tracks, exact RISE wording, stop conditions, source-quality rules | Treat as control-plane evidence. |
| Study proposal | A1/T1 scope, tier labels, wave expectations, rispec brief | Treat as planning evidence, not final findings. |
| Transcript and study notes | Claims about model swapping, runtime abstraction, and routing motivation | Mark transcript-only until corroborated. |
| OpenClaw or CLAW repo paths | Runtime dispatch, model selection, workflow stability, endpoint behavior | Require path and observed behavior. |
| Related framework docs or code | Comparable routing patterns and terminology | Keep separate from OpenClaw-specific claims. |
| Academic sources | Taxonomy, safety, and cost/capability terminology | Require citation details before synthesis. |

## Evidence-backed observation shape

Each reconstructed observation should include:

- claim text,
- source class,
- exact source pointer,
- whether it is evidence, provisional claim, repo path evidence, transcript-only claim, or contradiction,
- confidence and missing corroboration,
- candidate destination in `02-intent.md`, `03-specify.md`, or `04-export.md`.

## Track-specific reconstruction questions

### A1 vocabulary questions

- What names do sources use for runtime abstraction, model mobility, step-aware routing, or durable workflows?
- Which claims describe a taxonomy rather than a concrete implementation?
- Where do cost, latency, capability, risk, and review burden appear as separate dimensions?
- Which terms are imported from outside OpenClaw and should not be treated as transcript-native?

### T1 implementation questions

- What task signals are actually inspected before choosing a model tier?
- Which tiers are observed, configured, or only proposed: `local/small`, `cheap/bulk`, `premium`, or another catalog?
- What fallback path exists when a model is unavailable, too costly, too weak, or unsafe for the step?
- Where does a human review gate intervene before escalation or final synthesis?
- What data would be needed to produce a model-routing matrix row?

## Boundaries

- Do not turn the transcript into policy without corroboration.
- Do not infer live routing behavior from names alone.
- Do not collapse local, cheap, and premium tiers into quality rankings without cost and task context.
- Do not treat model selection as purely technical if permission or review gates shape the decision.
- Do not run Academic or Technical research from this scaffold.

## Handoff shape

The handoff to `02-intent.md` should contain:

- evidence-supported current reality,
- desired outcome candidates,
- unresolved contradictions,
- vocabulary choices with source support,
- claims that must remain provisional.
