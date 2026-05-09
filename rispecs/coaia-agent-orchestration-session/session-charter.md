# Session Charter — coaia-agent COAIA Integration

> Instantiated from [`copilot/session-charter-template.md`](../../copilot/session-charter-template.md)

**Session UUID**: 2604291305-coaia-agent-rispecs (spec-authoring parent)
**Implementation session UUID**: to be assigned at launch
**PDE UUID**: 4da3f9f5-4fe4-4b92-9e9f-f4fead872780
**Model**: claude-opus-4.6 (approved fallback: claude-sonnet-4.6 if claude-opus-4.6 unavailable)
**Authored**: 2026-04-29 by NORTH N3

---

## Objective

Implement the COAIA integration rispec pack for `coaia-agent` into working integration code:

- Register COAIA toolsets (coaia-pde MCP, coaia-narrative MCP, mcp-pde MCP) in the Hermes tool registry as opt-in families
- Wire STC creation, MMOT evaluation, PDE decomposition, and governance annotation as callable tools
- Author `app.spec.md` and any remaining rispec gaps identified during implementation
- Exit with all acceptance criteria from `veritas-mmot-companion.spec.md`, `medicine-wheel-governance.spec.md`, and `accountability-responsibility.rispec.md` checked or explicitly deferred

---

## Structural Tension

**Current Reality**: coaia-agent is an unmodified Hermes Agent 0.11.0 fork. No COAIA toolsets are registered. No rispecs existed before the spec-authoring session (2604291305). The rispec pack now exists but is not wired to any runtime code.

**Desired Outcome**: A coaia-agent session can optionally invoke PDE decomposition, STC creation, MMOT evaluation, and governance annotation through the Hermes tool registry — with Veritas and Medicine Wheel governance as independently opt-in tiers. The `HERMES_HOME=~/.coaia-agent` profile provides COAIA isolation without forking the runtime.

---

## Roots to Inspect

All `--add-dir` paths below. The executor must read these before Wave 1:

```
/a/src/coaia-agent
/a/src/coaia-agent/rispecs
/a/src/coaia-narrative
/a/src/coaia-visualizer
/a/src/coaia-planning
/a/src/coaia-pde
/a/src/mcp-pde
/a/src/mia-code/miaco
/workspace/repos/jgwill/miadi-orchestration-kit
/workspace/repos/jgwill/veritas
/workspace/repos/jgwill/medicine-wheel
/a/src/.mia/coaia-agent/deep-dive-2604291305
```

---

## Artefact Folder

```
/a/src/.mia/coaia-agent/implementation-session-<YYYYMMDDHHMM>/
```

Replace `<YYYYMMDDHHMM>` with the actual session timestamp at launch. The executor creates this folder in Wave 0 (bootstrap) and writes `EXECUTION_LOG.md` before any implementation wave opens.

---

## Plugin Dirs (all six must be active)

```
/workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit
/workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-promotion-context-kit
/workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-adversarial-review-kit
/workspace/repos/jgwill/miadi-orchestration-kit/copilot/structured-autonomy
/workspace/repos/jgwill/miadi-orchestration-kit/copilot/software-engineering-team
/workspace/repos/jgwill/miadi-orchestration-kit/copilot/project-planning
```

---

## Lane Contract

### Main lane (conductor only)

The main session is a **conductor**. It does not directly write runtime code or rispec files. It:
- Launches sub-agents (SOUTH, WEST, NORTH) per wave
- Reads wave reports and routes decisions back to the human
- Maintains `EXECUTION_LOG.md`
- Calls `stckin-artefact-report` skill at each wave boundary

### Lane A — SOUTH: Package Contract Archaeology

Read and validate existing MCP tool surfaces before any implementation wave. Produce `wave-1-south-report.md`.

Reads: `/a/src/coaia-pde/`, `/a/src/coaia-narrative/`, `/a/src/mcp-pde/`, Veritas MCP spec, Medicine Wheel ceremony-protocol spec.

Deliverable: Confirmed tool names, schemas, transport types, env var requirements for all COAIA MCP servers.

### Lane B — WEST: Validation and Contradiction Pass

After NORTH rispec-implementation waves, validate each acceptance criterion. Produce `wave-N-west-report.md`.

Uses: `miadi-adversarial-review-kit` (rise-revision-critic), `se-technical-writer`.

Deliverable: Pass/fail/deferred status for each acceptance criterion in the three main rispecs.

### Lanes C–J — NORTH: Implementation Waves (one per rispec file or code unit)

| Lane | Target | Wave |
|---|---|---|
| N-C | `tools/coaia_pde_tool.py` — PDE toolset registration | Wave 2 |
| N-D | `tools/coaia_narrative_tool.py` — coaia-narrative MCP toolset | Wave 3 |
| N-E | `tools/coaia_veritas_tool.py` — Veritas toolset (opt-in) | Wave 4 |
| N-F | `tools/coaia_governance_tool.py` — Tier 1/2/3 governance | Wave 5 |
| N-G | Config template update — governance, veritas, toolsets blocks | Wave 5 |
| N-H | `app.spec.md` authoring — missing overview rispec | Wave 6 |
| N-I | WEST validation pass | Wave 7 |
| N-J | `session-summary.md` + artefact close | Wave 8 |

Each NORTH lane:
- Reads its target rispec before writing any code
- Does not touch files owned by other lanes
- Exits with a `wave-<N>-<lane>-report.md` in the artefact folder

### Main-lane preservation rule

The main lane must not absorb implementation diffs. All file changes go through named NORTH sub-agents. The main lane only reads sub-agent reports, routes human decisions, and writes to `EXECUTION_LOG.md`.

---

## Required Outputs

At session close, the following must exist or be explicitly deferred with justification:

**Implementation outputs (in `coaia-agent/tools/`)**:
- `tools/coaia_pde_tool.py` — PDE toolset registered in Hermes registry
- `tools/coaia_narrative_tool.py` — coaia-narrative MCP toolset
- `tools/coaia_veritas_tool.py` — Veritas toolset (opt-in, check_fn gated)
- `tools/coaia_governance_tool.py` — governance check integration (Tiers 1–3)
- Config template updated with `governance.*`, `veritas.*`, `toolsets.coaia.*` blocks

**Rispec outputs (in `coaia-agent/rispecs/`)**:
- `app.spec.md` — high-level overview and reading order (created in this session)
- All acceptance criteria from `veritas-mmot-companion.spec.md` checked or deferred
- All acceptance criteria from `medicine-wheel-governance.spec.md` checked or deferred
- All acceptance criteria from `accountability-responsibility.rispec.md` checked or deferred

**Session state outputs (in `.mia/coaia-agent/implementation-session-<timestamp>/`)**:
- `EXECUTION_LOG.md` — live tracker updated after each wave
- `wave-<N>-report.md` per wave
- `session-summary.md` — final close, what was created, what remains, child issue list

**Orchestration pack updates (in this folder)**:
- `EXECUTION_LOG.md` is NOT here — it lives in the artefact folder above
- This `session-charter.md` may be annotated with actual wave results after close

---

## Special Boundaries

**Must stay provenance-only (do not promote to runtime code in this session)**:
- Identity normalization (`hermes-agent` → `coaia-agent` in pyproject.toml / package.json) — gated by C1–C7 human decisions
- Direction casing normalization adapter — specified in contradictions.md but human decision pending
- Medicine Wheel authority assignment (elder/firekeeper/steward) — coaia-agent remains unentitled

**May promote to spec during this session**:
- `app.spec.md` — high-level overview if not already authored by the spec-authoring session

**Must remain context-layer / retrieval-adjacent**:
- Veritas companion model IDs stored in STC metadata — these are discoverable artifacts, not governance authority

**Deferred to implementation session decision**:
- Plugin graduation: whether to create a `.github/plugin/plugin.json` for coaia-agent — assess after Wave 6; do not create unless the pattern recurs

---

## Audit Note

Each wave exits with a `wave-<N>-report.md` auditable by:

```bash
copilot --resume --model gpt-5-mini --reasoning-effort high --yolo --no-ask-user \
  -p "Read EXECUTION_LOG.md and wave-<N>-report.md in /a/src/.mia/coaia-agent/implementation-session-<timestamp>/. Report: lanes used, files changed, acceptance criteria checked, what remains. Do not make changes."
```

The audit session must be able to answer concretely on these dimensions without reading chat history.
