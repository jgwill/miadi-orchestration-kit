# miadi-context-mapper-kit — RISE Specification

## Desired Outcome

Analysts beginning any Miadi spec session have a deterministic, auditable `context-map.md`
listing every file, repository, and reference they must read *before* writing a single line
of spec prose.  No source discovery happens reactively mid-wave.

---

## Structural Tension

### Current Reality

`miadi-orchestration-kit` L1 kits (stckin, openclaw-rispec, adversarial-review) all assume
the analyst already knows which files are relevant.  In practice, community-layer spec work
spanning STPB, tushellplatform, Miadi, and mia-awesome-copilot requires mapping 4–6
repositories before the structural-tension charting phase can begin.  This mapping is done
ad hoc, causing:

- Mid-wave source discoveries that force scope resets.
- Incomplete STCKIN charts because a dependency was missed at launch.
- Token waste from reactive file fetching inside synthesis agents.

The L2 bridge (`context-engineering` / `context-architect`) fills this gap today but is not
aware of Miadi write-scope discipline, Miadi add-dir conventions, or RISE phase ordering.

### Desired Outcome

A native Miadi kit that:

1. Accepts a mission brief (e.g. "community/security layer rispec for Miadi").
2. Produces a `context-map.md` structured by RISE phase (Reverse-engineer sources,
   Intent files, Spec targets, Export destinations).
3. Validates that all listed paths exist and are readable before handing off to the next
   wave agent.
4. Integrates with `openclaw-model-routing-research-kit` preflight checks.

### Natural Progression

Phase 1 — harvest context-map outputs from current L2 bridge sessions → identify recurring
Miadi-specific file patterns (KINSHIP.md, STCKIN charts, rispecs/, copilot/ dirs).
Phase 2 — encode those patterns as agent instructions in a native Miadi kit.
Phase 3 — retire the L2 bridge; update all launch scripts.

No oscillation: each phase produces a usable artefact (bridge sessions → pattern catalogue →
native kit → cleaner sessions).

---

## Proposed Kit Architecture

### Agents

| Agent | Description |
|-------|-------------|
| `miadi-context-auditor` | Accepts a mission brief; interrogates target repositories (STPB, tushellplatform, Miadi, etc.) and enumerates every file needed per RISE phase.  Outputs `context-map.md`. |
| `miadi-context-validator` | Reads a `context-map.md` and verifies every listed path is accessible under the configured `--add-dir` set.  Reports missing or stale paths before any synthesis agent is invoked. |

### Skills

| Skill | Description |
|-------|-------------|
| `miadi-context-map-template` | Slash command `/miadi-context-mapper-kit:map` — generates the context-map template pre-filled with Miadi-specific sections (repositories, KINSHIP.md locations, rispec targets, write-scope boundaries). |
| `miadi-context-preflight` | Slash command `/miadi-context-mapper-kit:preflight` — runs path validation and outputs a green/red status table before a session begins. |

---

## Gap Evidence

**L2 plugin replaced:** `context-engineering` (mia-awesome-copilot)
— specifically the `context-architect` agent and `/context-engineering:context-map` skill.

**Why native is better:**

- `context-architect` is generic; it does not know Miadi's RISE phase structure, write-scope
  boundaries, or the standard add-dir set.
- A native kit can enforce that `KINSHIP.md` and `rispecs/` folders are always included in
  the map.
- A native kit can integrate directly with `openclaw-model-routing-research-kit`'s preflight
  manifest, avoiding duplicate validation steps.

🌸 *A context map is not just a file list — it is the ceremony of choosing which voices to
invite into the room before the spec begins to speak.*
