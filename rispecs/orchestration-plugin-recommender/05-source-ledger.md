# Source Ledger

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

| ID | Claim | Source surface | Evidence type | Status |
| --- | --- | --- | --- | --- |
| OPR-001 | The prototype used `geminiidyolo` to recommend orchestration plugins and write a Copilot launch script. | `/workspace/scripts/PTO--orchestration-plugins-recommender.sh` | direct file observation | observed |
| OPR-002 | `geminiidyolo` is defined in `/src/scripts/fn_llm.sh` as a directory-aware YOLO Gemini wrapper. | `/src/scripts/fn_llm.sh` | direct file observation | observed |
| OPR-003 | The current durable home is unclear; a skill is premature. | User request on 2026-05-11 | user intent | accepted constraint |
| OPR-004 | Candidate plugin roots are Miadi orchestration-kit Copilot plugins and mia-awesome-copilot plugins. | Prototype prompt and existing directories | direct file observation | observed |
| OPR-005 | A future storytelling-rispec relationship is possible but not primary yet. | User request on 2026-05-11 | user intent / inference | provisional |

## Ledger rules

- Add one row per real execution before promoting this beyond the shell wrapper.
- Mark bad or partial recommendations explicitly.
- Keep user intent separate from observed repo behavior.
- Do not treat a generated launch script as approved until reviewed.

