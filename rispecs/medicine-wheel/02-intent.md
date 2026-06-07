# 02 - Intent

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Desired outcome

A Miadi agent can create a Medicine Wheel orchestration plugin for any chosen
harness. The resulting plugin helps agents work through Medicine Wheel without
turning Medicine Wheel core into a harness-specific plugin host.

The plugin enables:

- Four Directions orientation for a mission or session,
- MCP/API health and tool discovery,
- ceremony lifecycle awareness,
- Fire Keeper permission and check-back gates,
- RISE spec review and wave planning,
- source-ledger and handoff artifacts that preserve evidence.

## Current reality

Medicine Wheel has a running MCP/API surface and proposal-grade plugin
integration design. Miadi has multiple harness-specific plugin directories and
RISE promotion discipline. The missing piece is a portable adapter contract that
converts Medicine Wheel semantics into those harness shapes.

The reverted `rise-spec-advisor` skill shows a useful capability, but placing it
inside `mw skill view` would blur runtime-adjacent Medicine Wheel skills with
cross-repo orchestration advising.

## Structural tension

Medicine Wheel naturally offers relation-aware orchestration surfaces:
directions, ceremonies, Fire Keeper gates, consent, OCAP, Wilson alignment, and
MCP tools. Miadi naturally offers cross-harness launch and plugin packaging
surfaces. Without a bridge spec, agents either copy ad-hoc prompts into one
harness or overload Medicine Wheel core with orchestration responsibilities that
belong in Miadi.

The advancing pattern is to keep Medicine Wheel as the source of relational
capability and define a Miadi adapter contract that each harness can implement
with its own packaging.

## Boundaries

This spec does not implement a plugin.

It does not claim that Medicine Wheel issue #64, #65, #66, or #67 are fixed.

It does not require `rise-spec-advisor` to return to `mw skill view`.

It does not authorize autonomous `act`-tier changes. Plugins may advise,
prepare, propose, and call safe read/analysis tools. Any write, GitHub action,
external dispatch, or data mutation must follow the host harness' consent and
permission rules.

It does not invent community relations beyond what source documents and user
instructions provide.

## Plugin identity

Working name: `miadi-medicine-wheel-orchestration-kit`

Portable role: Medicine Wheel orchestration adapter for Miadi agents.

Harness-specific names may vary:

- Copilot: `miadi-medicine-wheel-orchestration-kit`
- Codex: `miadi-medicine-wheel-orchestration-kit`
- Claude Code: `miadi-medicine-wheel-orchestrator`
- Gemini: `miadi-medicine-wheel-session-prep`
- Generic MCP runtime: `medicine-wheel-orchestration-adapter`

## Creative advancement scenario

**Creative Advancement Scenario**: A raw mission becomes a Medicine Wheel
orchestration session.

**Desired Outcome**: The operator begins with a direction-aware session that has
known MCP state, explicit gates, evidence sources, and a replayable wave plan.

**Current Reality**: The raw mission contains intent and constraints, but the
agent does not yet know which Medicine Wheel direction, ceremony context, tool
surface, or harness plugin shape should hold the work.

**Natural Progression**: The adapter probes Medicine Wheel health, maps the
mission through East/South/West/North, identifies Fire Keeper permission tier,
records source evidence, and produces a harness-native launch or plugin scaffold.

**Resolution**: The next agent can proceed with a clear ceremony-aware contract,
known caveats, and exact artifact paths.
