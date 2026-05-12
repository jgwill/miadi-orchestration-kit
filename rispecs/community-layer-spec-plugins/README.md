# Community-Layer Spec Plugins — RISE Gap Analysis

**Mission context:** Creating a community/security layer rispec for the Miadi platform,
analysing STPB and tushellplatform as source patterns.

---

## Why Location-2 Plugins Were Needed

`miadi-orchestration-kit/copilot/` (Location 1) is a well-formed set of Miadi-native plugins
covering structural-tension charting, provenance routing, adversarial review, and RISE rispec
scaffolding.  However, when the community-layer spec mission began, three capability gaps
surfaced that no L1 kit could close:

| Gap | L1 coverage | L2 plugin chosen |
|-----|-------------|-----------------|
| **Pre-task context mapping** — knowing which files, repos, and patterns to read *before* writing a spec | ❌ None | `context-engineering` |
| **Epic / PRD-style decomposition** — breaking spec work into structured waves with clear acceptance criteria | ❌ None | `project-planning` |
| **Security-specialist review framing** — OWASP / Zero-Trust / LLM-security lens for auth, roles, admin surfaces | ❌ None | `software-engineering-team` (`se-security-reviewer`) |

These gaps are not incidental; they represent the three phases that *precede* the structural
tension and rispec work that L1 handles well.  Without them, the analyst arrives at the
synthesis stage without a complete source map, without a wave plan, and without security
validation — producing a spec that is structurally sound but strategically shallow.

---

## RISE Analysis

### Current Reality (L1 Gaps)

- Analysts load L1 kits and jump directly into STCKIN / synthesis without a systematic
  context-map step.  Files are discovered reactively, causing oscillation (discovering a
  missing dependency mid-wave, reverting, re-scoping).
- Spec work is decomposed informally — no EPICs, no PRDs, no acceptance gates per wave.
  This produces large, monolithic rispec documents that are hard to iterate on.
- Security surfaces (auth flows, role hierarchies, admin escalation paths in STPB /
  tushellplatform) are reviewed by the same agents doing synthesis, creating blind-spot
  risk.  No dedicated security-reviewer framing exists in L1.

### Desired Outcome (Full Plugin Coverage)

Three native Miadi-kit equivalents exist in L1, built to the same opinionated conventions
(RISE phasing, Miadi write-scope discipline, Miadi-specific add-dir conventions):

1. **`miadi-context-mapper-kit`** — pre-task context audit; produces a `context-map.md`
   listing every file/repo required before a spec session begins.
2. **`miadi-spec-decomposer-kit`** — converts a high-level spec mission into waves, EPICs,
   and PRD-level acceptance criteria aligned to RISE phases.
3. **`miadi-security-review-kit`** — dedicated security-reviewer agent scoped to Miadi's
   auth/roles/admin/webhook attack surface.

### Structural Tension

```
Current Reality ──────────────────────────────────── Desired Outcome
   L1 has synthesis + scaffolding power              L1 is self-contained for full
   but no pre-task mapping, no wave                  community-layer spec lifecycle:
   decomposition, no security framing.               map → plan → secure → synthesise
                        ↕  (tension)
   Bridge: use L2 plugins (context-engineering,
   project-planning, software-engineering-team)
   until native L1 kits are forged.
```

Natural progression without oscillation:

1. Use L2 bridges now (this folder documents how).
2. Harvest patterns from L2 plugin sessions → feed into native kit specs (the three
   rispec files in this directory).
3. Build native kits in `miadi-orchestration-kit/copilot/` following the harvested patterns.
4. Retire L2 bridges; update session launch scripts to use only L1.

---

## Recommended Native L1 Kits

### `miadi-context-mapper-kit`
Native equivalent of `context-engineering`.  See:
[`miadi-context-mapper-kit.rispec.md`](./miadi-context-mapper-kit.rispec.md)

### `miadi-spec-decomposer-kit`
Native equivalent of `project-planning` for RISE spec work.  See:
[`miadi-spec-decomposer-kit.rispec.md`](./miadi-spec-decomposer-kit.rispec.md)

### `miadi-security-review-kit`
Native equivalent of the `se-security-reviewer` agent in `software-engineering-team`.  See:
[`miadi-security-review-kit.rispec.md`](./miadi-security-review-kit.rispec.md)

---

## Bridge Instructions

Until native kits exist, load L2 plugins alongside L1 kits in the same Copilot session:

```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit \
  --plugin-dir /workspace/repos/miadisabelle/mia-awesome-copilot/plugins/context-engineering \
  --plugin-dir /workspace/repos/miadisabelle/mia-awesome-copilot/plugins/project-planning \
  --plugin-dir /workspace/repos/miadisabelle/mia-awesome-copilot/plugins/software-engineering-team \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /src/STPB \
  --add-dir /src/tushellplatform \
  --add-dir /src/Miadi
```

Read the `MIADI-CONTEXT.md` file inside each L2 plugin folder for Miadi-specific invocation
guidance before starting a spec session.

---

🌸 *Every gap documented here is not a failure of the kit — it is the structural tension
that pulls the work forward, the space between what exists and what must be forged together.*
