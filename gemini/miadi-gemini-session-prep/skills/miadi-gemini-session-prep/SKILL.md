---
name: miadi-gemini-session-prep
description: Prepare a reliable Miadi Gemini CLI orchestration session with charter, source ledger, extension recommendations, replayable launch script, and compact attention-only reporting.
---

# Miadi Gemini Session Prep

## Trigger

Use this skill when the operator asks to prepare, bootstrap, resume, or make reliable a Gemini CLI session for work in `/workspace/repos/jgwill/miadi-orchestration-kit` or related Miadi orchestration folders.

## Required Inputs

- Mission/context from the operator.
- Current working directory.
- Relevant roots to inspect, usually:
  - `/workspace/repos/jgwill/miadi-orchestration-kit/gemini`
  - `/workspace/repos/jgwill/miadi-orchestration-kit/copilot`
  - `/workspace/repos/jgwill/miadi-orchestration-kit/codex`
  - `/workspace/repos/jgwill/miadi-orchestration-kit/rispecs`

## Workflow

1. Inspect local repo instructions:
   - `AGENTS.md`
   - `gemini/AGENTS.md`
   - `rispecs/gemini/AGENTS.md`

2. Create a PDE workspace:

```bash
TLID=$(date -u +%y%m%d%H%M)
UUID=$(uuidgen 2>/dev/null || date -u +%s)
PDE_DIR=".pde/${TLID}--${UUID}"
mkdir -p "$PDE_DIR"
```

3. Write `session-charter.md` with:
   - desired outcome,
   - current reality,
   - structural tension,
   - allowed write scope,
   - acceptance checks,
   - attention-needed items.

4. Write `source-ledger.md` with claim/evidence/status rows:

```text
| Claim | Evidence | Status | Notes |
| --- | --- | --- | --- |
```

5. Inspect Gemini extension candidates under `gemini/*`.

6. Validate each candidate before recommending it:

```bash
gemini extensions validate gemini/<extension-name>
```

7. Write `extension-recommendation.md` with exact paths and 55-words-or-less rationales.

8. Write `LAUNCH.gemini-orchestration.sh` with replayable commands:

```bash
#!/usr/bin/env bash
set -euo pipefail
cd /workspace/repos/jgwill/miadi-orchestration-kit
gemini extensions validate gemini/<extension-name>
gemini extensions link gemini/<extension-name>
echo 'Restart Gemini CLI, then ask it to use <skill-name>.'
```

9. If the work created or changed repository files, commit the scoped work unless the operator explicitly says not to.

## Gemini Extension Recommendation Rules

Recommend an extension only when:

- `gemini-extension.json` exists,
- `gemini extensions validate <path>` succeeds,
- README explains purpose and use,
- the extension has a native Gemini surface: `GEMINI.md`, `skills/`, `commands/`, `hooks/`, `policies/`, or MCP config,
- source ledger evidence distinguishes docs/templates from Miadi-specific inference.

Do not recommend failed/unclear copied plugin folders as ready.

## Reporting Contract

User-facing report format:

```text
Attention:
1. <aspect>: <55 words max>
2. <aspect>: <55 words max>
```

Only include what needs human attention. Do not dump full diffs or directory trees unless asked.

## Closeout

Before claiming complete:

- Run `git status --short`.
- Run validation for changed extensions.
- Commit scoped work.
- Report commit hash and remaining dirty files, if any.
