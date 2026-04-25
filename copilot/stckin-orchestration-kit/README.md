# STCKin Orchestration Kit

Miadi-native Copilot plugin for STCKin, structural-tension-aware deep-search, and orchestration-kit maintenance.

## Launch

### Standard kit session

```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /workspace/repos/miadisabelle/mia-awesome-copilot \
  --add-dir /src/Miadi
```

### Artefacted research session

```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir /workspace/repos/miadisabelle/mia-awesome-copilot \
  --add-dir /src/Miadi \
  --add-dir /src/IAIP/prototypes/artefacts/deep-search--Miadi-STCKIN--copilot-orchestration-kit--2604251232--a4b4ed72-13a4-453d-9585-1c2fbcc5533a
```

Add the two prior artefact folders as extra `--add-dir` values when you want kinship and prior-wave context loaded into the session.

## What's included

### Agents

| Agent | Description |
| --- | --- |
| `Miadi Orchestration Architect` | Builds or evolves Miadi-native Copilot kits by adapting patterns from `mia-awesome-copilot` to STCKin and orchestration goals. |
| `Miadi Deep Search Synthesizer` | Turns codebase and artefact scans into replayable findings, launch recipes, and next-wave proposals. |

### Skills

| Skill | Description |
| --- | --- |
| `stckin-wave-bootstrap` | Session bootstrap for STCKin or orchestration-kit work. |
| `stckin-orchestration-scaffold` | Scaffold or refine a Miadi-native Copilot kit with agents, skills, README, and plugin packaging. |
| `stckin-artefact-report` | Write replayable artefact notes for the active deep-search folder after a wave completes. |

## Scope

This first-wave kit stays deliberately small:

1. one reusable plugin folder,
2. Miadi-specific orchestration prompts,
3. explicit launch patterns for `--plugin-dir` and `--add-dir`,
4. artefact-first reporting when GitHub auth or repo cleanliness blocks remote actions.
