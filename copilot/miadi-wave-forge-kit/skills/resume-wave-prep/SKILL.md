---
name: resume-wave-prep
description: 'Resumes an interrupted wave-forge preparation from prior artefacts. Reads existing WavePlan, review result, and generated script to determine where to continue: at review, replan, or reforge.'
---

Use this skill when returning to a wave-forge session that was interrupted before the final script was launched, or when a previously forged script needs updating after the WavePlan was revised.

## When to use

- A prior `scan-and-plan` produced a WavePlan but the session ended before `review-wave-plan` or `forge-wave-script`
- A prior `review-wave-plan` returned **REVISE** and the WavePlan has since been corrected
- A generated script exists but paths or plugin dirs need to be updated

## Process

### Step 1 — Locate prior artefacts

Search the current working directory (and its subdirectories up to 2 levels) for:
- Files matching `*WavePlan*.md` or `*-waveplan.md`
- Files matching `review-wave-plan*.md` or `*-review.md`
- Files matching `orchestration-*.sh`
- Files in `.coaia/` folder matching any wave-related pattern

List all found artefacts with their modification timestamps.

### Step 2 — Determine resume point

Read each found artefact and classify the current state:

| State | Condition | Resume action |
|-------|-----------|---------------|
| **No WavePlan** | No WavePlan file found | Run `scan-and-plan` from scratch |
| **WavePlan only** | WavePlan exists, no review result | Run `review-wave-plan` on the existing WavePlan |
| **Blocked by REVISE** | Review result exists with REVISE verdict | Show the failing checks; ask user to fix the WavePlan, then run `review-wave-plan` again |
| **Ready to forge** | ADVANCE verdict exists, no script yet | Run `forge-wave-script` with the existing WavePlan |
| **Script exists** | Script file exists; user wants update | Determine what changed (desire, paths, agent names) and decide: replan or reforge only |

Report the determined state before taking any action.

### Step 3 — Execute the resume action

Execute only the identified resume action. Do not re-run earlier phases that already have valid artefacts.

- If resuming at `review-wave-plan`: read the WavePlan from the file and invoke the skill.
- If resuming at `forge-wave-script`: read the WavePlan and ADVANCE verdict, then invoke the skill.
- If reforging an existing script: invoke Wave Script Forge with the original WavePlan and the updated output script name (append `-r2`, `-r3`, etc. to distinguish from prior versions).

### Step 4 — Report

After completing the resume action, report:
```
Resume point: <state name>
Action taken: <what was run>
Outcome: <result>
Next: <what to do now — e.g. "run bash ./orchestration-....sh" or "fix WavePlan item X and re-run review-wave-plan">
```
