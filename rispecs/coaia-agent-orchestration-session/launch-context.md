# Launch Context — coaia-agent COAIA Integration Session

> Complete launch command and wave sequence for the coaia-agent implementation session. Copy-paste ready — replace only `<YYYYMMDDHHMM>` with the actual session timestamp.

**Session UUID**: to be assigned at launch
**PDE UUID**: 4da3f9f5-4fe4-4b92-9e9f-f4fead872780
**Model preference**: claude-opus-4.6
**Model fallback**: claude-sonnet-4.6 (approved closest fallback — claude-opus-4.6 may not be available in environment; use claude-sonnet-4.6 if so)
**Authored**: 2026-04-29 by NORTH N3 (claude-sonnet-4.6)

---

## Launch Command

```bash
copilot \
  --yolo \
  --no-ask-user \
  --model claude-opus-4.6 \
  --reasoning-effort xhigh \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-promotion-context-kit \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-adversarial-review-kit \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/structured-autonomy \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/software-engineering-team \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/project-planning \
  --add-dir /a/src/coaia-agent \
  --add-dir /a/src/coaia-agent/rispecs \
  --add-dir /a/src/coaia-narrative \
  --add-dir /a/src/coaia-visualizer \
  --add-dir /a/src/coaia-planning \
  --add-dir /a/src/coaia-pde \
  --add-dir /a/src/mcp-pde \
  --add-dir /a/src/mia-code/miaco \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /workspace/repos/jgwill/veritas \
  --add-dir /workspace/repos/jgwill/medicine-wheel \
  --add-dir /a/src/.mia/coaia-agent/deep-dive-2604291305 \
  --add-dir /a/src/.mia/coaia-agent/implementation-session-<YYYYMMDDHHMM> \
  -p "Use the stckin-wave-bootstrap skill. Then read /workspace/repos/jgwill/miadi-orchestration-kit/rispecs/coaia-agent-orchestration-session/session-charter.md and /workspace/repos/jgwill/miadi-orchestration-kit/rispecs/coaia-agent-orchestration-session/README.md. Create the artefact folder at /a/src/.mia/coaia-agent/implementation-session-<YYYYMMDDHHMM>/ and write EXECUTION_LOG.md. Then begin Wave 1 (SOUTH Lane A — package contract archaeology)."
```

### Model Fallback Note

If `claude-opus-4.6` is not available in the environment, use `claude-sonnet-4.6` as the approved closest fallback. Replace `--model claude-opus-4.6` with `--model claude-sonnet-4.6`. Document the fallback in the session's `EXECUTION_LOG.md` under a `## Model` section.

---

## Resume Command

```bash
copilot \
  --resume \
  --model gpt-5-mini \
  --reasoning-effort high \
  --yolo \
  --no-ask-user \
  -p "Read /a/src/.mia/coaia-agent/implementation-session-<YYYYMMDDHHMM>/EXECUTION_LOG.md and the most recent wave-<N>-report.md in the same folder. Continue from the last incomplete lane. Do not restart completed waves."
```

Use `gpt-5-mini` for resume to minimize cost. If the resumed lane requires implementation-grade reasoning, upgrade to `claude-sonnet-4.6` for that wave only.

---

## Wave Sequence

| Wave | Lane | Model | Deliverable |
|---|---|---|---|
| 0 — Bootstrap | Main (conductor) | claude-opus-4.6 / sonnet fallback | Artefact folder, `EXECUTION_LOG.md`, plugin smoke test |
| 1 — SOUTH archaeology | Lane A | claude-sonnet-4.6 | `wave-1-south-report.md` — confirmed MCP tool schemas, transport, env vars |
| 2 — NORTH: PDE tool | Lane N-C | claude-sonnet-4.6 | `tools/coaia_pde_tool.py`, `wave-2-report.md` |
| 3 — NORTH: narrative tool | Lane N-D | claude-sonnet-4.6 | `tools/coaia_narrative_tool.py`, `wave-3-report.md` |
| 4 — NORTH: Veritas tool | Lane N-E | claude-sonnet-4.6 | `tools/coaia_veritas_tool.py`, `wave-4-report.md` |
| 5 — NORTH: governance tool + config | Lanes N-F, N-G | claude-sonnet-4.6 | `tools/coaia_governance_tool.py`, config template update, `wave-5-report.md` |
| 6 — NORTH: app.spec.md | Lane N-H | claude-sonnet-4.6 | `coaia-agent/rispecs/app.spec.md`, `wave-6-report.md` |
| 7 — WEST: validation | Lane N-I | claude-sonnet-4.6 | Acceptance criteria pass/fail/deferred, `wave-7-west-report.md` |
| 8 — Close | Lane N-J | gpt-5-mini | `session-summary.md`, orchestration pack annotation, child issue list |

### Wave Boundary Rule

Each wave exits with a `wave-<N>-report.md` in the artefact folder before the next wave opens. The conductor reads the report, updates `EXECUTION_LOG.md`, and opens the next wave. If a wave report is absent, the conductor does not proceed — it surfaces the gap to the human operator.

---

## Required Reading Before Wave 1

The executor must confirm these files exist and are readable before opening Wave 1:

1. `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/coaia-agent-orchestration-session/README.md`
2. `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/coaia-agent-orchestration-session/session-charter.md`
3. `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs/coaia-agent-orchestration-session/launch-context.md` (this file)
4. `/a/src/.pde/2604291317--4da3f9f5-4fe4-4b92-9e9f-f4fead872780/pde-4da3f9f5-4fe4-4b92-9e9f-f4fead872780.md`
5. `/a/src/coaia-agent/rispecs/KINSHIP.md`
6. `/a/src/coaia-agent/rispecs/contradictions.md`
7. `/a/src/coaia-agent/rispecs/veritas-mmot-companion.spec.md`
8. `/a/src/coaia-agent/rispecs/medicine-wheel-governance.spec.md`
9. `/a/src/coaia-agent/rispecs/accountability-responsibility.rispec.md`

If any of 4–9 are missing, the executor creates the missing files before Wave 1 (they should have been created by the spec-authoring session that produced this launch context).

---

## Skills Available

| Skill | Source | When to invoke |
|---|---|---|
| `stckin-wave-bootstrap` | stckin-orchestration-kit | Wave 0 — confirm plugin load, read sources, check artefact folder |
| `stckin-artefact-report` | stckin-orchestration-kit | End of each wave — replayable artefact notes |
| `rise-pde-session-multi-agents-v2` | user-installed | Main session orchestration envelope if running full multi-agent mode |
| `deep-research` | miadi-orchestration-kit | If a specific COAIA package relation needs deeper survey mid-session |
| `adversarial-rise-review` | miadi-adversarial-review-kit | Wave 7 WEST validation pass |

---

## RISE Orientation Note

This launch context is not a fix-the-broken-state document. It advances toward a desired outcome:

> **coaia-agent sessions can invoke COAIA ceremony-aware tooling** — PDE decomposition, STC creation, MMOT evaluation, governance annotation — through the Hermes tool registry, with Veritas and Medicine Wheel as independently opt-in tiers. The structural tension between raw agentic execution and ceremony-aware relational methodology is held, not collapsed.

Every wave decision should be tested against this desired outcome, not against a checklist of missing files.
