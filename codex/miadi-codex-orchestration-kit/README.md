# Miadi Codex Orchestration Kit

Codex-native orchestration workflows for Miadi sessions. This kit focuses on
repeatable session control rather than live external integrations.

## Included skills

| Skill | Use |
| --- | --- |
| `miadi-session-bootstrap` | Turn a raw prompt or mission brief into a session charter, artifact folder, initial source ledger, and optional first wave plan. |
| `miadi-rise-wave-plan` | Decompose a ready mission into RISE-aligned waves with scope, owners, evidence roots, acceptance gates, and handoff files. |
| `miadi-source-ledger` | Track claims, evidence, confidence, contradictions, and promotion status before synthesis or memory write-back. |
| `miadi-rispec-readiness-review` | Decide whether a rispec is ready to become a plugin, should be held, should be split, or needs more research. |
| `miadi-closeout-handoff` | Close a session with plan verification, source-ledger status, changed files, gaps, and next action. |

## Why this kit

The Copilot kits in `copilot/` already provide mature patterns for STCKIN
bootstrap, source-ledger discipline, adversarial review, design integration, and
promotion context. The rispec folders in `rispecs/` contain useful design
signals, but many explicitly mark themselves as future or provisional. This
Codex kit promotes only the stable control-plane behavior:

- session chartering,
- RISE wave planning,
- evidence/source ledgers,
- readiness gates,
- closeout handoffs.

## Deliberately not promoted

These rispec ideas remain future candidates until they have stronger operational
evidence:

- `rispecs/orchestration-plugin-recommender` because it requires at least three
  successful recommendation uses before promotion.
- `rispecs/codex-claw-dispatch-kit` because it involves live dispatch,
  acknowledgement capture, endpoint safety, and external-state mutation gates.
- `rispecs/agent-memory-provenance-framework` as a full write-back framework
  because schema promotion and confirmation behavior remain provisional.
- `rispecs/discord-integration-patterns`, `rispecs/openclaw-runtime-patterns`,
  `rispecs/permission-scoping-orchestration`, and related runtime patterns
  because they identify future promotion shapes rather than finished plugins.

The `miadi-rispec-readiness-review` skill exists to keep that boundary explicit.

## Local use

From this repository, add the plugin as a local Codex plugin:

```bash
codex plugin marketplace add /workspace/repos/jgwill/miadi-orchestration-kit/codex/miadi-codex-orchestration-kit
```

Then ask Codex to use one of the included skills, for example:

```text
Use miadi-session-bootstrap for this mission and create a session charter.
```

## Inspiration

This kit adapts patterns from:

- `copilot/stckin-orchestration-kit`
- `copilot/openclaw-model-routing-research-kit`
- `copilot/miadi-adversarial-review-kit`
- `/workspace/repos/miadisabelle/mia-awesome-codex-plugins/plugins/Kanevry/session-orchestrator`
- `/workspace/repos/miadisabelle/mia-awesome-codex-plugins/plugins/Habib0x0/spec-driven-plugin`

It does not copy runtime hooks or external command behavior from those plugins.
