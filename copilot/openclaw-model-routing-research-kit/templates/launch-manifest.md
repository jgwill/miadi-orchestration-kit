# OpenClaw Model-Routing Launch Manifest

Date and timezone: `2026-05-08 America/Toronto`
Orchestrator: `Iris/Hermes`
Study root: `/workspace/repos/miadisabelle/workspace-openclaw/study-notes/openclaw-model-routing-85Q9htV2CBE`

## Related Issues

| Repo | Issue | Purpose |
| --- | --- | --- |
| `jgwill/miadi-orchestration-kit` | `#14` | Scaffold OpenClaw model-routing research Copilot kit. |
| `miadisabelle/workspace-openclaw` | `#80` | Create and operate study launch manifest. |

## Plugin Dirs

| Plugin dir | Required | Status |
| --- | --- | --- |
| `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/openclaw-model-routing-research-kit` | yes | unchecked |
| `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit` | recommended | unchecked |

## Add-Dir Paths

| Path | Purpose | Required |
| --- | --- | --- |
| `/workspace/repos/miadisabelle/workspace-openclaw` | study notes and outputs | yes |
| `/workspace/repos/jgwill/miadi-orchestration-kit` | orchestration kit and rispecs | yes |
| `/workspace/repos/jgwill/miadi-orchestration-kit-storytelling-rispecs` | narrative rispec precedent | when Narrative is authorized |
| `/workspace/repos/miadisabelle/mia-awesome-copilot` | existing plugin catalog and gap follow-up | optional |
| `/workspace/repos/jgwill/llms-txt` | RISE framework references | recommended |

## Allowed Write Scopes

| Scope | Authorized writes | Notes |
| --- | --- | --- |
| study root | `launch-manifest.md`, handoffs, ledgers, matrices, acceptance notes | default preflight scope |
| selected rispec folder | scaffold or update only when the track is authorized | must be named before launch |

## Track Order

| Order | Track | Searches | Authorized now | Token cap |
| --- | --- | --- | --- | --- |
| 1 | Academic | A1, A2, A3 | no | 230k |
| 2 | Technical | T1, T2, T3, T4 | no | 320k |
| 3 | Narrative | N1, N2, N3 | no | 190k |
| 0 | Preflight | manifest and scaffold readiness | yes | 25k |

Current authorized track: `Preflight`
Optional gap waves allowed per track: `1`

## Required Source Quality

- Major claims need at least 2 independent sources.
- Implementation claims need path-level repo evidence.
- Transcript-only claims are provisional.
- Contradictions remain visible until resolved.

## Stop Conditions

- Manifest missing or internally inconsistent.
- Requested write is outside allowed scopes.
- Selected track is not authorized.
- Token estimate exceeds the cap.
- Source ledger is missing before synthesis.
- More than one gap wave is needed.
- Live Discord or OpenClaw connector work is requested during read-only research.

## Exact Next Command

```bash
copilot --model gpt-5-mini --reasoning-effort high --yolo --no-ask-user \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/openclaw-model-routing-research-kit \
  --add-dir /workspace/repos/miadisabelle/workspace-openclaw \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  -p "List the loaded OpenClaw model-routing research kit agents and skills. Then identify the launch-manifest template path. Do not edit files."
```
