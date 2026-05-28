---
name: forge-wave-script
description: 'Takes a WavePlan (from scan-and-plan or from user) and invokes Wave Script Forge to write a complete executable orchestration bash script, then verifies and reports it.'
---

Use this skill to convert a WavePlan document into a ready-to-run bash orchestration script.

## When to use

Use this skill **only after** `review-wave-plan` has returned an explicit **ADVANCE** verdict.

Forging without a prior `review-wave-plan` ADVANCE is not permitted. If the user requests to skip review, require explicit confirmation and note the risk in the output report.

## Process

### Step 0 — Confirm ADVANCE verdict

Check whether a `review-wave-plan` result is present in the current session context.
- If an **ADVANCE** verdict exists: proceed.
- If a **REVISE** verdict exists: stop. Report the failing checks and instruct the user to fix the WavePlan and re-run `review-wave-plan`.
- If no review result is present: stop. Instruct the user to run `review-wave-plan` first.
  - Exception: if the user explicitly confirms they want to skip review, proceed but prepend a warning banner to the generated script.

### Step 1 — Confirm WavePlan availability

Verify that a WavePlan document is available in the current session context. The WavePlan must include:
- "Selected Plugins" table with at least one entry
- "Phase Sequence" section with at least one phase
- "Output Script Name" field

If the WavePlan is missing or incomplete, stop and instruct the user to run `scan-and-plan` first.

### Step 2 — Determine output script path

Derive the output script path:
- Use the "Output Script Name" from the WavePlan if present
- Otherwise derive: `orchestration-<kebab-slug>-<YYMMDD>.sh` where slug comes from the desire
- Confirm the path will be written relative to the current working directory

### Step 3 — Invoke Wave Script Forge

Invoke the **Wave Script Forge** agent with:
- The complete WavePlan document
- The output script name

The agent will write the script file, make it executable, and validate it with `bash -n`.

### Step 4 — Verify the written script

After the Wave Script Forge agent reports completion:
1. Confirm the file exists: `ls -lh <script_path>`
2. Confirm it is executable: check the `x` bit in the listing
3. Confirm syntax validity: `bash -n <script_path>` (verify independently from the forge agent)
4. Run a preflight smoke check: `bash <script_path> --preflight-only 2>&1 || true`
   - This confirms `copilot` is in PATH and all plugin/add-dir paths exist without launching a full session
   - If preflight prints errors, report them and mark the script as requiring path corrections
5. Read and display the first 50 lines

### Step 5 — Report

Report the outcome:

```
✓ Script written: /full/path/to/orchestration-<slug>-YYMMDD.sh
✓ Syntax valid (bash -n passed)
✓ Executable: yes

First 50 lines:
<lines 1-50 of the script>

To run:
  bash /full/path/to/orchestration-<slug>-YYMMDD.sh
```

If any step fails (file not written, syntax error, not executable), report the specific error and do not present the script as complete.

## Deliverables

- Executable bash script at `orchestration-<slug>-YYMMDD.sh` in cwd
- Syntax validation confirmation
- Full path report
