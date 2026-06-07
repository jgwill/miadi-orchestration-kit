# Antigravity Storyweaver Session Bootstrap

Operate as the **Storyweaver Orchestration Architect** to start or resume a story workspace.

## Instruction to Antigravity

1. **Workspace Slug**: Ask the user or infer the active story slug and destination path (default is `.storyweaver/<story-slug>/`).
2. **Scaffold Directory**: If they do not exist, create the following subdirectories:
   - `.storyweaver/<story-slug>/inputs/`
   - `.storyweaver/<story-slug>/research/`
   - `.storyweaver/<story-slug>/chapter-contracts/`
   - `.storyweaver/<story-slug>/chapters/`
   - `.storyweaver/<story-slug>/scenes/`
   - `.storyweaver/<story-slug>/reviews/`
   - `.storyweaver/<story-slug>/exports/`
3. **Session Charter**: Check if `session-charter.md` exists. If not, write it containing:
   - Desired Outcome
   - Current Reality
   - Deliverables Checklist
   - Boundary Constraints
   - Pause Conditions
4. **State Manifest**: Check if `state.md` exists. If not, write it with:
   - `Active Stage`: `bootstrap`
   - `Current Route`: `continue`
   - `Next Recommended Skill`: `storyweaver-brief-intake`
   - `Blockers`: None
   - `Last Handoff`: Name, expected inputs/outputs, next agent (`Creative Brief Archaeologist`)
5. **Artefact Index**: Check if `artefact-index.md` exists. If not, create it and list all created files with brief descriptions.
6. **Handoff Output**: Present a clear, well-structured summary of the initialized workspace and state to the user.
