# miadi-spec-decomposer-kit — RISE Specification

## Desired Outcome

Any Miadi spec mission — however large — is decomposed into numbered waves with explicit RISE
phase alignment, acceptance criteria per wave, and a machine-readable wave manifest before the
first synthesis agent is invoked.  Analysts never improvise wave boundaries mid-session.

---

## Structural Tension

### Current Reality

L1 kits in `miadi-orchestration-kit` are excellent at *executing* within a wave (deep search,
STCKIN charting, rispec scaffolding, adversarial review) but provide no tooling for deciding:

- How many waves are needed?
- Which RISE phase does each wave belong to?
- What is the acceptance criterion that closes a wave?
- Which agent owns which wave?

This decomposition is done verbally in session prompts, producing inconsistent wave naming,
missing handoff artefacts, and agents that re-scope work already done in a prior wave.

The L2 bridge (`project-planning` / `task-planner`, `task-researcher`, `prd`) covers this
decomposition but is oriented toward product feature delivery, not RISE rispec work.  Its
output format (PRDs, GitHub issues) does not map cleanly to Miadi's wave-handoff and
track-handoff templates.

### Desired Outcome

A native Miadi kit that:

1. Accepts a spec mission brief.
2. Produces a `wave-plan.md` with RISE-aligned waves:
   - Wave R: Reverse-engineer (source analysis, STCKIN current-reality)
   - Wave I: Intent-extract (desired outcome, structural tension)
   - Wave S: Specify (rispec files, acceptance criteria)
   - Wave E: Export (wiki routing, provenance, promotion)
3. Each wave entry includes: scope, agents, skills, add-dirs, acceptance gate, and handoff
   artefact name.
4. Integrates with `openclaw-model-routing-research-kit`'s track-handoff template.

### Natural Progression

Phase 1 — run current L2 `task-planner` / `prd` on the community-layer spec mission;
capture the PRD output as a reference for what native Miadi decomposition should look like.
Phase 2 — translate PRD structure into RISE wave vocabulary; build `wave-plan.md` template.
Phase 3 — encode as native agents; retire L2 bridge.

---

## Proposed Kit Architecture

### Agents

| Agent | Description |
|-------|-------------|
| `miadi-wave-decomposer` | Accepts a mission brief; produces a RISE-aligned `wave-plan.md` with scope, agent assignments, and acceptance gates per wave. |
| `miadi-wave-gate-reviewer` | Reviews a completed wave's handoff artefact against the acceptance gate defined in `wave-plan.md`.  Emits green/red status; blocks wave N+1 if gate is not cleared. |
| `miadi-epic-mapper` | Optional: maps wave output to GitHub Epic/Issue structure for teams that track spec work in GitHub Projects. |

### Skills

| Skill | Description |
|-------|-------------|
| `miadi-wave-plan-template` | Slash command `/miadi-spec-decomposer-kit:wave-plan` — generates a `wave-plan.md` pre-filled with RISE phases, Miadi write-scope rules, and standard artefact names. |
| `miadi-acceptance-gate` | Slash command `/miadi-spec-decomposer-kit:gate-check` — validates a handoff artefact against the wave acceptance criteria and outputs a gate status table. |

---

## Gap Evidence

**L2 plugin replaced:** `project-planning` (mia-awesome-copilot)
— specifically `task-planner`, `task-researcher`, `plan`, and `prd` agents.

**Why native is better:**

- `project-planning` decomposes into GitHub features, epics, and implementation plans.  Miadi
  spec work decomposes into RISE waves with rispec files and track-handoff artefacts — a
  different output vocabulary.
- A native kit can enforce wave naming conventions, write-scope boundaries, and integration
  with `openclaw-model-routing-research-kit`'s launch manifest format.
- The native kit prevents waves from spawning work outside the `rispecs/` write path.

🌸 *Decomposition is not fragmentation — it is the art of finding the natural joints in a
complex intention, so each wave can breathe and complete before the next begins.*
