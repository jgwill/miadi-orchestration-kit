# Model-Routing Matrix

Track owner:
Date:
Source ledger:

| Task class | Track source | Sensitivity | Context size | Tool/action risk | Latency need | Cost ceiling | Memory write risk | Confidence threshold | Recommended tier | Candidate model | Escalation trigger | Fallback model/path | Human review point | Evidence source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Low-risk classification | A1/T1 | low | small | low | fast | low | none | medium | local/small | local classifier or smallest approved model | confidence below threshold or sensitive content appears | cheap/bulk model | none unless routed to sensitive content | seed row |
| Duplicate detection | T1 | low | small/medium | low | fast | low | none | medium | local/small | embedding or small model | ambiguous near-duplicate cluster | cheap/bulk model | none | seed row |
| Bulk summarization | A1/A2/A3/T1/T2/T3/T4/N1/N2/N3 | medium | medium/large | low | normal | medium | none | medium | cheap/bulk | economical long-context model | source conflict, missing citations, or synthesis judgment needed | premium model | reviewer checks sampled citations | seed row |
| Source extraction | all tracks | medium | medium | low | normal | medium | none | high | cheap/bulk | economical extraction model | citation mismatch or source quality below B | premium verifier | source-ledger reviewer | seed row |
| Code patch planning | T1/T3/T4 | medium/high | medium/large | medium | normal | medium/high | none | high | premium | strong coding model | unclear ownership, cross-repo impact, or failing tests | human-scoped implementation plan | human review before edits | seed row |
| Architecture review | A1/T1/T4 | high | large | medium | normal | high | none | high | premium | senior reasoning model | unresolved contradiction or missing primary evidence | second premium reviewer | final integrator | seed row |
| Permission escalation decision | A3/T2/T4 | high | medium | high | normal | high | possible | very high | reviewer | premium model plus human | any authority expansion requested | stop and request explicit approval | mandatory before escalation | seed row |
| Durable memory write-back | A2/T3/N3 | high | medium | medium | normal | high | high | very high | reviewer | premium model plus human confirmation | source provenance incomplete or high impact memory | do not write memory | mandatory for high impact | seed row |
| Discord delivery | T2/N3 | medium/high | small/medium | high | fast/normal | medium | possible | high | reviewer | discord-channel-analyzer when available plus premium review | public channel, webhook action, or identity-sensitive content | draft-only handoff | human-visible confirmation | seed row |
| Final synthesis | all tracks | high | large | low/medium | normal | high | none | very high | premium | premium integrator plus second-model review | contradictions remain open or major claims lack two sources | return to source ledger review | final acceptance review | seed row |
