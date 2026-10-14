# rispecs — Miadi Orchestration Kit

The RISE specifications for the kit's plugins, harness adapters and orchestration patterns,
one folder per surface. Layout: jgwill/llms-txt `llms-rispecs-layout.md` (#87).

> **R**everse-engineer → **I**ntent-extract → **S**pecify → **E**xport

## How a packet reads

Most folders hold a whole RISE pass, numbered in method order:

```
<packet>/
├── README.md               roadmap: desired outcome, files, acceptance criteria
├── 01-reverse-engineer.md  R   what was observed
├── 02-intent.md            I   desired outcome, current reality, tension, boundaries
├── 03-specify.md           S   the contract (larger packets continue 03-, 04-, … in reading order)
├── 04-export.md            E   harness recipes and validation gates
└── 05-source-ledger.md         sources, claim confidence, promotion status
```

Open the folder's `README.md` first. A folder holding a single file is read from that file.

## Packets

| Folder | Surface | Issue |
|--------|---------|-------|
| [`agent-memory-provenance-framework/`](./agent-memory-provenance-framework/) | Observed, inferred and user-confirmed agent memory: provenance metadata, trust, scope | #15 |
| [`chronicle-github-sessions-observability/`](./chronicle-github-sessions-observability/) | A session that asks opens one GitHub issue from its first prompt and comments on it at each exit: the ilex prototype, built as its own plugin `claude/miadi-session-issue` (0.1.0, 2026-10-14), opted into per session, with a tracing sink as option (specified, not built) | #89 |
| [`claude-session-orchestrator-plugin/`](./claude-session-orchestrator-plugin/) | The first native Claude Code plugin of the kit, `claude/miadi-session-orchestrator` | — |
| [`coaia-agent-orchestration-session/`](./coaia-agent-orchestration-session/) | Replayable session pack for the coaia-agent COAIA integration (README → `launch-context.md` → `session-charter.md`) | — |
| [`codex-claw-dispatch-kit/`](./codex-claw-dispatch-kit/) | A Codex plugin that sends a bounded work commission to a Claw agent through Gaia and keeps the dispatch record | — |
| [`community-layer-spec-plugins/`](./community-layer-spec-plugins/) | Spec plugins for the Miadi community/security layer: context mapper, security review, spec decomposer | — |
| [`discord-integration-patterns/`](./discord-integration-patterns/) | Discord channels, threads, webhooks and bot events as agent delivery and event-sourcing contexts (read-only research posture) | #15 |
| [`east-pde-session-orchestration/`](./east-pde-session-orchestration/) | Strategy-aware PDE decomposition and the Intent Analyst for EAST sessions | #37 |
| [`gemini/`](./gemini/) | Guidance for rispecs that may become Gemini CLI extensions (`AGENTS.md`) | #31 |
| [`medicine-wheel/`](./medicine-wheel/) | Medicine Wheel as a harness-neutral orchestration substrate: Four Directions, Fire Keeper gates, ceremony context | #36 |
| [`miadi-edge-case-collector/`](./miadi-edge-case-collector/) | The edge case collector: accountable collection of use and edge cases, with credit (`STCGOAL.md`, not yet specified) | — |
| [`miadi-storyweaver-orchestration-kit/`](./miadi-storyweaver-orchestration-kit/) | A Copilot-first storytelling orchestration kit: agents, skills, review gates, story artefacts | #9 |
| [`model-routing-orchestration/`](./model-routing-orchestration/) | OpenClaw model-routing study: model tiers, routing policy, fallback behaviour | #15 |
| [`openclaw-runtime-patterns/`](./openclaw-runtime-patterns/) | OpenClaw runtime abstraction, durable workflows, CLAW/gaia topology, model-swap survival, session isolation | #15 |
| [`orchestration-plugin-recommender/`](./orchestration-plugin-recommender/) | A helper that asks an LLM which Copilot plugin directories to load for a work context | — |
| [`pde-loop-closure-orchestration/`](./pde-loop-closure-orchestration/) | How agents, plugins and launch scripts consume miaco's PDE provenance instrument (proposed draft) | #35 |
| [`permission-scoping-orchestration/`](./permission-scoping-orchestration/) | Least-authority boundaries, capability amplification checkpoints, human review gates for OpenClaw-style runtimes | #15 |
| [`security-remediation-orchestration/`](./security-remediation-orchestration/) | Security-hardening work that starts in a live issue folder, extracts reusable patterns, and exports them as Miadi waves | jgwill/Miadi#263 |
