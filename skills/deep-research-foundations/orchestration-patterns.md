# Multi-Agent Research Orchestration Patterns

Reference on patterns for multi-agent research, carried from the upstream `deep-research` skill. It drew on Anthropic's engineering post "How we built our multi-agent research system" (2025-06-13), production systems (GPT-Researcher, Onyx, LangChain) and other sources it did not list.

Verification: the 90.2%, 80% of variance and ~15x figures below were re-opened in Anthropic's post on 2026-11-22 (lane L3 of `miadi-foundation:personas-capabilities-and-research-stewardship`, source S12). The other figures are carried from the upstream skill and not re-checked.

## Key Statistics

| Metric | Value | Source |
|--------|-------|--------|
| Multi-agent vs single-agent quality | +90.2% | Anthropic internal eval |
| Research time reduction (parallel) | Up to 90% | Anthropic engineering blog |
| Token usage vs single-turn chat | ~15x more | Anthropic engineering blog |
| Token usage explains performance | 80% of variance | BrowseComp evaluation |
| Self-improving tool descriptions | -40% completion time | Anthropic engineering blog |
| Optimal sub-agent count | 3-5 parallel | Anthropic + OpenAI convergence |
| Max research cycles per sub-agent | 6-8 | Onyx production system |
| Coverage threshold | 2+ sources per sub-Q | OpenAI Deep Research |

## Proven Architecture: Orchestrator-Worker

Every production system converges on this:

```
User Query
    |
    v
[Lead Agent / Orchestrator]
    |
    ├── Clarify (if needed)
    ├── MECE decompose into sub-questions
    ├── Spawn 3-6 parallel sub-agents
    │     ├── Sub-agent A (angle 1) → findings
    │     ├── Sub-agent B (angle 2) → findings
    │     └── Sub-agent C (angle 3) → findings
    ├── Evaluate coverage → spawn more if gaps
    ├── Synthesize all findings
    └── Generate final report with citations
```

**Anthropic uses**: Opus 4 lead + Sonnet 4 workers. Different models reduce single-model blind spots.

## The 10 Pitfalls to Engineer Against

1. **Agent spawning explosions** — Hard-cap at 6 agents. Scale to complexity.
2. **Duplicate work** — MECE + explicit "do NOT cover X" boundaries.
3. **Overly-specific search queries** — Explicitly prompt "start broad (2-4 words), then narrow."
4. **SEO content farm preference** — Add source quality heuristics to every prompt.
5. **Context exhaustion** — Sub-agents write to files, lead reads summaries.
6. **Anchoring bias** — Batch ALL results before synthesis. Never process sequentially.
7. **Lost nuance in compression** — Preserve: facts, numbers, quotes, citations, contradictions.
8. **"Good enough" stopping** — Require 2+ sources per sub-question before report.
9. **Excessive inter-agent chatter** — Sub-agents report only to lead. No broadcasting.
10. **Single model bias** — Use Opus for lead, Sonnet for workers when possible.

## What persona evidence adds

From lane L3 of `miadi-foundation:personas-capabilities-and-research-stewardship` (17 sources, opened 2026-11-22):

- Persona text alone does not reliably raise accuracy: no gain across 162 roles and 2,410 questions (Zheng et al., Findings of EMNLP 2024).
- Where roles helped, the role text carried a procedure with outputs (ChatDev: executability 0.88 to 0.58 without roles).
- Perspectives widen the sources more than they raise recall (STORM), and a moderator that asks from unused information mattered more than adding experts (Co-STORM).
- So brief lanes with an objective, output format, tools and boundaries, and give each stewardship responsibility named outputs. Do not rely on a persona's voice for coverage.

## Decomposition Strategies

### MECE (Mutually Exclusive, Collectively Exhaustive)
The gold standard. Each sub-question covers a distinct area. No overlaps, no gaps.

### Perspective-Based
Break by stakeholder/lens: technical, business, user experience, historical, competitive, future.

### Dimension-Based
Break by question type: what exists, what are problems, what solutions emerge, who are key players, what does evidence say.

### Scale-Effort-to-Complexity
- Simple fact-finding: 1 agent, 3-10 tool calls
- Direct comparisons: 2-4 agents, 10-15 calls each
- Complex multi-faceted: 5-6 agents with divided responsibilities

## Synthesis Best Practices

### Three-Stage Pipeline
1. **Aggregate**: Collect all findings. Identify thematic connections.
2. **Cross-reference**: Where do sources agree (high confidence)? Where do they contradict?
3. **Construct narrative**: Organize by theme, not by agent. The output should feel like one coherent document, not a concatenation.

### The Critique Loop (Optional)
After synthesis, optionally spawn a critic agent that checks:
- Completeness (all sub-agent findings reflected?)
- Accuracy (claims properly attributed?)
- Coherence (logical flow?)
- Gaps (what remains unanswered?)

If issues found, revise synthesis.

## Production Systems to Study

1. **Anthropic's multi-agent system** — Opus lead + Sonnet workers, 90.2% improvement
2. **GPT-Researcher** (github.com/assafelovic/gpt-researcher) — 14k+ stars, editor/researcher/writer pipeline
3. **Onyx** (github.com/onyx-dot-app/onyx) — Enterprise-grade, two-tier orchestration
4. **LangChain Open Deep Research** (github.com/langchain-ai/open_deep_research) — StateGraph workflow
5. **Google ADK** — ParallelAgent → SequentialAgent pattern
