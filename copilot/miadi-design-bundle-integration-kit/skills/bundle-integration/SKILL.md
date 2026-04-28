---
name: bundle-integration
description: 'Integrate a Claude Design bundle into a target codebase — codify tokens into a rispec, convert design assets (e.g. mark.jsx) to static equivalents, stage prototypes under the codebase''s static-serving area, wire routes. Designed for early waves (tokens, hub + artifacts) where the work is single-lane.'
---

Use this skill when integrating a Claude Design bundle into a target codebase. The session charter you were launched with names the concrete bundle path, target codebase, and the specific lane this wave covers.

## Required reading order

1. The wave prompt file (charter)
2. The PDE handoff brief (charter names the path — typically `<pde-folder>/claude-design-handoff.md`)
3. The bundle's `README.md`
4. The bundle's `chats/chat1.md` — intent lives here
5. The bundle's canonical token file (typically `tokens.css`)
6. The bundle's hub file (typically `index.html`)
7. The target codebase's `CLAUDE.md` / `AGENTS.md` / `README.md` — service conventions
8. The orientation guidance the charter points to (creative-orientation, structural-tension-charts, or equivalents)

## Token codification process

1. Copy the bundle's canonical token file verbatim to the target codebase's static-token location named in the charter (e.g., `<target>/static/tokens.css`). Add a header comment:
   ```
   /* Sourced from Claude Design bundle <hash>, <milestone-or-issue-ref>, <YYYY-MM-DD> */
   ```
2. Author a token rispec at the path the charter specifies (typically `rispecs/visual-design-system.spec.md`) containing:
   - Token catalog (semantic groupings — directions, typography, spacing, status palette, semantic accents)
   - Theme variants with toggle pattern (e.g., `data-theme="<name>"`)
   - Primitive class catalog (`.card`, `.chip-*`, `.kbd`, `.divider`, etc., as the bundle defines them)
   - Consumer guidance for sibling services or pages that should adopt the system
3. Cross-link the token rispec from the codebase's umbrella rispec (charter names which one).

## Design-asset conversion process

Bundles often ship React/JSX components for design assets (e.g. ceremonial marks, badges, glyphs). Convert each to a static equivalent that fits the target codebase:

1. Read the JSX top to bottom; identify the SVG (or equivalent) shape it produces.
2. Inline-render the shape into a pure static asset (SVG file, image, etc.) — no React runtime in production.
3. Save at the path the charter specifies (typically `<target>/static/<asset-name>.<ext>`).
4. Provide an HTML usage example in the token rispec.

## Hub + artifacts staging process

The bundle's `index.html` and the artifact HTMLs (UI Spec, Pitch Deck, Walkthrough, etc.) are prototypes. Stage them as-is for reference:

1. Create a staging directory the charter specifies (typically `<target>/static/<staging-name>/`).
2. Copy the bundle's `project/` HTML and JS/JSX support files into staging — these are reference prototypes, kept verbatim.
3. Verify the target codebase's static mount serves the staging directory. If not, wire the route per the charter's instructions.
4. Add a navigation link from the codebase's existing entry page to the staged hub. Use a token-styled element from the codebase's primitive catalog.
5. The bundle prototypes typically pull React/Babel from CDN. They will run as-is when served. Do NOT add a local React/Babel dependency.

## Mandatory subagent flow — even for "small" waves

This skill is invoked by the **main lane orchestrator**, never by the implementer doing the work directly. The orchestrator dispatches a separate task agent for each item in the Token / Mark / Hub / Artifact lists above.

For **each item** (e.g., "copy tokens.css with provenance", "convert mark.jsx to mark.svg", "author visual-design-system.spec.md", "stage hub artifacts under <static-path>"):

1. **Implementer task agent** — fresh context, item-scoped prompt
2. **Stage 1 fidelity reviewer task agent** — fresh context, sees only the bundle source + the implementation file, runs the spec compliance checklist from the `fidelity-audit` skill. Gate.
3. **Revise loop** — if Stage 1 finds gaps, dispatch a revise task agent with the gap list, then re-dispatch Stage 1 reviewer. Loop until PASS.
4. **Stage 2 fidelity reviewer task agent** — fresh context, runs the code quality checklist. Only after Stage 1 PASS.
5. **Revise loop** — if Stage 2 finds issues, dispatch revise task agent, re-dispatch Stage 2 reviewer. Loop until APPROVED.
6. **Runtime test task agent** when applicable — opens the implementation file in its target environment (e.g., serves the HTML via the codebase's static route, verifies token consumption, theme toggle, no console errors). Returns PASS/FAIL with evidence.
7. **Append item-summary to the wave report** — the orchestrator retains only the summary line, not the diff.

The orchestrator never reads bundle JSX, copies files, or edits the target codebase directly. If the orchestrator finds itself doing the work, it has skipped the dispatch flow.

## Hard rules

- Bundle source at `bundle/` is READ-ONLY design reference. Never edit it.
- No new runtime dependencies in production output unless the charter explicitly approves them.
- Surgical edits only in the target codebase.
- Never `git add -A` — stage only files you authored or copied.
- Never commit unless the charter authorizes it.
- **Self-claim is not review.** A task agent that completed implementation cannot also be its own reviewer. Stage 1 and Stage 2 require fresh dispatches.

## Deliverables

- Files created and modified, listed with absolute paths
- Wave report at the path the charter specifies, with sections:
  - `Evidence checked`
  - `Execution method`
  - `Subagents used` — **must list each task agent dispatched**, with role (implementer / Stage 1 reviewer / Stage 2 reviewer / revise / runtime test), turn number, and one-line return summary. If this section says "none", the contract was violated.
  - `Context-preservation notes`
  - `Files created`
  - `Files modified`
  - `Per-item Stage 1 results` — must show the reviewer subagent's verdict, not a self-claim
  - `Per-item Stage 2 results` — must show the reviewer subagent's verdict, not a self-claim
  - `Per-item runtime test results` (when applicable)
  - `Fidelity gaps`
  - `Follow-ups`
