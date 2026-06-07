# Multi-Agent Systems & Orchestration Patterns

**Architecture Foundations** for coordinating specialized agents in complex workflows.

## Key Patterns (≤50 words each)

### Orchestrator-Worker (Anthropic Production Pattern)
Lead agent analyzes, plans, persists strategy, spawns parallel isolated subagents. Each subagent receives minimal context, returns condensed output. 90% lift over single-agent; costs 15× tokens. Use when task value justifies cost.

### Blackboard Architecture
Shared workspace any specialist reads/writes; control shell arbitrates. Add/remove specialists without rewiring. 2–4× faster than sequential handoff. Matches dynamic orchestration with better token efficiency than traditional message-passing.

### Agents' Room (Narrative-Specific, Verified)
Decompose narrative by function—planning agents (character, plot) separate from writing agents (intro, body, conclusion). Expert-preferred over baseline single-agent story generation. Ready for Storyweaver pattern.

### Context Isolation (Verified Pattern)
Each subagent gets minimal fresh context, returns condensed output. Prevents cross-contamination, enables parallelism, lets each agent use full window for depth. Critical for consistency in long-form work.

### Critic Loop (Adversarial Review)
Builder→Critic→revise→human. Isolated self-correction (one critic) outperforms unguided homogeneous debate. Use for verification, brainstorming, policy decisions. Surfaces errors single monologue cannot.

### Delegation Precision
Vague subagent prompts cause duplication and drift. Specify: objective, output format, tool guidance, boundaries, effort scale. Clear contracts prevent agent hallucination and replication.

### HALO (Hierarchical Autonomous Logic-Oriented)
Three tiers: high-level planning→mid-level role-design agents→low-level inference agents. Dynamic role instantiation per detected subtask rather than hard-coded roles.

### Handoff Protocol (State Transfer)
Agent A returns Command(goto=B, update={...}); receiving agent gets fresh context plus relevant carryover. Typed state channels (LangGraph) enable checkpointing + time-travel debugging.

### Heterogeneous LLM Backbones
Assign different base models per role strength—8.4% MATH and 47% AIME gains from mixed chatbot+reasoner setups. Different agents should prefer different models (Claude/GPT/Gemini).

### Persona Specification
Inject role descriptors that steer style, formality, reasoning. Persona effects are prompt-sensitive—small wording changes shift behavior substantially. Operationalizes specialization.

## Storyweaver Application

The **Agents' Room** pattern is the validated model for Storyweaver:

1. **Planning agents** (Brief Archaeologist, World Architect, Outline Architect) do NOT write
2. **Writing agents** (Scene Writer, Revision Weaver, Line Editor) do NOT plan
3. **Review agents** (Developmental Editor, Critique Reviewer) produce observations, not rewrites
4. **Continuity Keeper** blocks export when facts/timelines materially conflict
5. **Cultural Protocol Steward** has authority to pause for human guidance

Context isolation + critic loop + explicit handoff contracts prevent the chaos of undifferentiated story generation.

## Open Challenges (2026)

1. **Async coordination**: Current lead blocks on subagents. Async unlocks ~3.5× throughput but adds state/coordination complexity.
2. **Dynamic role instantiation** (HALO mid-tier) is early-stage; most systems hard-code roles.
3. **Learned consensus** in adversarial loops still emerging (A-HMAD framework).
4. **Cross-agent memory** at scale: blackboard architectures easier to reason about than distributed message-passing.

## Sources

- [How we built our multi-agent research system — Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Agents' Room: Narrative Generation through Multi-step Collaboration (arXiv 2410.02603)](https://arxiv.org/abs/2410.02603)
- [HALO: Hierarchical Autonomous Logic-Oriented Orchestration (arXiv 2505.13516)](https://arxiv.org/pdf/2505.13516)
- [LangGraph Multi-Agent Patterns](https://reference.langchain.com/python/langgraph-supervisor)
- [Blackboard Architecture for Multi-Agent Systems (CallSphere)](https://callsphere.ai/blog/blackboard-architecture-multi-agent-systems-shared-knowledge-spaces)
- [Isolated Self-Correction Prevails Over Homogeneous Multi-Agent Debate (arXiv 2605.00914)](https://arxiv.org/html/2605.00914)
