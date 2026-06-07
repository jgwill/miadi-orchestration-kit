#!/usr/bin/env python3
"""Deterministic validation for the Storyweaver kit and portable companions."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
KIT = ROOT / "copilot" / "miadi-storyweaver-orchestration-kit"
PLUGIN_JSON = KIT / ".github" / "plugin" / "plugin.json"
CODEX_KIT = ROOT / "codex" / "miadi-storyweaver-orchestration-kit"
CODEX_PLUGIN_JSON = CODEX_KIT / ".codex-plugin" / "plugin.json"

EXPECTED_COMPANION_FILES = [
    "codex/miadi-storyweaver-orchestration-kit/README.md",
    "codex/miadi-storyweaver-orchestration-kit/CODEX.md",
    "codex/miadi-storyweaver-orchestration-kit/.codex-plugin/plugin.json",
    "codex/miadi-storyweaver-orchestration-kit/templates/session-charter.md",
    "codex/miadi-storyweaver-orchestration-kit/templates/state.md",
    "codex/miadi-storyweaver-orchestration-kit/templates/artefact-index.md",
    "codex/miadi-storyweaver-orchestration-kit/templates/review.md",
    "codex/miadi-storyweaver-orchestration-kit/templates/source-ledger.md",
    "codex/miadi-storyweaver-orchestration-kit/templates/episode-packet.md",
    "codex/miadi-storyweaver-orchestration-kit/templates/visual-prompt-packet.md",
    "gemini/miadi-storyweaver-orchestration-kit/README.md",
    "gemini/miadi-storyweaver-orchestration-kit/GEMINI.md",
    "gemini/miadi-storyweaver-orchestration-kit/prompts/session-bootstrap.md",
    "gemini/miadi-storyweaver-orchestration-kit/prompts/smoke-test.md",
    "claude-code/miadi-storyweaver-orchestration-kit/README.md",
    "claude-code/miadi-storyweaver-orchestration-kit/CLAUDE.md",
    "claude-code/miadi-storyweaver-orchestration-kit/prompts/session-bootstrap.md",
    "claude-code/miadi-storyweaver-orchestration-kit/prompts/smoke-test.md",
    "antigravity/miadi-storyweaver-orchestration-kit/README.md",
    "antigravity/miadi-storyweaver-orchestration-kit/ANTIGRAVITY.md",
    "antigravity/miadi-storyweaver-orchestration-kit/prompts/session-bootstrap.md",
    "antigravity/miadi-storyweaver-orchestration-kit/prompts/smoke-test.md",
    "antigravity/miadi-storyweaver-orchestration-kit/prompts/visual-chronicle-generator.md",
    "antigravity/miadi-storyweaver-orchestration-kit/scripts/storyweaver-cli.py",
    "antigravity/miadi-storyweaver-orchestration-kit/scripts/storyweaver.sh",
    "antigravity/miadi-storyweaver-orchestration-kit/plugin.json",
]


def load_json(path: Path, label: str, errors: list[str]) -> dict:
    if not path.is_file():
        errors.append(f"missing {label}: {path.relative_to(ROOT)}")
        return {}

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(
            f"{label} does not parse: "
            f"{path.relative_to(ROOT)}:{exc.lineno}:{exc.colno}: {exc.msg}"
        )
    return {}


def load_manifest(errors: list[str]) -> dict:
    return load_json(PLUGIN_JSON, "plugin JSON", errors)


def resolve_manifest_path(raw_path: str, errors: list[str]) -> Path | None:
    path = (KIT / raw_path).resolve()
    kit_root = KIT.resolve()
    try:
        path.relative_to(kit_root)
    except ValueError:
        errors.append(f"manifest path escapes kit root: {raw_path}")
        return None
    return path


def check_manifest_skills(manifest: dict, errors: list[str]) -> None:
    skills = manifest.get("skills")
    if not isinstance(skills, list):
        errors.append("plugin JSON field `skills` must be a list")
        return

    for raw_path in skills:
        if not isinstance(raw_path, str):
            errors.append(f"plugin JSON skill path is not a string: {raw_path!r}")
            continue

        skill_dir = resolve_manifest_path(raw_path, errors)
        if skill_dir is None:
            continue

        skill_md = skill_dir / "SKILL.md"
        if not skill_dir.is_dir():
            errors.append(f"missing skill directory: {skill_dir.relative_to(ROOT)}")
        elif not skill_md.is_file():
            errors.append(f"missing skill file: {skill_md.relative_to(ROOT)}")


def check_manifest_agents(manifest: dict, errors: list[str]) -> None:
    agents = manifest.get("agents", [])
    if not isinstance(agents, list):
        errors.append("plugin JSON field `agents` must be a list when present")
        return

    for raw_path in agents:
        if not isinstance(raw_path, str):
            errors.append(f"plugin JSON agent path is not a string: {raw_path!r}")
            continue

        agent_path = resolve_manifest_path(raw_path, errors)
        if agent_path is not None and not agent_path.exists():
            errors.append(f"missing agent path: {agent_path.relative_to(ROOT)}")


def check_companion_files(errors: list[str]) -> None:
    for rel_path in EXPECTED_COMPANION_FILES:
        path = ROOT / rel_path
        if not path.is_file():
            errors.append(f"missing companion file: {rel_path}")


def check_codex_plugin(copilot_manifest: dict, errors: list[str]) -> int:
    codex_manifest = load_json(CODEX_PLUGIN_JSON, "Codex plugin JSON", errors)
    if not codex_manifest:
        return 0

    if codex_manifest.get("skills") != "./skills/":
        errors.append("Codex plugin JSON field `skills` must be './skills/'")

    copilot_skills = copilot_manifest.get("skills", [])
    if not isinstance(copilot_skills, list):
        errors.append("cannot compare Codex skills because Copilot `skills` is not a list")
        return 0

    skill_names = sorted(Path(raw_path).name for raw_path in copilot_skills if isinstance(raw_path, str))
    for skill_name in skill_names:
        skill_md = CODEX_KIT / "skills" / skill_name / "SKILL.md"
        if not skill_md.is_file():
            errors.append(f"missing Codex skill mirror: {skill_md.relative_to(ROOT)}")

    copilot_agents = sorted((KIT / "agents").glob("*.md"))
    for agent_path in copilot_agents:
        codex_agent = CODEX_KIT / "agents" / agent_path.name
        if not codex_agent.is_file():
            errors.append(f"missing Codex agent reference: {codex_agent.relative_to(ROOT)}")

    return len(skill_names)


def main() -> int:
    errors: list[str] = []
    manifest = load_manifest(errors)
    codex_skill_count = 0

    if manifest:
        check_manifest_skills(manifest, errors)
        check_manifest_agents(manifest, errors)
        codex_skill_count = check_codex_plugin(manifest, errors)

    check_companion_files(errors)

    if errors:
        print("Storyweaver validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    skill_count = len(manifest.get("skills", []))
    print("Storyweaver validation passed")
    print(f"- plugin JSON parsed: {PLUGIN_JSON.relative_to(ROOT)}")
    print(f"- manifest skills checked: {skill_count}")
    print(f"- Codex skill mirrors checked: {codex_skill_count}")
    print(f"- companion files checked: {len(EXPECTED_COMPANION_FILES)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
