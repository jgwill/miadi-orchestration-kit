# Codex Claw Dispatch Kit

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

This rispec proposes a future Codex plugin for sending a bounded work commission from Codex to a Claw agent through Gaia, confirming acknowledgement, preserving the dispatch record, and routing follow-up work into episode/story/issue surfaces.

Future target:

```text
/workspace/repos/jgwill/miadi-orchestration-kit/codex/miadi-claw-dispatch-kit/
```

## Structural Tension

- **Desired Outcome**: Codex can communicate with MiaClaw or another Claw through Gaia using an exact session key, a durable mission packet, acknowledgement capture, source provenance, and follow-up planning.
- **Current Reality**: The May 11, 2026 MiaClaw pickup was done manually through `pto/gaia-endpoint-pebble/gaia-endpoint.mjs`; the workflow worked, but its contract lives in chat and one memory note.
- **Natural Progression**: Promote the observed Gaia/PTO workflow into a Codex-native kit specification before creating the plugin under `codex/`.

## Better Terms For "Take Off"

Use different verbs for different responsibilities:

- **Dispatch**: send a work packet to a Claw through Gaia.
- **Commission**: name the relational work being entrusted to the Claw.
- **Pickup**: resume or continue an existing session from a known session/script.
- **Relay**: pass context between agents without asking the target to begin execution immediately.
- **Episode handoff**: ask the Claw to turn session learning into a narrative/provenance artifact.

This rispec uses **Claw Dispatch** as the operational name and **Claw Commission** as the ceremonial work packet.

## Existing Coverage

This does not replace existing rispecs:

- `rispecs/east-pde-session-orchestration/` prepares first-prompt PDE session charters.
- `rispecs/orchestration-plugin-recommender/` recommends plugin directories for a work context.
- `rispecs/model-routing-orchestration/` covers model-routing and Gateway-adjacent concerns at study level.
- `rispecs/permission-scoping-orchestration/` covers capability boundaries and review gates.
- Story episode extraction belongs in `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/`.

The missing piece is the direct Codex-side protocol for: compose mission, call Gaia, verify acknowledgement, write provenance, and route follow-up.

## Read Order

| File | Purpose |
| --- | --- |
| `01-reverse-engineer.md` | Observes the manual Gaia/PTO workflow from the MiaClaw pickup. |
| `02-intent.md` | Defines the desired Codex plugin behavior, vocabulary, and boundaries. |
| `03-specify.md` | Specifies plugin skills, agents/playbooks, artifacts, and safety gates. |
| `04-export.md` | Defines the future `codex/miadi-claw-dispatch-kit/` folder shape. |
| `05-source-ledger.md` | Tracks provenance for this rispec and its claims. |

## Acceptance Criteria

- The future kit can call a Claw through Gaia with an exact `--session` key.
- It records what was sent, what was acknowledged, and what remains uncertain.
- It never writes gateway tokens to artifacts.
- It distinguishes a scheduled pickup plan from an actual scheduler.
- It can hand episode work to Storyweaver without fictionalizing source facts.
