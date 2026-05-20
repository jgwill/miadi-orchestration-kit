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

## Native Plugin Installation in agy CLI

The Antigravity companion is fully compliant with the native `agy` CLI plugin structure. You can install, enable, and validate it directly inside your local environment:

```bash
# Validate the plugin before installation
/home/mia/.local/bin/agy plugin validate antigravity/miadi-storyweaver-orchestration-kit

# Install the plugin natively
/home/mia/.local/bin/agy plugin install antigravity/miadi-storyweaver-orchestration-kit

# List imported plugins to confirm successful integration
/home/mia/.local/bin/agy plugin list
```

## Command Line Interface (CLI) Utility

The companion includes a dedicated Python CLI tool `storyweaver.sh` designed to manage story workspaces, verify states, and register deliverables directly from any command line shell—supporting both **interactive** and **non-interactive** execution modes.

### 1. Bootstrapping a Story Workspace
Set up folders and write starting charter, state, and index files cleanly:

- **Non-Interactive Mode**:
  ```bash
  ./antigravity/miadi-storyweaver-orchestration-kit/scripts/storyweaver.sh bootstrap my-awesome-story --title "My Beautiful Story" --stage brief --route continue
  ```

- **Interactive Mode**:
  ```bash
  ./antigravity/miadi-storyweaver-orchestration-kit/scripts/storyweaver.sh bootstrap my-awesome-story --interactive
  ```

### 2. Querying Status and Health Checks
Audit the directory structure and read current pipeline stage and route details:

```bash
./antigravity/miadi-storyweaver-orchestration-kit/scripts/storyweaver.sh status my-awesome-story
```

### 3. Transitioning Story State
Transition the workspace phase, route decisions, or set next skills:

```bash
./antigravity/miadi-storyweaver-orchestration-kit/scripts/storyweaver.sh transition my-awesome-story --stage bible --route continue --skill storyweaver-story-bible
```

### 4. Registering Created Deliverables
Register generated draft files into the state manifest and update the artefact index:

```bash
./antigravity/miadi-storyweaver-orchestration-kit/scripts/storyweaver.sh register-artefact my-awesome-story story-bible.md accepted --description "Complete character sheet, relationships map, and setting bible"
```
