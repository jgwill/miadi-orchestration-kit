# Medicine Wheel Orchestration Plugin Contract

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

Issue: `jgwill/miadi-orchestration-kit#36`

This packet defines a harness-neutral Medicine Wheel orchestration contract for
Miadi agents. Its purpose is to let a future agent create a plugin or extension
for one selected harness, such as Claude Code, Gemini CLI, GitHub Copilot,
Codex, or another MCP-aware runtime, without re-reading the whole source thread.

## Desired outcome

Miadi agents can use Medicine Wheel as an orchestration substrate: orienting
work through the Four Directions, checking Fire Keeper gates, opening and
closing ceremony context, using MCP/API health checks, preserving source
ledgers, and producing RISE wave plans.

## Current reality

Medicine Wheel PR `jgwill/medicine-wheel#62` introduced a strong plugin
integration proposal and briefly added a `rise-spec-advisor` CLI skill before
reverting it. Miadi already has separate plugin shapes for Copilot, Codex,
Claude Code, and Gemini. What is missing is the bridge: a portable contract
that maps Medicine Wheel capabilities into those harness-specific folders.

## What is in this folder

| File | Purpose |
| --- | --- |
| `01-reverse-engineer.md` | Observes Medicine Wheel PR #62, local MCP behavior, Miadi harness patterns, and known gaps. |
| `02-intent.md` | Names the desired plugin relationship, current reality, structural tension, and boundaries. |
| `03-specify.md` | Defines the portable Medicine Wheel orchestration adapter contract. |
| `04-export.md` | Gives harness-specific implementation recipes and validation gates. |
| `05-source-ledger.md` | Records source evidence, claim confidence, and promotion status. |

## Acceptance criteria

- A future agent can choose one harness and scaffold the plugin from
  `04-export.md`.
- The plugin contract stays separate from Medicine Wheel core runtime skills.
- The spec names active known issues that affect implementation behavior,
  especially ceremony activation and validator evidence depth.
- The source ledger distinguishes observed facts, source-backed inferences, and
  future design choices.
