# Session Charter Template

Use this as the per-run Copilot prompt skeleton.

Objective:
- 

Roots to inspect:
- 

Artefact folder:
- 

Plugin dir:
- 

Lane contract:
- Lane A:
- Lane B:
- Lane C:
- Main lane:

Main-lane preservation rule:
- The main lane must not do all raw inspection itself when subordinate lanes can return scoped summaries.

Required outputs:
- Evidence checked with exact paths
- Execution method
- Subagents or task lanes used
- Context-preservation notes
- Final decision / revision brief / promotion matrix

Special boundaries:
- What must stay provenance-only:
- What might promote to spec:
- What might promote to wiki:
- What must remain context-layer or retrieval-adjacent:

Audit note:
- End in a way that a cheap `copilot --resume --model gpt-5-mini` audit can report concretely on lanes used, evidence inspected, and context preservation.