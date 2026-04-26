---
name: fidelity-audit
description: 'Two-stage audit — spec compliance first, code quality second. Required after every implementer task before a wave can close. Independent of self-claim. Includes a cheap post-wave audit pattern using a free model.'
---

Use this skill to audit a Claude Design bundle integration against the design source. Run as a separate task from the implementer.

## Two-stage gate

### Stage 1 — Spec compliance (gate to Stage 2)

Compare the implementation against the bundle source it was built from.

- [ ] **Token consumption**: implementation references the bundle's token system (variable names, classes, etc.); no hard-coded color / size / typography values that should come from tokens
- [ ] **Theme support**: every theme the bundle ships is implemented end-to-end and toggleable
- [ ] **Semantic fidelity**: bundle-specific semantics (directional symbolism, persona voices, brand language) preserved without drift
- [ ] **Typography**: each font role from the bundle is applied to the matching role in the implementation
- [ ] **Layout**: visual rhythm matches bundle intent (feel-clone, not pixel-clone)
- [ ] **Bundle-specific copy intact**: taglines, hero quotes, sub-lines preserved verbatim where the bundle includes them
- [ ] **No scope creep**: only the wave's stated lane was touched
- [ ] **Bundle untouched**: `bundle/` directory was read-only

**Output**: `PASS` or list of specific gaps with `path:line` references. PASS unlocks Stage 2.

### Stage 2 — Code quality

- [ ] Follows the target codebase's conventions (read its CLAUDE.md / AGENTS.md / README first)
- [ ] No introduced runtime dependencies unless the charter approved them
- [ ] Accessible: semantic HTML, alt text, focus states, keyboard reachable
- [ ] Mobile-aware (≥ viewport floor from charter)
- [ ] No insecure patterns: no inline event handlers wired to user data, no raw innerHTML with user input
- [ ] Token / shared CSS imported once per page; not duplicated
- [ ] No regressions to existing pages or consumers

**Output format**:
- Critical: [must fix before merge]
- Important: [should fix]
- Minor: [optional]
- Verdict: `APPROVED` or `REQUEST_CHANGES`

## Auditor rules

- Read the bundle source the implementer worked from. Never audit without ground truth.
- Don't approve until both stages pass. Stage 1 PASS gates Stage 2.
- Implementer self-claim ≠ audit. Verify independently — open the file, check the values, follow the imports.
- Document all findings in `wave-N-report.md` under `## Audit — <item-id>`.

## Cheap post-wave audit pattern

After all implementer tasks in a wave reach APPROVED, run a final cheap audit on the whole wave using a free model:

```bash
copilot --resume --model gpt-5-mini --reasoning-effort high --yolo --no-ask-user \
  --add-dir <target-codebase> \
  --add-dir <pde-folder> \
  --share <pde-folder>/orchestration/wave-N-audit-session.md \
  --name "<wave-name>-audit" \
  -p "Read wave-N-report.md and the implementation files referenced in it. Report concretely:
       (1) Files created and modified (exact paths)
       (2) Whether subagents/task agents were used and which lanes
       (3) Whether the orchestration contract was followed:
           - lane discipline (only the wave's stated scope was touched)
           - two-stage review (Stage 1 spec compliance gated Stage 2 code quality)
           - bundle source remained READ-ONLY
       (4) Context-preservation evidence (main lane did not absorb full implementation diffs)
       (5) Token-fidelity for any UI files (no hard-coded colors)
       (6) Any gaps to address before the next wave
       Be specific. Cite file:line where relevant. If the contract was NOT followed, say exactly where it broke."
```

If the audit shows the orchestration contract was not followed, tighten the wave's prompt or this skill before launching the next wave instead of assuming it happened.

## Required reading

- The wave prompt file (charter)
- The bundle's canonical design file (tokens.css or equivalent)
- The specific bundle files for the wave's lane
- The implementation files claimed "done"
- The wave report at `<pde-folder>/orchestration/wave-N-report.md`
