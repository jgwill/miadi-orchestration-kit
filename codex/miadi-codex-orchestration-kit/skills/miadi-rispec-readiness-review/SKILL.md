---
name: miadi-rispec-readiness-review
description: Use when deciding whether a Miadi rispec, future plugin idea, or draft orchestration pattern is ready to become a Codex or Copilot plugin. Produces a readiness decision without scaffolding or promoting the plugin.
---

# Miadi Rispec Readiness Review

Use this skill as the promotion gate before creating a plugin from any rispec.
It is intentionally read-only unless the user asks for a written report.

## Decisions

Return exactly one readiness decision:

- `promote`: ready to become a plugin now.
- `hold`: valuable, but not ready.
- `split`: some parts are ready; others must remain rispec or research.
- `research`: insufficient evidence to decide.

Do not scaffold a plugin as part of this skill. Promotion is a separate action
after the decision is explicit.

## Required evidence

Inspect the candidate rispec folder and any linked implementation or plugin
precedent. A `promote` decision requires:

- non-empty input and output contracts,
- explicit stop conditions,
- stable artifact paths or templates,
- source-ledger or evidence rules,
- known write scopes,
- no unresolved external-auth, endpoint, or secret-handling gaps,
- no unresolved "future", "provisional", or "promotion check" language that
  affects core behavior,
- at least one working precedent in `copilot/` or another existing plugin, or a
  strong reason the work is purely markdown and low-risk.

For recommender-style, routing-style, or automation-style plugins, require
evidence from at least three successful uses unless the rispec itself sets a
stricter threshold.

## Review steps

1. Read the rispec `README.md` first.
2. Read `01-reverse-engineer.md`, `02-intent.md`, `03-specify.md`, and
   `04-export.md` when present.
3. Read source ledger files when present.
4. Search for words that often mark unfinished work:
   - `future`
   - `provisional`
   - `candidate`
   - `promotion`
   - `blocked`
   - `deferred`
   - `TODO`
5. Compare against relevant working kits:
   - `copilot/stckin-orchestration-kit`
   - `copilot/openclaw-model-routing-research-kit`
   - `copilot/miadi-adversarial-review-kit`
   - existing Codex plugins when they provide a close structural match.
6. Produce the decision table.

## Output format

```markdown
# Rispec Readiness Review

Candidate:
Decision: promote | hold | split | research

## Evidence Read
- path:
- path:

## Readiness Table
| Gate | Status | Evidence |
| --- | --- | --- |
| Input contract | pass/partial/fail | ... |
| Output contract | pass/partial/fail | ... |
| Stop conditions | pass/partial/fail | ... |
| Source ledger | pass/partial/fail | ... |
| Write scope | pass/partial/fail | ... |
| Operational precedent | pass/partial/fail | ... |
| External side effects | pass/partial/fail | ... |
| Promotion evidence | pass/partial/fail | ... |

## Decision Rationale

## If Held
- Missing evidence:
- Next proving run:

## If Split
- Promote now:
- Keep as rispec:
```

## Hard stops

Return `hold` or `research` when:

- live external mutation is required and permission/auth behavior is unresolved,
- user-confirmed memory or authority would be inferred,
- artifact paths are not defined,
- the rispec says future promotion requires more successful uses and those uses
  are not documented,
- core claims lack exact source paths.
