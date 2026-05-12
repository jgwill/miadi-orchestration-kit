# Source Ledger

RISE path: `Reverse-engineer -> Intent-extract -> Specify -> Export`

## Sources Read

| Source | Use |
| --- | --- |
| `/home/mia/.openclaw/workspace/pto/gaia-endpoint-pebble/gaia-endpoint.mjs` | Observed CLI commands, flags, token loading, session/channel headers, and response extraction. |
| `/home/mia/.openclaw/workspace/pto/gaia-endpoint-pebble/README.md` | Confirmed intended Gaia endpoint usage and token secrecy note. |
| `/workspace/repos/scripts/RESUME--gemini--session--8a3c1d91-4cb4-49ba-8a96-8e349ea4e3fe.creator-of--pde-2605111213--f32f2748-4870-45bd-bf55-49230aab96fa.sh` | Confirmed the Gemini resume command that MiaClaw is expected to pick up. |
| `/home/mia/.openclaw/workspace/memory/2026-05-11.md` | Confirmed the recorded MiaClaw acknowledgement and handoff memory. |
| `rispecs/east-pde-session-orchestration/` | Compared first-prompt session charter scope with Claw dispatch scope. |
| `rispecs/orchestration-plugin-recommender/` | Compared plugin recommendation scope with Gaia dispatch scope. |
| `rispecs/model-routing-orchestration/` | Confirmed Gateway-related concerns exist at study level but not as direct dispatch protocol. |
| `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs/rispecs/miadi-storyweaver-orchestration-kit/` | Located the correct future home for episode/StoryForm/StoryBeat extraction. |

## Claim Status

| Claim | Status | Basis |
| --- | --- | --- |
| The Gaia endpoint supports exact session routing through `--session`. | Evidence | `gaia-endpoint.mjs` and README. |
| The May 11 MiaClaw dispatch succeeded and returned acknowledgement. | Evidence | Command output and `memory/2026-05-11.md`. |
| Existing rispecs do not define a direct Codex-side Claw dispatch kit. | Evidence | Search and read of relevant rispec folders. |
| A future Codex plugin should use fixture-based tests before live Gateway calls. | Recommendation | Safety and token boundary reasoning from observed endpoint behavior. |
| StoryForms/StoryBeats extraction belongs in the Storyweaver rispec branch. | Recommendation | Existing Storyweaver scope and user instruction. |

## Open Questions

- What final Codex plugin manifest schema should this repo standardize on beyond `.codex-plugin/plugin.json`?
- Should live dispatch produce `.claw-dispatch/` artifacts in the caller workspace, the target workspace, or both?
- Should a Claw acknowledgement ledger become a shared cross-agent artifact format with Iris/Hermes as well?
