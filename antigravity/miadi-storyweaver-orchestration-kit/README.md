# Antigravity Companion: Miadi Storyweaver Orchestration Kit

This is a premium, interactive **Antigravity Extension/Companion** for the Copilot-first Storyweaver kit at:

```text
copilot/miadi-storyweaver-orchestration-kit/
```

Unlike basic CLI prompt files or static companions, this extension is optimized specifically for **Google DeepMind Antigravity**. It enables Antigravity to act as a proactive, tool-using orchestration agent to scaffold, draft, validate, and visually illustrate story workspaces.

## What Antigravity Does

1. **Interactive Workspace Operations**: Automatically sets up, organizes, and updates `.storyweaver/<story-slug>/` directories and state files using robust file operations.
2. **Deterministic State Auditing**: Automatically parses `state.md` and routes work to the next pipeline agent.
3. **Automated Verification**: Automatically runs the Python validator to confirm metadata and folder formatting.
4. **Visual Pre-production**: Uses `generate_image` to render premium concepts and Chronicle seeds directly into the workspace.

## Antigravity Smoke Test

To verify that Antigravity is correctly configured and fully understands the Storyweaver pipeline:

```bash
# As Antigravity, read and execute this prompt contract:
antigravity -p "$(cat antigravity/miadi-storyweaver-orchestration-kit/prompts/smoke-test.md)"
```

Alternatively, ask Antigravity to perform a smoke test directly in the pair-programming session.

## Story Session Bootstrap

To start or resume an interactive story workspace:

```bash
# Ask Antigravity to load and execute the bootstrap workflow:
antigravity -p "$(cat antigravity/miadi-storyweaver-orchestration-kit/prompts/session-bootstrap.md)"
```

Then provide the desired `.storyweaver/<story-slug>/` workspace directory and your creative prompt.

## Active Visual Pre-production

To generate concept art or visual chronicle prompt seeds:

```bash
# Execute the visual generator prompt:
antigravity -p "$(cat antigravity/miadi-storyweaver-orchestration-kit/prompts/visual-chronicle-generator.md)"
```

Antigravity will read your story bible, prompt details, and create beautiful visual reference frames in your workspace.
