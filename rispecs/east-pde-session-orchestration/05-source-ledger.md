# Source Ledger

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

| ID | Claim | Source surface | Evidence type | Status |
| --- | --- | --- | --- | --- |
| EAST-001 | The hook session prompt asked for a shortened `pde` GitHub label description. | `/src/_sessiondata/ca226890-bae0-4936-bc27-3c3f3b0db9f2/last_gemini_user_inputs.json` | direct file observation | observed |
| EAST-002 | Gemini set topic metadata before answering, including title and strategic intent. | `/src/_sessiondata/ca226890-bae0-4936-bc27-3c3f3b0db9f2/_gemini_transcript_latest.jsonl` | direct file observation | observed |
| EAST-003 | The answer compressed PDE into a session-initiation description and added Miette resonance. | `/src/_sessiondata/ca226890-bae0-4936-bc27-3c3f3b0db9f2/last_gemini_AssistantResponse.json` | direct file observation | observed |
| EAST-004 | The orchestration kit already uses Copilot plugin folders with agents, skills, and plugin manifests. | `/workspace/repos/jgwill/miadi-orchestration-kit/copilot` | direct directory observation | observed |
| EAST-005 | `session-charter-template.md` defines the reusable charter surface for future launches. | `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/session-charter-template.md` | direct file observation | observed |
| EAST-006 | `mia-awesome-copilot/plugins` remains inspiration but should become non-required for this kit. | User request on 2026-05-11 and directory observation | user constraint + direct observation | accepted constraint |
| EAST-007 | EAST is the medicine-wheel direction for this orchestration type. | User request on 2026-05-11 | user constraint | accepted constraint |

## Ledger rules

- Keep direct file observations separate from user constraints.
- Mark external plugin references as inspiration unless the session truly requires them.
- Record each future EAST run before implementing `miadi-east-pde-session-kit`.
