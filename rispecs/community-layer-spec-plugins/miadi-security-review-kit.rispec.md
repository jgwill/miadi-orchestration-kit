# miadi-security-review-kit — RISE Specification

## Desired Outcome

Every community/security layer rispec produced for the Miadi platform has been reviewed by a
dedicated security agent before promotion.  Auth flows, role hierarchies, admin escalation
paths, and webhook surfaces are evaluated against OWASP Top 10, Zero-Trust principles, and
LLM-specific attack vectors.  Security findings are artefacted in a `security-review.md`
alongside each rispec.

---

## Structural Tension

### Current Reality

L1 kits include `miadi-adversarial-review-kit` for general skeptical pressure-testing of
spec claims.  This is valuable but **not** a security review:

- Adversarial review challenges *reasoning quality* (are the claims well-evidenced?).
- Security review challenges *attack surface* (can this design be exploited?).

For community/security layer specs covering STPB user roles, Miadi webhook auth, and admin
privilege escalation, the distinction is critical.  Without a dedicated security-reviewer
framing, the following risks go unexamined:

- Insecure direct object references in community role APIs.
- JWT/session token scope creep across Miadi webhook event types.
- LLM prompt-injection through community-submitted content processed by agents.
- Admin privilege escalation via STPB's role-inheritance graph.

The L2 bridge (`software-engineering-team` / `se-security-reviewer`) provides OWASP Top 10
and Zero-Trust framing but is not aware of Miadi's specific attack surface (webhook-driven
agent invocation, LLM-processing of community content, Miadi permission-scoping model).

### Desired Outcome

A native Miadi kit that:

1. Reads a rispec (or draft spec section) and the source patterns it is based on (STPB,
   tushellplatform auth flows).
2. Produces a `security-review.md` structured by threat category:
   - Authentication & session (JWT, webhook HMAC validation)
   - Authorization & roles (STPB role graph, admin escalation)
   - LLM attack surface (prompt injection, jailbreak via community content)
   - Data exposure (PII in agent logs, JSONL narrative stores)
   - Supply-chain (plugin loading, copilot add-dir trust boundaries)
3. Rates each finding by severity (Critical / High / Medium / Low).
4. Integrates with `miadi-adversarial-review-kit` — adversarial review runs *first*
   (claim quality), security review runs *second* (attack surface).

### Natural Progression

Phase 1 — run `se-security-reviewer` on the community-layer rispec draft; capture findings
and map them to Miadi-specific threat categories.
Phase 2 — build a `miadi-security-threat-model.md` template encoding those categories.
Phase 3 — encode as a native agent; retire the L2 bridge.

---

## Proposed Kit Architecture

### Agents

| Agent | Description |
|-------|-------------|
| `miadi-security-reviewer` | Reads a rispec or spec section; applies OWASP Top 10, Zero-Trust, and LLM-security lenses scoped to Miadi's webhook, auth, and community-content attack surfaces.  Outputs `security-review.md`. |
| `miadi-threat-modeler` | Produces or updates a STRIDE-based threat model for a Miadi subsystem (e.g. community layer, webhook pipeline, admin panel).  Feeds into the spec's *Current Reality* section. |

### Skills

| Skill | Description |
|-------|-------------|
| `miadi-security-review-template` | Slash command `/miadi-security-review-kit:review` — generates a `security-review.md` pre-filled with Miadi threat categories and severity rubric. |
| `miadi-threat-model-template` | Slash command `/miadi-security-review-kit:threat-model` — generates a STRIDE threat-model template scoped to the Miadi platform subsystem named in the prompt. |
| `miadi-owasp-checklist` | Slash command `/miadi-security-review-kit:owasp-check` — runs an OWASP Top 10 checklist against a named rispec file and outputs pass/fail per category. |

---

## Gap Evidence

**L2 plugin replaced:** `software-engineering-team` (mia-awesome-copilot)
— specifically the `se-security-reviewer` agent.

**Why native is better:**

- `se-security-reviewer` applies generic OWASP / Zero-Trust framing.  A native kit encodes
  Miadi-specific attack surfaces: webhook HMAC validation, LLM prompt-injection via community
  submissions, STPB role-inheritance escalation, and copilot add-dir trust boundaries.
- A native kit integrates with `miadi-adversarial-review-kit` in a defined review pipeline
  (adversarial first, security second) rather than requiring manual orchestration.
- A native kit writes findings to a standardised `security-review.md` alongside the rispec,
  making security artefacts first-class outputs in the provenance chain.

🌸 *Security is not a gate bolted onto the end of a spec — it is the relational
accountability that says: who could be harmed by this design, and have we listened to their
vulnerability before we shipped the blueprint?*
