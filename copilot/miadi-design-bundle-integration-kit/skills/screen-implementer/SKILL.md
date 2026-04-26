---
name: screen-implementer
description: 'Reimplement ONE screen from a design bundle as production code in the target codebase''s stack. Visual fidelity to the prototype, but native to the target. Designed for delegated waves where each screen is a subordinate lane handled by a fresh task agent.'
---

Use this skill to reimplement ONE screen from a Claude Design bundle as production code in the target codebase. **Subordinate-lane discipline**: one screen per task agent.

## Required reading (per screen)

The session charter names:
- the bundle path
- the target codebase
- the screen-to-source-to-target mapping
- the production stack to use (vanilla HTML/CSS/JS, React, Vue, native, etc.)
- the viewport floor for mobile fidelity

General order:
1. The wave prompt file (charter)
2. The bundle's shared chrome / shell prototype (typically `screens/chrome.jsx` or equivalent)
3. The bundle's shared detail-card / partial pattern (typically `screens/artifact-panel.jsx` or equivalent)
4. The bundle's canonical token file
5. **Your assigned screen's prototype source** — read top to bottom
6. The target codebase's existing house-style page (charter names which one)
7. Reference screenshots in the bundle's `uploads/` if present

## Implementation rules

1. **Match the target codebase's stack.** The charter names it. Do not introduce a different framework.
2. **Token-only design values.** Every color, font, spacing, radius must come from the bundle's token system. Zero hard-coded values.
3. **All themes work.** If the bundle ships multiple themes, every theme renders correctly via the toggle pattern.
4. **Shared chrome / shell.** Extract the bundle's chrome pattern into a shared partial in the target codebase the first time it's needed; subsequent screens consume it consistently.
5. **Mock data first.** Screens render with realistic mock data inline. Real API wiring is a later wave unless the charter explicitly asks otherwise.
6. **Mobile-aware.** Layout must not break below the viewport floor the charter specifies.
7. **Accessible.** Semantic HTML, alt text on imagery, focus states, keyboard reachable controls (theme toggle, navigation, etc.).
8. **Bundle-specific copy preserved.** Taglines, hero quotes, sub-lines, persona-voice fragments must survive verbatim where the prototype includes them.

## Per-screen workflow

1. Read your assigned screen's prototype + chrome + tokens
2. Sketch the production-stack structure as a comment first
3. Write the screen file
4. Verify token consumption (grep for hard-coded color values; should find none in production output)
5. Verify theme toggle (open mentally; trace which classes/attrs flip)
6. Hand off to the fidelity reviewer (separate task, separate skill — `fidelity-audit`)
7. Fix any Stage 1 (spec compliance) gaps; re-review until PASS
8. Fix any Stage 2 (code quality) issues; re-review until APPROVED
9. Append to `wave-N-report.md`:
   ```
   ## <screen-id> — DONE
   - Source: <bundle-path>
   - Target: <implementation-path>
   - Token fidelity: confirmed (zero hard-coded values)
   - Theme support: confirmed (themes: <list>)
   - Mock data approach: <one line>
   - Stage 1 audit: PASS
   - Stage 2 audit: APPROVED
   ```

## Hard rules

- Never introduce a runtime not in the charter's named stack.
- Bundle prototype is reference, not code to copy.
- Stay in your assigned screen — do not edit other screens or shared files outside the chrome partial unless the charter explicitly asks.
- No real API wiring unless the charter authorizes it.
- Never `git add -A`.

## Deliverable per screen

- The screen file at the target path the charter mapped
- (First screen only) the shared chrome partial extracted from the bundle's chrome prototype
- An entry in `wave-N-report.md` per the format above
