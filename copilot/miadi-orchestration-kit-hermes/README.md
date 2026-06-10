# Miadi Orchestration Kit — Hermes Closure Layer

This Copilot plugin is a Hermes-facing companion to the existing Miadi Copilot kits.

It exists because issue `jgwill/Miadi#354` exposed a gap that is larger than prompt writing:

- Wave 1 created useful code but simulated lanes.
- Wave 2 used real named subagents and produced reports.
- Yet after the job completed, the repository still had uncommitted code and Chronicle material waiting for a closure decision.

That means the orchestration unit is not only:

> prompt + launch script + plugin list

It is:

> preparation payload + lane contracts + validation scripts + transcript audit + closure gate + commit/chronicle event packet.

## Agents

| Agent | Purpose |
| --- | --- |
| `miadi-hermes-closure-architect` | Designs and verifies the post-wave closure gate: changed-file ledger, commit partition, Chronicle event, and next-wave trigger decision. |
| `miadi-copilot-payload-steward` | Prepares launch payloads before Copilot runs: exact plugin roster, lane contracts, validation scripts, and recovery prompt templates. |

## Skills

| Skill | Purpose |
| --- | --- |
| `hermes-copilot-launch-preparation` | Before launch: produce machine-readable payloads, not only natural-language prompts. |
| `hermes-copilot-wave-closure` | After completion: inspect the report/transcript/diff, decide commit partitioning, create Chronicle event cards, and either prepare commits or launch a closure subagent. |

## Closure question surfaced by issue #354

When Copilot finishes a wave and no commit was made, Hermes must not treat the wave as fully complete.

The closure layer asks:

1. What changed?
2. Which changed files belong together?
3. What validation proves they are safe?
4. What Chronicle event did this wave create?
5. Should Hermes create the commit directly, or spawn a dedicated closure subagent?
6. What follow-up wave, if any, is automatically authorized?

## Recommended launch composition

Use this kit alongside implementation/review kits:

```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-orchestration-kit-hermes \
  --plugin-dir /workspace/repos/miadisabelle/mia-awesome-copilot/plugins/rug-agentic-workflow \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-adversarial-review-kit \
  --add-dir <active-miadi-worktree> \
  --add-dir <active-pde-folder> \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit
```

## Non-goal

This kit does not automatically push disruptive commits without a closure gate. It prepares the decision and, when authorized, can guide a dedicated commit/closure worker.
