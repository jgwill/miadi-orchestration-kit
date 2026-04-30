# Source Ledger

## Structural Tension

- **Desired Outcome**: Preserve the exact evidence used to create these orchestration specs.
- **Current Reality**: The user pointed to a path that was not present, while the relevant storytelling rispecs existed elsewhere in the workspace.
- **Natural Progression**: Record source paths, promoted claims, and boundaries so future implementation agents can understand what was studied and what was inferred.

## Path Resolution

Mission issue created for this work:

```text
https://github.com/jgwill/miadi-orchestration-kit/issues/9
```

The user requested study of:

```text
/workspace/repos/jgwill/llms-txt/src/storytelling/rispecs
```

That path was not present in this workspace. The relevant local sources found and used were:

```text
/workspace/repos/jgwill/llms-txt/docs/storytelling.md
/workspace/repos/jgwill/llms-txt/docs/rise-framework.md
/workspace/repos/jgwill/llms-txt/llms-rise-framework.txt
/workspace/repos/jgwill/llms-txt/rispecs/README.md
/workspace/repos/jgwill/storytelling/rispecs/
/workspace/repos/jgwill/miadi-orchestration-kit/
```

## Primary Source Files Read

| Source | Used For |
| --- | --- |
| `/workspace/repos/jgwill/llms-txt/docs/rise-framework.md` | RISE summary, four phases, SpecLang prose-code framing. |
| `/workspace/repos/jgwill/llms-txt/llms-rise-framework.txt` | Creative orientation, structural tension, Creative Advancement Scenario format, rispec maintenance guidance. |
| `/workspace/repos/jgwill/llms-txt/docs/storytelling.md` | Storytelling package overview, generation pipeline, architecture components, IAIP phase mapping, rispec list. |
| `/workspace/repos/jgwill/llms-txt/rispecs/README.md` | General guidance that rispec folders can track source, issue, PR, or PDE provenance. |
| `/workspace/repos/jgwill/storytelling/rispecs/ApplicationLogic.md` | Prompt analysis, story elements, outline, chapter generation, critique/revision loops, polish/export flow. |
| `/workspace/repos/jgwill/storytelling/rispecs/Creative_Orientation_Operating_Guide.md` | Structural Tension block, observations, structural assessment, advancing moves, create-language rules. |
| `/workspace/repos/jgwill/storytelling/rispecs/Architect_Agent_Specification.md` | Agent mandate for creative archaeology and implementation-agnostic specifications. |
| `/workspace/repos/jgwill/storytelling/rispecs/Prompts.md` | Prompt taxonomy and brief-intake/story-element/outline/chapter-generation concepts. |
| `/workspace/repos/jgwill/storytelling/rispecs/DataSchemas.md` | Session, metadata, chapter count, completion, scene list, StoryBeat, character arc, and feedback schemas. |
| `/workspace/repos/jgwill/storytelling/rispecs/Session_Management_Architecture.md` | Persistent creative workspace, checkpointing, resume semantics, state preservation. |
| `/workspace/repos/jgwill/storytelling/rispecs/RAG_Implementation_Specification.md` | Multi-source research, source attribution, local files, URLs, CoAiAPy pattern, retriever concept. |
| `/workspace/repos/jgwill/storytelling/rispecs/IAIP_Integration_Specification.md` | Ceremonial phases, Two-Eyed Seeing adapter, diary pattern, protocol-aware storytelling. |
| `/workspace/repos/jgwill/storytelling/rispecs/Narrative_Intelligence_Integration_Specification.md` | StoryBeat, character state, thematic focus, emotional targeting, analysis-ready generation. |
| `/workspace/repos/jgwill/storytelling/rispecs/Analytical_Feedback_Loop_Specification.md` | Analysis, gap identification, enrichment, route-like quality loop. |
| `/workspace/repos/jgwill/storytelling/rispecs/Character_Arc_Tracking_Specification.md` | Character arc state, beat impact, consistency report, arc context. |
| `/workspace/repos/jgwill/storytelling/rispecs/Emotional_Beat_Enrichment_Specification.md` | Emotional beat analysis and enrichment loop. |
| `/workspace/repos/jgwill/storytelling/rispecs/AGENT_INSTRUCTIONS.md` | Build-from-rispecs principle and reading order pattern. |
| `/workspace/repos/jgwill/miadi-orchestration-kit/README.md` | Existing kit list and launch pattern. |
| `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit/README.md` | Copilot plugin README and smoke-test pattern. |
| `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit/.github/plugin/plugin.json` | Plugin manifest shape. |
| `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit/agents/miadi-orchestration-architect.md` | Agent markdown format. |
| `/workspace/repos/jgwill/miadi-orchestration-kit/copilot/stckin-orchestration-kit/skills/stckin-orchestration-scaffold/SKILL.md` | Skill markdown format. |

## Promoted Claims

| Claim In These Specs | Source Support |
| --- | --- |
| RISE specs should be implementation-agnostic prose code. | `llms-rise-framework.txt`, `docs/rise-framework.md`, storytelling `AGENT_INSTRUCTIONS.md`. |
| Story creation should begin with prompt analysis and story elements before drafting. | storytelling `ApplicationLogic.md`, `Prompts.md`, `docs/storytelling.md`. |
| Chapter drafting benefits from layered scene generation and review loops. | storytelling `ApplicationLogic.md`, `Prompts.md`. |
| Persistent story sessions should checkpoint at natural progression boundaries. | storytelling `Session_Management_Architecture.md`, `DataSchemas.md`. |
| Research context should preserve source attribution and distinguish sourced details from generated invention. | storytelling `RAG_Implementation_Specification.md`. |
| Character arc, emotional beat, and analytical feedback patterns should become continuity and review responsibilities. | storytelling narrative intelligence, character arc, emotional enrichment, and analytical feedback specs. |
| Copilot kits in this repo use plugin folders with `.github/plugin/plugin.json`, `agents/`, `skills/`, README launch commands, and smoke tests. | existing `copilot/*` kits. |
| The new kit should not depend on the existing storytelling package. | Explicit user instruction plus RISE implementation-agnostic principle. |

## Inferences

These specs infer the agent roster from the storytelling pipeline and common editorial responsibilities. The storytelling package does not already define every proposed Copilot agent. The roster is an orchestration abstraction designed for a writing team rather than a direct port of package modules.

These specs infer markdown artefact persistence from the package's session checkpointing pattern and the existing repo's artefact-first orchestration style. The future Copilot kit does not need a database or LangGraph runtime to honor the persistence intent.

## Boundaries For Future Agents

Future implementation agents should use these source files for provenance, but should not re-couple the Copilot kit to the `jgwill/storytelling` source package. If implementation requires code, scripts, or schemas later, those should be native to `miadi-orchestration-kit` and justified by a separate rispec update.
