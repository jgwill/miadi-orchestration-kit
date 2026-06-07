# 03 — Specify

## Plugin Contract

**Name:** `miadi-session-orchestrator`
**Location:** `claude/miadi-session-orchestrator/`
**Load method:** `claude --plugin-dir <path>`

## Agents

### `plan-review`
- **Trigger:** "review this plan", "check the proposal", proposed/ file updated
- **Tools:** Read, Bash, Grep (no Write — never implements)
- **Input:** path to a `proposed/*.md` file
- **Output:** Gap Report (severity-tagged) + Revision Prompt (≤250 words, paste-ready)
- **Checklist:**
  1. `plan_content` inline in POST payload
  2. Idempotency key (`session_id + plan_filename`)
  3. Langfuse error trace on failure path
  4. Write-back pattern resolved (not ambiguous)
  5. Naming consistent (`plan_file` / `plan_filename`)

## Commands

### `/review-plan [path]`
- Loads live context via `!` blocks (proposed files, session folder)
- Runs 5-point checklist
- Outputs gap report + revision prompt

### `/session-status`
- Reads `_claude_PreToolUse.jsonl` and `last_claude_user_inputs.jsonl`
- Reports what active sessions are creating in ≤55 words

## Skills

### `review-plan`
- Full cycle: locate → read platform context → gap analysis → check/create issue → revision prompt
- Output contract: always both gap report AND revision prompt

## Tool restrictions (by component)

| Component | Allowed tools |
|-----------|--------------|
| `plan-review` agent | Read, Bash, Grep |
| `/review-plan` command | Read, Bash(cat, ls, gh issue) |
| `/session-status` command | Bash(ls, cat, tail) |

## Boundaries

- Never modifies proposed/ files directly
- Never writes implementation code
- Always hands revision prompt to the user for forwarding
