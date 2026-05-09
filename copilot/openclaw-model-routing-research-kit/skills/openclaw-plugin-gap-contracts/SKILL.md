---
name: openclaw-plugin-gap-contracts
description: Reconcile OpenClaw study plugin gap names and contracts while keeping live connector implementation out of read-only research phases.
---

Use this skill when a track mentions missing plugins, connector gaps, or tool names.

## Reconciled Names

Use these names as canonical:

- `arxiv-search`
- `web-discovery-search`
- `github-code-search`
- `discord-channel-analyzer`
- `openclaw-runtime-inspector`
- `model-routing-policy-simulator`

Map older or draft names this way:

- `discord-integration -> discord-channel-analyzer`
- `openclaw-runtime-connector -> openclaw-runtime-inspector`
- `agent-routing-dispatch -> model-routing-policy-simulator`

There is no standalone `mythology-archetype-search`. Fold mythology, archetype, and narrative source discovery into source-ledger rules with normal source types and quality checks.

## Gap Contracts

| Canonical name | Purpose | Research phase treatment |
| --- | --- | --- |
| `arxiv-search` | Structured academic paper discovery. | Gap. Use web/deep-search mitigations and ledger every paper. |
| `web-discovery-search` | Broad discovery across docs, papers, repos, and discussions. | Gap. Use available search/fetch tools and mark discovery limitations. |
| `github-code-search` | Cross-repo implementation pattern discovery. | Gap. Use targeted repo reads when repos are already available. |
| `discord-channel-analyzer` | Inspect Discord channel, thread, webhook, and bot-event patterns. | Gap. Do not require live Discord access for read-only research. |
| `openclaw-runtime-inspector` | Inspect OpenClaw runtime topology, endpoint maps, sessions, and logs. | Gap. Do not require live runtime access unless manifest authorizes it. |
| `model-routing-policy-simulator` | Simulate routing policy decisions from task/risk/cost/context inputs. | Present as this skill/template pair. |

## Process

1. Normalize plugin names in notes, handoffs, and acceptance checks.
2. Separate required research capability from optional live connector implementation.
3. Record each gap in the track handoff with mitigation used.
4. Do not block read-only research because a live connector is missing.
5. Do not implement connectors during a research-only launch.
6. Escalate to human review if a track claims a connector result without evidence.

## Output

Add this section to handoffs when gaps appear:

```markdown
## Plugin Gap Contracts

Canonical gap:
Old name, if any:
Needed for:
Mitigation used:
Evidence quality impact:
Follow-up repo:
Blocking current track:
```
