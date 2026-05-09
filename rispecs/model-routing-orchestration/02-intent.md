# Intent-extract

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This stage defines the structural tension for model-routing orchestration after the evidence has been reconstructed.

## Desired outcome

Future OpenClaw research and build waves can express model routing as a durable orchestration pattern: task steps expose routing signals, the runtime selects an appropriate model tier, fallback and review gates are visible, and model-routing matrix outputs remain traceable to evidence.

## Current reality

The study begins from a tension between:

- agents described as locked to one model,
- runtime-abstraction claims that imply model mobility,
- cost/capability tradeoffs that may vary by task step,
- safety and review needs that can override cheapest-route logic,
- multiple tracks that could invent incompatible routing vocabulary.

Without this rispec, later waves may mix taxonomy, implementation details, and policy conclusions in the same document.

## Structural tension

| Current reality | Desired outcome | Advancing move |
| --- | --- | --- |
| Model-routing language may come from transcript, proposal, papers, and code with different meanings. | One vocabulary is shared by A1 and T1, with provenance attached. | Reconstruct terminology first, then promote only supported terms into specification. |
| Routing can be framed as cost saving only. | Routing balances cost, capability, latency, reliability, permission scope, and review needs. | Require each routing rule to name the dimension it optimizes and the evidence for that choice. |
| A model swap can break agent behavior if workflow logic depends on provider assumptions. | Workflow logic remains stable while model choice changes at runtime. | Separate task contract, model catalog, fallback, and review gate in the specification. |
| Fallback and escalation can be hidden in implementation details. | Fallback and escalation are inspectable matrix columns. | Make matrix outputs part of the handoff contract. |

## Creative advancement scenarios

### Scenario: classify lightweight work

**Desired Outcome:** A future dispatcher can route simple classification or triage to a low-cost tier while preserving auditability.

**Current Reality:** The study proposes tiers, but future evidence must show which tasks actually fit each tier.

**Natural Progression:** Reverse-engineered task examples become candidate matrix rows; each row records task signals, chosen tier, fallback path, and review requirement.

**Resolution:** A low-risk route is documented without implying that all classification is safe or cheap by default.

### Scenario: escalate hard judgment

**Desired Outcome:** Hard judgment, trust evaluation, or final synthesis can move to a premium tier with visible reason and review context.

**Current Reality:** Premium model use can be justified by habit unless the route records what made the step hard.

**Natural Progression:** The specification requires escalation triggers and a reviewer-visible explanation before premium use is treated as policy.

**Resolution:** Premium routing becomes a controlled decision, not an unexamined default.

## Non-goals

- Do not choose production models.
- Do not set budget policy.
- Do not run routing experiments.
- Do not make final Academic or Technical findings.
- Do not authorize live OpenClaw connector work.

## Handoff shape

The handoff to `03-specify.md` should provide:

- approved vocabulary,
- structural tension table,
- routing dimensions to include,
- non-goals,
- claims that need source-ledger status before use.
