# Copilot Plugin Export Specification

## Structural Tension

- **Desired Outcome**: The rispec suite can be exported into a working Copilot plugin without interpretation drift.
- **Current Reality**: Existing kits show the local packaging pattern, but the storytelling kit has not been created yet.
- **Natural Progression**: Specify folder layout, manifest fields, agent files, skill files, launch commands, and smoke tests.

## Target Folder

```text
copilot/miadi-storyweaver-orchestration-kit/
```

## Plugin Manifest

Create:

```text
copilot/miadi-storyweaver-orchestration-kit/.github/plugin/plugin.json
```

Expected manifest:

```json
{
  "name": "miadi-storyweaver-orchestration-kit",
  "description": "Miadi-native Copilot orchestration kit for story creation, review, revision, continuity, protocol stewardship, and export.",
  "version": "0.1.0",
  "author": {
    "name": "Miadi"
  },
  "repository": "https://github.com/jgwill/miadi-orchestration-kit",
  "license": "MIT",
  "keywords": [
    "miadi",
    "storytelling",
    "writing",
    "orchestration",
    "rise",
    "copilot"
  ],
  "agents": [
    "./agents"
  ],
  "skills": [
    "./skills/storyweaver-session-bootstrap",
    "./skills/storyweaver-brief-intake",
    "./skills/storyweaver-story-bible",
    "./skills/storyweaver-outline-and-beats",
    "./skills/storyweaver-chapter-wave",
    "./skills/storyweaver-review-loop",
    "./skills/storyweaver-continuity-ledger",
    "./skills/storyweaver-cultural-protocol-check",
    "./skills/storyweaver-export-packet"
  ]
}
```

## Kit README

Create:

```text
copilot/miadi-storyweaver-orchestration-kit/README.md
```

The README must include:

- purpose
- launch command
- smoke test command
- agent table
- skill table
- expected story workspace shape
- no-dependency statement for `jgwill/storytelling`
- source rispec pointer to `rispecs/miadi-storyweaver-orchestration-kit/`

## Agent Files

Create one markdown file per required agent under:

```text
copilot/miadi-storyweaver-orchestration-kit/agents/
```

Each file should follow the existing kit pattern:

```markdown
---
name: "Storyweaver Orchestration Architect"
description: "Coordinates RISE-aligned story creation waves across brief, bible, outline, drafting, review, revision, continuity, protocol, and export."
---

You are ...
```

Agent file names should use kebab case matching `04-agent-roster.md`.

## Skill Files

Create one `SKILL.md` per required skill under:

```text
copilot/miadi-storyweaver-orchestration-kit/skills/<skill-name>/SKILL.md
```

Each skill should include:

- frontmatter
- use conditions
- required reading order
- workflow
- artefacts read
- artefacts written
- route and pause conditions
- acceptance checklist

## Standard Launch

```bash
copilot \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-storyweaver-orchestration-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  --add-dir <story-workspace-or-project>
```

When using sources from `llms-txt`, add:

```bash
  --add-dir /workspace/repos/jgwill/llms-txt
```

When adapting existing drafts or research folders, add them as explicit `--add-dir` values.

## Smoke Test

```bash
tmpdir=$(mktemp -d)
cd "$tmpdir"
copilot --model gpt-5-mini --reasoning-effort high --yolo --no-ask-user \
  --plugin-dir /workspace/repos/jgwill/miadi-orchestration-kit/copilot/miadi-storyweaver-orchestration-kit \
  --add-dir /workspace/repos/jgwill/miadi-orchestration-kit \
  -p "Name the Storyweaver kit agents and skills, then say which skill would start a new story from a prompt."
```

Expected answer should name:

- Storyweaver Orchestration Architect
- Creative Brief Archaeologist
- World And Character Architect
- Narrative Research Weaver
- Outline Architect
- Scene Writer
- Continuity Keeper
- Developmental Editor
- Critique Reviewer
- Revision Weaver
- Line Editor
- Cultural Protocol Steward
- Export Steward

It should identify `storyweaver-session-bootstrap` or `storyweaver-brief-intake` as the starting skill depending on whether a workspace already exists.

## Export From Rispec To Plugin

Implementation steps:

1. Read this rispec folder in README order.
2. Create the target plugin folder.
3. Copy the manifest structure from this spec.
4. Draft agent files from `04-agent-roster.md`.
5. Draft skill files from `05-skill-surface.md`.
6. Add README launch and smoke-test commands.
7. Run the smoke test.
8. Update root `README.md` to list the new kit only after the plugin exists.

## Acceptance Checklist

- Manifest JSON parses.
- All manifest skill paths exist.
- `agents` folder exists and contains every required agent.
- Each skill has a `SKILL.md`.
- README launch command uses the local absolute plugin path.
- Smoke test can load the kit.
- No implementation file imports `jgwill/storytelling`.
- The kit points back to these rispecs for provenance.
