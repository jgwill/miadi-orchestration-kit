---
name: use-design-bundle-integration-kit
description: >
  Use this skill when Claude Code needs to integrate a Claude Design bundle
  (claude.ai/design) into a target codebase via Copilot CLI orchestration.
  Triggers on: "implement the design bundle", "integrate the claude design",
  "wire up the bundle into <repo>", "run the design integration waves", or
  any task that already has a PDE folder with `bundle/` extracted and an
  `orchestration/` subfolder pending. Tells Claude Code (the main-session
  orchestrator) how to dispatch waves to the
  `miadi-design-bundle-integration-kit` Copilot plugin while keeping the
  main session context clean.
version: 0.1.0
---

# Use the Design Bundle Integration Kit

This skill is **for Claude Code in the main session**. It explains how to use the reusable Copilot plugin at `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-design-bundle-integration-kit` to integrate any Claude Design bundle into any target codebase.

The plugin holds the generic toolkit (agents + skills). The PDE's orchestration folder holds the instance-specific charters. Claude Code is the conductor.

## When this skill applies

- A Claude Design bundle has been fetched and extracted (typically under `<pde-folder>/bundle/<project>/`).
- The bundle has a `README.md`, `chats/`, and `project/` (with `tokens.css`, hub `index.html`, screens, and artifacts).
- A PDE folder already exists with a `claude-design-handoff.md` describing the bundle and the integration intent.
- The user is ready to begin (or resume) the integration waves.

If the bundle has not yet been fetched and extracted, that is a prior phase — handle it directly in the main session (the integration kit does not fetch bundles).

## What Claude Code does (the main-session orchestrator role)

1. **Read the PDE's `claude-design-handoff.md`** to confirm: bundle path, target codebase, milestone reference, key fidelity anchors.
2. **Confirm the orchestration folder exists** at `<pde-folder>/orchestration/` with at minimum:
   - `prompts/wave1-*.txt`, `prompts/wave2-*.txt`, `prompts/wave3-*.txt` (session charters)
   - `launch.sh` (parameterized launcher)
   - `audit.sh` (cheap post-wave audit)
   - `MAIN_SESSION_HANDOFF.md` (instance-specific orchestration brief)
3. **Read `MAIN_SESSION_HANDOFF.md`** — this is where the previous Claude Code instance recorded everything you need to know about this specific Design→Codebase pair.
4. **Run waves sequentially**, one at a time:
   - `./launch.sh <N>` — runs the wave via Copilot CLI with the kit plugged in
   - `./audit.sh <N>` — runs the cheap post-wave audit using a free model (gpt-5-mini)
   - Read `wave-<N>-report.md` after each wave; verify the orchestration contract was followed
   - If audit shows the contract broke, tighten the prompt before launching the next wave
5. **Stay out of implementation**. The whole point of the kit is that Claude Code does not absorb implementation diffs. You are the conductor; Copilot + its subagents do the work; reports come back as compressed summaries.
6. **The final wave (audit + close) stays in main session** — you read all the reports, validate the integration, link rispecs, and close the milestone or issue.

## The launch contract (what the orchestration folder's `launch.sh` does)

```bash
copilot \
  --model gpt-5.4 \
  --reasoning-effort xhigh \
  --yolo \
  --no-ask-user \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-design-bundle-integration-kit \
  --add-dir <target-codebase> \
  --add-dir <pde-folder> \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /workspace/repos/miadisabelle/mia-awesome-copilot \
  --share <pde-folder>/orchestration/wave-<N>-session.md \
  --share-gist \
  --name "<wave-name>" \
  -p "$(cat <pde-folder>/orchestration/prompts/wave<N>-*.txt)"
```

`--share-gist` exports the full subagent dispatch ledger to a secret GitHub gist after the wave completes — Claude Code uses this to review and evolve the session.

## The audit contract

After every wave:

```bash
copilot --resume --model gpt-5-mini --reasoning-effort high --yolo --no-ask-user \
  --add-dir <target-codebase> \
  --add-dir <pde-folder> \
  --share <pde-folder>/orchestration/wave-<N>-audit-session.md \
  --name "<wave-name>-audit" \
  -p "Read wave-<N>-report.md and the implementation files. Verify orchestration contract was followed: lane discipline, two-stage review, READ-ONLY bundle, context preservation, token fidelity. Report concretely with file:line. If broken, say where."
```

`gpt-5-mini` is free — the audit is cheap. Always run it.

## Required reading before invoking

In order:

1. The PDE's `claude-design-handoff.md` — the integration intent
2. The PDE's `orchestration/MAIN_SESSION_HANDOFF.md` — instance-specific orchestration brief
3. `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-design-bundle-integration-kit/README.md` — kit overview
4. `/b/trading/skills/software-development/miadi-copilot-wave-launcher/SKILL.md` — wave launcher conventions
5. `/b/trading/skills/software-development/subagent-driven-development/SKILL.md` — fresh-subagent-per-task pattern

## Hard rules

- Don't fork the plugin. If a new Design→Codebase pair needs integration, write new prompts in a new PDE's orchestration folder and point at the same `--plugin-dir`.
- Don't run waves out of order. Tokens before Hub before Screens before Audit.
- Don't skip the cheap audit between waves.
- Don't absorb implementation diffs into main-session context. Read wave reports; trust the orchestration contract; spot-check critical files only when an audit flags a gap.
- The Audit + Close wave **stays in main session** — synthesizing across all waves needs main-session context, not Copilot's.

## Where this fits in the suite

| Kit | Use when |
|---|---|
| `stckin-orchestration-kit` | STCKin / structural-tension-aware deep-search |
| `miadi-promotion-context-kit` | Provenance → spec → wiki → retrieval promotion |
| `miadi-adversarial-review-kit` | Adversarial review of in-flight work |
| **`miadi-design-bundle-integration-kit`** | Design→Codebase integration (this skill drives it) |

Compose by stacking `--plugin-dir <kit>` flags when a wave needs multiple kits.
