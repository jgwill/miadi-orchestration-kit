# Export

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Future Plugin Folder

```text
/workspace/repos/jgwill/miadi-orchestration-kit/codex/miadi-claw-dispatch-kit/
  .codex-plugin/
    plugin.json
  README.md
  skills/
    claw-dispatch-preflight/
      SKILL.md
    claw-commission-send/
      SKILL.md
    claw-acknowledgement-ledger/
      SKILL.md
    claw-episode-followup/
      SKILL.md
  agents/
    claw-dispatch-architect.md
    gateway-provenance-auditor.md
    episode-handoff-steward.md
  templates/
    commission-packet.md
    acknowledgement-ledger.md
    followup-plan.md
```

## Manifest Sketch

```json
{
  "name": "miadi-claw-dispatch-kit",
  "description": "Codex kit for Gaia-backed Claw dispatch, acknowledgement capture, provenance, and episode handoff planning.",
  "version": "0.1.0",
  "author": {
    "name": "Miadi"
  },
  "repository": "https://github.com/jgwill/miadi-orchestration-kit",
  "license": "MIT",
  "keywords": [
    "miadi",
    "codex",
    "openclaw",
    "gaia",
    "dispatch",
    "handoff",
    "storyweaver"
  ]
}
```

## Launch Pattern

The future skill should support this operator shape:

```text
Use miadi-claw-dispatch-kit to dispatch this commission to MiaClaw through Gaia:
- session: pde-2605111213--f32f2748-4870-45bd-bf55-49230aab96fa
- schedule: May 11, 2026 at 11:00 PM America/Toronto
- source: /workspace/repos/scripts/RESUME--gemini--session--8a3c1d91-4cb4-49ba-8a96-8e349ea4e3fe.creator-of--pde-2605111213--f32f2748-4870-45bd-bf55-49230aab96fa.sh
- expected ack: planned pickup time, session ID, first artifact
```

The skill resolves the endpoint path from known workspace context or asks only if it cannot find one.

## Smoke Test Idea

The first implementation smoke test should not call the live Gateway. It should run preflight against a fixture and verify that:

- `commission-packet.md` contains the target Claw, exact session ID, schedule, source paths, and expected acknowledgement.
- `command-shape.md` includes a redacted endpoint command.
- no token-like string appears in artifacts.
- the follow-up plan routes narrative work to the Storyweaver session-episode spec.

Live dispatch should require an explicit user request because it sends data to another runtime.

## Promotion Path

1. Keep this rispec as the source of truth.
2. Add the Storyweaver session-episode extension before implementation.
3. Scaffold `codex/miadi-claw-dispatch-kit/`.
4. Add fixture-based preflight smoke tests.
5. Only then add optional live-dispatch behavior.
