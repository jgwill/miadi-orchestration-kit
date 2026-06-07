---
name: resume-wave-prep
description: 'Resumes an interrupted wave-forge preparation from prior artefacts. Reads existing WavePlan, review result, and generated script to determine where to continue: at review, replan, or reforge.'
---

Use this skill when a `copilot_prepare_orchestration` session ended before the script was written, or when you want to reforge the script for an existing PDE working folder.

## When to use

- The bash function ran but reported "Script NOT found" — the session ended mid-forge
- You want to retry a failed or incomplete session without re-running the slow bash scan
- A previously forged script exists but needs to be regenerated with updated paths or phases

## How PDE working folders work

`copilot_prepare_orchestration` always creates `.pde/<yyMMddHHmm>--<uuid>/` in the cwd. That folder contains:
- `scan-context.md` — the bash-built scan of target dirs, kits, and all available agents
- `prompt.md` — the complete forge instructions (references scan-context inline)
- `orchestration-*.sh` — the output script (written by copilot during the session)

## Process

### Step 1 — Locate the PDE working folder

```bash
ls -lt .pde/ | head -20
```

List `.pde/` subfolders sorted by modification time. The most recent one is the target session. Report its full path.

### Step 2 — Inspect the PDE folder

```bash
ls -lh .pde/<ts>--<uuid>/
```

Check for the presence of:
- `scan-context.md` — if missing, the bash scan didn't complete (rare; rerun `copilot_prepare_orchestration`)
- `prompt.md` — if missing, same situation
- `orchestration-*.sh` — if present, the session succeeded; if absent, we need to retry the forge

### Step 3 — Determine resume action

| State | Condition | Action |
|-------|-----------|--------|
| **Script exists** | `orchestration-*.sh` found in PDE folder | Report success — script is at that path; no action needed |
| **No script, prompt exists** | `prompt.md` present, no script | Retry the forge (Step 4) |
| **PDE folder empty or missing key files** | `scan-context.md` or `prompt.md` absent | Tell user to rerun `copilot_prepare_orchestration` from scratch |

### Step 4 — Retry the forge (when no script exists)

The `prompt.md` already contains all scan context and instructions. Pass it via `@file`:

```bash
copilot \
  --model claude-sonnet-4.6 \
  --add-dir ".pde/<ts>--<uuid>" \
  -p "@.pde/<ts>--<uuid>/prompt.md"
```

Do NOT re-run the bash scan. Do NOT invoke skills. Write the script directly per the prompt.md instructions.

If retrying a second time (first retry also failed), append `-r2` to the script name in prompt.md before relaunching.

### Step 5 — Report

```
PDE folder  : .pde/<ts>--<uuid>/
Resume point: <No script | Script exists>
Action taken: <Retry forge | None needed>
Script path : <path if created, else "not yet created">
Next        : <run bash ./orchestration-....sh | retry with corrected prompt.md>
```
