---
name: review-wave-plan
description: 'Adversarial review of a WavePlan before forging. Checks agent validity, path existence, desire alignment, and structural completeness. Returns ADVANCE or REVISE with specifics.'
---

Use this skill to validate a WavePlan before committing to script forging. Catch problems early rather than producing a broken orchestration script.

## When to use

Use this skill after `scan-and-plan` produces a WavePlan and before `forge-wave-script` writes the script.

## Review checklist

Work through each check below in order. For each check, record PASS or FAIL with a one-line finding.

### Check 1 — Agent name validity

For every agent named in the WavePlan's Phase Sequence:
- Verify the agent name appears in the "Available Agents" table of the Orchestration Scan Report (or in the agents directory of a selected kit)
- If an agent name does not match any known agent, mark FAIL and list the unmatched name

### Check 2 — Plugin dir path existence

For every path in the WavePlan's "Selected Plugins" table:
- Run `ls <path>/.github/plugin/plugin.json` to confirm the kit exists at that path
- If a path does not exist or has no `plugin.json`, mark FAIL and list the missing path

### Check 3 — Add-dir path existence

For every path in the WavePlan's "Selected Add-Dirs" table:
- Run `ls <path>` to confirm the directory exists
- If a path does not exist, mark FAIL and list the missing path

### Check 4 — Desire alignment

Re-read the original user desire. Re-read the Phase Sequence.
Ask: does each phase's tasks connect to the stated desire?

Flag FAIL if:
- The phases describe generic scaffolding work not related to the desire
- The desire involves a specific technology (e.g. TypeScript, Python, monorepo) but no agents with relevant expertise are selected
- The desire implies more than analysis (i.e. code changes are expected) but no implementation phase exists

### Check 5 — Issue creation presence

If the desire implies code changes (refactoring, new features, bug fixes):
- Check whether the target repo uses GitHub Issues (look for an `AGENTS.md`, `.github/copilot-instructions.md`, or CI workflows that reference `gh issue` or `github.com`).
- If the repo uses GitHub Issues: verify an Issue Creation phase is present in the Phase Sequence. If absent, mark FAIL: "Issue Creation phase missing for a desire that implies code changes in a GitHub-hosted repo."
- If the repo does not use GitHub Issues (e.g. private/local-only, Jira-based, or no evidence of issue workflow): mark N/A and note the reason.

### Check 6 — Adversarial review phase presence

- Verify Phase Sequence includes an adversarial review phase (Phase 5 or equivalent)
- The phase must name a specific agent responsible for adversarial review
- If absent or unnamed, mark FAIL

### Check 7 — Synthesis/closure phase presence

- Verify Phase Sequence ends with a synthesis or closure phase
- The phase must specify that it produces a session summary and relaunch instructions
- If absent, mark FAIL

## Output format

Produce the review result in this format:

```markdown
# WavePlan Review

## Checks

| # | Check | Result | Finding |
|---|-------|--------|---------|
| 1 | Agent name validity | PASS/FAIL | <finding or "all agents verified"> |
| 2 | Plugin dir paths | PASS/FAIL | <finding or "all paths exist"> |
| 3 | Add-dir paths | PASS/FAIL | <finding or "all paths exist"> |
| 4 | Desire alignment | PASS/FAIL | <finding or "phases align with desire"> |
| 5 | Issue creation | PASS/FAIL/N-A | <finding or "present" or "N/A: desire is analysis-only"> |
| 6 | Adversarial review phase | PASS/FAIL | <finding or "present and named"> |
| 7 | Synthesis phase | PASS/FAIL | <finding or "present with relaunch instructions"> |

## Verdict

**ADVANCE** — All checks passed. Proceed to forge-wave-script.

— or —

**REVISE** — The following items must be fixed before forging:
1. <specific item to fix>
2. <specific item to fix>
(list only failing checks with actionable fix descriptions)
```

If verdict is REVISE, do not proceed to forging. Return the review to the user or the orchestrating skill for plan correction.

If verdict is ADVANCE, state:
```
✓ WavePlan is valid. Use 'forge-wave-script' to produce the bash script.
```
